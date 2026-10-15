/**
 * 浏览器半侧与 DSH 客户端之间的那几块形状（0.2.0-rc.2）。
 *
 * 只放类型：update.ts 只用 `import type` 引它，Node 的类型剥离会把整行删掉，测试才能直接跑 update.ts。
 * 只写插件真正读写的字段；运行时它们由壳注入（ctx 服务、插槽渲染器给组件的 props）。
 * @module dsh-tool-gdrive/client/contract
 */
import type { SettingsFormScope } from '@deepseek-ai/dsh-client-ui-primitives'

export type Translate = (key: string, params?: Record<string, string | number>) => string

/** `ctx.remote.*` 的回执：`ok` 为假时是传输层或准入失败，不是命令自己的失败。 */
export type RemoteResult<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } }

/** `pluginManager.installBundle` 的结果，只写读到的字段。 */
export interface InstallResult {
	application: 'applied' | 'restart-required' | 'overridden' | 'failed' | 'cancelled'
	error?: { code: string; diagnostic?: string }
	packageResult?: { output?: string }
}

/** DSH 插件管理的远程服务里，更新用到的两个方法。 */
export interface PluginManagerRemote {
	installBundle(spec: string, options: { enabled?: boolean; requestId?: string }): Promise<RemoteResult<InstallResult>>
	/** 安装还在跑时拿它的结果；已经结束（或编号不认识）回 null。 */
	waitForInstall(requestId: string): Promise<RemoteResult<InstallResult | null>>
}

export interface PluginPackageRef {
	readonly name: string
	readonly version?: string
	readonly installed: boolean
	readonly enabled: boolean
}

/** 插件详情页插槽给条目的 subject。 */
export type PluginsSubject =
	| { readonly kind: 'bundle'; readonly pkg: PluginPackageRef }
	| { readonly kind: 'row'; readonly pkg: PluginPackageRef; readonly row: unknown }
	| { readonly kind: 'item'; readonly id: string }

/** 插槽登记的最小形状；`inject` 的返回值成为组件 props 的一部分。 */
export interface SlotRegistration {
	name: string
	key?: string
	id?: string
	order?: number
	locale?: string
	inject?: () => object
}

export interface ClientContext {
	effect(body: () => (() => void) | void, label?: string): void
	/** 等这些服务都到位再跑回调；任一服务撤掉时回调里登记的东西一起撤（cordis 子纤程）。 */
	inject(deps: readonly string[], callback: (scope: ClientContext) => void): unknown
	locale: {
		register(ns: string, dict: { zh: Record<string, string>; en: Record<string, string> }): () => void
		bind(ns: string): Translate
	}
	slots: {
		inject(name: string, register: () => unknown): () => void
		register(options: SlotRegistration, component: unknown): unknown
	}
	/** `pluginManager` 只在 `inject(['remote.pluginManager'], …)` 的回调里读。 */
	remote: { pluginManager: PluginManagerRemote }
	configForms: {
		get<T>(namespace: string): SettingsFormScope<T>
	}
}
