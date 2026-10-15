/**
 * 浏览器半侧入口：注册字典 + plugins.row.config slot（配置页）+ plugins.detail.actions slot（检查更新）。
 * 仿 dsh-client-ui-settings-shell/lib/client.js 的入口形态。
 * @module dsh-tool-gdrive/client
 */
import type { ClientContext } from './contract.js'
import { NS, en, zh } from './locales.js'
import { GdriveFormController, GdrivePage } from './page.js'
import { UpdateAction } from './UpdateAction.js'
import {
	WINDOW_INSTALLS_NAME,
	WINDOW_STORE_NAME,
	checkUpdate,
	restartPending,
	runInstall,
	sameSite,
	waitForMarketUrl,
	watchMarketUrl,
	type InstallOutcome,
	type InstallRegistry,
	type KeyValueStore,
	type UpdateCheck
} from './update.js'

const WINDOW_STORE = Symbol.for(WINDOW_STORE_NAME)
const WINDOW_INSTALLS = Symbol.for(WINDOW_INSTALLS_NAME)

/**
 * 挂在 window 上的「装好待重启」记录：热替换只换模块、不换文档，它留得下来；刷新页面或重开桌面版就没了。
 * 不写进任何浏览器持久存储 —— 那样重启 DSH 后记录还在，页面会一直说「重启后生效」。
 * Symbol 名与键名跨版本不能改（见 update.ts 文件头）。
 */
function pageStore(): KeyValueStore {
	const holder = globalThis as { [WINDOW_STORE]?: Map<string, string> }
	const map = (holder[WINDOW_STORE] ??= new Map<string, string>())
	return {
		getItem: (key) => map.get(key) ?? null,
		setItem: (key, value) => {
			map.set(key, value)
		},
		removeItem: (key) => {
			map.delete(key)
		}
	}
}

/**
 * 唯一的进行中安装的登记处，同样挂在 window 上（热替换不换文档，留得下来；见 update.ts 的「安装状态机」）。
 * Symbol 名跨版本不能改。
 */
function installRegistry(): InstallRegistry {
	const holder = globalThis as { [WINDOW_INSTALLS]?: InstallRegistry }
	return (holder[WINDOW_INSTALLS] ??= {})
}

/** 需要的浏览器侧服务（cordis fiber inject）。'remote' 必须在顶层：子纤程里读 scope.remote 要沿纤程链找到它。 */
const inject = ['slots', 'locale', 'configForms', 'remote']

function apply(ctx: ClientContext) {
	ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'gdrive: dictionaries')
	const form = ctx.configForms.get<Record<string, unknown>>('gdrive')
	const controller = new GdriveFormController(form)
	ctx.effect(() => () => controller.dispose(), 'gdrive: form subscription')
	ctx.effect(
		() =>
			ctx.slots.inject('plugins.row.config', () =>
				ctx.slots.register(
					{
						name: 'plugins.row.config',
						key: 'dsh-tool-gdrive#gdrive',
						locale: NS,
						inject: () => controller.inject()
					},
					GdrivePage
				)
			),
		'gdrive: config page'
	)

	/* 详情页的「检查更新」：等插件管理的远程服务到位再登记；服务撤掉时一起撤。 */
	ctx.inject(['remote.pluginManager'], (scope) => {
		const manager = scope.remote.pluginManager
		const registry = installRegistry()
		scope.slots.inject('plugins.detail.actions', () =>
			scope.slots.register(
				{
					name: 'plugins.detail.actions',
					id: 'gdrive-update',
					order: 10,
					locale: NS,
					inject: () => ({
						/*
						 * 调用时才现读配置：用户在配置页改了市场地址，下一次检查就生效。
						 * 先等配置就绪、且本插件的配置表单没有正在进行的保存（宿主「最后接受」的值要等保存落定才变），
						 * 不拿缺省市场或旧地址顶替；保存失败则按旧的已接受值检查，结果带 saveFailed。
						 */
						checkUpdate: async (installed: string | undefined, signal?: AbortSignal): Promise<UpdateCheck> => {
							const site = await waitForMarketUrl(form, { signal, save: controller.saveWatch })
							if (!site.ok) return { kind: 'failed', failure: { code: 'config-loading' } }
							const result = await checkUpdate((url, init) => globalThis.fetch(url, init), site.raw, installed, { signal })
							return site.saveFailed ? { ...result, saveFailed: true } : result
						},
						/* 已接受的市场地址变了就通知，组件据此作废当前结果并重新检查。 */
						watchSite: (listener: () => void) => watchMarketUrl(form, listener),
						/*
						 * 已有安装在进行：不再发起新安装，等同一个结果。否则先确认当前已接受的站点还是结果读的那个，
						 * 不是就不装（stale），由组件重新检查；然后走 runInstall（状态机见 update.ts）。
						 */
						installUpdate: async (url: string, version: string, enabled: boolean, origin: string): Promise<InstallOutcome> => {
							if (registry.current) return registry.current.promise
							const site = await waitForMarketUrl(form, { save: controller.saveWatch, timeoutMs: 3000 })
							if (!site.ok || !sameSite(site.raw, origin)) return { kind: 'stale' }
							return runInstall(registry, pageStore(), manager, url, version, enabled)
						},
						inflight: () => (registry.current ? { version: registry.current.version, promise: registry.current.promise } : undefined),
						restartPending: (installed: string | undefined) => restartPending(pageStore(), installed)
					})
				},
				UpdateAction
			)
		)
	})
}

export { NS, apply, inject }
