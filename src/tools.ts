/**
 * 10 个模型可见工具：授权向导（status/start）、目录与搜索、元数据、读取、上传、更新、Docs、Sheets。
 * @module dsh-tool-gdrive/tools
 */
import { exec as execChild } from 'node:child_process'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { AuthMode, GDriveAuth } from './auth.js'
import type { GClient } from './gclient.js'
import { GDriveError, type JsonValue } from './util.js'

export interface ToolsDeps {
	auth: GDriveAuth
	client: GClient
	cfg: { mode: AuthMode; pageSize: number; maxChars: number }
}

const fileItemSchema = {
	type: 'object',
	additionalProperties: true,
	properties: {
		id: { type: 'string' },
		name: { type: 'string' },
		mimeType: { type: 'string' },
		size: { type: 'string' },
		modifiedTime: { type: 'string' },
		webViewLink: { type: 'string' },
		trashed: { type: 'boolean' }
	}
} as const

const listOutputSchema = {
	type: 'object',
	additionalProperties: true,
	properties: {
		files: { type: 'array', items: fileItemSchema },
		nextPageToken: { type: 'string', description: '存在时说明还有下一页，原样传回 pageToken 继续翻页' },
		hasMore: { type: 'boolean' }
	}
} as const

function shortMime(mimeType?: string | null): string {
	switch (mimeType) {
		case 'application/vnd.google-apps.folder': return '文件夹'
		case 'application/vnd.google-apps.document': return '文档'
		case 'application/vnd.google-apps.spreadsheet': return '表格'
		case 'application/vnd.google-apps.presentation': return '幻灯片'
		case 'application/vnd.google-apps.shortcut': return '快捷方式'
		default: return mimeType ?? '未知'
	}
}

function renderFileList(v: {
	files?: { id?: string; name?: string; mimeType?: string; modifiedTime?: string }[]
	nextPageToken?: string
	hasMore?: boolean
}): string {
	const files = v.files ?? []
	const lines = files.map((f) => `- [${shortMime(f.mimeType)}] ${f.name ?? f.id ?? '(未命名)'}　id=${f.id ?? '?'}${f.modifiedTime ? `　${f.modifiedTime.slice(0, 10)}` : ''}`)
	const more = v.hasMore === true ? `\n还有下一页，调用时传 pageToken=${v.nextPageToken}` : ''
	return `共 ${files.length} 项${more}\n${lines.join('\n')}`
}

/** 只读模式下拒绝写操作，并给出切换指引。 */
function assertWritable(mode: AuthMode): void {
	if (mode === 'readonly')
		throw new GDriveError(
			'当前为只读模式（mode=readonly），写入被拒绝',
			'把插件配置 mode 改为 readwrite（写本插件创建的文件）或 full（写全部文件），删除 token 文件后重新 gdrive_auth_start 授权'
		)
}

function tryOpenBrowser(url: string): Promise<boolean> {
	const cmd = process.platform === 'darwin' ? `open "${url}"` : process.platform === 'win32' ? `cmd /c start "" "${url}"` : `xdg-open "${url}"`
	return new Promise((resolve) => {
		execChild(cmd, (err) => resolve(!err))
	})
}

/** null/undefined 统一剔除，保证输出是严格 JSON。 */
function pickMeta(data: Record<string, JsonValue>): Record<string, JsonValue> {
	const keys = ['id', 'name', 'mimeType', 'size', 'modifiedTime', 'createdTime', 'parents', 'webViewLink', 'trashed', 'description', 'starred', 'owners']
	const out: Record<string, JsonValue> = {}
	for (const k of keys) {
		const v = data[k]
		if (v !== null && v !== undefined) out[k] = v
	}
	return out
}

export function createTools(deps: ToolsDeps) {
	const { auth, client, cfg } = deps
	const timeoutMs = 60_000

	return [
		defineTool({
			name: 'gdrive_auth_status',
			description: '查看 Google 云端硬盘授权状态：是否已授权、授权范围、过期时间；授权流程进行中时返回授权链接。',
			parameters: {},
			output: {
				schema: {
					type: 'object',
					additionalProperties: true,
					properties: {
						authorized: { type: 'boolean' },
						status: { type: 'string', enum: ['authorized', 'pending', 'no_token'] },
						hint: { type: 'string' }
					}
				},
				render: (_args, v) => {
					if (v.authorized) {
						if (v.scopeMismatch === true)
							return [
								{
									type: 'text',
									text: `已授权但与当前 mode 的授权范围不匹配（缺少：${((v.missingScopes as string[] | undefined) ?? []).join(' ') || '未知'}），后续 gdrive 工具会调用失败。${v.hint ?? '请删除 token 文件后重新调用 gdrive_auth_start。'}`
								}
							]
						const online = v.onlineCheck === 'failed' ? '\n注意：在线核验失败，以上 scope/过期时间来自本地 token，可能已失效。' : ''
						return [{ type: 'text', text: `已授权。scope：${v.scope ?? '未知'}${v.expiryDate ? `，令牌过期时间 ${v.expiryDate}` : ''}${online}` }]
					}
					if (v.status === 'pending') return [{ type: 'text', text: `授权进行中：请在浏览器打开 ${v.authUrl} 完成登录（剩余约 ${v.expiresInSec} 秒），完成后再调用本工具确认。` }]
					return [{ type: 'text', text: `未授权。${v.hint ?? ''}` }]
				}
			},
			isConcurrencySafe: () => true,
			timeoutMs: 15_000,
			async execute(_args, exec) {
				const result = await auth.status(exec.signal)
				exec.signal.throwIfAborted()
				return result
			},
			presentCall: () => ({ card: 'generic', title: '查看 Google 云端硬盘授权状态', kind: 'other' })
		}),

		defineTool({
			name: 'gdrive_auth_start',
			description: '开始 Google 账号授权：生成本地回调并返回授权链接。用户在浏览器完成登录后 token 自动保存，之后所有 gdrive_* 工具即可使用。',
			parameters: {
				openBrowser: { type: 'boolean', description: '是否尝试自动打开浏览器（默认 true，失败时也会返回链接）' }
			},
			output: {
				schema: {
					type: 'object',
					additionalProperties: true,
					properties: {
						authUrl: { type: 'string' },
						port: { type: 'integer' },
						expiresInSec: { type: 'integer' },
						openedBrowser: { type: 'boolean' }
					}
				},
				render: (_args, v) => [
					{ type: 'text', text: `请在浏览器打开以下链接完成 Google 授权（${v.expiresInSec} 秒内有效）：\n${v.authUrl}\n完成后调用 gdrive_auth_status 确认。` }
				]
			},
			isConcurrencySafe: () => false,
			async execute(args, exec) {
				const r = await auth.startAuth()
				exec.signal.throwIfAborted()
				const openedBrowser = args.openBrowser === false ? false : await tryOpenBrowser(r.authUrl)
				return { ...r, openedBrowser }
			},
			presentCall: () => ({ card: 'generic', title: '发起 Google 账号授权', kind: 'other' })
		}),

		defineTool({
			name: 'gdrive_list',
			description: '列出 Google 云端硬盘某个文件夹的内容（默认根目录），按修改时间倒序，支持分页。',
			parameters: {
				folderId: { type: 'string', description: '文件夹 ID；省略时列根目录' },
				pageToken: { type: 'string', description: '上一页结果里的 nextPageToken，用于翻页' },
				pageSize: { type: 'integer', description: '每页数量，默认取插件配置 pageSize' }
			},
			output: {
				schema: listOutputSchema,
				render: (_args, v) => [{ type: 'text', text: renderFileList(v) }]
			},
			isConcurrencySafe: () => true,
			timeoutMs,
			async execute(args, exec) {
				return await client.list({ folderId: args.folderId, pageToken: args.pageToken, pageSize: args.pageSize }, exec.signal)
			},
			presentCall: (args) => ({ card: 'generic', title: `列目录 ${args.folderId ?? '根目录'}`, kind: 'read' })
		}),

		defineTool({
			name: 'gdrive_search',
			description: '在 Google 云端硬盘中搜索：keyword 同时匹配文件名与正文，可叠加 mimeType / folderId 过滤，支持分页。',
			parameters: {
				keyword: { type: 'string', description: '关键词，匹配文件名与正文' },
				mimeType: { type: 'string', description: '精确 mimeType，如 application/pdf、application/vnd.google-apps.document' },
				folderId: { type: 'string', description: '限定在该文件夹内搜索' },
				pageToken: { type: 'string', description: '上一页结果里的 nextPageToken，用于翻页' },
				pageSize: { type: 'integer', description: '每页数量，默认取插件配置 pageSize' }
			},
			output: {
				schema: listOutputSchema,
				render: (_args, v) => [{ type: 'text', text: renderFileList(v) }]
			},
			isConcurrencySafe: () => true,
			timeoutMs,
			async execute(args, exec) {
				return await client.search(
					{ keyword: args.keyword, mimeType: args.mimeType, folderId: args.folderId, pageToken: args.pageToken, pageSize: args.pageSize },
					exec.signal
				)
			},
			presentCall: (args) => ({ card: 'generic', title: `搜索云盘：${args.keyword ?? args.mimeType ?? ''}`, kind: 'search' })
		}),

		defineTool({
			name: 'gdrive_get',
			description: '按文件 ID 获取 Google 云端硬盘文件的元数据（名称、类型、大小、修改时间、拥有者、父目录、网页链接等）。',
			parameters: {
				fileId: { type: 'string', required: true, description: '文件 ID' }
			},
			output: {
				schema: {
					type: 'object',
					additionalProperties: true,
					properties: {
						id: { type: 'string' },
						name: { type: 'string' },
						mimeType: { type: 'string' },
						size: { type: 'string' },
						modifiedTime: { type: 'string' },
						webViewLink: { type: 'string' }
					}
				},
				render: (_args, v) => [
					{
						type: 'text',
						text: `[${shortMime(v.mimeType as string | undefined)}] ${v.name ?? v.id}\nid=${v.id}${v.size ? `\n大小=${v.size} 字节` : ''}${v.modifiedTime ? `\n修改时间=${v.modifiedTime}` : ''}${v.webViewLink ? `\n链接=${v.webViewLink}` : ''}`
					}
				]
			},
			isConcurrencySafe: () => true,
			timeoutMs,
			async execute(args, exec) {
				const data = await client.get(args.fileId, exec.signal)
				return pickMeta(data)
			},
			presentCall: (args) => ({ card: 'generic', title: `获取文件元数据 ${args.fileId}`, kind: 'read' })
		}),

		defineTool({
			name: 'gdrive_read',
			description:
				'读取 Google 云端硬盘文件内容。Google 文档/幻灯片导出纯文本，表格导出 CSV（首个工作表，按范围读请用 gdrive_sheets），文本型文件直接读取；二进制文件只返回元数据提示。超出 maxChars 自动截断。',
			parameters: {
				fileId: { type: 'string', required: true, description: '文件 ID' },
				maxChars: { type: 'integer', description: '返回的最大字符数，默认取插件配置 maxChars' }
			},
			output: {
				schema: {
					type: 'object',
					additionalProperties: true,
					properties: {
						id: { type: 'string' },
						name: { type: 'string' },
						mimeType: { type: 'string' },
						kind: { type: 'string' },
						text: { type: 'string' },
						truncated: { type: 'boolean' },
						totalChars: { type: 'integer' },
						note: { type: 'string' }
					}
				},
				render: (_args, v) => {
					if (v.kind === 'binary-meta') return [{ type: 'text', text: `${v.name}（${v.mimeType}）：${v.note ?? '二进制文件未读取'}` }]
					const text = v.text ?? ''
					const head = `${v.name}（${v.mimeType}，共 ${v.totalChars} 字符${v.truncated ? `，已截断为前 ${text.length} 字符` : ''}）`
					return [{ type: 'text', text: `${head}${v.note ? `\n${v.note}` : ''}\n${text}` }]
				}
			},
			isConcurrencySafe: () => true,
			timeoutMs,
			async execute(args, exec) {
				return await client.read(args.fileId, args.maxChars, exec.signal)
			},
			presentCall: (args) => ({ card: 'generic', title: `读取云盘文件 ${args.fileId}`, kind: 'read' })
		}),

		defineTool({
			name: 'gdrive_upload',
			description:
				'上传内容到 Google 云端硬盘：content 直传文本，或 localPath 上传本地文件；mimeType 设为 application/vnd.google-apps.folder 时新建文件夹。需要 readwrite/full 模式授权。',
			parameters: {
				name: { type: 'string', required: true, description: '文件名' },
				parentId: { type: 'string', description: '目标文件夹 ID；省略时传到根目录' },
				mimeType: { type: 'string', description: '内容类型；文本默认 text/plain，本地文件默认 application/octet-stream' },
				content: { type: 'string', description: '文本内容（与 localPath 二选一）' },
				localPath: { type: 'string', description: '本地文件绝对路径（与 content 二选一）' }
			},
			output: {
				schema: {
					type: 'object',
					additionalProperties: true,
					properties: { id: { type: 'string' }, name: { type: 'string' }, mimeType: { type: 'string' }, webViewLink: { type: 'string' } }
				},
				render: (_args, v) => [{ type: 'text', text: `已上传：${v.name}　id=${v.id}${v.webViewLink ? `\n${v.webViewLink}` : ''}` }]
			},
			timeoutMs: 120_000,
			async execute(args, exec) {
				assertWritable(cfg.mode)
				const data = await client.upload(
					{ name: args.name, parentId: args.parentId, mimeType: args.mimeType, content: args.content, localPath: args.localPath },
					exec.signal
				)
				return pickMeta(data)
			},
			presentCall: (args) => ({ card: 'generic', title: `上传到云盘：${args.name}`, kind: 'edit' })
		}),

		defineTool({
			name: 'gdrive_update',
			description:
				'修改 Google 云端硬盘文件：改内容（content/localPath）、改名（name）、移动（addParents/removeParents）、软删与恢复（trashed=true/false，可组合）。需要 readwrite/full 模式授权。',
			parameters: {
				fileId: { type: 'string', required: true, description: '文件 ID' },
				name: { type: 'string', description: '新文件名' },
				content: { type: 'string', description: '新的文本内容（覆盖）' },
				localPath: { type: 'string', description: '用本地文件内容覆盖' },
				mimeType: { type: 'string', description: '覆盖内容的 mimeType' },
				addParents: { type: 'string', description: '加入的父文件夹 ID，多个用逗号分隔' },
				removeParents: { type: 'string', description: '移出的父文件夹 ID，多个用逗号分隔' },
				trashed: { type: 'boolean', description: 'true 软删（进回收站，可恢复），false 恢复' }
			},
			output: {
				schema: {
					type: 'object',
					additionalProperties: true,
					properties: { id: { type: 'string' }, name: { type: 'string' }, mimeType: { type: 'string' }, trashed: { type: 'boolean' }, webViewLink: { type: 'string' } }
				},
				render: (_args, v) => [{ type: 'text', text: `已更新：${v.name ?? v.id}${v.trashed === true ? '（已移入回收站）' : ''}${v.trashed === false ? '（已恢复）' : ''}` }]
			},
			timeoutMs: 120_000,
			async execute(args, exec) {
				assertWritable(cfg.mode)
				const data = await client.update(
					{
						fileId: args.fileId,
						name: args.name,
						content: args.content,
						localPath: args.localPath,
						mimeType: args.mimeType,
						addParents: args.addParents,
						removeParents: args.removeParents,
						trashed: args.trashed
					},
					exec.signal
				)
				return pickMeta(data)
			},
			presentCall: (args) => {
				const kind = args.trashed === true ? ('delete' as const) : args.addParents || args.removeParents ? ('move' as const) : ('edit' as const)
				const title = args.trashed === true ? `软删云盘文件 ${args.fileId}` : args.trashed === false ? `恢复云盘文件 ${args.fileId}` : `更新云盘文件 ${args.fileId}`
				return { card: 'generic', title, kind }
			}
		}),

		defineTool({
			name: 'gdrive_docs',
			description:
				'读写 Google 文档（Docs）：op=read 提取正文纯文本；op=append 在文末追加；op=replace 全文替换（需提供 text）。写操作需要 readwrite/full 模式授权。',
			parameters: {
				documentId: { type: 'string', required: true, description: '文档 ID' },
				op: { type: 'string', enum: ['read', 'append', 'replace'], required: true, description: 'read 读正文 / append 文末追加 / replace 全文替换' },
				text: { type: 'string', description: 'append / replace 时必填的文本' },
				maxChars: { type: 'integer', description: 'read 时返回的最大字符数' }
			},
			output: {
				schema: {
					type: 'object',
					additionalProperties: true,
					properties: {
						documentId: { type: 'string' },
						title: { type: 'string' },
						text: { type: 'string' },
						truncated: { type: 'boolean' },
						totalChars: { type: 'integer' },
						appended: { type: 'boolean' },
						replaced: { type: 'boolean' }
					}
				},
				render: (args, v) => {
					if (args.op === 'read')
						return [{ type: 'text', text: `${v.title ?? v.documentId}（共 ${v.totalChars} 字符${v.truncated ? `，已截断为前 ${(v.text ?? '').length} 字符` : ''}）\n${v.text ?? ''}` }]
					if (args.op === 'append') return [{ type: 'text', text: `已在文档末尾追加 ${v.appendedChars} 字符` }]
					return [{ type: 'text', text: `已全文替换文档内容（${v.chars} 字符）` }]
				}
			},
			timeoutMs,
			async execute(args, exec) {
				if (args.op === 'read') return await client.docsRead(args.documentId, args.maxChars, exec.signal)
				assertWritable(cfg.mode)
				if (!args.text) throw new GDriveError(`op=${args.op} 需要提供 text 参数`)
				if (args.op === 'append') return await client.docsAppend(args.documentId, args.text, exec.signal)
				return await client.docsReplace(args.documentId, args.text, exec.signal)
			},
			presentCall: (args) => {
				const title = args.op === 'read' ? `读取 Google 文档 ${args.documentId}` : args.op === 'append' ? `追加 Google 文档 ${args.documentId}` : `替换 Google 文档 ${args.documentId}`
				return { card: 'generic', title, kind: args.op === 'read' ? ('read' as const) : ('edit' as const) }
			}
		}),

		defineTool({
			name: 'gdrive_sheets',
			description:
				'读写 Google 表格（Sheets）：op=meta 查看工作表清单；op=read 按 A1 范围读值；op=write 覆盖写入范围；op=append 末尾追加行（write/append 需提供 values 二维数组）。写操作需要 readwrite/full 模式授权。',
			parameters: {
				spreadsheetId: { type: 'string', required: true, description: '表格 ID' },
				op: { type: 'string', enum: ['meta', 'read', 'write', 'append'], required: true, description: 'meta / read / write / append' },
				range: { type: 'string', description: 'A1 范围，如 Sheet1!A1:D10；read/write/append 必填' },
				values: {
					type: 'array',
					items: { type: 'array', items: { type: 'json' } },
					description: '二维数组，如 [["a",1],["b",2]]；write/append 必填'
				}
			},
			output: {
				schema: {
					type: 'object',
					additionalProperties: true,
					properties: {
						range: { type: 'string' },
						values: { type: 'array', items: { type: 'array', items: { type: 'json' } } },
						rowCount: { type: 'integer' },
						updatedRows: { type: 'integer' },
						updatedCells: { type: 'integer' }
					}
				},
				render: (args, v) => {
					if (args.op === 'meta') {
						const sheets = (v.sheets as { title?: string; rowCount?: number; columnCount?: number }[] | undefined) ?? []
						const lines = sheets.map((s) => `- ${s.title}（${s.rowCount} 行 × ${s.columnCount} 列）`)
						return [{ type: 'text', text: `${v.title ?? v.spreadsheetId}\n${lines.join('\n')}` }]
					}
					if (args.op === 'read') {
						const values = (v.values as unknown[][] | undefined) ?? []
						const lines = values.map((row) => row.map((c) => String(c ?? '')).join('\t'))
						return [{ type: 'text', text: `${v.range}（${v.rowCount} 行）\n${lines.join('\n')}` }]
					}
					return [{ type: 'text', text: `已写入 ${v.updatedRange ?? v.range}：${v.updatedRows} 行、${v.updatedCells} 个单元格` }]
				}
			},
			timeoutMs,
			async execute(args, exec) {
				if (args.op === 'meta') return await client.sheetsMeta(args.spreadsheetId, exec.signal)
				if (!args.range) throw new GDriveError(`op=${args.op} 需要提供 range 参数`, '形如 Sheet1!A1:D10')
				if (args.op === 'read') return await client.sheetsRead(args.spreadsheetId, args.range, exec.signal)
				assertWritable(cfg.mode)
				if (!args.values) throw new GDriveError(`op=${args.op} 需要提供 values 参数`, '二维数组，如 [["a",1],["b",2]]')
				if (args.op === 'write') return await client.sheetsWrite(args.spreadsheetId, args.range, args.values, exec.signal)
				return await client.sheetsAppend(args.spreadsheetId, args.range, args.values, exec.signal)
			},
			presentCall: (args) => {
				const titleMap = { meta: '查看表格结构', read: '读取表格', write: '写入表格', append: '追加表格' } as const
				return { card: 'generic', title: `${titleMap[args.op]} ${args.spreadsheetId}${args.range ? ` ${args.range}` : ''}`, kind: args.op === 'write' || args.op === 'append' ? ('edit' as const) : ('read' as const) }
			}
		})
	]
}
