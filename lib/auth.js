/**
 * OAuth 授权向导：本地回环回调收 code（state 防注入）、token 原子落盘（0600）、自动刷新、scope 与 mode 一致性校验。
 * @module dsh-tool-gdrive/auth
 */
import crypto from 'node:crypto';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promises as fsp } from 'node:fs';
import { OAuth2Client } from 'google-auth-library';
import { GDriveError } from './util.js';
/**
 * 各档 mode 对应的 OAuth scope。
 * - readonly：全部只读。
 * - readwrite：Drive 全量读 + 本插件创建文件可写（drive.file）+ Docs/Sheets 内容可写。
 * - full：Drive 全量读写（restricted scope，自建 GCP 项目测试态可用，授权页会有未验证警告）。
 */
export function scopesForMode(mode) {
    switch (mode) {
        case 'readonly':
            return [
                'https://www.googleapis.com/auth/drive.metadata.readonly',
                'https://www.googleapis.com/auth/drive.readonly',
                'https://www.googleapis.com/auth/documents.readonly',
                'https://www.googleapis.com/auth/spreadsheets.readonly'
            ];
        case 'readwrite':
            return [
                'https://www.googleapis.com/auth/drive.readonly',
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/documents',
                'https://www.googleapis.com/auth/spreadsheets'
            ];
        case 'full':
            return [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/documents',
                'https://www.googleapis.com/auth/spreadsheets'
            ];
    }
}
/**
 * scope 蕴含关系：key 被 value 中任一 scope 覆盖。
 * 用于 mode 收窄（如 full → readonly）时避免误判需重新授权。
 * 注意：drive.file 不蕴含 drive.readonly（仅见本应用创建/打开的文件），不在表中。
 */
const IMPLIED_BY = {
    'https://www.googleapis.com/auth/drive.metadata.readonly': [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive'
    ],
    'https://www.googleapis.com/auth/drive.readonly': ['https://www.googleapis.com/auth/drive'],
    'https://www.googleapis.com/auth/documents.readonly': ['https://www.googleapis.com/auth/documents'],
    'https://www.googleapis.com/auth/spreadsheets.readonly': ['https://www.googleapis.com/auth/spreadsheets']
};
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;
const ONLINE_CHECK_TIMEOUT_MS = 15_000;
const CALLBACK_PATH = '/oauth2callback';
export function defaultTokenPath() {
    return path.join(os.homedir(), '.config', 'dsh', 'gdrive-tokens.json');
}
export class GDriveAuth {
    cfg;
    tokens = null;
    loaded = false;
    pending = null;
    inflight = null;
    constructor(cfg) {
        this.cfg = cfg;
    }
    /** 是否已配置 GCP OAuth 凭证（区别于是否已授权）。 */
    get configured() {
        return Boolean(this.cfg.clientId && this.cfg.clientSecret);
    }
    assertConfigured() {
        if (!this.configured)
            throw new GDriveError('缺少 GCP OAuth 凭证（clientId / clientSecret）', '在「插件 → dsh-tool-gdrive → 配置」页填写并保存，或写入 profile 的 cordis.patch.yml');
    }
    newClient(redirectUri, opts = {}) {
        return new OAuth2Client({
            clientId: this.cfg.clientId,
            clientSecret: this.cfg.clientSecret,
            redirectUri,
            transporterOptions: { timeout: ONLINE_CHECK_TIMEOUT_MS, ...(opts.signal ? { signal: opts.signal } : {}) }
        });
    }
    async load() {
        if (this.loaded)
            return;
        this.loaded = true;
        try {
            const raw = await fsp.readFile(this.cfg.tokenPath, 'utf8');
            this.tokens = JSON.parse(raw);
        }
        catch {
            this.tokens = null;
        }
    }
    /** 先写盘（临时文件 + chmod + 原子 rename）再提交内存，失败不产生不一致状态。 */
    async save(tokens) {
        const merged = { ...this.tokens, ...tokens };
        await fsp.mkdir(path.dirname(this.cfg.tokenPath), { recursive: true });
        const tmp = `${this.cfg.tokenPath}.tmp-${process.pid}`;
        try {
            await fsp.writeFile(tmp, JSON.stringify(merged, null, 2), { mode: 0o600 });
            await fsp.chmod(tmp, 0o600);
            await fsp.rename(tmp, this.cfg.tokenPath);
        }
        catch (err) {
            await fsp.unlink(tmp).catch(() => undefined);
            throw err;
        }
        this.tokens = merged;
    }
    /**
     * 已授权 scope 是否覆盖当前 mode 所需（按蕴含关系判断）。
     * scope 未知时 fail-closed：视为不匹配，走重新授权指引。
     */
    scopeMismatch() {
        const granted = (this.tokens?.scope ?? '').split(/\s+/).filter(Boolean);
        if (granted.length === 0)
            return [...this.cfg.scopes];
        return this.cfg.scopes.filter((s) => !granted.includes(s) && !(IMPLIED_BY[s] ?? []).some((g) => granted.includes(g)));
    }
    /** 取得可用 OAuth2Client；未授权 / scope 不匹配时抛出带中文指引的错误。 */
    async ensureClient(opts = {}) {
        await this.load();
        if (!this.tokens?.refresh_token && !this.tokens?.access_token) {
            if (this.pending)
                throw new GDriveError('授权流程进行中，尚未完成', `在浏览器打开授权链接完成登录：${this.pending.authUrl}`);
            throw new GDriveError('尚未授权 Google 账号', '先调用 gdrive_auth_start 获取授权链接，在浏览器完成登录');
        }
        const missing = this.scopeMismatch();
        if (missing.length > 0)
            throw new GDriveError(`当前 token 的授权范围与插件 mode 不匹配（缺少 ${missing.length} 个 scope）`, `删除 token 文件 ${this.cfg.tokenPath} 后重新调用 gdrive_auth_start 授权`);
        const client = this.newClient(undefined, opts);
        client.setCredentials(this.tokens);
        client.on('tokens', (t) => {
            void this.save(t).catch(() => undefined);
        });
        return client;
    }
    /** 启动授权流程：返回授权 URL，本地回调服务后台等待 code；进行中/启动中的流程被复用，无竞态。 */
    async startAuth() {
        this.assertConfigured();
        if (this.pending) {
            const left = Math.max(0, Math.round((AUTH_TIMEOUT_MS - (Date.now() - this.pending.startedAt)) / 1000));
            return { authUrl: this.pending.authUrl, port: this.pending.port, expiresInSec: left };
        }
        // ??= 的检查与赋值在同一同步段，并发调用必然复用同一 promise
        this.inflight ??= this.startAuthInner().finally(() => {
            this.inflight = null;
        });
        return this.inflight;
    }
    async startAuthInner() {
        let lastErr;
        for (let offset = 0; offset < 3; offset++) {
            const port = this.cfg.port + offset;
            try {
                return await this.listen(port);
            }
            catch (err) {
                lastErr = err;
                if (err?.code !== 'EADDRINUSE')
                    break;
            }
        }
        const code = lastErr?.code;
        const msg = lastErr instanceof Error ? `${lastErr.name}: ${lastErr.message}` : String(lastErr);
        throw new GDriveError(`本地回调端口不可用（最后错误：${code ? `${code}：` : ''}${msg}）`, '若提示 EADDRINUSE 请把插件配置 port 改成其他值；若端口越界请改为 0~65535');
    }
    listen(port) {
        return new Promise((resolve, reject) => {
            const redirectUri = `http://127.0.0.1:${port}${CALLBACK_PATH}`;
            const state = crypto.randomBytes(16).toString('base64url');
            const server = http.createServer((req, res) => {
                void (async () => {
                    try {
                        const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
                        if (url.pathname !== CALLBACK_PATH) {
                            res.writeHead(404);
                            res.end('Not Found');
                            return;
                        }
                        // state 不匹配：可能是注入/误触，只回 400 并保持流程存活
                        if (url.searchParams.get('state') !== state) {
                            res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' });
                            res.end('<h3>state 校验失败</h3><p>该请求不是本次授权流程的合法回调。</p>');
                            return;
                        }
                        const error = url.searchParams.get('error');
                        const code = url.searchParams.get('code');
                        if (error || !code) {
                            res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' });
                            res.end('<h3>授权未完成</h3><p>可以关闭此页面，回到对话重新调用 gdrive_auth_start。</p>');
                            this.closePending();
                            return;
                        }
                        const { tokens } = await this.newClient(redirectUri).getToken(code);
                        await this.save(tokens);
                        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
                        res.end('<h3>授权完成</h3><p>可以关闭此页面，回到对话继续。</p>');
                        this.closePending();
                    }
                    catch {
                        try {
                            res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' });
                            res.end('<h3>授权失败</h3><p>code 交换 token 出错，请回到对话重新调用 gdrive_auth_start。</p>');
                        }
                        finally {
                            this.closePending();
                        }
                    }
                })();
            });
            server.once('error', reject);
            server.listen(port, '127.0.0.1', () => {
                // listen 成功：移除启动期 error 处理器，换常驻兜底防止运行期 error 变 unhandled
                server.removeListener('error', reject);
                server.on('error', (e) => console.warn('[gdrive] 授权回调服务运行期错误：', e));
                const authUrl = this.newClient(redirectUri).generateAuthUrl({
                    access_type: 'offline',
                    prompt: 'consent',
                    scope: this.cfg.scopes,
                    redirect_uri: redirectUri,
                    state
                });
                const timer = setTimeout(() => this.closePending(), AUTH_TIMEOUT_MS);
                this.pending = { server, port, authUrl, startedAt: Date.now(), timer };
                resolve({ authUrl, port, expiresInSec: AUTH_TIMEOUT_MS / 1000 });
            });
        });
    }
    closePending() {
        if (!this.pending)
            return;
        clearTimeout(this.pending.timer);
        try {
            this.pending.server.close();
        }
        catch {
            /* 忽略关闭异常 */
        }
        this.pending = null;
    }
    /** 授权状态；在线核验失败不影响本地状态结论。 */
    async status(signal) {
        if (!this.configured) {
            return {
                status: 'no_token',
                authorized: false,
                configured: false,
                hint: '缺少 clientId/clientSecret：在「插件 → dsh-tool-gdrive → 配置」页填写并保存'
            };
        }
        await this.load();
        if (this.pending) {
            return {
                status: 'pending',
                authorized: false,
                configured: true,
                authUrl: this.pending.authUrl,
                expiresInSec: Math.max(0, Math.round((AUTH_TIMEOUT_MS - (Date.now() - this.pending.startedAt)) / 1000)),
                hint: '在浏览器打开 authUrl 完成登录后，再调用 gdrive_auth_status 确认'
            };
        }
        if (!this.tokens?.refresh_token && !this.tokens?.access_token) {
            return { status: 'no_token', authorized: false, configured: true, hint: '调用 gdrive_auth_start 开始授权' };
        }
        const out = {
            status: 'authorized',
            authorized: true,
            configured: true,
            tokenPath: this.cfg.tokenPath
        };
        if (this.tokens.scope)
            out.scope = this.tokens.scope;
        if (this.tokens.expiry_date)
            out.expiryDate = new Date(this.tokens.expiry_date).toISOString();
        const missing = this.scopeMismatch();
        if (missing.length > 0) {
            out.scopeMismatch = true;
            out.missingScopes = missing;
            out.hint = `mode 与授权范围不匹配：删除 ${this.cfg.tokenPath} 后重新 gdrive_auth_start`;
        }
        try {
            signal?.throwIfAborted();
            const client = await this.ensureClient({ signal });
            const access = await client.getAccessToken();
            if (access.token) {
                const info = await client.getTokenInfo(access.token);
                if (info.scopes?.length)
                    out.scope = info.scopes.join(' ');
                if (info.expiry_date)
                    out.expiryDate = new Date(info.expiry_date).toISOString();
            }
        }
        catch {
            out.onlineCheck = 'failed';
        }
        return out;
    }
    dispose() {
        this.closePending();
    }
}
//# sourceMappingURL=auth.js.map