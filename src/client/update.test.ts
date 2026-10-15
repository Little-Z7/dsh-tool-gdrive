import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import type { InstallResult, PluginManagerRemote, RemoteResult } from './contract.ts'
import { en, zh } from './locales.ts'
import {
	ARCHIVE_PATH,
	DEFAULT_MARKET_URL,
	INDEX_PATH,
	REASON_MAX,
	RESTART_KEY,
	checkUpdate,
	clampReason,
	clearRestartPending,
	compareVersions,
	installUpdate,
	markRestartPending,
	marketSite,
	newRequestId,
	parseMarketIndex,
	reasonMessage,
	restartPending,
	INFLIGHT_KEY,
	runInstall,
	sameSite,
	watchMarketUrl,
	type InstallRegistry,
	type SaveWatch,
	updateSpec,
	waitForMarketUrl,
	type ConfigScope,
	type Failure,
	type FetchInit,
	type FetchLike
} from './update.ts'

const SHA = 'a'.repeat(12) + 'b'.repeat(52)
const FILE = `dsh-tool-gdrive-0.2.7-${SHA.slice(0, 12)}.tgz`

function index(over: Record<string, unknown> = {}, row: Record<string, unknown> = {}, extra: unknown[] = []) {
	return {
		schemaVersion: 1,
		plugins: [
			{ name: 'other', latest: '1.0.0', versions: [] },
			{
				name: 'dsh-tool-gdrive',
				latest: '0.2.7',
				versions: [
					{ version: '0.2.7', file: FILE, tarSha256: SHA, ...row },
					{ version: '0.2.6', file: 'dsh-tool-gdrive-0.2.6-cccccccccccc.tgz', tarSha256: 'c'.repeat(64) }
				],
				...over
			},
			...extra
		]
	}
}

test('版本比较：数字逐段、正式版高于预发布、rc.2 < rc.10、忽略 +build', () => {
	assert.ok(compareVersions('0.2.10', '0.2.9') > 0)
	assert.ok(compareVersions('0.2.6', '0.2.7') < 0)
	assert.ok(compareVersions('1.0.0', '1.0.0-rc.1') > 0)
	assert.ok(compareVersions('1.0.0-rc.2', '1.0.0-rc.10') < 0)
	assert.equal(compareVersions('1.0.0+a', '1.0.0+b'), 0)
	assert.equal(compareVersions('0.2.6', '0.2.6'), 0)
})

test('marketSite：缺省、归一化、https 为主，http 只放行本机回环', () => {
	for (const empty of [undefined, '', '   ', 42, null]) assert.deepEqual(marketSite(empty), { ok: true, origin: DEFAULT_MARKET_URL })
	assert.deepEqual(marketSite('https://tv.example:56814/'), { ok: true, origin: 'https://tv.example:56814' })
	assert.deepEqual(marketSite('  https://tv.example  '), { ok: true, origin: 'https://tv.example' })
	for (const ok of ['http://127.0.0.1:8765', 'http://localhost:8765', 'http://[::1]:8765']) {
		assert.deepEqual(marketSite(ok), { ok: true, origin: ok }, ok)
	}
	for (const bad of [
		'http://example.com',
		'ftp://x',
		'javascript:alert(1)',
		'https://tv.example/path',
		'https://tv.example/?q=1',
		'https://tv.example/#f',
		'https://user:pw@tv.example',
		'https://user@tv.example',
		'https://tv.example//',
		'https://tv .example',
		'https://tv.example:443',
		'https://TV.example',
		'https://tv_example',
		'x'
	]) {
		const r = marketSite(bad)
		assert.equal(r.ok, false, bad)
		if (!r.ok) assert.equal(r.value, bad.trim())
	}
})

test('parseMarketIndex：合格样例返回 {version, file}', () => {
	assert.deepEqual(parseMarketIndex(index()), { ok: true, entry: { version: '0.2.7', file: FILE } })
})

test('parseMarketIndex：各种坏清单对应各自的失败代码', () => {
	const code = (raw: unknown) => {
		const r = parseMarketIndex(raw)
		return r.ok ? 'ok' : r.failure.code
	}
	assert.equal(code(null), 'not-json')
	assert.equal(code({ plugins: [] }), 'schema')
	assert.equal(code({ ...index(), schemaVersion: 2 }), 'schema')
	assert.equal(code({ schemaVersion: 1, plugins: {} }), 'bad-entry')
	assert.equal(code({ schemaVersion: 1, plugins: [{ name: 'other' }] }), 'missing')
	assert.equal(code(index({}, {}, [{ name: 'dsh-tool-gdrive', latest: '0.2.7', versions: [] }])), 'bad-entry')
	assert.equal(code(index({ latest: 'latest' })), 'bad-entry')
	assert.equal(code(index({ latest: '0.2.9' })), 'bad-entry')
	assert.equal(code(index({}, { tarSha256: 'A'.repeat(64) })), 'bad-entry')
	assert.equal(code(index({}, { tarSha256: 'abc' })), 'bad-entry')
	for (const file of [
		`aura-dsh-plugin-0.2.7-${SHA.slice(0, 12)}.tgz`,
		`dsh-tool-gdrive-0.2.6-${SHA.slice(0, 12)}.tgz`,
		`https://evil.example/${FILE}`,
		`../${FILE}`,
		`dsh-tool-gdrive-0.2.7-${SHA.slice(0, 12).toUpperCase()}.tgz`,
		`dsh-tool-gdrive-0.2.7-${'d'.repeat(12)}.tgz`
	]) {
		assert.equal(code(index({}, { file })), 'bad-file', file)
	}
})

function fakeFetch(body: unknown, status = 200) {
	const calls: { url: string; init: FetchInit }[] = []
	const impl: FetchLike = (url, init) => {
		calls.push({ url, init })
		return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })
	}
	return { impl, calls }
}

test('checkUpdate：请求地址与请求头，可更新给出版本化地址', async () => {
	const { impl, calls } = fakeFetch(index())
	const r = await checkUpdate(impl, 'http://127.0.0.1:8765/', '0.2.6')
	assert.deepEqual(r, { kind: 'available', version: '0.2.7', url: `http://127.0.0.1:8765${ARCHIVE_PATH}${FILE}`, origin: 'http://127.0.0.1:8765' })
	assert.equal(calls.length, 1)
	assert.equal(calls[0]!.url, 'http://127.0.0.1:8765' + INDEX_PATH)
	assert.equal(calls[0]!.init.cache, 'no-store')
	assert.equal(calls[0]!.init.credentials, 'omit')
	assert.equal(calls[0]!.init.referrerPolicy, 'no-referrer')
	assert.equal(calls[0]!.init.redirect, 'error')
	await checkUpdate(impl, undefined, '0.2.6')
	assert.equal(calls[1]!.url, DEFAULT_MARKET_URL + INDEX_PATH)
})

test('checkUpdate：已装版本等于或高于 latest 时已是最新，显示已装版本', async () => {
	const { impl } = fakeFetch(index())
	assert.deepEqual(await checkUpdate(impl, undefined, '0.2.7'), { kind: 'latest', version: '0.2.7' })
	assert.deepEqual(await checkUpdate(impl, undefined, '0.3.0'), { kind: 'latest', version: '0.3.0' })
})

test('checkUpdate：HTTP 错误、非 JSON、网络错误、超时各有代码', async () => {
	const fail = (r: Awaited<ReturnType<typeof checkUpdate>>): Failure => {
		assert.equal(r.kind, 'failed')
		return (r as { failure: Failure }).failure
	}
	assert.deepEqual(fail(await checkUpdate(fakeFetch({}, 404).impl, 'https://x.example', '0.2.6')), { code: 'http', status: 404 })
	const notJson: FetchLike = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('Unexpected token <')) })
	assert.deepEqual(fail(await checkUpdate(notJson, 'https://x.example', '0.2.6')), { code: 'not-json' })
	const broken: FetchLike = () => Promise.reject(new TypeError('Failed to fetch'))
	assert.deepEqual(fail(await checkUpdate(broken, 'https://x.example', '0.2.6')), { code: 'network', origin: 'https://x.example', message: 'Failed to fetch' })
	const never: FetchLike = () => new Promise(() => {})
	assert.deepEqual(fail(await checkUpdate(never, 'https://x.example', '0.2.6', { timeoutMs: 20 })), { code: 'timeout', origin: 'https://x.example', seconds: 0 })
	/* 真 fetch 被中止后会以 AbortError 拒绝（比超时的 reject 先到），仍要归为超时而不是网络错误 */
	const honoursAbort: FetchLike = (_url, init) =>
		new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('signal is aborted without reason', 'AbortError'))))
	assert.deepEqual(fail(await checkUpdate(honoursAbort, 'https://x.example', '0.2.6', { timeoutMs: 20 })), { code: 'timeout', origin: 'https://x.example', seconds: 0 })
	assert.deepEqual(fail(await checkUpdate(fakeFetch({ schemaVersion: 1, plugins: [] }).impl, 'https://x.example', '0.2.6')), { code: 'missing' })
})

test('checkUpdate：地址不合格时 fetch 被调用 0 次', async () => {
	for (const bad of ['ftp://x', 'http://example.com', 'https://a/b', 'https://u:p@a']) {
		const { impl, calls } = fakeFetch(index())
		const r = await checkUpdate(impl, bad, '0.2.6')
		assert.deepEqual(r, { kind: 'failed', failure: { code: 'bad-site', value: bad } })
		assert.equal(calls.length, 0, bad)
	}
})

function manager(install: RemoteResult<InstallResult>, recovered: RemoteResult<InstallResult | null> = { ok: true, value: null }) {
	const calls: { spec: string; options: object }[] = []
	const remote: PluginManagerRemote = {
		installBundle: (spec, options) => {
			calls.push({ spec, options })
			return Promise.resolve(install)
		},
		waitForInstall: () => Promise.resolve(recovered)
	}
	return { remote, calls }
}

test('updateSpec：必须带包名前缀', () => {
	assert.equal(updateSpec('https://x/a.tgz'), 'dsh-tool-gdrive@https://x/a.tgz')
	assert.match(newRequestId(1), /^gdrive-update-1-[0-9a-z]{1,6}$/)
})

test('installUpdate：restart-required 为 restart，installBundle 恰好一次，带包名并保持启停状态', async () => {
	const url = `https://tv.example/dsh-market/${FILE}`
	for (const enabled of [true, false]) {
		const { remote, calls } = manager({ ok: true, value: { application: 'restart-required' } })
		assert.deepEqual(await installUpdate(remote, url, enabled, 'r1'), { kind: 'restart' })
		assert.deepEqual(calls, [{ spec: `dsh-tool-gdrive@${url}`, options: { enabled, requestId: 'r1' } }])
	}
	const applied = manager({ ok: true, value: { application: 'applied' } })
	assert.deepEqual(await installUpdate(applied.remote, 'u', true, 'r'), { kind: 'applied' })
	const cancelled = manager({ ok: true, value: { application: 'cancelled' } })
	assert.deepEqual(await installUpdate(cancelled.remote, 'u', true, 'r'), { kind: 'failed', failure: { code: 'cancelled' } })
})

test('installUpdate：失败原因取 pnpm 的 ERR_PNPM_ 行，跳过 [WARN]；依次退到 diagnostic、code、application', async () => {
	const text = async (value: InstallResult) => {
		const r = await installUpdate(manager({ ok: true, value }).remote, 'u', true, 'r')
		assert.equal(r.kind, 'failed')
		return (r as { failure: { code: string; text: string } }).failure.text
	}
	assert.equal(
		await text({ application: 'failed', error: { code: 'operation-error' }, packageResult: { output: 'Progress: resolved 1\n ERR_PNPM_FETCH_404  GET https://x: Not Found - 404\nmore' } }),
		'ERR_PNPM_FETCH_404  GET https://x: Not Found - 404'
	)
	assert.equal(
		await text({
			application: 'failed',
			packageResult: {
				output: [
					'[WARN] GET https://x/a.tgz error (ERR_PNPM_TARBALL_INTEGRITY). Will retry in 10 seconds.',
					'[ERR_PNPM_TARBALL_INTEGRITY] Got unexpected checksum for "https://x/a.tgz".',
					'This error happened while installing a direct dependency'
				].join('\n')
			}
		}),
		'[ERR_PNPM_TARBALL_INTEGRITY] Got unexpected checksum for "https://x/a.tgz".'
	)
	/* pnpm 12 的真实输出：没有 ERR_PNPM_ 代码，原因在 `Error:` 段，折行折断的 URL 要接回去 */
	const pnpm12 = [
		'[WARN] Replaced "dsh-tool-gdrive" ("file:/x/a.tgz") with "dsh-tool-gdrive@http://127.0.0.1:1/dsh-market/b.tgz" from a different source.',
		'✓ Lockfile passes supply-chain policies (verified 10m ago)',
		'Error:   × adding a new package',
		'  ╰─▶ Failed to resolve dependency tree: Failed to resolve dependency: Tarball',
		'      server returned HTTP 404 for http://127.0.0.1:1/dsh-market/dsh-tool-',
		'      gdrive-0.2.7-ffffffffffff.tgz',
		''
	].join('\n')
	assert.equal(
		await text({ application: 'failed', error: { code: 'operation-error' }, packageResult: { output: pnpm12 } }),
		'Error:   × adding a new package ╰─▶ Failed to resolve dependency tree: Failed to resolve dependency: Tarball server returned HTTP 404 for http://127.0.0.1:1/dsh-market/dsh-tool-gdrive-0.2.7-ffffffffffff.tgz'
	)
	assert.equal(await text({ application: 'failed', error: { code: 'operation-error', diagnostic: pnpm12 } }), (await text({ application: 'failed', packageResult: { output: pnpm12 } })))
	assert.equal(await text({ application: 'failed', error: { code: 'c', diagnostic: 'diag' }, packageResult: { output: 'no pnpm line' } }), 'diag')
	assert.equal(await text({ application: 'failed', error: { code: 'operation-error' } }), 'operation-error')
	assert.equal(await text({ application: 'overridden' }), 'overridden')
})

test('installUpdate：回执丢失时按请求编号找回结果；找回 null 为失败并带原消息', async () => {
	const lost = manager({ ok: false, error: { code: 'disconnected', message: 'socket closed' } }, { ok: true, value: { application: 'restart-required' } })
	assert.deepEqual(await installUpdate(lost.remote, 'u', true, 'r'), { kind: 'restart' })
	const unknown = manager({ ok: false, error: { code: 'disconnected', message: 'socket closed' } })
	assert.deepEqual(await installUpdate(unknown.remote, 'u', true, 'r'), { kind: 'failed', failure: { code: 'install', text: 'socket closed' } })
})

test('待重启记录：只认与盘上版本一致的记录；存储抛错或不存在时当作没有', () => {
	const data = new Map<string, string>()
	const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) }
	assert.equal(restartPending(store, '0.2.7'), false)
	markRestartPending(store, '0.2.7')
	assert.equal(data.get(RESTART_KEY), '0.2.7')
	assert.equal(restartPending(store, '0.2.7'), true)
	assert.equal(restartPending(store, '0.2.6'), false)
	assert.equal(restartPending(store, undefined), false)
	clearRestartPending(store)
	assert.equal(restartPending(store, '0.2.7'), false)
	const denied = () => {
		throw new Error('denied')
	}
	const broken = { getItem: denied, setItem: denied, removeItem: denied }
	markRestartPending(broken, '0.2.7')
	clearRestartPending(broken)
	assert.equal(restartPending(broken, '0.2.7'), false)
	assert.equal(restartPending(undefined, '0.2.7'), false)
})

const FAILURES: Failure[] = [
	{ code: 'bad-site', value: 'ftp://x' },
	{ code: 'network', origin: 'https://x', message: 'm' },
	{ code: 'timeout', origin: 'https://x', seconds: 15 },
	{ code: 'http', status: 500 },
	{ code: 'not-json' },
	{ code: 'schema', schema: '2' },
	{ code: 'missing' },
	{ code: 'bad-entry', detail: 'latest' },
	{ code: 'bad-file', file: 'f', version: '0.2.7' },
	{ code: 'cancelled' },
	{ code: 'install', text: 'ERR_PNPM_X' },
	{ code: 'config-loading' },
	{ code: 'unexpected', message: 'boom' }
]

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort()

test('文案：每个失败代码映射到的键与参数在 en 和 zh 里都存在', () => {
	for (const failure of FAILURES) {
		const { key, params } = reasonMessage(failure)
		for (const dict of [en, zh] as Record<string, string>[]) {
			assert.ok(typeof dict[key] === 'string', `${failure.code} → ${key}`)
			assert.deepEqual(placeholders(dict[key]!), Object.keys(params).sort(), `${failure.code} 占位符`)
		}
	}
})

test('文案：en 和 zh 键集合相同，每个键的 {占位符} 也相同', () => {
	assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort())
	for (const key of Object.keys(en) as (keyof typeof en)[]) assert.deepEqual(placeholders(en[key]), placeholders(zh[key]), key)
})

test('缺省地址一致：src/index.ts 的 description 与 README 写的缺省地址等于 DEFAULT_MARKET_URL', () => {
	const root = new URL('../../', import.meta.url)
	assert.ok(readFileSync(new URL('src/index.ts', root), 'utf8').includes(DEFAULT_MARKET_URL))
	assert.ok(readFileSync(new URL('README.md', root), 'utf8').includes(DEFAULT_MARKET_URL))
	for (const dict of [en, zh]) assert.ok(dict.marketUrlHint.includes(DEFAULT_MARKET_URL))
})

// ───────────────────────── 审查返工：解析不抛出 ─────────────────────────

test('checkUpdate：畸形清单返回失败结果而不是抛出（schemaVersion / latest 为对象、数组、null 等）', async () => {
	const run = (body: unknown) => checkUpdate(fakeFetch(body).impl, undefined, '0.2.6')
	const failure = async (body: unknown): Promise<Failure> => {
		const r = await run(body)
		assert.equal(r.kind, 'failed')
		return (r as { failure: Failure }).failure
	}
	/* 真实 JSON.parse 出来的值：toString 为 null 的对象，String() 它会抛 TypeError */
	const evil = JSON.parse('{"schemaVersion":{"toString":null},"plugins":[]}')
	assert.deepEqual(await failure(evil), { code: 'schema', schema: 'object' })
	assert.deepEqual(await failure({ schemaVersion: [1], plugins: [] }), { code: 'schema', schema: 'array' })
	assert.deepEqual(await failure({ schemaVersion: null, plugins: [] }), { code: 'schema', schema: 'null' })
	assert.deepEqual(await failure({ schemaVersion: 2, plugins: [] }), { code: 'schema', schema: '2' })
	assert.deepEqual(await failure({ schemaVersion: 'x'.repeat(100), plugins: [] }), { code: 'schema', schema: 'x'.repeat(40) })
	assert.equal((await failure({ schemaVersion: true })).code, 'schema')
	assert.deepEqual(await failure(index({ latest: JSON.parse('{"toString":null}') })), { code: 'bad-entry', detail: 'latest' })
	assert.deepEqual(await failure(index({ latest: ['0.2.7'] })), { code: 'bad-entry', detail: 'latest' })
	assert.deepEqual(await failure(index({}, { file: JSON.parse('{"toString":null}') })), { code: 'bad-entry', detail: 'file' })
	assert.deepEqual(await failure(index({}, { tarSha256: JSON.parse('{"toString":null}') })), { code: 'bad-entry', detail: 'tarSha256' })
	assert.deepEqual(await failure(index({ versions: 'x' })), { code: 'bad-entry', detail: 'versions' })
	/* 其余意外（访问响应字段就抛）也落进失败分支，不向外抛 */
	const hostile: FetchLike = () => Promise.resolve({ get ok(): boolean { throw new TypeError('boom') }, status: 200, json: () => Promise.resolve({}) })
	assert.deepEqual(await checkUpdate(hostile, undefined, '0.2.6'), { kind: 'failed', failure: { code: 'unexpected', message: 'boom' } })
	const hostileError: FetchLike = () => Promise.reject(JSON.parse('{"toString":null}'))
	assert.deepEqual((await checkUpdate(hostileError, 'https://x.example', '0.2.6') as { failure: Failure }).failure.code, 'network')
})

// ───────────────────────── 审查返工：配置加载中不拿缺省市场顶替 ─────────────────────────

function fakeScope(initial: 'loading' | 'ready' | 'unavailable', value?: { marketUrl?: unknown }) {
	let snap = { status: initial, value }
	const listeners = new Set<() => void>()
	const scope: ConfigScope = {
		getSnapshot: () => snap,
		subscribe: (l) => {
			listeners.add(l)
			return () => void listeners.delete(l)
		}
	}
	return { scope, listeners, set: (status: 'loading' | 'ready' | 'unavailable', v?: { marketUrl?: unknown }) => { snap = { status, value: v }; for (const l of [...listeners]) l() } }
}

test('waitForMarketUrl：就绪直接给值；loading → ready 取到自定义值；unavailable 才用缺省；订阅总会取消', async () => {
	assert.deepEqual(await waitForMarketUrl(fakeScope('ready', { marketUrl: 'http://127.0.0.1:8765' }).scope), { ok: true, raw: 'http://127.0.0.1:8765', saveFailed: false })
	assert.deepEqual(await waitForMarketUrl(fakeScope('ready', {}).scope), { ok: true, raw: undefined, saveFailed: false })
	assert.deepEqual(await waitForMarketUrl(fakeScope('ready', undefined).scope), { ok: true, raw: undefined, saveFailed: false })
	assert.deepEqual(await waitForMarketUrl(fakeScope('unavailable').scope), { ok: true, raw: undefined, saveFailed: false })
	const f = fakeScope('loading')
	const p = waitForMarketUrl(f.scope, { timeoutMs: 5000 })
	assert.equal(f.listeners.size, 1)
	f.set('loading')
	f.set('ready', { marketUrl: 'http://127.0.0.1:9' })
	assert.deepEqual(await p, { ok: true, raw: 'http://127.0.0.1:9', saveFailed: false })
	assert.equal(f.listeners.size, 0)
})

test('waitForMarketUrl：一直 loading 超时；被作废立即结束；都取消订阅', async () => {
	const f = fakeScope('loading')
	assert.deepEqual(await waitForMarketUrl(f.scope, { timeoutMs: 20 }), { ok: false })
	assert.equal(f.listeners.size, 0)
	const g = fakeScope('loading')
	const ctl = new AbortController()
	const p = waitForMarketUrl(g.scope, { timeoutMs: 5000, signal: ctl.signal })
	ctl.abort()
	assert.deepEqual(await p, { ok: false })
	assert.equal(g.listeners.size, 0)
	const pre = new AbortController()
	pre.abort()
	assert.deepEqual(await waitForMarketUrl(fakeScope('loading').scope, { signal: pre.signal }), { ok: false })
})

// ───────────────────────── 审查返工：失败原因统一上限 ─────────────────────────

test('失败原因：所有来源统一规范化并截断到 400 字（省略号计入），恰好 400 / 401 的边界', async () => {
	assert.equal(REASON_MAX, 400)
	assert.equal(clampReason('a'.repeat(400)), 'a'.repeat(400))
	const cut = clampReason('a'.repeat(401))
	assert.equal(cut.length, 400)
	assert.ok(cut.endsWith('…'))
	assert.equal(cut, 'a'.repeat(399) + '…')
	assert.equal(clampReason('  a\n   b  '), 'a b')
	const text = async (value: InstallResult) => {
		const r = await installUpdate(manager({ ok: true, value }).remote, 'u', true, 'r')
		return (r as { failure: { text: string } }).failure.text
	}
	const longLine = 'ERR_PNPM_X ' + 'z'.repeat(600)
	const a = await text({ application: 'failed', packageResult: { output: longLine } })
	assert.equal(a.length, 400)
	assert.ok(a.startsWith('ERR_PNPM_X zzz') && a.endsWith('…'))
	const b = await text({ application: 'failed', error: { code: 'c', diagnostic: 'd'.repeat(900) } })
	assert.equal(b.length, 400)
	const exact = await text({ application: 'failed', error: { code: 'c', diagnostic: 'd'.repeat(400) } })
	assert.equal(exact, 'd'.repeat(400))
	const over = await text({ application: 'failed', error: { code: 'c', diagnostic: 'd'.repeat(401) } })
	assert.equal(over.length, 400)
	const block = await text({ application: 'failed', packageResult: { output: 'Error: x\n' + 'y'.repeat(700) } })
	assert.equal(block.length, 400)
	const viaMessage = await installUpdate(manager({ ok: false, error: { code: 'c', message: 'm'.repeat(900) } }).remote, 'u', true, 'r')
	assert.equal((viaMessage as { failure: { text: string } }).failure.text.length, 400)
	const net = await checkUpdate(() => Promise.reject(new TypeError('n'.repeat(900))), 'https://x.example', '0.2.6')
	assert.equal(((net as { failure: { message: string } }).failure).message.length, 400)
})

// ───────────────────────── 第二轮返工：等保存、作废、站点变化 ─────────────────────────

function fakeSave(initial = false) {
	let state = { saving: initial, failed: false }
	const listeners = new Set<() => void>()
	const save: SaveWatch = {
		getSnapshot: () => state,
		subscribe: (l) => {
			listeners.add(l)
			return () => void listeners.delete(l)
		}
	}
	return { save, listeners, set: (next: { saving: boolean; failed?: boolean }) => { state = { saving: next.saving, failed: next.failed ?? false }; for (const l of [...listeners]) l() } }
}

test('waitForMarketUrl：保存进行中先等，保存成功后按新接受的值；一直不落定超时；订阅都撤掉', async () => {
	const f = fakeScope('ready', {})
	const sv = fakeSave(true)
	const p = waitForMarketUrl(f.scope, { timeoutMs: 5000, save: sv.save })
	await new Promise((r) => setTimeout(r, 10))
	assert.equal(f.listeners.size + sv.listeners.size, 2)
	f.set('ready', { marketUrl: 'http://127.0.0.1:9' })
	sv.set({ saving: false })
	assert.deepEqual(await p, { ok: true, raw: 'http://127.0.0.1:9', saveFailed: false })
	assert.equal(f.listeners.size + sv.listeners.size, 0)
	const stuck = fakeSave(true)
	assert.deepEqual(await waitForMarketUrl(fakeScope('ready', {}).scope, { timeoutMs: 20, save: stuck.save }), { ok: false })
	assert.equal(stuck.listeners.size, 0)
})

test('waitForMarketUrl：保存失败时按旧的已接受值继续，并带 saveFailed', async () => {
	const f = fakeScope('ready', { marketUrl: 'http://127.0.0.1:7' })
	const sv = fakeSave(true)
	const p = waitForMarketUrl(f.scope, { save: sv.save })
	sv.set({ saving: false, failed: true })
	assert.deepEqual(await p, { ok: true, raw: 'http://127.0.0.1:7', saveFailed: true })
})

test('waitForMarketUrl / checkUpdate：已中止就不发请求（ready 后同一任务内立即 abort → fetch 0 次）', async () => {
	const ctl = new AbortController()
	const { impl, calls } = fakeFetch(index())
	const waited = waitForMarketUrl(fakeScope('ready', { marketUrl: 'http://127.0.0.1:9' }).scope, { signal: ctl.signal })
	ctl.abort()
	await waited
	const result = await checkUpdate(impl, 'http://127.0.0.1:9', '0.2.6', { signal: ctl.signal })
	assert.deepEqual(result, { kind: 'failed', failure: { code: 'cancelled' } })
	assert.equal(calls.length, 0)
	const pre = new AbortController()
	pre.abort()
	assert.deepEqual(await waitForMarketUrl(fakeScope('ready', {}).scope, { signal: pre.signal }), { ok: false }, '立即返回路径也要先看 aborted')
})

test('waitForMarketUrl：订阅时同步回调也不留订阅（拿到撤销函数后已结束就立刻撤）', async () => {
	let status: 'loading' | 'ready' = 'loading'
	let offCalls = 0
	const scope: ConfigScope = {
		getSnapshot: () => ({ status, value: { marketUrl: 'http://127.0.0.1:9' } }),
		subscribe: (l) => {
			status = 'ready'
			l()
			return () => void offCalls++
		}
	}
	assert.deepEqual(await waitForMarketUrl(scope), { ok: true, raw: 'http://127.0.0.1:9', saveFailed: false })
	assert.equal(offCalls, 1)
	const sv = fakeSave(true)
	let saveOff = 0
	const save: SaveWatch = { getSnapshot: sv.save.getSnapshot, subscribe: (l) => { sv.set({ saving: false }); l(); return () => void saveOff++ } }
	const f = fakeScope('ready', {})
	assert.equal((await waitForMarketUrl(f.scope, { save })).ok, true)
	assert.equal(saveOff, 1)
	assert.equal(f.listeners.size, 0)
})

test('watchMarketUrl：已接受的值变了才通知；首次读到值与 loading 期间不算；没配与空串同为缺省', () => {
	const f = fakeScope('loading')
	let n = 0
	const off = watchMarketUrl(f.scope, () => n++)
	f.set('ready', { marketUrl: 'http://127.0.0.1:9' })
	assert.equal(n, 0, 'loading → 首个值不算变化')
	f.set('ready', { marketUrl: 'http://127.0.0.1:9/' })
	assert.equal(n, 0, '归一化后相同')
	f.set('loading')
	f.set('ready', { marketUrl: 'http://127.0.0.1:9' })
	assert.equal(n, 0)
	f.set('ready', { marketUrl: 'http://127.0.0.1:10' })
	assert.equal(n, 1)
	f.set('ready', {})
	assert.equal(n, 2, '清除后回到缺省也是变化')
	f.set('ready', { marketUrl: '' })
	assert.equal(n, 2, '空串与没配同为缺省')
	f.set('ready', { marketUrl: 'ftp://x' })
	assert.equal(n, 3)
	off()
	assert.equal(f.listeners.size, 0)
	f.set('ready', {})
	assert.equal(n, 3)
})

test('sameSite：当前已接受的站点是不是结果当时读的 origin', () => {
	assert.equal(sameSite('http://127.0.0.1:9/', 'http://127.0.0.1:9'), true)
	assert.equal(sameSite('http://127.0.0.1:10', 'http://127.0.0.1:9'), false)
	assert.equal(sameSite(undefined, DEFAULT_MARKET_URL), true)
	assert.equal(sameSite('', DEFAULT_MARKET_URL), true)
	assert.equal(sameSite(undefined, 'http://127.0.0.1:9'), false)
	assert.equal(sameSite('ftp://x', DEFAULT_MARKET_URL), false)
})

// ───────────────────────── 第二轮返工：拒绝路径与安装状态机 ─────────────────────────

test('installUpdate：installBundle / waitForInstall reject 也归一化：先按 requestId 找回，仍失败才转 failed', async () => {
	const boom = () => Promise.reject(new Error('socket exploded'))
	const recovers: PluginManagerRemote = { installBundle: boom, waitForInstall: () => Promise.resolve({ ok: true, value: { application: 'restart-required' } }) }
	assert.deepEqual(await installUpdate(recovers, 'u', true, 'r'), { kind: 'restart' })
	const nothing: PluginManagerRemote = { installBundle: boom, waitForInstall: () => Promise.resolve({ ok: true, value: null }) }
	assert.deepEqual(await installUpdate(nothing, 'u', true, 'r'), { kind: 'failed', failure: { code: 'install', text: 'socket exploded' } })
	const bothReject: PluginManagerRemote = { installBundle: boom, waitForInstall: boom }
	assert.deepEqual(await installUpdate(bothReject, 'u', true, 'r'), { kind: 'failed', failure: { code: 'install', text: 'socket exploded' } })
})

function store() {
	const data = new Map<string, string>()
	return { data, store: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) } }
}
function deferredManager() {
	let resolveInstall!: (r: RemoteResult<InstallResult>) => void
	let rejectInstall!: (e: unknown) => void
	const calls: Array<{ spec: string; options: object }> = []
	const remote: PluginManagerRemote = {
		installBundle: (spec, options) => {
			calls.push({ spec, options })
			return new Promise((resolve, reject) => { resolveInstall = resolve; rejectInstall = reject })
		},
		waitForInstall: () => Promise.resolve({ ok: true, value: null })
	}
	return { remote, calls, resolve: (a: InstallResult['application']) => resolveInstall({ ok: true, value: { application: a } }), reject: (e: unknown) => rejectInstall(e) }
}

test('runInstall：进行中的安装唯一——再次调用不再调 installBundle，拿同一个结果；进行中记录收尾时删除', async () => {
	const m = deferredManager()
	const s = store()
	const registry: InstallRegistry = {}
	const first = runInstall(registry, s.store, m.remote, 'u1', '0.2.8', true)
	assert.equal(s.data.get(INFLIGHT_KEY), '0.2.8', '安装前就记下目标版本')
	assert.equal(registry.current?.version, '0.2.8')
	const second = runInstall(registry, s.store, m.remote, 'u2', '0.2.9', false)
	assert.equal(second, first, '同一个 Promise')
	assert.equal(m.calls.length, 1)
	m.resolve('restart-required')
	assert.deepEqual(await first, { kind: 'restart' })
	assert.deepEqual(await second, { kind: 'restart' })
	assert.equal(m.calls.length, 1)
	assert.equal(registry.current, undefined)
	assert.equal(s.data.has(INFLIGHT_KEY), false)
	assert.equal(s.data.get(RESTART_KEY), '0.2.8', 'restart 才升为已确认')
})

test('runInstall：已确认 0.2.7，再装 0.2.8 失败 / 取消 / 拒绝 → 仍是 0.2.7；applied 清除；restart 更新为新版本', async () => {
	const s = store()
	markRestartPending(s.store, '0.2.7')
	for (const how of ['failed', 'cancelled', 'reject'] as const) {
		const m = deferredManager()
		const registry: InstallRegistry = {}
		const p = runInstall(registry, s.store, m.remote, 'u', '0.2.8', true)
		assert.equal(restartPending(s.store, '0.2.7'), true, '安装中已确认的 0.2.7 仍有效')
		if (how === 'reject') m.reject(new Error('boom'))
		else m.resolve(how)
		const outcome = await p
		assert.equal(outcome.kind, 'failed', how)
		assert.equal(s.data.get(RESTART_KEY), '0.2.7', how)
		assert.equal(restartPending(s.store, '0.2.7'), true, how)
		assert.equal(restartPending(s.store, '0.2.8'), false, how)
		assert.equal(s.data.has(INFLIGHT_KEY), false, how)
		assert.equal(registry.current, undefined, how)
	}
	let m = deferredManager()
	const applied = runInstall({}, s.store, m.remote, 'u', '0.2.8', true)
	m.resolve('applied')
	assert.deepEqual(await applied, { kind: 'applied' })
	assert.equal(s.data.has(RESTART_KEY), false)
	markRestartPending(s.store, '0.2.7')
	m = deferredManager()
	const restart = runInstall({}, s.store, m.remote, 'u', '0.2.8', true)
	m.resolve('restart-required')
	assert.deepEqual(await restart, { kind: 'restart' })
	assert.equal(s.data.get(RESTART_KEY), '0.2.8')
})

test('restartPending：热替换场景——安装进行中（记录目标版本），盘上版本已是目标版本 → 视为待重启', async () => {
	const m = deferredManager()
	const s = store()
	const registry: InstallRegistry = {}
	const p = runInstall(registry, s.store, m.remote, 'u', '0.2.8', true)
	assert.equal(restartPending(s.store, '0.2.7'), false)
	assert.equal(restartPending(s.store, '0.2.8'), true, '新页面看到进行中的目标版本 == 盘上版本')
	assert.equal(restartPending(s.store, undefined), false)
	m.resolve('restart-required')
	await p
	assert.equal(restartPending(s.store, '0.2.8'), true)
})
