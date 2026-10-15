/**
 * 插件详情页的「检查更新 / 一键更新」逻辑（纯函数，无 DOM、无运行时本地 import，Node 可直接跑测试）。
 *
 * 新版本从灵环 TV 插件市场的 `index.json` 读，安装交给 DSH 自己的 `pluginManager.installBundle` ——
 * 与插件页「安装」按钮同一条 pnpm 路径，失败时 DSH 会把 package.json 与锁文件还原，更新失败不会弄坏已装的那份。
 *
 * ⚠️ 两条跨版本约定（已装插件会读线上清单，也会被后来的版本热替换），改动前先想清楚：
 *   ① 读 index.json 的哪些字段、地址怎么拼：`schemaVersion`、`plugins[].name/latest`、`versions[].version/file/tarSha256`，
 *      清单地址 `<origin>/dsh-market/index.json`，安装包地址 `<origin>/dsh-market/<file>`。市场改了这些，已装插件的检查就会失败。
 *   ② 「装好待重启」记录的存放处：window 上的 Symbol（WINDOW_STORE_NAME）与键名（RESTART_KEY）在各版本间不能改。
 *      旧版点更新时写入，DSH 热替换进来的新版要读到同一条记录。
 *
 * ⚠️ 交给 `installBundle` 的是 `dsh-tool-gdrive@<地址>`，不是光秃秃的地址。光给地址时 pnpm 不知道它装的是哪个包，
 * 会把 package.json 里已有的远程依赖重新解析一遍，拿锁文件里的旧摘要去校验旧地址现在的字节，
 * 出 ERR_PNPM_TARBALL_INTEGRITY。带上包名后 pnpm 直接替换这一条依赖，不再碰旧地址。
 * DSH 的 parseInstallSpec 把它当带版本范围的 registry 写法，装完按「package.json 里哪个依赖变了」认包。
 */
import type { InstallResult, PluginManagerRemote, RemoteResult } from './contract.js'

export const PLUGIN_NAME = 'dsh-tool-gdrive'
/** 缺省市场地址只在这里写一处。 */
export const DEFAULT_MARKET_URL = 'https://tv.auraaigc.ccwu.cc:56814'
export const INDEX_PATH = '/dsh-market/index.json'
export const ARCHIVE_PATH = '/dsh-market/'
export const CHECK_TIMEOUT_MS = 15000
export const RESTART_KEY = 'dsh-tool-gdrive.restart-pending'
export const INFLIGHT_KEY = 'dsh-tool-gdrive.install-inflight'
export const WINDOW_STORE_NAME = 'dsh-tool-gdrive.window-store'
export const WINDOW_INSTALLS_NAME = 'dsh-tool-gdrive.window-installs'

/** 失败原因：代码 + 参数，由界面翻译成中英文（见 reasonMessage）。 */
export type Failure =
	| { code: 'bad-site'; value: string }
	| { code: 'network'; origin: string; message: string }
	| { code: 'timeout'; origin: string; seconds: number }
	| { code: 'http'; status: number }
	| { code: 'not-json' }
	| { code: 'schema'; schema: string }
	| { code: 'missing' }
	| { code: 'bad-entry'; detail: string }
	| { code: 'bad-file'; file: string; version: string }
	| { code: 'cancelled' }
	| { code: 'install'; text: string }
	| { code: 'config-loading' }
	| { code: 'unexpected'; message: string }

/** 展示给用户的失败原因统一上限（省略号计入）。 */
export const REASON_MAX = 400

/** 规范化（换行接成一行、去首尾空白）后截断到 REASON_MAX 个字符，省略号计入。 */
export function clampReason(text: string): string {
	const one = text.replace(/\s*\n\s*/g, ' ').trim()
	return one.length > REASON_MAX ? `${one.slice(0, REASON_MAX - 1)}…` : one
}

/** 外部值的展示描述：只对 number / string 取值，其他写类型名，不对任意对象调用 String / 插值。 */
function describeValue(v: unknown): string {
	if (typeof v === 'number' || typeof v === 'string') return clampReason(String(v)).slice(0, 40)
	if (v === null) return 'null'
	if (Array.isArray(v)) return 'array'
	return typeof v
}

// ───────────────────────── 市场地址 ─────────────────────────

export type MarketSite = { ok: true; origin: string } | { ok: false; value: string }

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])
const SITE_CHARS = /^https?:\/\/[A-Za-z0-9.:[\]-]+$/

/**
 * 市场地址只认 origin：https；http 只放行本机回环（测试用）。不带账号密码、路径、查询、fragment。
 * 未设置、非字符串、空白都用缺省地址。允许多写一个尾斜杠。
 */
export function marketSite(raw: unknown): MarketSite {
	if (typeof raw !== 'string' || raw.trim() === '') return { ok: true, origin: DEFAULT_MARKET_URL }
	const text = raw.trim()
	const bad: MarketSite = { ok: false, value: text }
	const bare = text.endsWith('/') ? text.slice(0, -1) : text
	if (!SITE_CHARS.test(bare)) return bad
	let url: URL
	try {
		url = new URL(bare)
	} catch {
		return bad
	}
	if (url.username !== '' || url.password !== '') return bad
	if (url.protocol === 'http:' && !LOOPBACK_HOSTS.has(url.hostname)) return bad
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return bad
	if (bare !== url.origin) return bad
	return { ok: true, origin: url.origin }
}

// ───────────────────────── 版本 ─────────────────────────

/** 与市场 paths.mjs 的 SEMVER_RE 同一条。 */
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

/** 移植自市场 market.mjs 的 compareSemver（与市场选 latest 同一口径）：忽略 +build，预发布标签逐段比。 */
export function compareVersions(a: string, b: string): number {
	const parse = (v: string) => {
		const [core = '', pre] = (v.split('+')[0] ?? '').split(/-(.+)/)
		return { n: core.split('.').map(Number), pre: pre ?? null }
	}
	const x = parse(a)
	const y = parse(b)
	for (let i = 0; i < 3; i++) {
		const xi = x.n[i] ?? 0
		const yi = y.n[i] ?? 0
		if (xi !== yi) return xi < yi ? -1 : 1
	}
	if (x.pre === y.pre) return 0
	if (x.pre === null) return 1
	if (y.pre === null) return -1
	const xs = x.pre.split('.')
	const ys = y.pre.split('.')
	for (let i = 0; i < Math.max(xs.length, ys.length); i++) {
		const xp = xs[i]
		const yp = ys[i]
		if (xp === undefined) return -1
		if (yp === undefined) return 1
		const xn = /^\d+$/.test(xp)
		const yn = /^\d+$/.test(yp)
		if (xn && yn) {
			if (Number(xp) !== Number(yp)) return Number(xp) < Number(yp) ? -1 : 1
		} else if (xn !== yn) return xn ? -1 : 1
		else if (xp !== yp) return xp < yp ? -1 : 1
	}
	return 0
}

// ───────────────────────── 清单 ─────────────────────────

export interface MarketEntry {
	version: string
	file: string
}

type Parsed = { ok: true; entry: MarketEntry } | { ok: false; failure: Failure }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** 清单来自线上，逐条检查；`file` 必须严格等于 `<包名>-<版本>-<tarSha256 前 12 位>.tgz`，不跟着清单跳到别处。 */
export function parseMarketIndex(raw: unknown): Parsed {
	const entryBad = (detail: string): Parsed => ({ ok: false, failure: { code: 'bad-entry', detail } })
	if (!isRecord(raw)) return { ok: false, failure: { code: 'not-json' } }
	if (raw.schemaVersion !== 1) return { ok: false, failure: { code: 'schema', schema: describeValue(raw.schemaVersion) } }
	if (!Array.isArray(raw.plugins)) return entryBad('plugins')
	const mine = raw.plugins.filter((p) => isRecord(p) && p.name === PLUGIN_NAME)
	if (mine.length === 0) return { ok: false, failure: { code: 'missing' } }
	if (mine.length > 1) return entryBad('name')
	const plugin = mine[0] as Record<string, unknown>
	const latest = plugin.latest
	if (typeof latest !== 'string' || !SEMVER_RE.test(latest)) return entryBad('latest')
	const versions = Array.isArray(plugin.versions) ? plugin.versions : []
	const row = versions.find((v) => isRecord(v) && v.version === latest)
	if (!isRecord(row)) return entryBad('versions')
	const sha = row.tarSha256
	if (typeof sha !== 'string' || !/^[0-9a-f]{64}$/.test(sha)) return entryBad('tarSha256')
	const file = row.file
	if (typeof file !== 'string') return entryBad('file')
	if (file !== `${PLUGIN_NAME}-${latest}-${sha.slice(0, 12)}.tgz`) {
		return { ok: false, failure: { code: 'bad-file', file, version: latest } }
	}
	return { ok: true, entry: { version: latest, file } }
}

// ───────────────────────── 检查 ─────────────────────────

/**
 * `available` 带上它读的站点 origin：点「更新到 x」时若当前已接受的站点已经变了，就不装，改为重新检查。
 * `saveFailed`：检查时配置表单上一次保存没有成功，这次读的是旧的已接受地址（界面据此提示，不静默显示成正常）。
 */
export type UpdateCheck = (
	| { kind: 'latest'; version: string }
	| { kind: 'available'; version: string; url: string; origin: string }
	| { kind: 'failed'; failure: Failure }
) & { saveFailed?: boolean }

export type FetchInit = {
	cache: 'no-store'
	credentials: 'omit'
	referrerPolicy: 'no-referrer'
	redirect: 'error'
	signal: AbortSignal
}
export type FetchLike = (url: string, init: FetchInit) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

const errorMessage = (e: unknown): string => {
	try {
		return clampReason(e instanceof Error ? e.message : String(e))
	} catch {
		return 'unknown error'
	}
}

/**
 * 读市场清单，对比已装版本。地址不合格时不发请求。
 * 不带 Referer（DSH 网页版地址里带 token）、不带 Cookie、不跟随重定向；`timeoutMs` 内没回就放弃。
 */
export async function checkUpdate(
	fetchImpl: FetchLike,
	rawSite: unknown,
	installed: string | undefined,
	options: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<UpdateCheck> {
	/* 只返回结果、不抛出：解析阶段遇到任何意外也落进失败分支。 */
	try {
		return await runCheck(fetchImpl, rawSite, installed, options)
	} catch (e) {
		return { kind: 'failed', failure: { code: 'unexpected', message: errorMessage(e) } }
	}
}

async function runCheck(
	fetchImpl: FetchLike,
	rawSite: unknown,
	installed: string | undefined,
	options: { timeoutMs?: number; signal?: AbortSignal }
): Promise<UpdateCheck> {
	const site = marketSite(rawSite)
	if (!site.ok) return { kind: 'failed', failure: { code: 'bad-site', value: site.value } }
	const origin = site.origin
	/* 已被作废（卸载 / 新的检查）就不发请求。 */
	if (options.signal?.aborted) return { kind: 'failed', failure: { code: 'cancelled' } }
	const timeoutMs = options.timeoutMs ?? CHECK_TIMEOUT_MS
	const ctl = new AbortController()
	const onAbort = () => ctl.abort()
	options.signal?.addEventListener('abort', onAbort, { once: true })
	let timer: ReturnType<typeof setTimeout> | undefined
	let timedOut = false
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			/* 先记下是超时再中止：真 fetch 被中止后会抢先以 AbortError 拒绝，不能把它当成网络错误。 */
			timedOut = true
			ctl.abort()
			reject(new Error('timeout'))
		}, timeoutMs)
	})
	timeout.catch(() => {})
	const fail = (e: unknown, parsing: boolean): UpdateCheck => {
		if (timedOut) return { kind: 'failed', failure: { code: 'timeout', origin, seconds: Math.round(timeoutMs / 1000) } }
		if (parsing && e instanceof SyntaxError) return { kind: 'failed', failure: { code: 'not-json' } }
		return { kind: 'failed', failure: { code: 'network', origin, message: errorMessage(e) } }
	}
	try {
		let response: Awaited<ReturnType<FetchLike>>
		try {
			response = await Promise.race([
				fetchImpl(origin + INDEX_PATH, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: ctl.signal }),
				timeout
			])
		} catch (e) {
			return fail(e, false)
		}
		if (!response.ok) return { kind: 'failed', failure: { code: 'http', status: response.status } }
		let body: unknown
		try {
			body = await Promise.race([response.json(), timeout])
		} catch (e) {
			return fail(e, true)
		}
		const parsed = parseMarketIndex(body)
		if (!parsed.ok) return { kind: 'failed', failure: parsed.failure }
		const { version, file } = parsed.entry
		if (installed !== undefined && compareVersions(version, installed) <= 0) {
			/* 已装版本不低于市场 latest：显示已装的，不显示市场上更旧的版本号。 */
			return { kind: 'latest', version: installed }
		}
		return { kind: 'available', version, url: origin + ARCHIVE_PATH + file, origin }
	} finally {
		if (timer !== undefined) clearTimeout(timer)
		options.signal?.removeEventListener('abort', onAbort)
	}
}

// ───────────────────────── 读配置 ─────────────────────────

export const CONFIG_WAIT_MS = 10000

/** 配置节的最小形状（SettingsFormScope 的子集）；`value` 是宿主「最后接受」的值。 */
export interface ConfigScope {
	getSnapshot(): { status: 'loading' | 'ready' | 'unavailable'; value: { marketUrl?: unknown } | undefined }
	subscribe(listener: () => void): () => void
}

/**
 * 配置表单的保存状态（来自本插件的表单控制器）。快照里的 `value` 只在宿主接受之后才变，
 * 保存还在路上时它仍是旧值（没配过就是缺省），所以检查要等「没有正在进行的保存」。
 * `failed`：上一次保存没有按所填的落下（下一次编辑或保存才清除）。
 */
export interface SaveWatch {
	getSnapshot(): { saving: boolean; failed: boolean }
	subscribe(listener: () => void): () => void
}

export type ConfigWait = { ok: true; raw: unknown; saveFailed: boolean } | { ok: false }

/**
 * 取市场地址的配置值。要等两件事：快照离开 loading，且表单没有正在进行的保存
 * （一个等待，共用 `timeoutMs` 上限与 `signal` 作废）；不能把「还没读到 / 还没存完」当成「没配」去请求缺省市场。
 * 就绪后按当时已接受的值；宿主不提供这节配置（unavailable）才用缺省。保存失败时按旧的已接受值继续，
 * 并在结果里带 `saveFailed`。超时或被作废返回 `{ ok: false }`，调用方不发请求。
 */
export function waitForMarketUrl(
	scope: ConfigScope,
	options: { timeoutMs?: number; signal?: AbortSignal; save?: SaveWatch } = {}
): Promise<ConfigWait> {
	const { signal, save } = options
	const read = (): ConfigWait | undefined => {
		const snap = scope.getSnapshot()
		if (snap.status === 'loading') return undefined
		const state = save?.getSnapshot()
		if (state?.saving) return undefined
		return { ok: true, raw: snap.status === 'ready' ? snap.value?.marketUrl : undefined, saveFailed: state?.failed === true }
	}
	if (signal?.aborted) return Promise.resolve({ ok: false })
	const now = read()
	if (now) return Promise.resolve(now)
	return new Promise((resolve) => {
		let done = false
		const offs: Array<() => void> = []
		let timer: ReturnType<typeof setTimeout> | undefined
		const finish = (result: ConfigWait) => {
			if (done) return
			done = true
			if (timer !== undefined) clearTimeout(timer)
			signal?.removeEventListener('abort', onAbort)
			for (const off of offs.splice(0)) off()
			resolve(result)
		}
		const onAbort = () => finish({ ok: false })
		const onChange = () => {
			const r = read()
			if (r) finish(r)
		}
		signal?.addEventListener('abort', onAbort, { once: true })
		timer = setTimeout(() => finish({ ok: false }), options.timeoutMs ?? CONFIG_WAIT_MS)
		for (const source of [scope, save]) {
			if (!source) continue
			/* 订阅时监听器可能被同步调用：拿到撤销函数后若已经结束，立刻撤掉，不留订阅。 */
			const off = source.subscribe(onChange)
			if (done) off()
			else offs.push(off)
		}
		onChange()
	})
}

/** 站点配置值的比较键：没配与空串同为缺省；不合格的按原文区分。 */
function siteKey(raw: unknown): string {
	const site = marketSite(raw)
	return site.ok ? `ok:${site.origin}` : `bad:${site.value}`
}

/** 当前已接受的站点是不是结果当时读的那个 origin（不是就不能装它给的地址）。 */
export function sameSite(raw: unknown, origin: string): boolean {
	const site = marketSite(raw)
	return site.ok && site.origin === origin
}

/**
 * 已接受的市场地址变了就通知（订阅快照）。第一次读到值只记下，不算变化；loading 期间不算。
 * 用来作废当前的检查结果并重新检查。
 */
export function watchMarketUrl(scope: ConfigScope, onChange: () => void): () => void {
	const current = (): string | undefined => {
		const snap = scope.getSnapshot()
		return snap.status === 'loading' ? undefined : siteKey(snap.status === 'ready' ? snap.value?.marketUrl : undefined)
	}
	let last = current()
	return scope.subscribe(() => {
		const now = current()
		if (now === undefined) return
		const changed = last !== undefined && last !== now
		last = now
		if (changed) onChange()
	})
}

// ───────────────────────── 安装 ─────────────────────────

/** `stale`：点击时已接受的市场地址与检查结果读的不是同一个站点，没有安装，调用方应当重新检查。 */
export type InstallOutcome = { kind: 'restart' } | { kind: 'applied' } | { kind: 'failed'; failure: Failure } | { kind: 'stale' }

/** 交给 DSH 插件管理的安装写法：带包名的远程包（原因见文件头）。 */
export function updateSpec(url: string): string {
	/* 包名写成字面量而不是 PLUGIN_NAME：这是 DSH 的安装写法，不随常量改名；构建产物里也能直接 grep 到。 */
	return `dsh-tool-gdrive@${url}`
}

/** 一次更新的唯一编号；DSH 用它对上安装日志、取消与断线后的结果找回。 */
export function newRequestId(now: number = Date.now()): string {
	return `gdrive-update-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 装新版。`installBundle` 要跑一次 pnpm（十几秒），这期间传输层断了不等于安装失败 ——
 * 按请求编号再问一次结果。`enabled` 传插件当前的启停状态：已停用的插件更新后仍是停用。
 */
export async function installUpdate(
	manager: PluginManagerRemote,
	url: string,
	enabled: boolean,
	requestId: string = newRequestId()
): Promise<InstallOutcome> {
	/* 两个远程调用都可能 reject（不只是回 `ok:false`）：在这里归一化，调用方永远拿到一个结果。 */
	let answer: RemoteResult<InstallResult>
	try {
		answer = await manager.installBundle(updateSpec(url), { enabled, requestId })
	} catch (e) {
		answer = { ok: false, error: { code: 'rejected', message: errorMessage(e) } }
	}
	if (!answer.ok) {
		let recovered: RemoteResult<InstallResult | null> | undefined
		try {
			recovered = await manager.waitForInstall(requestId)
		} catch {
			recovered = undefined
		}
		if (recovered?.ok && recovered.value) answer = { ok: true, value: recovered.value }
		else return { kind: 'failed', failure: { code: 'install', text: clampReason(answer.error.message || answer.error.code) } }
	}
	const result = answer.value
	if (result.application === 'restart-required') return { kind: 'restart' }
	if (result.application === 'applied') return { kind: 'applied' }
	if (result.application === 'cancelled') return { kind: 'failed', failure: { code: 'cancelled' } }
	return { kind: 'failed', failure: { code: 'install', text: failureText(result) } }
}

/** pnpm 12 起不再打 ERR_PNPM_ 代码，原因在 `Error:` 开头的那一段（按 80 列折行，URL 会被折断，接回去）。 */
function errorBlock(text: string | undefined): string | undefined {
	if (!text) return undefined
	const lines = text.split('\n')
	const start = lines.findIndex((line) => /^\s*Error:/.test(line))
	if (start < 0) return undefined
	let out = ''
	for (const line of lines.slice(start)) {
		const t = line.trim()
		if (t === '') continue
		out += out === '' || out.endsWith('-') ? t : ` ${t}`
	}
	return out
}

/** 先选出最终原因，再统一规范化并截断到 REASON_MAX（所有来源同一条出口）。 */
export function failureText(result: InstallResult): string {
	const output = result.packageResult?.output?.trim()
	/* pnpm 的输出很长，真正的原因在 ERR_PNPM_ 那一行；前面重试时的 `[WARN] … error (ERR_PNPM_…)` 只是过程。 */
	const lines = output?.split('\n').filter((line) => line.includes('ERR_PNPM_')) ?? []
	const pnpmLine = lines.find((line) => !line.trimStart().startsWith('[WARN]')) ?? lines[0]
	const diagnostic = result.error?.diagnostic
	const chosen = pnpmLine?.trim() || errorBlock(output) || errorBlock(diagnostic) || diagnostic || result.error?.code || result.application
	return clampReason(chosen)
}

/** 失败代码 → 文案键与参数（界面用 t(key, params) 翻译）。 */
export function reasonMessage(failure: Failure): { key: string; params: Record<string, string | number> } {
	switch (failure.code) {
		case 'bad-site':
			return { key: 'updateReasonBadSite', params: { value: failure.value } }
		case 'network':
			return { key: 'updateReasonNetwork', params: { origin: failure.origin, message: failure.message } }
		case 'timeout':
			return { key: 'updateReasonTimeout', params: { origin: failure.origin, seconds: failure.seconds } }
		case 'http':
			return { key: 'updateReasonHttp', params: { status: failure.status } }
		case 'not-json':
			return { key: 'updateReasonNotJson', params: {} }
		case 'schema':
			return { key: 'updateReasonSchema', params: { schema: failure.schema } }
		case 'missing':
			return { key: 'updateReasonMissing', params: {} }
		case 'bad-entry':
			return { key: 'updateReasonBadEntry', params: { detail: failure.detail } }
		case 'bad-file':
			return { key: 'updateReasonBadFile', params: { file: failure.file, version: failure.version } }
		case 'cancelled':
			return { key: 'updateReasonCancelled', params: {} }
		case 'install':
			return { key: 'updateReasonInstall', params: { text: failure.text } }
		case 'config-loading':
			return { key: 'updateReasonConfigLoading', params: {} }
		case 'unexpected':
			return { key: 'updateReasonUnexpected', params: { message: failure.message } }
	}
}

// ───────────────────────── 装好待重启 ─────────────────────────

/**
 * 「装好了、还没重启」记在组件之外：装完新版 DSH 会热替换浏览器半侧、插件页也按新包重画，组件状态全丢；
 * 可宿主半侧仍是旧的，要重启 DSH 才换。DSH 不告诉插件页宿主半侧跑的是哪一版，所以记录跟着页面走
 * （存放处见 index.tsx：window 级 Map），重开页面即视为重启过。只认与盘上版本一致的记录。
 */
export interface KeyValueStore {
	getItem(key: string): string | null
	setItem(key: string, value: string): void
	removeItem(key: string): void
}

export function markRestartPending(store: KeyValueStore | undefined, version: string): void {
	try {
		store?.setItem(RESTART_KEY, version)
	} catch {
		/* 存不进去：只是少一句提示 */
	}
}

export function clearRestartPending(store: KeyValueStore | undefined): void {
	try {
		store?.removeItem(RESTART_KEY)
	} catch {
		/* 同上 */
	}
}

export function restartPending(store: KeyValueStore | undefined, installed: string | undefined): boolean {
	if (installed === undefined) return false
	try {
		return store?.getItem(RESTART_KEY) === installed || store?.getItem(INFLIGHT_KEY) === installed
	} catch {
		return false
	}
}

// ───────────────────────── 安装状态机 ─────────────────────────
//
// window 上共享三样东西（Symbol 名与键名跨版本不能改，0.2.6 之后的版本要读得懂）：
//
//   RESTART_KEY    「已确认」的待重启版本。只在安装结果确认为 restart 时写入；安装失败 / 取消 / 拒绝都不碰它；
//                  applied（已经热生效，不需要重启）时清除。所以已确认的 0.2.7 不会被一次失败的 0.2.8 抹掉。
//   INFLIGHT_KEY   「进行中」的目标版本。安装前写入、无论成败都在收尾时删除。
//                  存它是因为装成功的那一刻 DSH 就热替换浏览器半侧：新页面里的组件已经没有旧组件的状态，
//                  而旧模块的收尾代码不一定来得及跑 —— 新页面若看到「进行中的目标版本 == 盘上版本」，就说明已装上，
//                  按「已确认」处理（restartPending 两个键都认）。
//   registry       唯一的进行中安装（含它的 Promise）。已有安装在进行时，新挂载的组件或再次点击不再发起新安装，
//                  拿同一个 Promise 等同一个结果（runInstall 直接返回它）。热替换不换文档，registry 留得下来。
//
// 状态流：idle → 写 INFLIGHT、登记 registry → installBundle →
//   restart  : 删 INFLIGHT、写 RESTART_KEY（升为已确认）
//   applied  : 删 INFLIGHT、清 RESTART_KEY
//   failed / cancelled / reject : 删 INFLIGHT，RESTART_KEY 不变
// 收尾在 finally 里，registry 一定被释放。

export interface InflightInstall {
	requestId: string
	version: string
	promise: Promise<InstallOutcome>
}

/** 唯一的进行中安装的登记处（挂在 window 上，见 index.tsx）。 */
export interface InstallRegistry {
	current?: InflightInstall
}

export function runInstall(
	registry: InstallRegistry,
	store: KeyValueStore | undefined,
	manager: PluginManagerRemote,
	url: string,
	version: string,
	enabled: boolean
): Promise<InstallOutcome> {
	if (registry.current) return registry.current.promise
	const requestId = newRequestId()
	try {
		store?.setItem(INFLIGHT_KEY, version)
	} catch {
		/* 存不进去：只是少一句提示 */
	}
	const promise = (async (): Promise<InstallOutcome> => {
		let outcome: InstallOutcome = { kind: 'failed', failure: { code: 'unexpected', message: 'install did not finish' } }
		try {
			outcome = await installUpdate(manager, url, enabled, requestId)
		} catch (e) {
			outcome = { kind: 'failed', failure: { code: 'unexpected', message: errorMessage(e) } }
		} finally {
			registry.current = undefined
			try {
				store?.removeItem(INFLIGHT_KEY)
			} catch {
				/* 同上 */
			}
			if (outcome.kind === 'restart') markRestartPending(store, version)
			else if (outcome.kind === 'applied') clearRestartPending(store)
		}
		return outcome
	})()
	registry.current = { requestId, version, promise }
	return promise
}
