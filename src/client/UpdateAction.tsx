/**
 * 插件详情页页头的「检查更新 / 更新到 x.y.z」。只出现在本插件自己的组合包页上。
 *
 * 打开页面就查一次（只读市场清单）；有新版时按钮直接写目标版本号，点一下由 DSH 的插件管理装新包。
 * 新包要等 DSH 重启才接管 —— 正在跑的这份插件不能被就地替换。失败原因写在正文里（不放 title）。
 * @module dsh-tool-gdrive/client/UpdateAction
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Button, TextShimmer } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PluginsSubject, Translate } from './contract.js'
import { PLUGIN_NAME, clampReason, reasonMessage, type Failure, type InstallOutcome, type UpdateCheck } from './update.js'

export interface UpdateActionProps {
	subject: PluginsSubject
	t: Translate
	checkUpdate: (installed: string | undefined, signal?: AbortSignal) => Promise<UpdateCheck>
	/** `origin`：检查结果读的站点；点击时已接受的站点若不同，不安装（回 stale），由本组件重新检查。 */
	installUpdate: (url: string, version: string, enabled: boolean, origin: string) => Promise<InstallOutcome>
	/** 已有安装在进行（比如热替换后重挂载）：拿到它的目标版本与结果，不再发起新安装。 */
	inflight?: () => { version: string; promise: Promise<InstallOutcome> } | undefined
	/** 已接受的市场地址变了就通知；返回撤销函数。 */
	watchSite?: (listener: () => void) => () => void
	/** 盘上这个版本是不是本窗口刚装、还没重启 DSH。 */
	restartPending: (installed: string | undefined) => boolean
}

type Phase =
	| { kind: 'checking' }
	| { kind: 'checked'; check: UpdateCheck }
	| { kind: 'installing'; version: string }
	| { kind: 'installed'; version: string; outcome: InstallOutcome }

type Tone = 'muted' | 'ok' | 'error'

const WRAP: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }
/* DSH 的页头操作区不收缩（flex-shrink: 0），状态文字太宽会把「卸载」和启停开关挤出窗口；
 * 窗口窄（侧栏收起，宽度 < 1100px）时跟着窗口收窄：实测 480px 起不溢出，760px 起为满宽 360px。 */
const STATUS_BASE: CSSProperties = { maxWidth: 'min(360px, max(96px, calc(100vw - 390px)))', fontSize: 12, lineHeight: '18px', overflowWrap: 'anywhere' }
/* 对比度（浅色底实测）：label-tertiary 3.7:1、state-error-primary 4.498:1，都不到 4.5:1，
 * 所以「已是最新」用 label-secondary，错误色向正文色掺 20% 压深一点（token 间的 color-mix，随明暗主题走）。
 * 浏览器不认 color-mix 时退回普通 token 颜色；var() 都带回退值，token 缺失时也有可读的颜色。 */
const ERROR_TOKEN = 'var(--dsw-alias-state-error-primary, #b3261e)'
const ERROR_MIXED = `color-mix(in srgb, ${ERROR_TOKEN} 80%, var(--dsw-alias-label-primary, #1c1c1e))`
const SECONDARY = 'var(--dsw-alias-label-secondary, #5f6368)'

function supportsColorMix(): boolean {
	try {
		return typeof CSS !== 'undefined' && CSS.supports('color', 'color-mix(in srgb, red 50%, blue)')
	} catch {
		return false
	}
}

function statusStyle(tone: Tone): CSSProperties {
	const color = tone === 'error' ? (supportsColorMix() ? ERROR_MIXED : ERROR_TOKEN) : SECONDARY
	return { ...STATUS_BASE, color }
}

function unexpected(e: unknown): Failure {
	let message = 'unknown error'
	try {
		message = clampReason(e instanceof Error ? e.message : String(e))
	} catch {
		/* 连描述都取不出来：用上面的缺省 */
	}
	return { code: 'unexpected', message }
}

function reasonText(t: Translate, failure: Failure): string {
	const { key, params } = reasonMessage(failure)
	return t(key, params)
}

export function UpdateAction({ subject, t, checkUpdate, installUpdate, inflight, watchSite, restartPending: isRestartPending }: UpdateActionProps) {
	const own = subject.kind === 'bundle' && subject.pkg.name === PLUGIN_NAME && subject.pkg.installed
	const installed = subject.kind === 'bundle' ? subject.pkg.version : undefined
	const enabled = subject.kind === 'bundle' ? subject.pkg.enabled !== false : true
	const [phase, setPhase] = useState<Phase>({ kind: 'checking' })
	const live = useRef(true)
	const running = useRef<AbortController | null>(null)
	const installing = useRef(false)
	useEffect(() => {
		live.current = true
		return () => {
			live.current = false
			running.current?.abort()
		}
	}, [])

	const check = (): void => {
		if (!live.current) return
		/* 新的一次检查作废上一次（包括它还在等配置）。 */
		running.current?.abort()
		const ctl = new AbortController()
		running.current = ctl
		setPhase({ kind: 'checking' })
		void checkUpdate(installed, ctl.signal)
			.catch((e: unknown): UpdateCheck => ({ kind: 'failed', failure: unexpected(e) }))
			.then((result) => {
				if (live.current && running.current === ctl) setPhase({ kind: 'checked', check: result })
			})
	}

	/* 一次安装的收尾：站点已变（stale）就重新检查，其余显示结果。 */
	const settle = (version: string, outcome: InstallOutcome): void => {
		installing.current = false
		if (!live.current) return
		if (outcome.kind === 'stale') check()
		else setPhase({ kind: 'installed', version, outcome })
	}
	const follow = (version: string, promise: Promise<InstallOutcome>): void => {
		installing.current = true
		setPhase({ kind: 'installing', version })
		void promise.catch((e: unknown): InstallOutcome => ({ kind: 'failed', failure: unexpected(e) })).then((outcome) => settle(version, outcome))
	}
	useEffect(() => {
		/* 打开页面 / 换了版本（页面按新的 subject 重画）：有安装在进行就接着等它，否则查一次。 */
		if (!own) return
		const ongoing = inflight?.()
		if (ongoing) follow(ongoing.version, ongoing.promise)
		else check()
	}, [own, installed])
	useEffect(() => {
		/* 已接受的市场地址变了：作废当前结果、重新检查（安装进行中不打断）。 */
		if (!own || !watchSite) return
		return watchSite(() => {
			if (live.current && !installing.current) check()
		})
	}, [own, installed])

	if (!own) return null
	/* 装完新版插件页会按新包重画、这颗按钮重新挂载，「重启后生效」不能只记在本地状态里。 */
	const restartPending = isRestartPending(installed)

	const install = (url: string, version: string, origin: string): void => {
		follow(version, installUpdate(url, version, enabled, origin))
	}

	let button: { label: string; onClick?: () => void; busy?: boolean; primary?: boolean }
	let status: { text: string; tone: Tone } | null = null
	switch (phase.kind) {
		case 'checking':
			button = { label: t('updateChecking'), busy: true }
			break
		case 'installing':
			button = { label: t('updateInstalling', { version: phase.version }), busy: true }
			break
		case 'installed':
			if (phase.outcome.kind === 'failed') {
				button = { label: t('updateRetry'), onClick: check }
				status = { text: t('updateFailed', { reason: reasonText(t, phase.outcome.failure) }), tone: 'error' }
			} else {
				button = { label: t('updateCheck'), onClick: check }
				status = { text: t(phase.outcome.kind === 'restart' ? 'updateDoneRestart' : 'updateDone', { version: phase.version }), tone: 'ok' }
			}
			break
		case 'checked': {
			const result = phase.check
			if (result.kind === 'available') {
				button = { label: t('updateInstall', { version: result.version }), onClick: () => install(result.url, result.version, result.origin), primary: true }
			} else if (result.kind === 'failed') {
				button = { label: t('updateRetry'), onClick: check }
				status = { text: t('updateCheckFailed', { reason: reasonText(t, result.failure) }), tone: 'error' }
			} else {
				button = { label: t('updateCheck'), onClick: check }
				status = restartPending
					? { text: t('updateDoneRestart', { version: installed! }), tone: 'ok' }
					: { text: t('updateLatest', { version: result.version }), tone: 'muted' }
			}
			break
		}
	}

	/* 上一次保存配置没成功：这次读的是旧的已接受地址，不能静默显示成正常。 */
	const note = phase.kind === 'checked' && phase.check.saveFailed ? t('updateSaveFailedNote') : null

	return (
		<span style={WRAP}>
			{note !== null ? (
				<span style={statusStyle('muted')} role="status">
					{note}
				</span>
			) : null}
			{status !== null ? (
				<span style={statusStyle(status.tone)} role={status.tone === 'error' ? 'alert' : 'status'}>
					{status.text}
				</span>
			) : null}
			<Button variant={button.primary ? 'primary' : 'outline'} size="sm" disabled={button.busy === true} onClick={button.onClick}>
				{button.busy ? <TextShimmer active>{button.label}</TextShimmer> : button.label}
			</Button>
		</span>
	)
}
