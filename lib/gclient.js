/**
 * Drive / Docs / Sheets API 封装：统一重试、取消、中文错误、分页与截断。
 * @module dsh-tool-gdrive/gclient
 */
import { createReadStream } from 'node:fs';
import { google } from 'googleapis';
import { GDriveError, abortable, escapeQ, isTextualMime, mapGoogleError, truncateText, withRetry } from './util.js';
const FIELDS_BASIC = 'id,name,mimeType,size,modifiedTime,createdTime,parents,webViewLink,trashed';
const FIELDS_LIST = `nextPageToken, files(${FIELDS_BASIC})`;
const FIELDS_META = 'id,name,mimeType,size,modifiedTime,createdTime,parents,webViewLink,trashed,description,starred,owners(displayName,emailAddress),shortcutDetails(targetId,targetMimeType)';
const MIME_FOLDER = 'application/vnd.google-apps.folder';
const MIME_SHORTCUT = 'application/vnd.google-apps.shortcut';
const MIME_DOC = 'application/vnd.google-apps.document';
const MIME_SHEET = 'application/vnd.google-apps.spreadsheet';
const MIME_SLIDES = 'application/vnd.google-apps.presentation';
function cleanFile(f) {
    const out = {};
    if (f.id != null)
        out.id = f.id;
    if (f.name != null)
        out.name = f.name;
    if (f.mimeType != null)
        out.mimeType = f.mimeType;
    if (f.size != null)
        out.size = f.size;
    if (f.modifiedTime != null)
        out.modifiedTime = f.modifiedTime;
    if (f.webViewLink != null)
        out.webViewLink = f.webViewLink;
    if (f.trashed != null)
        out.trashed = f.trashed;
    return out;
}
function cleanFiles(files) {
    return (files ?? []).map(cleanFile);
}
export class GClient {
    auth;
    cfg;
    constructor(auth, cfg) {
        this.auth = auth;
        this.cfg = cfg;
    }
    async drive() {
        return google.drive({ version: 'v3', auth: await this.auth.ensureClient() });
    }
    async docs() {
        return google.docs({ version: 'v1', auth: await this.auth.ensureClient() });
    }
    async sheets() {
        return google.sheets({ version: 'v4', auth: await this.auth.ensureClient() });
    }
    /** 统一调用包装：取消前置检查 + 重试（退避可取消）+ 中文错误映射。 */
    async call(fn, signal) {
        try {
            signal?.throwIfAborted();
            return await abortable(withRetry(fn, 3, signal), signal);
        }
        catch (err) {
            throw mapGoogleError(err);
        }
    }
    requestOpts(signal) {
        return { timeout: this.cfg.timeoutMs, ...(signal ? { signal } : {}) };
    }
    /** 列目录；folderId 省略时列根目录。 */
    async list(args, signal) {
        const drive = await this.drive();
        const parent = args.folderId ? `'${escapeQ(args.folderId)}' in parents` : `'root' in parents`;
        const res = await this.call(() => drive.files.list({
            q: `${parent} and trashed = false`,
            fields: FIELDS_LIST,
            pageSize: args.pageSize ?? this.cfg.pageSize,
            pageToken: args.pageToken,
            orderBy: 'modifiedTime desc',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        }, this.requestOpts(signal)), signal);
        const files = cleanFiles(res.data.files);
        return listResult(files, res.data.nextPageToken);
    }
    /** 搜索：keyword 同时匹配文件名与全文；可叠加 mimeType / folderId 过滤。 */
    async search(args, signal) {
        const drive = await this.drive();
        const parts = ['trashed = false'];
        if (args.keyword) {
            const k = escapeQ(args.keyword);
            parts.push(`(name contains '${k}' or fullText contains '${k}')`);
        }
        if (args.mimeType)
            parts.push(`mimeType = '${escapeQ(args.mimeType)}'`);
        if (args.folderId)
            parts.push(`'${escapeQ(args.folderId)}' in parents`);
        const res = await this.call(() => drive.files.list({
            q: parts.join(' and '),
            fields: FIELDS_LIST,
            pageSize: args.pageSize ?? this.cfg.pageSize,
            pageToken: args.pageToken,
            orderBy: 'modifiedTime desc',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        }, this.requestOpts(signal)), signal);
        const files = cleanFiles(res.data.files);
        return listResult(files, res.data.nextPageToken);
    }
    /** 取单个文件的元数据（含 shortcut 目标）。 */
    async get(fileId, signal) {
        const drive = await this.drive();
        const res = await this.call(() => drive.files.get({ fileId, fields: FIELDS_META, supportsAllDrives: true }, this.requestOpts(signal)), signal);
        return res.data;
    }
    /** 读取文件内容：Google 文档导出纯文本；表格导出 CSV（仅首个工作表）；二进制只回元数据。 */
    async read(fileId, maxChars, signal) {
        const limit = maxChars ?? this.cfg.maxChars;
        const drive = await this.drive();
        let meta = await this.call(() => drive.files.get({ fileId, fields: 'id,name,mimeType,size,shortcutDetails(targetId,targetMimeType)', supportsAllDrives: true }, this.requestOpts(signal)), signal);
        // 快捷方式解析一层
        if (meta.data.mimeType === MIME_SHORTCUT && meta.data.shortcutDetails?.targetId) {
            fileId = meta.data.shortcutDetails.targetId;
            meta = await this.call(() => drive.files.get({ fileId, fields: 'id,name,mimeType,size', supportsAllDrives: true }, this.requestOpts(signal)), signal);
        }
        const mimeType = meta.data.mimeType ?? 'application/octet-stream';
        const name = meta.data.name ?? fileId;
        if (mimeType === MIME_FOLDER)
            throw new GDriveError('目标是文件夹，无法读取内容', '用 gdrive_list 列出其内容');
        let data;
        let kind = 'text';
        let note;
        let partial = false;
        let byteSize;
        if (mimeType === MIME_DOC || mimeType === MIME_SLIDES) {
            kind = 'google-doc';
            const res = await this.call(() => drive.files.export({ fileId, mimeType: 'text/plain' }, { ...this.requestOpts(signal), responseType: 'arraybuffer' }), signal);
            data = res.data;
        }
        else if (mimeType === MIME_SHEET) {
            kind = 'google-sheet-csv';
            note = '表格按 CSV 导出（仅首个工作表）；按范围读取请用 gdrive_sheets';
            const res = await this.call(() => drive.files.export({ fileId, mimeType: 'text/csv' }, { ...this.requestOpts(signal), responseType: 'arraybuffer' }), signal);
            data = res.data;
        }
        else if (isTextualMime(mimeType)) {
            // Range 预算按 UTF-8 最坏 4 字节/字符放大；用 Content-Range 头判定是否真截断
            // （Google 对 Range 请求恒回 206，即使整个文件都在返回范围内，不能只看状态码）
            const res = await this.call(() => drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { ...this.requestOpts(signal), responseType: 'arraybuffer', headers: { Range: `bytes=0-${limit * 4 - 1}` } }), signal);
            data = res.data;
            byteSize = meta.data.size ? Number(meta.data.size) : undefined;
            partial = computePartial(res.status, res.headers?.['content-range'], typeof res.data === 'string' ? Buffer.byteLength(res.data) : res.data.byteLength, byteSize);
        }
        else {
            const size = meta.data.size ? Number(meta.data.size) : undefined;
            return {
                id: fileId,
                name,
                mimeType,
                kind: 'binary-meta',
                text: '',
                truncated: false,
                totalChars: 0,
                note: `二进制文件不读取内容${size !== undefined ? `（大小 ${size} 字节）` : ''}；可先用 gdrive_get 查看元数据`
            };
        }
        const text = typeof data === 'string' ? data : Buffer.from(data).toString('utf8');
        const t = truncateText(text, limit);
        if (partial) {
            // 只拿到开头一块：truncated 必为真；totalChars 仅是已下载块的字符数，文件总量用字节数提示
            return {
                id: fileId,
                name,
                mimeType,
                kind,
                text: t.text,
                truncated: true,
                totalChars: t.totalChars,
                note: `${note ? `${note}；` : ''}文件较大${byteSize !== undefined ? `（共约 ${byteSize} 字节）` : ''}，仅返回开头部分，totalChars 为已下载块的字符数`
            };
        }
        return { id: fileId, name, mimeType, kind, text: t.text, truncated: t.truncated, totalChars: t.totalChars, ...(note ? { note } : {}) };
    }
    /** 上传 / 新建：content 直传文本，localPath 传本地文件，mimeType 为 folder 时建文件夹。 */
    async upload(args, signal) {
        if (!args.name || args.name.trim() === '')
            throw new GDriveError('文件名不能为空', 'name 需要是非空字符串');
        if (args.parentId !== undefined && args.parentId.trim() === '')
            throw new GDriveError('parentId 不能为空字符串', '省略 parentId 则上传到根目录');
        const drive = await this.drive();
        const requestBody = { name: args.name, parents: args.parentId ? [args.parentId] : undefined };
        let media;
        // Google 工作区类型（document/spreadsheet/presentation）：mimeType 必须放在元数据上才会「上传即转换」，
        // 只放在 media 上会落成一个 octet-stream 二进制文件
        const isGoogleType = args.mimeType !== undefined && args.mimeType.startsWith('application/vnd.google-apps.') && args.mimeType !== MIME_FOLDER;
        if (args.mimeType === MIME_FOLDER) {
            if (args.content !== undefined || args.localPath)
                throw new GDriveError('mimeType 为 folder 时不能同时提供 content/localPath', '新建文件夹只传 name/parentId/mimeType；上传内容请勿把 mimeType 设为 application/vnd.google-apps.folder');
            requestBody.mimeType = MIME_FOLDER;
        }
        else if (args.localPath) {
            if (args.content !== undefined)
                throw new GDriveError('content 与 localPath 互斥，只能传一个', '文本内容用 content，本地文件用 localPath');
            if (isGoogleType)
                requestBody.mimeType = args.mimeType;
            media = { mimeType: isGoogleType ? 'application/octet-stream' : (args.mimeType ?? 'application/octet-stream'), body: createReadStream(args.localPath) };
        }
        else if (args.content !== undefined) {
            if (isGoogleType) {
                requestBody.mimeType = args.mimeType;
                // 文本内容转 Google 文档/表格：Docs 按纯文本、Sheets 按 CSV 解析
                const sourceMime = args.mimeType === MIME_SHEET ? 'text/csv' : 'text/plain';
                media = { mimeType: sourceMime, body: args.content };
            }
            else {
                media = { mimeType: args.mimeType ?? 'text/plain; charset=utf-8', body: args.content };
            }
        }
        else {
            throw new GDriveError('upload 需要 content（文本）或 localPath（本地文件路径）之一', '新建文件夹请把 mimeType 设为 application/vnd.google-apps.folder');
        }
        const res = await this.call(() => drive.files.create({ requestBody, media, fields: FIELDS_BASIC, supportsAllDrives: true }, this.requestOpts(signal)), signal);
        return res.data;
    }
    /** 更新：改内容 / 改名 / 移动 / 软删（trashed）。 */
    async update(args, signal) {
        const drive = await this.drive();
        const requestBody = {};
        if (args.name !== undefined) {
            if (args.name.trim() === '')
                throw new GDriveError('文件名不能为空', 'name 需要是非空字符串');
            requestBody.name = args.name;
        }
        if (args.trashed !== undefined)
            requestBody.trashed = args.trashed;
        let media;
        if (args.localPath)
            media = { mimeType: args.mimeType ?? 'application/octet-stream', body: createReadStream(args.localPath) };
        else if (args.content !== undefined)
            media = { mimeType: args.mimeType ?? 'text/plain; charset=utf-8', body: args.content };
        if (Object.keys(requestBody).length === 0 && !media && !args.addParents && !args.removeParents)
            throw new GDriveError('update 没有要执行的修改', '至少提供 name / content / localPath / addParents / removeParents / trashed 之一');
        const res = await this.call(() => drive.files.update({
            fileId: args.fileId,
            requestBody,
            media,
            addParents: args.addParents,
            removeParents: args.removeParents,
            fields: FIELDS_BASIC,
            supportsAllDrives: true
        }, this.requestOpts(signal)), signal);
        return res.data;
    }
    /** 多标签页文档探测：写操作 fail-fast，读操作返回提示。 */
    async docTabCount(docs, documentId, signal) {
        const res = await this.call(() => docs.documents.get({ documentId, includeTabsContent: true, fields: 'tabs(tabProperties)' }, this.requestOpts(signal)), signal);
        return res.data.tabs?.length ?? 0;
    }
    async assertSingleTab(docs, documentId, op, signal) {
        const tabs = await this.docTabCount(docs, documentId, signal);
        if (tabs > 1)
            throw new GDriveError(`该文档包含 ${tabs} 个标签页（tab），${op} 只会作用于第一个标签页，已拒绝执行`, '请先拆分文档或在网页端处理；如需指定标签页，后续版本将支持 tabId 参数');
    }
    /** 读取 Google 文档正文（含表格与脚注文本），按 maxChars 截断；多标签页文档只读第一个并提示。 */
    async docsRead(documentId, maxChars, signal) {
        const docs = await this.docs();
        const tabs = await this.docTabCount(docs, documentId, signal);
        const res = await this.call(() => docs.documents.get({ documentId }, this.requestOpts(signal)), signal);
        const doc = res.data;
        const full = extractDocText(doc);
        const t = truncateText(full, maxChars ?? this.cfg.maxChars);
        const out = { documentId, text: t.text, truncated: t.truncated, totalChars: t.totalChars };
        if (doc.title != null)
            out.title = doc.title;
        if (tabs > 1)
            out.note = `该文档包含 ${tabs} 个标签页，此处仅读取第一个标签页的内容`;
        return out;
    }
    /** 在 Google 文档正文末尾追加文本。 */
    async docsAppend(documentId, text, signal) {
        const docs = await this.docs();
        await this.assertSingleTab(docs, documentId, 'append', signal);
        await this.call(() => docs.documents.batchUpdate({ documentId, requestBody: { requests: [{ insertText: { endOfSegmentLocation: {}, text } }] } }, this.requestOpts(signal)), signal);
        return { documentId, appended: true, appendedChars: text.length };
    }
    /** 全文替换 Google 文档正文（保留文末换行符约束）。 */
    async docsReplace(documentId, text, signal) {
        const docs = await this.docs();
        await this.assertSingleTab(docs, documentId, 'replace', signal);
        const res = await this.call(() => docs.documents.get({ documentId, fields: 'body/content/endIndex' }, this.requestOpts(signal)), signal);
        const content = res.data.body?.content ?? [];
        const endIndex = content.at(-1)?.endIndex ?? 1;
        const requests = [];
        if (endIndex > 2)
            requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } });
        requests.push({ insertText: { location: { index: 1 }, text } });
        await this.call(() => docs.documents.batchUpdate({ documentId, requestBody: { requests } }, this.requestOpts(signal)), signal);
        return { documentId, replaced: true, chars: text.length };
    }
    /** 表格元数据：工作表清单与尺寸。 */
    async sheetsMeta(spreadsheetId, signal) {
        const sheets = await this.sheets();
        const res = await this.call(() => sheets.spreadsheets.get({ spreadsheetId, fields: 'spreadsheetId,properties.title,sheets.properties' }, this.requestOpts(signal)), signal);
        const data = res.data;
        const out = {
            sheets: (data.sheets ?? []).map((s) => {
                const p = s.properties ?? {};
                const o = {};
                if (p.title != null)
                    o.title = p.title;
                if (p.index != null)
                    o.index = p.index;
                if (p.gridProperties?.rowCount != null)
                    o.rowCount = p.gridProperties.rowCount;
                if (p.gridProperties?.columnCount != null)
                    o.columnCount = p.gridProperties.columnCount;
                return o;
            })
        };
        if (data.spreadsheetId != null)
            out.spreadsheetId = data.spreadsheetId;
        if (data.properties?.title != null)
            out.title = data.properties.title;
        return out;
    }
    /** 按 A1 范围读取单元格。 */
    async sheetsRead(spreadsheetId, range, signal) {
        const sheets = await this.sheets();
        const res = await this.call(() => sheets.spreadsheets.values.get({ spreadsheetId, range, majorDimension: 'ROWS' }, this.requestOpts(signal)), signal);
        const out = { values: (res.data.values ?? []), rowCount: res.data.values?.length ?? 0 };
        if (res.data.range != null)
            out.range = res.data.range;
        return out;
    }
    /** 按 A1 范围覆盖写入单元格（USER_ENTERED 解析）。 */
    async sheetsWrite(spreadsheetId, range, values, signal) {
        const sheets = await this.sheets();
        const res = await this.call(() => sheets.spreadsheets.values.update({ spreadsheetId, range, valueInputOption: 'USER_ENTERED', requestBody: { range, majorDimension: 'ROWS', values } }, this.requestOpts(signal)), signal);
        const out = {};
        if (res.data.updatedRange != null)
            out.updatedRange = res.data.updatedRange;
        if (res.data.updatedRows != null)
            out.updatedRows = res.data.updatedRows;
        if (res.data.updatedCells != null)
            out.updatedCells = res.data.updatedCells;
        return out;
    }
    /** 在表格末尾追加行。 */
    async sheetsAppend(spreadsheetId, range, values, signal) {
        const sheets = await this.sheets();
        const res = await this.call(() => sheets.spreadsheets.values.append({ spreadsheetId, range, valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS', requestBody: { range, majorDimension: 'ROWS', values } }, this.requestOpts(signal)), signal);
        const updates = res.data.updates;
        const out = {};
        if (updates?.updatedRange != null)
            out.updatedRange = updates.updatedRange;
        if (updates?.updatedRows != null)
            out.updatedRows = updates.updatedRows;
        if (updates?.updatedCells != null)
            out.updatedCells = updates.updatedCells;
        return out;
    }
}
/** 组装分页结果：无下一页时省略 nextPageToken 键（显式 undefined 过不了 harness 的无损 JSON 校验）。 */
function listResult(files, token) {
    const hasToken = token !== undefined && token !== null && token !== '';
    return hasToken ? { files, nextPageToken: token, hasMore: true } : { files, hasMore: false };
}
/**
 * 判定 Range 下载是否真的只拿到部分内容。
 * 优先解析 Content-Range（bytes 0-N/total）；缺头时回退到「已收字节数 < 文件总字节数」；
 * 无法判定时保守按部分处理。
 */
function computePartial(status, contentRange, receivedBytes, fileSize) {
    if (status !== 206)
        return false;
    if (typeof contentRange === 'string') {
        const m = /bytes\s+\d+-(\d+)\/(\d+)/.exec(contentRange);
        if (m)
            return Number(m[1]) + 1 < Number(m[2]);
    }
    if (fileSize !== undefined)
        return receivedBytes < fileSize;
    return true;
}
/** 递归提取 Google 文档正文纯文本（段落 + 表格单元格），并附脚注。目录（TOC）属导航冗余，不提取。 */
function extractDocText(doc) {
    const out = [];
    const walk = (elements) => {
        for (const el of elements ?? []) {
            if (el.paragraph)
                for (const pe of el.paragraph.elements ?? [])
                    if (pe.textRun?.content)
                        out.push(pe.textRun.content);
            if (el.table)
                for (const row of el.table.tableRows ?? [])
                    for (const cell of row.tableCells ?? [])
                        walk(cell.content);
        }
    };
    walk(doc.body?.content);
    const footnotes = Object.values(doc.footnotes ?? {});
    if (footnotes.length > 0) {
        out.push('\n[脚注]\n');
        for (const fn of footnotes)
            walk(fn.content);
    }
    return out.join('');
}
//# sourceMappingURL=gclient.js.map