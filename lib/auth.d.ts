import { OAuth2Client } from 'google-auth-library';
import { type JsonValue } from './util.js';
export type AuthMode = 'readonly' | 'readwrite' | 'full';
/**
 * 各档 mode 对应的 OAuth scope。
 * - readonly：全部只读。
 * - readwrite：Drive 全量读 + 本插件创建文件可写（drive.file）+ Docs/Sheets 内容可写。
 * - full：Drive 全量读写（restricted scope，自建 GCP 项目测试态可用，授权页会有未验证警告）。
 */
export declare function scopesForMode(mode: AuthMode): string[];
export interface AuthConfig {
    clientId?: string;
    clientSecret?: string;
    port: number;
    tokenPath: string;
    scopes: string[];
}
export declare function defaultTokenPath(): string;
export declare class GDriveAuth {
    private readonly cfg;
    private tokens;
    private loaded;
    private pending;
    private inflight;
    constructor(cfg: AuthConfig);
    /** 是否已配置 GCP OAuth 凭证（区别于是否已授权）。 */
    get configured(): boolean;
    private assertConfigured;
    private newClient;
    private load;
    /** 先写盘（临时文件 + chmod + 原子 rename）再提交内存，失败不产生不一致状态。 */
    private save;
    /**
     * 已授权 scope 是否覆盖当前 mode 所需（按蕴含关系判断）。
     * scope 未知时 fail-closed：视为不匹配，走重新授权指引。
     */
    private scopeMismatch;
    /** 取得可用 OAuth2Client；未授权 / scope 不匹配时抛出带中文指引的错误。 */
    ensureClient(opts?: {
        signal?: AbortSignal;
    }): Promise<OAuth2Client>;
    /** 启动授权流程：返回授权 URL，本地回调服务后台等待 code；凭证未变时复用进行中的流程。 */
    startAuth(): Promise<{
        authUrl: string;
        port: number;
        expiresInSec: number;
    }>;
    private startAuthInner;
    private listen;
    private closePending;
    /** 授权状态；在线核验失败不影响本地状态结论。 */
    status(signal?: AbortSignal): Promise<Record<string, JsonValue>>;
    dispose(): void;
}
