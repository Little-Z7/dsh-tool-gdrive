/**
 * 跑一遍真的客户端入口：测试里用 esbuild 以与 esbuild.client.mjs 相同的选项在内存里构建当前 src/client，
 * 信封调 `__ModuleLoader__.load`，factory 只向壳要它声明的外部模块，apply 在一份假 ctx 上登记配置页与「检查更新」。
 * 另有一条守卫：内存构建结果必须与已提交的 lib/client.js 逐字节相同（产物过期即失败）。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import vm from 'node:vm'
import { buildClientSource, committedClient, EXTERNALS } from './build.test-helper.ts'

const RESTART_KEY = 'dsh-tool-gdrive.restart-pending'
const DEFAULT_INDEX = 'https://tv.auraaigc.ccwu.cc:56814/dsh-market/index.json'

let lastSpecs: Array<{ field?: string; parse?: (text: string) => unknown }> = []
class FakeForm {
	constructor(_scope: unknown, specs: typeof lastSpecs) {
		lastSpecs = specs
	}
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
type Snap = { status: 'loading' | 'ready' | 'unavailable'; value: Record<string, unknown> | undefined }

/** 装好一份假宿主，返回装好的插件与可操控的零件。 */
async function boot(initial: Snap) {
	const source = await buildClientSource()
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
	const registered: Registered[] = []
	const injected = new Map<string, (scope: unknown) => void>()
	let snap: Snap = initial
	const listeners = new Set<() => void>()
	const setSnap = (next: Snap) => {
		snap = next
		for (const l of [...listeners]) l()
	}
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
			get: () => ({
				getSnapshot: () => ({ ...snap, base: {}, user: {}, writable: true, revision: 1 }),
				subscribe: (l: () => void) => {
					listeners.add(l)
					return () => void listeners.delete(l)
				},
				mutate: async () => true
			})
		}
	}
	;(plugin.apply as (c: unknown) => void)(ctx)
	const installs: Array<{ spec: string; options: { enabled?: boolean; requestId?: string } }> = []
	let application = 'restart-required'
	let duringInstall: string | undefined
	const store = () => vm.runInContext(`globalThis[Symbol.for('dsh-tool-gdrive.window-store')]`, context) as Map<string, string> | undefined
	const pluginManager = {
		installBundle: async (spec: string, options: { enabled?: boolean; requestId?: string }) => {
			installs.push({ spec, options })
			/* DSH 装成功那一刻就热替换浏览器半侧，待重启记录必须在这之前已经写好 */
			duringInstall = store()?.get(RESTART_KEY)
			return { ok: true, value: { application } }
		},
		waitForInstall: async () => ({ ok: true, value: null })
	}
	injected.get('remote.pluginManager')?.({ ...ctx, remote: { pluginManager } })
	return {
		plugin,
		registered,
		injected,
		fetched,
		listeners,
		setSnap,
		store,
		installs,
		setApplication: (a: string) => (application = a),
		duringInstall: () => duringInstall,
		face: () => registered.find((r) => r.id === 'gdrive-update')!.inject!()
	}
}

const ready = (marketUrl?: unknown): Snap => ({ status: 'ready', value: marketUrl === undefined ? {} : { marketUrl } })
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v))

test('已提交的 lib/client.js 与当前源码的构建结果逐字节相同（过期请先 npm run build）', async () => {
	const built = await buildClientSource()
	assert.ok(built === committedClient(), 'lib/client.js 与 src/client 的构建结果不一致：产物过期了，先跑 npm run build 再提交')
})

test('client：inject 含 remote，登记 remote.pluginManager 与详情页按钮；读配置节里的 marketUrl', async () => {
	const h = await boot(ready('http://127.0.0.1:9'))
	// vm 新上下文里的数组原型不同，先拷回本 realm
	assert.deepEqual([...(h.plugin.inject as string[])], ['slots', 'locale', 'configForms', 'remote'])
	assert.deepEqual([...h.injected.keys()], ['remote.pluginManager'])
	assert.ok(h.registered.some((r) => r.name === 'plugins.row.config'))
	const action = h.registered.find((r) => r.id === 'gdrive-update')!
	assert.equal(action.name, 'plugins.detail.actions')
	const face = h.face()
	assert.equal(typeof face.checkUpdate, 'function')
	/* 读的是配置节里的 marketUrl，且是调用时现读 */
	await (face.checkUpdate as (v: string) => Promise<unknown>)('0.2.6')
	h.setSnap(ready())
	await (face.checkUpdate as (v: string) => Promise<unknown>)('0.2.6')
	h.setSnap({ status: 'unavailable', value: undefined })
	await (face.checkUpdate as (v: string) => Promise<unknown>)('0.2.6')
	assert.deepEqual(h.fetched, ['http://127.0.0.1:9/dsh-market/index.json', DEFAULT_INDEX, DEFAULT_INDEX])
})

test('client：配置还在 loading 时不请求缺省市场，就绪后只请求自定义地址；一直 loading 不发请求；作废后不发请求', async () => {
	const h = await boot({ status: 'loading', value: undefined })
	const check = h.face().checkUpdate as (v: string, signal?: AbortSignal) => Promise<unknown>
	const pending = check('0.2.6')
	await new Promise((r) => setTimeout(r, 20))
	assert.deepEqual(h.fetched, [], 'loading 期间不能拿缺省市场顶替')
	assert.equal(h.listeners.size, 1)
	h.setSnap({ status: 'loading', value: undefined })
	h.setSnap(ready('http://127.0.0.1:9'))
	await pending
	assert.deepEqual(h.fetched, ['http://127.0.0.1:9/dsh-market/index.json'])
	assert.equal(h.listeners.size, 0)

	// 一直 loading，被作废（组件卸载 / 新的检查）：不发请求，返回「读不到配置」
	const g = await boot({ status: 'loading', value: undefined })
	const ctl = new AbortController()
	const result = (g.face().checkUpdate as (v: string, signal: AbortSignal) => Promise<unknown>)('0.2.6', ctl.signal)
	ctl.abort()
	assert.deepEqual(json(await result), { kind: 'failed', failure: { code: 'config-loading' } })
	assert.deepEqual(g.fetched, [])
	assert.equal(g.listeners.size, 0)
})

test('client：page.tsx 传给表单模型的 marketUrl 字段：空串清除，非法阻止保存，合格存归一化 origin', async () => {
	await boot(ready())
	const spec = lastSpecs.find((s) => s.field === 'marketUrl')
	assert.ok(spec && typeof spec.parse === 'function', '表单里要有 marketUrl 字段')
	const parse = (text: string) => json(spec!.parse!(text) ?? null)
	assert.deepEqual(parse(''), { kind: 'clear' })
	assert.deepEqual(parse('   '), { kind: 'clear' })
	assert.equal(parse('ftp://x'), null)
	assert.equal(parse('http://example.com'), null)
	assert.equal(parse('https://tv.example/path'), null)
	assert.deepEqual(parse('https://tv-test.auraaigc.ccwu.cc:56812/'), { kind: 'set', value: 'https://tv-test.auraaigc.ccwu.cc:56812' })
	assert.deepEqual(parse('http://127.0.0.1:8765'), { kind: 'set', value: 'http://127.0.0.1:8765' })
})

test('client：待重启记录先写后装；失败恢复旧记录，不删仍有效的待重启；applied 清除', async () => {
	const h = await boot(ready())
	const face = h.face()
	const install = face.installUpdate as (u: string, v: string, enabled: boolean) => Promise<{ kind: string }>
	const pending = face.restartPending as (v: string) => boolean
	const url = (v: string) => `http://127.0.0.1:9/dsh-market/dsh-tool-gdrive-${v}-abc.tgz`
	assert.equal((await install(url('0.2.7'), '0.2.7', false)).kind, 'restart')
	assert.deepEqual(json(h.installs[0]), { spec: `dsh-tool-gdrive@${url('0.2.7')}`, options: { enabled: false, requestId: h.installs[0]!.options.requestId } })
	assert.equal(h.installs[0]!.options.enabled, false)
	assert.equal(h.duringInstall(), '0.2.7', '记录必须在 installBundle 之前已经写好')
	assert.equal(h.store()?.get(RESTART_KEY), '0.2.7')
	/* 页面按新包重挂后（新的 inject 面）仍读得到 */
	assert.equal((h.face().restartPending as (v: string) => boolean)('0.2.7'), true)
	assert.equal(pending('0.2.6'), false)
	/* 已有待重启 0.2.7，再装 0.2.8 失败 → 记录仍为 0.2.7、页面仍提示 0.2.7 待重启 */
	h.setApplication('failed')
	assert.equal((await install(url('0.2.8'), '0.2.8', true)).kind, 'failed')
	assert.equal(h.duringInstall(), '0.2.8')
	assert.equal(h.store()?.get(RESTART_KEY), '0.2.7')
	assert.equal(pending('0.2.7'), true)
	assert.equal(pending('0.2.8'), false)
	h.setApplication('cancelled')
	assert.equal((await install(url('0.2.8'), '0.2.8', true)).kind, 'failed')
	assert.equal(h.store()?.get(RESTART_KEY), '0.2.7')
	/* applied：清除 */
	h.setApplication('applied')
	assert.equal((await install(url('0.2.8'), '0.2.8', true)).kind, 'applied')
	assert.equal(h.store()?.has(RESTART_KEY), false)
	/* 没有旧记录时失败 → 删除 */
	h.setApplication('failed')
	assert.equal((await install(url('0.2.9'), '0.2.9', true)).kind, 'failed')
	assert.equal(h.store()?.has(RESTART_KEY), false)
})
