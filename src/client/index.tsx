/**
 * 配置页浏览器半侧入口：注册字典 + plugins.row.config slot。
 * 仿 dsh-client-ui-settings-shell/lib/client.js 的入口形态。
 * @module dsh-tool-gdrive/client
 */
import { NS, en, zh } from './locales.js'
import { GdriveFormController, GdrivePage } from './page.js'

/** 浏览器侧 cordis 服务的最小类型面（运行时由宿主提供）。 */
interface LocaleService {
	bind(ns: string): (key: string) => string
	register(ns: string, dict: { zh: Record<string, string>; en: Record<string, string> }): () => void
}
interface SlotsService {
	inject(name: string, factory: () => unknown): () => void
	register(descriptor: Record<string, unknown>, component: unknown): unknown
}
interface ConfigFormsService {
	get(entryId: string): import('@deepseek-ai/dsh-client-ui-primitives').SettingsFormScope<Record<string, unknown>>
}
interface ClientContext {
	locale: LocaleService
	slots: SlotsService
	configForms: ConfigFormsService
	effect(fn: () => (() => void) | void, label?: string): void
}

/** 需要的浏览器侧服务（cordis fiber inject）。 */
const inject = ['slots', 'locale', 'configForms']

function apply(ctx: ClientContext) {
	ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'gdrive: dictionaries')
	const controller = new GdriveFormController(ctx.configForms.get('gdrive'))
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
}

export { NS, apply, inject }
