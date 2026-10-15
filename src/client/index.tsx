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
	RESTART_KEY,
	WINDOW_STORE_NAME,
	checkUpdate,
	installUpdate,
	markRestartPending,
	newRequestId,
	restartPending,
	settleRestartPending,
	waitForMarketUrl,
	type KeyValueStore,
	type UpdateCheck
} from './update.js'

const WINDOW_STORE = Symbol.for(WINDOW_STORE_NAME)

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
		/* 最近一次安装的请求编号：较早的请求晚收尾时，不许覆盖之后请求写下的待重启记录。 */
		let latestRequest = ''
		scope.slots.inject('plugins.detail.actions', () =>
			scope.slots.register(
				{
					name: 'plugins.detail.actions',
					id: 'gdrive-update',
					order: 10,
					locale: NS,
					inject: () => ({
						/* 调用时才现读配置：用户在配置页改了市场地址，下一次检查就生效；配置还在加载时先等，不拿缺省市场顶替。 */
						checkUpdate: async (installed: string | undefined, signal?: AbortSignal): Promise<UpdateCheck> => {
							const site = await waitForMarketUrl(form, { signal })
							if (!site.ok) return { kind: 'failed', failure: { code: 'config-loading' } }
							return checkUpdate((url, init) => globalThis.fetch(url, init), site.raw, installed, { signal })
						},
						installUpdate: async (url: string, version: string, enabled: boolean) => {
							/* 必须在装之前记：装成功的那一刻 DSH 就热替换本半侧，`await` 之后的代码未必还有机会跑。
							 * 先记下旧记录：这次没装成时恢复它，不能删掉一条仍然有效的「待重启」。 */
							const store = pageStore()
							const previous = store.getItem(RESTART_KEY)
							const requestId = newRequestId()
							latestRequest = requestId
							markRestartPending(store, version)
							const outcome = await installUpdate(manager, url, enabled, requestId)
							if (latestRequest === requestId) settleRestartPending(store, previous, outcome)
							return outcome
						},
						restartPending: (installed: string | undefined) => restartPending(pageStore(), installed)
					})
				},
				UpdateAction
			)
		)
	})
}

export { NS, apply, inject }
