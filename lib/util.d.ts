/** 尽力打开系统浏览器；失败返回 false（调用方应同时展示 URL）。 */
export declare function tryOpenBrowser(url: string): Promise<boolean>;
/**
 * 读取可能被 Volatile 装箱的配置值。
 * volatile 字段在运行期以 { get(): snapshot } 引用传递，UI 保存会就地提交；
 * 每次用 .get() 读到的都是最新值。非装箱值（普通字段/测试直传）原样返回。
 */
export declare function readV<T>(v: unknown): T;
/** 严格 JSON 值类型（本地定义，避免传递依赖）。 */
export type JsonValue = string | number | boolean | null | JsonValue[] | {
    [key: string]: JsonValue;
};
/** 插件统一错误类型；`hint` 是给模型/用户的下一步操作建议。 */
export declare class GDriveError extends Error {
    readonly hint?: string;
    constructor(message: string, hint?: string);
}
/** 把 gaxios/googleapis 的错误翻译成中文、可操作的 GDriveError。 */
export declare function mapGoogleError(err: unknown): GDriveError;
/** 对 429/5xx/网络抖动做指数退避重试，最多 3 次；退避期响应取消，定时器不阻塞进程退出。 */
export declare function withRetry<T>(fn: () => Promise<T>, retries?: number, signal?: AbortSignal): Promise<T>;
/** 让任意 Promise 响应 AbortSignal：signal 触发时以“操作已取消”拒绝。 */
export declare function abortable<T>(p: Promise<T>, signal?: AbortSignal): Promise<T>;
export interface TruncatedText {
    text: string;
    truncated: boolean;
    totalChars: number;
}
export declare function truncateText(text: string, maxChars: number): TruncatedText;
/** 转义 Drive q 查询语法中的反斜杠与单引号。 */
export declare function escapeQ(value: string): string;
/** 常见文本型 mimeType 判定，决定能否按文本读取。 */
export declare function isTextualMime(mimeType: string): boolean;
