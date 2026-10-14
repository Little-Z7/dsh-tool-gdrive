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

export const name = 'gdrive'
export const inject = ['tools']

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

export const Config = Schema.object({
	clientId: Schema.string().description('GCP OAuth Client ID（“桌面应用”类型，回环地址免登记）。在插件配置页或此处填写'),
	clientSecret: Schema.string().description('GCP OAuth Client Secret'),
	port: Schema.number().default(55414).description('OAuth 回调端口，被占用时自动递增重试 3 次'),
	bridgePort: Schema.number().default(0).description('配置页本地桥端口；0 表示自动取 port+10'),
	tokenPath: Schema.string().default('').description('token 保存路径，默认 ~/.config/dsh/gdrive-tokens.json'),
	mode: Schema.union(['readonly', 'readwrite', 'full'] as const)
		.default('readonly')
		.description('readonly 只读；readwrite 可读全部、写本插件创建的文件并可读写 Docs/Sheets 内容；full 为 Drive 全量读写'),
	maxChars: Schema.number().default(8000).description('单次读取返回的最大字符数'),
	pageSize: Schema.number().default(20).description('列表/搜索默认分页大小'),
	timeoutMs: Schema.number().default(20000).description('单次 Google API 请求超时毫秒')
})

export function apply(ctx: Context, config: PluginConfig) {
	const cfg: PluginConfig = { ...config, tokenPath: config.tokenPath || defaultTokenPath() }
	const auth = new GDriveAuth({
		clientId: cfg.clientId,
		clientSecret: cfg.clientSecret,
		port: cfg.port,
		tokenPath: cfg.tokenPath,
		scopes: scopesForMode(cfg.mode)
	})
	const client = new GClient(auth, { timeoutMs: cfg.timeoutMs, maxChars: cfg.maxChars, pageSize: cfg.pageSize })
	for (const def of createTools({ auth, client, cfg })) ctx.tools.register(def)
	ctx.effect(() => () => auth.dispose())
	// 配置页本地桥：失败不影响工具可用性
	ctx.effect(() => {
		let handle: { close: () => void } | undefined
		startBridge(auth, cfg.bridgePort > 0 ? cfg.bridgePort : cfg.port + 10)
			.then((h) => {
				handle = h
			})
			.catch((err) => console.warn('[gdrive] 配置页桥启动失败（不影响工具使用）：', err))
		return () => handle?.close()
	}, 'gdrive: bridge')
}
