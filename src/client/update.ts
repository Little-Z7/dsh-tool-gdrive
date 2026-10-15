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
import type { InstallResult, PluginManagerRemote } from './contract.js'

export const PLUGIN_NAME = 'dsh-tool-gdrive'
/** 缺省市场地址只在这里写一处。 */
export const DEFAULT_MARKET_URL = 'https://tv.auraaigc.ccwu.cc:56814'
export const INDEX_PATH = '/dsh-market/index.json'
export const ARCHIVE_PATH = '/dsh-market/'
export const CHECK_TIMEOUT_MS = 15000
export const RESTART_KEY = 'dsh-tool-gdrive.restart-pending'
export const WINDOW_STORE_NAME = 'dsh-tool-gdrive.window-store'

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
	if (raw.schemaVersion !== 1) return { ok: false, failure: { code: 'schema', schema: String(raw.schemaVersion) } }
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

export type UpdateCheck =
	| { kind: 'latest'; version: string }
	| { kind: 'available'; version: string; url: string }
	| { kind: 'failed'; failure: Failure }

export type FetchInit = {
	cache: 'no-store'
	credentials: 'omit'
	referrerPolicy: 'no-referrer'
	redirect: 'error'
	signal: AbortSignal
}
export type FetchLike = (url: string, init: FetchInit) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e))

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
	const site = marketSite(rawSite)
	if (!site.ok) return { kind: 'failed', failure: { code: 'bad-site', value: site.value } }
	const origin = site.origin
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
		return { kind: 'available', version, url: origin + ARCHIVE_PATH + file }
	} finally {
		if (timer !== undefined) clearTimeout(timer)
		options.signal?.removeEventListener('abort', onAbort)
	}
}

// ───────────────────────── 安装 ─────────────────────────

export type InstallOutcome = { kind: 'restart' } | { kind: 'applied' } | { kind: 'failed'; failure: Failure }

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
	let answer = await manager.installBundle(updateSpec(url), { enabled, requestId })
	if (!answer.ok) {
		const recovered = await manager.waitForInstall(requestId)
		if (recovered.ok && recovered.value) answer = { ok: true, value: recovered.value }
		else return { kind: 'failed', failure: { code: 'install', text: answer.error.message || answer.error.code } }
	}
	const result = answer.value
	if (result.application === 'restart-required') return { kind: 'restart' }
	if (result.application === 'applied') return { kind: 'applied' }
	if (result.application === 'cancelled') return { kind: 'failed', failure: { code: 'cancelled' } }
	return { kind: 'failed', failure: { code: 'install', text: failureText(result) } }
}

const REASON_MAX = 400

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
	return out.length > REASON_MAX ? `${out.slice(0, REASON_MAX)}…` : out
}

export function failureText(result: InstallResult): string {
	const output = result.packageResult?.output?.trim()
	/* pnpm 的输出很长，真正的原因在 ERR_PNPM_ 那一行；前面重试时的 `[WARN] … error (ERR_PNPM_…)` 只是过程。 */
	const lines = output?.split('\n').filter((line) => line.includes('ERR_PNPM_')) ?? []
	const pnpmLine = lines.find((line) => !line.trimStart().startsWith('[WARN]')) ?? lines[0]
	const diagnostic = result.error?.diagnostic
	return pnpmLine?.trim() || errorBlock(output) || errorBlock(diagnostic) || diagnostic || result.error?.code || result.application
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
		return store?.getItem(RESTART_KEY) === installed
	} catch {
		return false
	}
}
