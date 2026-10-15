/**
 * 跑一遍真的 lib/client.js（已提交的构建产物）：信封调 `__ModuleLoader__.load`，
 * factory 只向壳要它声明的外部模块，apply 在一份假 ctx 上登记配置页与「检查更新」。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'

const RESTART_KEY = 'dsh-tool-gdrive.restart-pending'
const EXTERNALS = ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives']

class FakeForm {
	bind(project: () => unknown) {
		const v = project()
		return { getSnapshot: () => v, subscribe: () => () => {} }
	}
	shell() {
		return { available: true, writable: true, dirty: false, invalid: false, saving: false, failed: false }
	}
	field() {
		return { text: '', overridden: false, invalid: false }
	}
	actions() {
		return { edit() {}, resetField() {}, save() {}, discard() {} }
	}
	dispose() {}
}

interface Registered {
	name: string
	key?: string
	id?: string
	inject?: () => Record<string, unknown>
}

test('client.js：inject 含 remote，登记 remote.pluginManager，详情页按钮、待重启记录与配置节读取', async () => {
	const source = readFileSync(new URL('../../lib/client.js', import.meta.url), 'utf8')
	assert.ok(!/localStorage|sessionStorage/.test(source))
	let loaded: { id: string; factory: (require: (name: string) => unknown) => Record<string, unknown> } | undefined
	const fetched: string[] = []
	const sandbox: Record<string | symbol, unknown> = {
		window: { __ModuleLoader__: { load: (row: typeof loaded) => (loaded = row) } },
		fetch: (url: string) => {
			fetched.push(url)
			return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })
		},
		AbortController,
		URL,
		setTimeout,
		clearTimeout,
		Promise
	}
	const context = vm.createContext(sandbox)
	vm.runInContext(source, context)
	assert.equal(loaded?.id, 'dsh-tool-gdrive')

	const plugin = loaded!.factory((name) => {
		assert.ok(EXTERNALS.includes(name), `unexpected module request ${name}`)
		return name === '@deepseek-ai/dsh-client-ui-primitives'
			? { SettingsFormModel: FakeForm, settingsTextField: () => ({}), settingsNumberField: () => ({}) }
			: {}
	})
	// vm 新上下文里的数组原型不同，先拷回本 realm
	assert.deepEqual([...(plugin.inject as string[])], ['slots', 'locale', 'configForms', 'remote'])

	const registered: Registered[] = []
	const injected = new Map<string, (scope: unknown) => void>()
	let configValue: Record<string, unknown> | undefined = { marketUrl: 'http://127.0.0.1:9' }
	const ctx = {
		effect: (body: () => unknown) => void body(),
		inject: (deps: string[], cb: (scope: unknown) => void) => void injected.set([...deps].join(','), cb),
		locale: { register: () => () => {}, bind: () => (key: string) => key },
		slots: {
			inject: (_name: string, register: () => unknown) => {
				register()
				return () => {}
			},
			register: (options: Registered) => {
				registered.push(options)
				return () => {}
			}
		},
		remote: {},
		configForms: {
			get: () => ({ getSnapshot: () => ({ status: 'ready', value: configValue, base: {}, user: {}, writable: true, revision: 1 }), subscribe: () => () => {}, mutate: async () => true })
		}
	}
	;(plugin.apply as (c: unknown) => void)(ctx)
	assert.deepEqual([...injected.keys()], ['remote.pluginManager'])

	/* 以 Symbol 为键的全局属性不会同步回 sandbox 对象，只能进上下文里读 */
	const store = () => vm.runInContext(`globalThis[Symbol.for('dsh-tool-gdrive.window-store')]`, context) as Map<string, string> | undefined
	let application = 'restart-required'
	let duringInstall: string | undefined
	const installs: { spec: string; options: { enabled?: boolean; requestId?: string } }[] = []
	const pluginManager = {
		installBundle: async (spec: string, options: { enabled?: boolean; requestId?: string }) => {
			installs.push({ spec, options })
			/* DSH 装成功那一刻就热替换浏览器半侧，待重启记录必须在这之前已经写好 */
			duringInstall = store()?.get(RESTART_KEY)
			return { ok: true, value: { application } }
		},
		waitForInstall: async () => ({ ok: true, value: null })
	}
	injected.get('remote.pluginManager')!({ ...ctx, remote: { pluginManager } })

	assert.ok(registered.some((r) => r.name === 'plugins.row.config'))
	const action = registered.find((r) => r.id === 'gdrive-update')!
	assert.equal(action.name, 'plugins.detail.actions')
	const face = action.inject!()
	assert.equal(typeof face.checkUpdate, 'function')

	/* 读的是配置节里的 marketUrl，且是调用时现读 */
	await (face.checkUpdate as (v: string) => Promise<unknown>)('0.2.6')
	configValue = {}
	await (face.checkUpdate as (v: string) => Promise<unknown>)('0.2.6')
	assert.deepEqual(fetched, ['http://127.0.0.1:9/dsh-market/index.json', 'https://tv.auraaigc.ccwu.cc:56814/dsh-market/index.json'])

	const install = face.installUpdate as (u: string, v: string, enabled: boolean) => Promise<{ kind: string }>
	const url = 'http://127.0.0.1:9/dsh-market/dsh-tool-gdrive-9.9.9-abc.tgz'
	assert.equal((await install(url, '9.9.9', false)).kind, 'restart')
	assert.deepEqual(JSON.parse(JSON.stringify(installs)), [{ spec: `dsh-tool-gdrive@${url}`, options: { enabled: false, requestId: installs[0]!.options.requestId } }])
	assert.equal(duringInstall, '9.9.9')
	assert.equal(store()?.get(RESTART_KEY), '9.9.9')
	/* 页面按新包重挂后（新的 inject 面）仍读得到 */
	assert.equal((action.inject!().restartPending as (v: string) => boolean)('9.9.9'), true)
	assert.equal((face.restartPending as (v: string) => boolean)('9.9.8'), false)
	application = 'failed'
	assert.equal((await install(url, '9.9.9', true)).kind, 'failed')
	assert.equal(store()?.has(RESTART_KEY), false)
})
