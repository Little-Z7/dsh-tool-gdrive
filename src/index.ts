/**
 * dsh-tool-gdrive：DeepSeek Harness 的 Google 云端硬盘插件。
 * 读写闭环 + 工具内 OAuth 授权向导；token 只落本地文件，不进配置。
 * @module dsh-tool-gdrive
 */
import Schema from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'
import { GDriveAuth, defaultTokenPath, scopesForMode, type AuthMode } from './auth.js'
import { startBridge } from './bridge.js'
import { GClient } from './gclient.js'
import { createTools } from './tools.js'
import { readV } from './util.js'

export const name = 'gdrive'
export const inject = ['tools']

/** 逻辑配置（volatile 字段在运行期可能是装箱引用，统一经 readV 读取）。 */
export interface PluginConfig {
	clientId?: string
	clientSecret?: string
	port: number
	bridgePort: number
	tokenPath: string
	mode: AuthMode
	maxChars: number
	pageSize: number
	timeoutMs: number
}

// 可编辑字段全部标 volatile：dsh-settings 只把 volatile 字段暴露给配置页，
// 且 UI 保存就地提交、插件经 readV 读到最新值，无需重挂载。
export const Config = Schema.object({
	clientId: Schema.string().volatile().description('GCP OAuth Client ID（“桌面应用”类型，回环地址免登记）。在插件配置页或此处填写'),
	clientSecret: Schema.string().volatile().description('GCP OAuth Client Secret'),
	port: Schema.number().default(55414).volatile().description('OAuth 回调端口，被占用时自动递增重试 3 次'),
	bridgePort: Schema.number().default(0).volatile().description('配置页本地桥端口；0 表示自动取 port+10'),
	tokenPath: Schema.string().default('').volatile().description('token 保存路径，默认 ~/.config/dsh/gdrive-tokens.json'),
	mode: Schema.union(['readonly', 'readwrite', 'full'] as const)
		.default('readonly')
		.volatile()
		.description('readonly 只读；readwrite 可读全部、写本插件创建的文件并可读写 Docs/Sheets 内容；full 为 Drive 全量读写'),
	maxChars: Schema.number().default(8000).volatile().description('单次读取返回的最大字符数'),
	pageSize: Schema.number().default(20).volatile().description('列表/搜索默认分页大小'),
	timeoutMs: Schema.number().default(20000).volatile().description('单次 Google API 请求超时毫秒')
})

export function apply(ctx: Context, config: PluginConfig) {
	// 惰性读取视图：每次访问经 readV 解装箱，UI 保存的 volatile 提交即时可见
	const live: PluginConfig & { readonly scopes: string[] } = {
		get clientId() {
			return readV<string | undefined>(config.clientId)
		},
		get clientSecret() {
			return readV<string | undefined>(config.clientSecret)
		},
		get port() {
			return readV<number | undefined>(config.port) ?? 55414
		},
		get bridgePort() {
			return readV<number | undefined>(config.bridgePort) ?? 0
		},
		get tokenPath() {
			return readV<string | undefined>(config.tokenPath) || defaultTokenPath()
		},
		get mode() {
			return readV<AuthMode | undefined>(config.mode) ?? 'readonly'
		},
		get maxChars() {
			return readV<number | undefined>(config.maxChars) ?? 8000
		},
		get pageSize() {
			return readV<number | undefined>(config.pageSize) ?? 20
		},
		get timeoutMs() {
			return readV<number | undefined>(config.timeoutMs) ?? 20000
		},
		get scopes() {
			return scopesForMode(this.mode)
		}
	}
	const auth = new GDriveAuth({
		get clientId() {
			return live.clientId
		},
		get clientSecret() {
			return live.clientSecret
		},
		get port() {
			return live.port
		},
		get tokenPath() {
			return live.tokenPath
		},
		get scopes() {
			return live.scopes
		}
	})
	const client = new GClient(auth, live)
	for (const def of createTools({ auth, client, cfg: live })) ctx.tools.register(def)
	ctx.effect(() => () => auth.dispose())
	// 配置页本地桥：失败不影响工具可用性
	ctx.effect(() => {
		let handle: { close: () => void } | undefined
		startBridge(auth, live.bridgePort > 0 ? live.bridgePort : live.port + 10)
			.then((h) => {
				handle = h
			})
			.catch((err) => console.warn('[gdrive] 配置页桥启动失败（不影响工具使用）：', err))
		return () => handle?.close()
	}, 'gdrive: bridge')
}
