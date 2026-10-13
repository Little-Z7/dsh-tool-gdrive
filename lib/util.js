/**
 * 共享工具：中文可操作错误、限流重试、AbortSignal 响应、文本截断、Drive 查询转义。
 * @module dsh-tool-gdrive/util
 */
/** 插件统一错误类型；`hint` 是给模型/用户的下一步操作建议。 */
export class GDriveError extends Error {
    hint;
    constructor(message, hint) {
        super(message);
        this.name = 'GDriveError';
        this.hint = hint;
    }
}
/** 把 gaxios/googleapis 的错误翻译成中文、可操作的 GDriveError。 */
export function mapGoogleError(err) {
    if (err instanceof GDriveError)
        return err;
    const e = (err ?? {});
    const status = typeof e.code === 'number' ? e.code : e.response?.status;
    const reason = e.errors?.[0]?.reason;
    const raw = e.errors?.[0]?.message ?? e.message ?? String(err);
    switch (status) {
        case 400:
            return new GDriveError(`请求参数有误：${raw}`, '检查文件 ID、range（形如 Sheet1!A1:D10）等参数格式');
        case 401:
            return new GDriveError('访问令牌已失效且自动刷新失败', '调用 gdrive_auth_status 查看状态，必要时重新调用 gdrive_auth_start 授权');
        case 403:
            if (reason === 'insufficientPermissions')
                return new GDriveError('当前授权的 scope 不足以执行该操作', '把插件配置 mode 改为 readwrite（写本插件创建的文件）或 full（写全部文件），删除旧 token 后重新 gdrive_auth_start 授权');
            if (reason === 'userRateLimitExceeded' || reason === 'rateLimitExceeded' || reason === 'dailyLimitExceeded')
                return new GDriveError('触发 Google API 限流', '稍等片刻后重试');
            return new GDriveError(`没有权限访问该资源：${raw}`, '确认文件已共享给当前授权账号；共享盘文件需账号有访问权限');
        case 404:
            return new GDriveError('文件不存在或未被共享给当前账号', '检查文件 ID 是否正确');
        case 409:
            return new GDriveError(`操作冲突：${raw}`);
        default:
            if (status !== undefined && status >= 500)
                return new GDriveError(`Google 服务端错误（${status}）`, '稍后重试');
            return new GDriveError(`请求失败：${raw}`);
    }
}
function isRetryable(err) {
    const code = err?.code;
    return code === 429 || code === 500 || code === 502 || code === 503 || code === 504 || code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'EAI_AGAIN';
}
/** 对 429/5xx/网络抖动做指数退避重试，最多 3 次；退避期响应取消，定时器不阻塞进程退出。 */
export async function withRetry(fn, retries = 3, signal) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            lastErr = err;
            if (attempt === retries || !isRetryable(err))
                break;
            const delay = 500 * 2 ** attempt + Math.floor(Math.random() * 200);
            await abortable(new Promise((r) => {
                const t = setTimeout(r, delay);
                t.unref?.();
            }), signal);
        }
    }
    throw lastErr;
}
/** 让任意 Promise 响应 AbortSignal：signal 触发时以“操作已取消”拒绝。 */
export function abortable(p, signal) {
    if (!signal)
        return p;
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            // 消费底层 Promise 的拒绝，避免 unhandledRejection 崩掉宿主进程
            p.then(undefined, () => { });
            reject(new GDriveError('操作已取消'));
            return;
        }
        const onAbort = () => reject(new GDriveError('操作已取消'));
        signal.addEventListener('abort', onAbort, { once: true });
        p.then((v) => {
            signal.removeEventListener('abort', onAbort);
            resolve(v);
        }, (e) => {
            signal.removeEventListener('abort', onAbort);
            reject(e);
        });
    });
}
export function truncateText(text, maxChars) {
    const totalChars = text.length;
    if (totalChars <= maxChars)
        return { text, truncated: false, totalChars };
    return { text: text.slice(0, maxChars), truncated: true, totalChars };
}
/** 转义 Drive q 查询语法中的反斜杠与单引号。 */
export function escapeQ(value) {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
/** 常见文本型 mimeType 判定，决定能否按文本读取。 */
export function isTextualMime(mimeType) {
    return (mimeType.startsWith('text/') ||
        mimeType === 'application/json' ||
        mimeType === 'application/xml' ||
        mimeType === 'application/javascript' ||
        mimeType === 'application/x-yaml' ||
        mimeType === 'application/yaml' ||
        mimeType === 'application/toml' ||
        mimeType === 'application/x-sh' ||
        mimeType.endsWith('+json') ||
        mimeType.endsWith('+xml'));
}
//# sourceMappingURL=util.js.map