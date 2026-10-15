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
import { PLUGIN_NAME, reasonMessage, type Failure, type InstallOutcome, type UpdateCheck } from './update.js'

export interface UpdateActionProps {
	subject: PluginsSubject
	t: Translate
	checkUpdate: (installed: string | undefined) => Promise<UpdateCheck>
	installUpdate: (url: string, version: string, enabled: boolean) => Promise<InstallOutcome>
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
/* 对比度（浅色底实测）：label-tertiary 3.7:1、state-error-primary 4.498:1，都不到 4.5:1，
 * 所以「已是最新」用 label-secondary，错误色向正文色掺 20% 压深一点（token 间的 color-mix，随明暗主题走）。 */
const STATUS: Record<Tone, CSSProperties> = {
	muted: { color: 'var(--dsw-alias-label-secondary)' },
	ok: { color: 'var(--dsw-alias-label-secondary)' },
	error: { color: 'color-mix(in srgb, var(--dsw-alias-state-error-primary) 80%, var(--dsw-alias-label-primary))' }
}
/* DSH 的页头操作区不收缩（flex-shrink: 0），状态文字太宽会把「卸载」和启停开关挤出窗口；
 * 窗口窄（侧栏收起，宽度 < 1100px）时跟着窗口收窄：实测 480px 起不溢出，760px 起为满宽 360px。 */
const STATUS_BASE: CSSProperties = { maxWidth: 'min(360px, max(96px, calc(100vw - 390px)))', fontSize: 12, lineHeight: '18px', overflowWrap: 'anywhere' }

function reasonText(t: Translate, failure: Failure): string {
	const { key, params } = reasonMessage(failure)
	return t(key, params)
}

export function UpdateAction({ subject, t, checkUpdate, installUpdate, restartPending: isRestartPending }: UpdateActionProps) {
	const own = subject.kind === 'bundle' && subject.pkg.name === PLUGIN_NAME && subject.pkg.installed
	const installed = subject.kind === 'bundle' ? subject.pkg.version : undefined
	const enabled = subject.kind === 'bundle' ? subject.pkg.enabled !== false : true
	const [phase, setPhase] = useState<Phase>({ kind: 'checking' })
	const live = useRef(true)
	useEffect(() => {
		live.current = true
		return () => {
			live.current = false
		}
	}, [])

	const check = (): void => {
		setPhase({ kind: 'checking' })
		void checkUpdate(installed).then((result) => {
			if (live.current) setPhase({ kind: 'checked', check: result })
		})
	}
	useEffect(() => {
		/* 换了版本（页面按新的 subject 重画）就再查一次。 */
		if (own) check()
	}, [own, installed])

	if (!own) return null
	/* 装完新版插件页会按新包重画、这颗按钮重新挂载，「重启后生效」不能只记在本地状态里。 */
	const restartPending = isRestartPending(installed)

	const install = (url: string, version: string): void => {
		setPhase({ kind: 'installing', version })
		void installUpdate(url, version, enabled).then((outcome) => {
			if (live.current) setPhase({ kind: 'installed', version, outcome })
		})
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
				button = { label: t('updateInstall', { version: result.version }), onClick: () => install(result.url, result.version), primary: true }
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

	return (
		<span style={WRAP}>
			{status !== null ? (
				<span style={{ ...STATUS_BASE, ...STATUS[status.tone] }} role={status.tone === 'error' ? 'alert' : 'status'}>
					{status.text}
				</span>
			) : null}
			<Button variant={button.primary ? 'primary' : 'outline'} size="sm" disabled={button.busy === true} onClick={button.onClick}>
				{button.busy ? <TextShimmer active>{button.label}</TextShimmer> : button.label}
			</Button>
		</span>
	)
}
