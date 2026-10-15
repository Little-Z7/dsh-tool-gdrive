import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import type { InstallResult, PluginManagerRemote, RemoteResult } from './contract.ts'
import { en, zh } from './locales.ts'
import {
	ARCHIVE_PATH,
	DEFAULT_MARKET_URL,
	INDEX_PATH,
	RESTART_KEY,
	checkUpdate,
	clearRestartPending,
	compareVersions,
	installUpdate,
	markRestartPending,
	marketSite,
	newRequestId,
	parseMarketIndex,
	reasonMessage,
	restartPending,
	updateSpec,
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
	assert.deepEqual(r, { kind: 'available', version: '0.2.7', url: `http://127.0.0.1:8765${ARCHIVE_PATH}${FILE}` })
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
	{ code: 'install', text: 'ERR_PNPM_X' }
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
