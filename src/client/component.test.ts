/**
 * 组件级测试：把当前源码里的 UpdateAction 在内存里打成 cjs，用一个最小的 React 替身渲染它
 * （只实现它用到的 useState / useEffect / useRef 与 jsx 运行时；jsx 返回 `{ type, props }` 元素对象，
 * setState 触发重渲染，effect 在渲染后执行），遍历元素树找按钮与状态文字。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildComponentSource } from './build.test-helper.ts'
import type { InstallOutcome, UpdateCheck } from './update.ts'

interface El {
	type: unknown
	props: Record<string, unknown>
}

// ───────────────────────── React 替身 ─────────────────────────

interface Handle {
	hooks: unknown[]
	idx: number
	effects: Array<() => void>
	render: () => void
	unmounted: boolean
}
let current: Handle | null = null
let lateSetStates = 0

const useState = <T>(initial: T): [T, (v: T) => void] => {
	const h = current!
	const i = h.idx++
	if (!(i in h.hooks)) {
		h.hooks[i] = { value: initial, render: h.render, handle: h }
	}
	const slot = h.hooks[i] as { value: T; render: () => void }
	return [
		slot.value,
		(v: T) => {
			/* 卸载后还有人调 setState（迟到的结果没被拦住）就记一次。 */
			if (h.unmounted) lateSetStates++
			if (!Object.is(slot.value, v)) {
				slot.value = v
				slot.render()
			}
		}
	]
}
const useRef = <T>(initial: T): { current: T } => {
	const h = current!
	const i = h.idx++
	if (!(i in h.hooks)) h.hooks[i] = { current: initial }
	return h.hooks[i] as { current: T }
}
const useEffect = (fn: () => void | (() => void), deps?: unknown[]): void => {
	const h = current!
	const i = h.idx++
	const slot = (h.hooks[i] ??= { deps: undefined, cleanup: undefined }) as { deps?: unknown[]; cleanup?: void | (() => void); first?: boolean }
	const changed = !slot.first || !deps || !slot.deps || deps.some((d, k) => !Object.is(d, slot.deps![k]))
	slot.first = true
	if (!changed) return
	slot.deps = deps
	h.effects.push(() => {
		if (typeof slot.cleanup === 'function') slot.cleanup()
		slot.cleanup = fn()
	})
}
const jsx = (type: unknown, props: Record<string, unknown>): El => ({ type, props })

function mount(Component: (props: any) => El | null, initialProps: Record<string, unknown>) {
	let props = initialProps
	const handle: Handle = { hooks: [], idx: 0, effects: [], render: () => render(), unmounted: false }
	let tree: El | null = null
	let rendering = false
	let dirty = false
	let unmounted = false
	const render = (): void => {
		if (unmounted) return
		if (rendering) {
			dirty = true
			return
		}
		rendering = true
		try {
			do {
				dirty = false
				handle.idx = 0
				handle.effects = []
				current = handle
				tree = Component(props)
				current = null
				for (const run of handle.effects) run()
			} while (dirty)
		} finally {
			rendering = false
			current = null
		}
	}
	render()
	return {
		tree: () => tree,
		/** 换 props 重渲染（页面按新的 subject 重画）。 */
		update: (next: Record<string, unknown>) => {
			props = next
			render()
		},
		unmount: () => {
			unmounted = true
			handle.unmounted = true
			for (const slot of handle.hooks as Array<{ cleanup?: void | (() => void) }>) if (slot && typeof slot.cleanup === 'function') slot.cleanup()
		}
	}
}

const flush = async (): Promise<void> => {
	for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
}

// ───────────────────────── 元素树工具 ─────────────────────────

const kids = (el: El): unknown[] => {
	const c = el.props.children
	return c === undefined || c === null || c === false ? [] : Array.isArray(c) ? c.flat(Infinity) : [c]
}
const isEl = (v: unknown): v is El => typeof v === 'object' && v !== null && 'type' in v && 'props' in v
function walk(el: unknown, fn: (e: El) => void): void {
	if (!isEl(el)) return
	fn(el)
	for (const k of kids(el)) walk(k, fn)
}
function textOf(el: unknown): string {
	if (typeof el === 'string' || typeof el === 'number') return String(el)
	if (!isEl(el)) return ''
	return kids(el).map(textOf).join('')
}
function find(tree: El | null, pred: (e: El) => boolean): El[] {
	const out: El[] = []
	walk(tree, (e) => pred(e) && out.push(e))
	return out
}
const buttons = (tree: El | null) => find(tree, (e) => e.type === 'button')
const statuses = (tree: El | null) => find(tree, (e) => e.props.role === 'alert' || e.props.role === 'status')

// ───────────────────────── 加载组件 ─────────────────────────

async function loadComponent(): Promise<(props: any) => El | null> {
	const code = await buildComponentSource()
	const module = { exports: {} as Record<string, unknown> }
	const req = (name: string): unknown => {
		if (name === 'react') return { useState, useEffect, useRef }
		if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
		if (name === '@deepseek-ai/dsh-client-ui-primitives') return { Button: 'button', TextShimmer: 'span' }
		throw new Error(`unexpected module ${name}`)
	}
	new Function('require', 'module', 'exports', code)(req, module, module.exports)
	return module.exports.UpdateAction as (props: any) => El | null
}

const t = (key: string, params?: Record<string, string | number>): string => (params && Object.keys(params).length > 0 ? `${key}${JSON.stringify(params)}` : key)
const own = (enabled?: boolean) => ({ kind: 'bundle', pkg: { name: 'dsh-tool-gdrive', version: '0.2.6', installed: true, ...(enabled === undefined ? {} : { enabled }) } })
const AVAILABLE = { kind: 'available', version: '0.2.7', url: 'http://127.0.0.1:1/dsh-market/x.tgz', origin: 'http://127.0.0.1:1' } as const satisfies UpdateCheck

function props(over: Record<string, unknown> = {}) {
	const calls = { check: [] as Array<string | undefined>, signals: [] as Array<AbortSignal | undefined>, install: [] as Array<[string, string, boolean, string]> }
	const base = {
		subject: own(true),
		t,
		checkUpdate: (installed?: string, signal?: AbortSignal) => {
			calls.check.push(installed)
			calls.signals.push(signal)
			return Promise.resolve(AVAILABLE)
		},
		installUpdate: (url: string, version: string, enabled: boolean, origin: string): Promise<InstallOutcome> => {
			calls.install.push([url, version, enabled, origin])
			return Promise.resolve({ kind: 'restart' })
		},
		restartPending: () => false
	}
	return { calls, props: { ...base, ...over } }
}

// ───────────────────────── 用例 ─────────────────────────

test('UpdateAction：subject.pkg.enabled 为 false / true / undefined 时，点击更新传给 installUpdate 的 enabled 为 false / true / true', async () => {
	const UpdateAction = await loadComponent()
	for (const [enabled, expected] of [[false, false], [true, true], [undefined, true]] as const) {
		const { calls, props: p } = props({ subject: own(enabled) })
		const view = mount(UpdateAction, p)
		await flush()
		const [button] = buttons(view.tree())
		assert.ok(button, '检查返回 available 后要有按钮')
		assert.equal(textOf(button), 'updateInstall{"version":"0.2.7"}')
		;(button!.props.onClick as () => void)()
		await flush()
		assert.deepEqual(calls.install, [[AVAILABLE.url, '0.2.7', expected, AVAILABLE.origin]], `enabled=${String(enabled)}`)
		assert.equal(textOf(statuses(view.tree())[0]), 'updateDoneRestart{"version":"0.2.7"}')
		view.unmount()
	}
})

test('UpdateAction：别的包、不是 bundle、没装好时渲染 null，且不发起检查', async () => {
	const UpdateAction = await loadComponent()
	const subjects = [
		{ kind: 'bundle', pkg: { name: 'other-plugin', version: '1.0.0', installed: true, enabled: true } },
		{ kind: 'row', pkg: { name: 'dsh-tool-gdrive', version: '0.2.6', installed: true, enabled: true }, row: {} },
		{ kind: 'item', id: 'dsh-tool-gdrive' },
		{ kind: 'bundle', pkg: { name: 'dsh-tool-gdrive', version: '0.2.6', installed: false, enabled: true } }
	]
	for (const subject of subjects) {
		const { calls, props: p } = props({ subject })
		const view = mount(UpdateAction, p)
		await flush()
		assert.equal(view.tree(), null, JSON.stringify(subject))
		assert.deepEqual(calls.check, [])
		view.unmount()
	}
})

test('UpdateAction：检查失败时原因写在正文元素里（role=alert），按钮为「重试」，点重试重新检查', async () => {
	const UpdateAction = await loadComponent()
	let n = 0
	const { props: p } = props({
		checkUpdate: () => {
			n++
			return Promise.resolve(n === 1 ? ({ kind: 'failed', failure: { code: 'missing' } } as UpdateCheck) : AVAILABLE)
		}
	})
	const view = mount(UpdateAction, p)
	await flush()
	const [alert] = statuses(view.tree())
	assert.equal(alert!.props.role, 'alert')
	assert.equal(textOf(alert), 'updateCheckFailed{"reason":"updateReasonMissing"}')
	assert.equal(alert!.props.title, undefined, '原因不能只放在 title 里')
	const [retry] = buttons(view.tree())
	assert.equal(textOf(retry), 'updateRetry')
	assert.equal(find(view.tree(), (e) => textOf(e) === 'updateInstall{"version":"0.2.7"}').length > 0, false)
	;(retry!.props.onClick as () => void)()
	await flush()
	assert.equal(textOf(buttons(view.tree())[0]), 'updateInstall{"version":"0.2.7"}')
	assert.equal(n, 2)
	view.unmount()
})

test('UpdateAction：检查与安装的 Promise 拒绝时转成可读的失败状态，不会卡在「正在检查」', async () => {
	const UpdateAction = await loadComponent()
	const rejecting = props({ checkUpdate: () => Promise.reject(new Error('kaboom')) })
	const v1 = mount(UpdateAction, rejecting.props)
	await flush()
	assert.match(textOf(statuses(v1.tree())[0]), /^updateCheckFailed.*updateReasonUnexpected.*kaboom/)
	assert.equal(textOf(buttons(v1.tree())[0]), 'updateRetry')
	v1.unmount()
	const bad = props({ installUpdate: () => Promise.reject(JSON.parse('{"toString":null}')) })
	const v2 = mount(UpdateAction, bad.props)
	await flush()
	;(buttons(v2.tree())[0]!.props.onClick as () => void)()
	await flush()
	const [alert] = statuses(v2.tree())
	assert.equal(alert!.props.role, 'alert')
	assert.match(textOf(alert), /^updateFailed.*updateReasonUnexpected.*unknown error/)
	assert.equal(textOf(buttons(v2.tree())[0]), 'updateRetry')
	v2.unmount()
})

test('UpdateAction：卸载与新一次检查会作废上一次（signal 被中止，迟到的结果不显示）', async () => {
	const UpdateAction = await loadComponent()
	const resolvers: Array<(c: UpdateCheck) => void> = []
	const { calls, props: p } = props({
		checkUpdate: (installed?: string, signal?: AbortSignal) => {
			calls.check.push(installed)
			calls.signals.push(signal)
			return new Promise<UpdateCheck>((resolve) => resolvers.push(resolve))
		}
	})
	lateSetStates = 0
	const view = mount(UpdateAction, p)
	await flush()
	assert.equal(calls.check.length, 1)
	assert.equal(calls.signals[0]!.aborted, false)
	view.unmount()
	assert.equal(calls.signals[0]!.aborted, true, '卸载要中止还在等的检查')
	resolvers[0]!(AVAILABLE)
	await flush()
	assert.equal(textOf(buttons(view.tree())[0]), 'updateChecking', '卸载后迟到的结果不写回')
	assert.equal(lateSetStates, 0, '卸载后不许再有 setState')
})

test('UpdateAction：错误颜色在浏览器支持 color-mix 时用 color-mix，不支持时退回带回退值的 token 颜色', async () => {
	const UpdateAction = await loadComponent()
	const g = globalThis as { CSS?: unknown }
	const had = 'CSS' in g
	const saved = g.CSS
	try {
		const colorOf = async (supports: boolean | 'absent') => {
			if (supports === 'absent') delete g.CSS
			else g.CSS = { supports: () => supports }
			const { props: p } = props({ checkUpdate: () => Promise.resolve({ kind: 'failed', failure: { code: 'missing' } } as UpdateCheck) })
			const view = mount(UpdateAction, p)
			await flush()
			const style = statuses(view.tree())[0]!.props.style as { color: string }
			view.unmount()
			return style.color
		}
		const mixed = await colorOf(true)
		assert.match(mixed, /^color-mix\(in srgb, var\(--dsw-alias-state-error-primary, #[0-9a-f]{6}\) 80%, var\(--dsw-alias-label-primary, #[0-9a-f]{6}\)\)$/)
		for (const mode of [false, 'absent'] as const) {
			const plain = await colorOf(mode)
			assert.match(plain, /^var\(--dsw-alias-state-error-primary, #[0-9a-f]{6}\)$/, String(mode))
		}
	} finally {
		if (had) g.CSS = saved
		else delete g.CSS
	}
})

test('UpdateAction：已装版本变了会再查一次，较早那次迟到的结果不覆盖新的结果', async () => {
	const UpdateAction = await loadComponent()
	const resolvers: Array<(c: UpdateCheck) => void> = []
	const signals: AbortSignal[] = []
	const { props: p } = props({
		subject: own(true),
		checkUpdate: (_installed?: string, signal?: AbortSignal) => {
			signals.push(signal!)
			return new Promise<UpdateCheck>((resolve) => resolvers.push(resolve))
		}
	})
	const view = mount(UpdateAction, p)
	await flush()
	assert.equal(resolvers.length, 1)
	view.update({ ...p, subject: { kind: 'bundle', pkg: { name: 'dsh-tool-gdrive', version: '0.2.7', installed: true, enabled: true } } })
	await flush()
	assert.equal(resolvers.length, 2, '版本变了要再查一次')
	assert.equal(signals[0]!.aborted, true, '上一次被作废')
	resolvers[1]!({ kind: 'latest', version: '0.2.7' })
	await flush()
	assert.equal(textOf(statuses(view.tree())[0]), 'updateLatest{"version":"0.2.7"}')
	resolvers[0]!(AVAILABLE)
	await flush()
	assert.equal(textOf(statuses(view.tree())[0]), 'updateLatest{"version":"0.2.7"}', '迟到的旧结果不能盖掉新结果')
	view.unmount()
})

// ───────────────────────── 第二轮返工 ─────────────────────────

test('UpdateAction：卸载之后没有任何 setState（迟到的检查、安装、站点变化都被拦住）', async () => {
	const UpdateAction = await loadComponent()
	lateSetStates = 0
	const checks: Array<(c: UpdateCheck) => void> = []
	const installs: Array<(o: InstallOutcome) => void> = []
	let notify: () => void = () => {}
	const p = props({
		checkUpdate: () => new Promise<UpdateCheck>((resolve) => checks.push(resolve)),
		installUpdate: () => new Promise<InstallOutcome>((resolve) => installs.push(resolve)),
		watchSite: (l: () => void) => {
			notify = l
			return () => void unmounted++
		}
	})
	let unmounted = 0
	const view = mount(UpdateAction, p.props)
	await flush()
	checks[0]!(AVAILABLE)
	await flush()
	;(buttons(view.tree())[0]!.props.onClick as () => void)()
	await flush()
	view.unmount()
	assert.equal(unmounted, 1, '卸载要撤掉站点订阅')
	installs[0]!({ kind: 'restart' })
	notify()
	checks.forEach((r) => r(AVAILABLE))
	await flush()
	assert.equal(lateSetStates, 0, '卸载后不许再有 setState')
})

test('UpdateAction：已接受的市场地址变了 → 作废当前结果并重新检查；安装进行中不打断', async () => {
	const UpdateAction = await loadComponent()
	let notify: () => void = () => {}
	let n = 0
	const installResolvers: Array<(o: InstallOutcome) => void> = []
	const { props: p } = props({
		checkUpdate: (_i?: string, signal?: AbortSignal) => {
			n++
			void signal
			return Promise.resolve(AVAILABLE as UpdateCheck)
		},
		watchSite: (l: () => void) => {
			notify = l
			return () => {}
		},
		installUpdate: () => new Promise<InstallOutcome>((resolve) => installResolvers.push(resolve))
	})
	const view = mount(UpdateAction, p)
	await flush()
	assert.equal(n, 1)
	notify()
	await flush()
	assert.equal(n, 2, '地址变了要重新检查')
	;(buttons(view.tree())[0]!.props.onClick as () => void)()
	await flush()
	notify()
	await flush()
	assert.equal(n, 2, '安装进行中不重新检查')
	installResolvers[0]!({ kind: 'restart' })
	await flush()
	assert.equal(textOf(statuses(view.tree())[0]), 'updateDoneRestart{"version":"0.2.7"}')
	view.unmount()
})

test('UpdateAction：点更新时站点已变（stale）→ 不安装，改为重新检查，并把检查结果的 origin 交给 installUpdate', async () => {
	const UpdateAction = await loadComponent()
	let n = 0
	const seen: string[] = []
	const { props: p } = props({
		checkUpdate: () => {
			n++
			return Promise.resolve({ ...AVAILABLE, origin: n === 1 ? 'http://127.0.0.1:1' : 'http://127.0.0.1:2', url: `http://127.0.0.1:${n === 1 ? 1 : 2}/dsh-market/x.tgz` } as UpdateCheck)
		},
		installUpdate: (_u: string, _v: string, _e: boolean, origin: string) => {
			seen.push(origin)
			return Promise.resolve({ kind: 'stale' } as InstallOutcome)
		}
	})
	const view = mount(UpdateAction, p)
	await flush()
	;(buttons(view.tree())[0]!.props.onClick as () => void)()
	await flush()
	assert.deepEqual(seen, ['http://127.0.0.1:1'])
	assert.equal(n, 2, 'stale 后要重新检查')
	assert.equal(textOf(buttons(view.tree())[0]), 'updateInstall{"version":"0.2.7"}')
	assert.equal(statuses(view.tree()).length, 0, 'stale 不显示成安装结果')
	view.unmount()
})

test('UpdateAction：挂载时已有安装在进行 → 显示「正在安装 x…」并等同一个结果，不发起检查也不再装', async () => {
	const UpdateAction = await loadComponent()
	let resolve!: (o: InstallOutcome) => void
	const promise = new Promise<InstallOutcome>((r) => (resolve = r))
	const { calls, props: p } = props({ inflight: () => ({ version: '0.2.8', promise }) })
	const view = mount(UpdateAction, p)
	await flush()
	assert.deepEqual(calls.check, [], '有安装在进行时不发起检查')
	assert.equal(textOf(buttons(view.tree())[0]), 'updateInstalling{"version":"0.2.8"}')
	assert.equal(buttons(view.tree())[0]!.props.disabled, true)
	assert.deepEqual(calls.install, [])
	resolve({ kind: 'restart' })
	await flush()
	assert.equal(textOf(statuses(view.tree())[0]), 'updateDoneRestart{"version":"0.2.8"}')
	assert.deepEqual(calls.install, [])
	view.unmount()
})

test('UpdateAction：上次保存没成功时，结果旁边有提示（正文元素里），不静默显示成正常', async () => {
	const UpdateAction = await loadComponent()
	const { props: p } = props({ checkUpdate: () => Promise.resolve({ kind: 'latest', version: '0.2.6', saveFailed: true } as UpdateCheck) })
	const view = mount(UpdateAction, p)
	await flush()
	const texts = statuses(view.tree()).map(textOf)
	assert.deepEqual(texts, ['updateSaveFailedNote', 'updateLatest{"version":"0.2.6"}'])
	view.unmount()
})

test('UpdateAction：卸载之后的站点通知不发起检查、不 setState（安装收尾后 / checking / checked 状态下卸载）', async () => {
	const UpdateAction = await loadComponent()
	const make = () => {
		let notify: () => void = () => {}
		const resolvers: Array<(c: UpdateCheck) => void> = []
		const installs: Array<(o: InstallOutcome) => void> = []
		const base = props({
			checkUpdate: () => new Promise<UpdateCheck>((resolve) => resolvers.push(resolve)),
			installUpdate: () => new Promise<InstallOutcome>((resolve) => installs.push(resolve)),
			watchSite: (l: () => void) => {
				notify = l
				return () => {}
			}
		})
		return { notify: () => notify(), resolvers, installs, props: base.props }
	}
	// 1) 安装结果已收尾（先 flush）后卸载，再通知
	lateSetStates = 0
	let c = make()
	let view = mount(UpdateAction, c.props)
	await flush()
	c.resolvers[0]!(AVAILABLE)
	await flush()
	;(buttons(view.tree())[0]!.props.onClick as () => void)()
	await flush()
	c.installs[0]!({ kind: 'restart' })
	await flush()
	view.unmount()
	c.notify()
	await flush()
	assert.equal(c.resolvers.length, 1, '卸载后通知不发起检查')
	assert.equal(lateSetStates, 0)
	// 2) checking 状态卸载后再通知
	c = make()
	view = mount(UpdateAction, c.props)
	await flush()
	view.unmount()
	c.notify()
	await flush()
	assert.equal(c.resolvers.length, 1)
	assert.equal(lateSetStates, 0)
	// 3) checked 状态卸载后再通知
	c = make()
	view = mount(UpdateAction, c.props)
	await flush()
	c.resolvers[0]!(AVAILABLE)
	await flush()
	view.unmount()
	c.notify()
	await flush()
	assert.equal(c.resolvers.length, 1)
	assert.equal(lateSetStates, 0)
})
