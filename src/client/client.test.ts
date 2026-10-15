/**
 * 跑一遍真的客户端入口：测试里用 esbuild 以与 esbuild.client.mjs 相同的选项在内存里构建当前 src/client，
 * 信封调 `__ModuleLoader__.load`，factory 只向壳要它声明的外部模块，apply 在一份假 ctx 上登记配置页与「检查更新」。
 * 另有一条守卫：内存构建结果必须与已提交的 lib/client.js 逐字节相同（产物过期即失败）。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import vm from 'node:vm'
import { buildClientSource, committedClient, externals } from './build.test-helper.ts'

const RESTART_KEY = 'dsh-tool-gdrive.restart-pending'
const DEFAULT_INDEX = 'https://tv.auraaigc.ccwu.cc:56814/dsh-market/index.json'

let lastSpecs: Array<{ field?: string; parse?: (text: string) => unknown }> = []
/** 假宿主表单模型的保存状态：测试里翻 saving / failed 再 notify，等价于宿主表单在保存途中发布了新快照。 */
const formState = { saving: false, failed: false, saveResult: undefined as Promise<void> | undefined, listeners: new Set<() => void>() }
const notifyForm = () => {
	for (const l of [...formState.listeners]) l()
}
class FakeForm {
	constructor(_scope: unknown, specs: typeof lastSpecs) {
		lastSpecs = specs
	}
	bind(project: () => unknown) {
		return {
			getSnapshot: () => project(),
			subscribe: (l: () => void) => {
				formState.listeners.add(l)
				return () => void formState.listeners.delete(l)
			}
		}
	}
	shell() {
		return { available: true, writable: true, dirty: false, invalid: false, saving: formState.saving, failed: formState.failed }
	}
	field() {
		return { text: '', overridden: false, invalid: false }
	}
	actions() {
		return { edit() {}, resetField() {}, save: () => formState.saveResult, discard() {} }
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
type Mode = 'restart-required' | 'applied' | 'failed' | 'cancelled' | 'reject'

/** 装好一份假宿主，返回装好的插件与可操控的零件；`reboot()` 在同一份 window 上再装一份（模拟热替换）。 */
async function boot(initial: Snap) {
	formState.saving = false
	formState.failed = false
	formState.saveResult = undefined
	formState.listeners.clear()
	const source = await buildClientSource()
	const allowed = await externals()
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
	let snap: Snap = initial
	const listeners = new Set<() => void>()
	const setSnap = (next: Snap) => {
		snap = next
		for (const l of [...listeners]) l()
	}
	const installs: Array<{ spec: string; options: { enabled?: boolean; requestId?: string } }> = []
	let mode: Mode = 'restart-required'
	let hold: Promise<void> | undefined
	let release: () => void = () => {}
	let duringInstall: string | undefined
	const store = () => vm.runInContext(`globalThis[Symbol.for('dsh-tool-gdrive.window-store')]`, context) as Map<string, string> | undefined
	const pluginManager = {
		installBundle: async (spec: string, options: { enabled?: boolean; requestId?: string }) => {
			installs.push({ spec, options })
			/* DSH 装成功那一刻就热替换浏览器半侧：目标版本必须在这之前已经记下 */
			duringInstall = store()?.get('dsh-tool-gdrive.install-inflight')
			if (hold) await hold
			if (mode === 'reject') throw new Error('socket exploded')
			return { ok: true, value: { application: mode } }
		},
		waitForInstall: async () => ({ ok: true, value: null })
	}
	/** 装一份插件实例（同一份 window、同一个假宿主）。 */
	const instance = () => {
		vm.runInContext(source, context)
		assert.equal(loaded?.id, 'dsh-tool-gdrive')
		const plugin = loaded!.factory((name) => {
			assert.ok(allowed.includes(name), `unexpected module request ${name}`)
			return name === '@deepseek-ai/dsh-client-ui-primitives'
				? { SettingsFormModel: FakeForm, settingsTextField: () => ({}), settingsNumberField: () => ({}) }
				: {}
		})
		const registered: Registered[] = []
		const injected = new Map<string, (scope: unknown) => void>()
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
		injected.get('remote.pluginManager')?.({ ...ctx, remote: { pluginManager } })
		return { plugin, registered, injected }
	}
	let current = instance()
	return {
		get plugin() {
			return current.plugin
		},
		get registered() {
			return current.registered
		},
		get injected() {
			return current.injected
		},
		fetched,
		listeners,
		setSnap,
		store,
		installs,
		setMode: (m: Mode) => (mode = m),
		/** 之后的 installBundle 会停在这里，直到 `release()`。 */
		holdInstalls: () => {
			hold = new Promise<void>((resolve) => (release = resolve))
		},
		release: () => {
			hold = undefined
			release()
		},
		duringInstall: () => duringInstall,
		face: () => current.registered.find((r) => r.id === 'gdrive-update')!.inject!(),
		/** 模拟热替换：同一份 window 上再装一份新的插件实例。 */
		reboot: () => {
			current = instance()
			return current.registered.find((r) => r.id === 'gdrive-update')!.inject!()
		}
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

const ORIGIN = 'http://127.0.0.1:9'
const url = (v: string) => `${ORIGIN}/dsh-market/dsh-tool-gdrive-${v}-abc.tgz`
type Face = Record<string, unknown>
const installOf = (face: Face) => face.installUpdate as (u: string, v: string, enabled: boolean, origin: string) => Promise<{ kind: string }>
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms))

test('client：配置表单保存进行中 → 检查先等；保存成功后只请求新地址，0 次请求旧地址 / 缺省市场', async () => {
	const h = await boot(ready())
	formState.saving = true
	notifyForm()
	const check = h.face().checkUpdate as (v: string, signal?: AbortSignal) => Promise<unknown>
	const pending = check('0.2.6')
	await tick()
	assert.deepEqual(h.fetched, [], '保存还没落定：宿主「最后接受」的值仍是旧的，不能据此请求')
	h.setSnap(ready(ORIGIN)) // 宿主接受了
	assert.deepEqual(h.fetched, [], '值变了但保存还没收尾，仍在等')
	formState.saving = false
	notifyForm()
	await pending
	assert.deepEqual(h.fetched, [`${ORIGIN}/dsh-market/index.json`])
	assert.equal(h.listeners.size, 0)
	assert.equal(formState.listeners.size, 0, '检查结束后对保存状态的订阅也撤掉了')
})

test('client：保存失败 → 按旧的已接受值检查，结果带 saveFailed（不静默当成正常）', async () => {
	const h = await boot(ready('http://127.0.0.1:7'))
	formState.saving = true
	notifyForm()
	const pending = (h.face().checkUpdate as (v: string) => Promise<unknown>)('0.2.6')
	await tick()
	assert.deepEqual(h.fetched, [])
	formState.saving = false
	formState.failed = true
	notifyForm()
	const result = json(await pending) as { kind: string; saveFailed?: boolean }
	assert.deepEqual(h.fetched, ['http://127.0.0.1:7/dsh-market/index.json'])
	assert.equal(result.saveFailed, true)
	assert.equal(result.kind, 'failed') // 假 fetch 回 500：失败结果上也带着提示
})

test('client：save 动作外包一层——保存的 Promise 没落定前检查等着（宿主表单没发布 saving 时的兜底）', async () => {
	const h = await boot(ready())
	const row = h.registered.find((r) => r.name === 'plugins.row.config')!
	const actions = row.inject!() as { save: () => unknown }
	let done!: () => void
	formState.saveResult = new Promise<void>((resolve) => (done = resolve))
	actions.save() // 表单快照里的 saving 始终是 false，只有外包层知道保存在路上
	const pending = (h.face().checkUpdate as (v: string) => Promise<unknown>)('0.2.6')
	await tick()
	assert.deepEqual(h.fetched, [], '保存的 Promise 没落定，不能请求')
	h.setSnap(ready(ORIGIN))
	done()
	await pending
	assert.deepEqual(h.fetched, [`${ORIGIN}/dsh-market/index.json`])
})

test('client：已接受的市场地址变了 → 通知组件重新检查（watchSite）', async () => {
	const h = await boot(ready('http://127.0.0.1:7'))
	const watch = h.face().watchSite as (l: () => void) => () => void
	let n = 0
	const off = watch(() => n++)
	h.setSnap(ready('http://127.0.0.1:7'))
	assert.equal(n, 0)
	h.setSnap(ready(ORIGIN))
	assert.equal(n, 1)
	off()
	h.setSnap(ready('http://127.0.0.1:8'))
	assert.equal(n, 1)
})

test('client：点更新时站点已变 → 不安装（stale）；站点没变才装', async () => {
	const h = await boot(ready(ORIGIN))
	const face = h.face()
	h.setSnap(ready('http://127.0.0.1:10')) // 检查之后，已接受的地址变了
	assert.deepEqual(json(await installOf(face)(url('0.2.7'), '0.2.7', true, ORIGIN)), { kind: 'stale' })
	assert.equal(h.installs.length, 0)
	assert.equal(h.store()?.has('dsh-tool-gdrive.install-inflight') ?? false, false)
	h.setSnap(ready(ORIGIN))
	assert.equal((await installOf(face)(url('0.2.7'), '0.2.7', true, ORIGIN)).kind, 'restart')
	assert.equal(h.installs.length, 1)
})

test('client：已接受地址与点击时保存还在进行 → 先等落定再比对站点', async () => {
	const h = await boot(ready(ORIGIN))
	formState.saving = true
	notifyForm()
	const p = installOf(h.face())(url('0.2.7'), '0.2.7', true, ORIGIN)
	await tick()
	assert.equal(h.installs.length, 0, '保存没落定不装')
	h.setSnap(ready('http://127.0.0.1:10'))
	formState.saving = false
	notifyForm()
	assert.deepEqual(json(await p), { kind: 'stale' })
	assert.equal(h.installs.length, 0)
})

test('client：已有安装在进行 → 新挂载 / 再次点击不再发起新安装，只调用一次 installBundle，等同一个结果', async () => {
	const h = await boot(ready(ORIGIN))
	h.holdInstalls()
	const first = installOf(h.face())(url('0.2.8'), '0.2.8', true, ORIGIN)
	await tick()
	assert.equal(h.installs.length, 1)
	assert.equal(h.duringInstall(), '0.2.8', '进行中的目标版本在 installBundle 之前已记下')
	const second = installOf(h.face())(url('0.2.8'), '0.2.8', true, ORIGIN) // 第二次挂载的组件
	const ongoing = h.face().inflight as () => { version: string; promise: Promise<{ kind: string }> } | undefined
	assert.equal(ongoing()?.version, '0.2.8')
	await tick()
	assert.equal(h.installs.length, 1, '第二次不再调用 installBundle')
	h.release()
	assert.equal((await first).kind, 'restart')
	assert.equal((await second).kind, 'restart')
	assert.equal(h.installs.length, 1)
	assert.equal(ongoing(), undefined)
	assert.equal(h.store()?.get('dsh-tool-gdrive.restart-pending'), '0.2.8')
	assert.equal(h.store()?.has('dsh-tool-gdrive.install-inflight'), false)
})

test('client：热替换——安装进行中组件卸载重挂（新的插件实例），盘上版本已是目标版本 → 显示待重启，且仍只装一次', async () => {
	const h = await boot(ready(ORIGIN))
	h.holdInstalls()
	const first = installOf(h.face())(url('0.2.8'), '0.2.8', true, ORIGIN)
	await tick()
	const face2 = h.reboot() // DSH 装成功那一刻热替换浏览器半侧：新模块、新组件，同一份 window
	const restartPending = face2.restartPending as (v: string) => boolean
	assert.equal(restartPending('0.2.8'), true, '看到进行中的目标版本 == 盘上版本，视为待重启')
	assert.equal(restartPending('0.2.7'), false)
	const ongoing = (face2.inflight as () => { version: string; promise: Promise<{ kind: string }> } | undefined)()
	assert.equal(ongoing?.version, '0.2.8', '新实例看得到旧实例的进行中安装')
	const again = installOf(face2)(url('0.2.8'), '0.2.8', true, ORIGIN)
	await tick()
	assert.equal(h.installs.length, 1)
	h.release()
	assert.equal((await first).kind, 'restart')
	assert.equal((await again).kind, 'restart')
	assert.equal(restartPending('0.2.8'), true)
	assert.equal(h.installs.length, 1)
})

test('client：已确认 0.2.7，再装 0.2.8 失败 / 取消 / 拒绝 → 仍是 0.2.7；restart 更新；applied 清除', async () => {
	const h = await boot(ready(ORIGIN))
	const face = h.face()
	const pending = face.restartPending as (v: string) => boolean
	assert.equal((await installOf(face)(url('0.2.7'), '0.2.7', false, ORIGIN)).kind, 'restart')
	assert.equal(h.installs[0]!.options.enabled, false)
	assert.equal(h.installs[0]!.spec, `dsh-tool-gdrive@${url('0.2.7')}`)
	assert.equal(h.duringInstall(), '0.2.7', '记录必须在 installBundle 之前已经写好')
	assert.equal(h.store()?.get('dsh-tool-gdrive.restart-pending'), '0.2.7')
	assert.equal((h.face().restartPending as (v: string) => boolean)('0.2.7'), true, '页面按新包重挂后仍读得到')
	assert.equal(pending('0.2.6'), false)
	for (const m of ['failed', 'cancelled', 'reject'] as const) {
		h.setMode(m)
		assert.equal((await installOf(face)(url('0.2.8'), '0.2.8', true, ORIGIN)).kind, 'failed', m)
		assert.equal(h.store()?.get('dsh-tool-gdrive.restart-pending'), '0.2.7', m)
		assert.equal(pending('0.2.7'), true, m)
		assert.equal(pending('0.2.8'), false, m)
		assert.equal(h.store()?.has('dsh-tool-gdrive.install-inflight'), false, m)
	}
	h.setMode('restart-required')
	assert.equal((await installOf(face)(url('0.2.8'), '0.2.8', true, ORIGIN)).kind, 'restart')
	assert.equal(h.store()?.get('dsh-tool-gdrive.restart-pending'), '0.2.8')
	h.setMode('applied')
	assert.equal((await installOf(face)(url('0.2.9'), '0.2.9', true, ORIGIN)).kind, 'applied')
	assert.equal(h.store()?.has('dsh-tool-gdrive.restart-pending'), false)
})

test('client：ready 后同一任务内立即 abort → fetch 0 次', async () => {
	const h = await boot(ready(ORIGIN))
	const ctl = new AbortController()
	const result = (h.face().checkUpdate as (v: string, signal: AbortSignal) => Promise<unknown>)('0.2.6', ctl.signal)
	ctl.abort()
	assert.equal((json(await result) as { kind: string }).kind, 'failed')
	assert.deepEqual(h.fetched, [])
})
