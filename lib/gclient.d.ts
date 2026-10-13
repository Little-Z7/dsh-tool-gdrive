import type { GDriveAuth } from './auth.js';
import { type JsonValue } from './util.js';
export interface GClientConfig {
    timeoutMs: number;
    maxChars: number;
    pageSize: number;
}
/** 净化后的文件项：null/undefined 一律剔除，保证严格 JSON。 */
export type FileItem = {
    id?: string;
    name?: string;
    mimeType?: string;
    size?: string;
    modifiedTime?: string;
    webViewLink?: string;
    trashed?: boolean;
};
export type ListResult = {
    files: FileItem[];
    nextPageToken?: string;
    hasMore: boolean;
};
export type ReadResult = {
    id: string;
    name: string;
    mimeType: string;
    kind: 'text' | 'binary-meta' | 'google-doc' | 'google-sheet-csv';
    text: string;
    truncated: boolean;
    totalChars: number;
    note?: string;
};
export declare class GClient {
    private readonly auth;
    private readonly cfg;
    constructor(auth: GDriveAuth, cfg: GClientConfig);
    private drive;
    private docs;
    private sheets;
    /** 统一调用包装：取消前置检查 + 重试（退避可取消）+ 中文错误映射。 */
    private call;
    private requestOpts;
    /** 列目录；folderId 省略时列根目录。 */
    list(args: {
        folderId?: string;
        pageToken?: string;
        pageSize?: number;
    }, signal?: AbortSignal): Promise<ListResult>;
    /** 搜索：keyword 同时匹配文件名与全文；可叠加 mimeType / folderId 过滤。 */
    search(args: {
        keyword?: string;
        mimeType?: string;
        folderId?: string;
        pageToken?: string;
        pageSize?: number;
    }, signal?: AbortSignal): Promise<ListResult>;
    /** 取单个文件的元数据（含 shortcut 目标）。 */
    get(fileId: string, signal?: AbortSignal): Promise<Record<string, JsonValue>>;
    /** 读取文件内容：Google 文档导出纯文本；表格导出 CSV（仅首个工作表）；二进制只回元数据。 */
    read(fileId: string, maxChars?: number, signal?: AbortSignal): Promise<ReadResult>;
    /** 上传 / 新建：content 直传文本，localPath 传本地文件，mimeType 为 folder 时建文件夹。 */
    upload(args: {
        name: string;
        parentId?: string;
        mimeType?: string;
        content?: string;
        localPath?: string;
    }, signal?: AbortSignal): Promise<Record<string, JsonValue>>;
    /** 更新：改内容 / 改名 / 移动 / 软删（trashed）。 */
    update(args: {
        fileId: string;
        name?: string;
        content?: string;
        localPath?: string;
        mimeType?: string;
        addParents?: string;
        removeParents?: string;
        trashed?: boolean;
    }, signal?: AbortSignal): Promise<Record<string, JsonValue>>;
    /** 多标签页文档探测：写操作 fail-fast，读操作返回提示。 */
    private docTabCount;
    private assertSingleTab;
    /** 读取 Google 文档正文（含表格与脚注文本），按 maxChars 截断；多标签页文档只读第一个并提示。 */
    docsRead(documentId: string, maxChars?: number, signal?: AbortSignal): Promise<Record<string, JsonValue>>;
    /** 在 Google 文档正文末尾追加文本。 */
    docsAppend(documentId: string, text: string, signal?: AbortSignal): Promise<Record<string, JsonValue>>;
    /** 全文替换 Google 文档正文（保留文末换行符约束）。 */
    docsReplace(documentId: string, text: string, signal?: AbortSignal): Promise<Record<string, JsonValue>>;
    /** 表格元数据：工作表清单与尺寸。 */
    sheetsMeta(spreadsheetId: string, signal?: AbortSignal): Promise<Record<string, JsonValue>>;
    /** 按 A1 范围读取单元格。 */
    sheetsRead(spreadsheetId: string, range: string, signal?: AbortSignal): Promise<Record<string, JsonValue>>;
    /** 按 A1 范围覆盖写入单元格（USER_ENTERED 解析）。 */
    sheetsWrite(spreadsheetId: string, range: string, values: JsonValue[][], signal?: AbortSignal): Promise<Record<string, JsonValue>>;
    /** 在表格末尾追加行。 */
    sheetsAppend(spreadsheetId: string, range: string, values: JsonValue[][], signal?: AbortSignal): Promise<Record<string, JsonValue>>;
}
