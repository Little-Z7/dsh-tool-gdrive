/**
 * 配置页：凭证表单（configForms 持久化）+ GCP 指引 + 授权向导（本地桥实时状态）。
 * 仿 dsh-client-ui-settings-shell 的 ShellCard 模式。
 * @module dsh-tool-gdrive/client/page
 */
import { useEffect, useState } from 'react'
import {
	SettingsForm,
	SettingsFormModel,
	SettingsSecretField,
	SettingsValueField,
	Tag,
	settingsNumberField,
	settingsTextField,
	type SettingsFieldSpec,
	type SettingsFormScope,
	type TagTone
} from '@deepseek-ai/dsh-client-ui-primitives'
import { DEFAULT_MARKET_URL, marketSite, type SaveWatch } from './update.js'

type T = (key: string) => string

/** mode 字段：只允许三个枚举值，空串表示恢复默认。 */
function settingsModeField(field: string): SettingsFieldSpec {
	return {
		field,
		format: (v) => String(v ?? ''),
		parse: (text) => {
			const v = text.trim()
			if (v === '') return { kind: 'clear' }
			if (v === 'readonly' || v === 'readwrite' || v === 'full') return { kind: 'set', value: v }
			return undefined
		}
	}
}

/** 市场地址：空串表示恢复缺省；合格的存归一化后的 origin；不合格返回 undefined（表单据此阻止保存）。 */
function settingsMarketUrlField(field: string): SettingsFieldSpec {
	return {
		field,
		format: (v) => String(v ?? ''),
		parse: (text) => {
			if (text.trim() === '') return { kind: 'clear' }
			const site = marketSite(text)
			return site.ok ? { kind: 'set', value: site.origin } : undefined
		}
	}
}

interface FormSnapshot {
	available: boolean
	writable: boolean
	dirty: boolean
	invalid: boolean
	saving: boolean
	failed: boolean
	clientId: { text: string; overridden: boolean; invalid: boolean }
	clientSecret: { text: string; overridden: boolean; invalid: boolean }
	mode: { text: string; overridden: boolean; invalid: boolean }
	port: { text: string; overridden: boolean; invalid: boolean }
	bridgePort: { text: string; overridden: boolean; invalid: boolean }
	maxChars: { text: string; overridden: boolean; invalid: boolean }
	pageSize: { text: string; overridden: boolean; invalid: boolean }
	marketUrl: { text: string; overridden: boolean; invalid: boolean }
	secretConfigured: boolean
	clientIdConfigured: boolean
	effectiveBridgePort: number
}

/** 表单控制器：桥接一个 SettingsFormModel 到 slot 注入面。 */
export class GdriveFormController {
	private readonly form: SettingsFormModel<Record<string, unknown>>
	readonly store: ReturnType<SettingsFormModel<Record<string, unknown>>['bind']>

	constructor(private readonly scope: SettingsFormScope<Record<string, unknown>>) {
		const secrets = [
			{
				field: 'clientSecret',
				write: (text: string) => scope.mutate([{ op: 'set', path: ['clientSecret'], value: text }])
			}
		]
		this.form = new SettingsFormModel(
			scope,
			[
				settingsTextField('clientId'),
				settingsModeField('mode'),
				settingsNumberField('port'),
				settingsNumberField('bridgePort'),
				settingsNumberField('maxChars'),
				settingsNumberField('pageSize'),
				settingsMarketUrlField('marketUrl')
			],
			secrets
		)
		this.store = this.form.bind(() => this.projection())
	}

	private projection(): FormSnapshot {
		const snap = this.scope.getSnapshot()
		const value = (snap.value ?? {}) as Record<string, unknown>
		const user = (snap.user ?? {}) as Record<string, unknown>
		const port = typeof value.port === 'number' ? value.port : 55414
		const bridge = typeof value.bridgePort === 'number' && value.bridgePort > 0 ? value.bridgePort : port + 10
		return {
			...this.form.shell(),
			clientId: this.form.field('clientId'),
			clientSecret: this.form.field('clientSecret'),
			mode: this.form.field('mode'),
			port: this.form.field('port'),
			bridgePort: this.form.field('bridgePort'),
			maxChars: this.form.field('maxChars'),
			pageSize: this.form.field('pageSize'),
			marketUrl: this.form.field('marketUrl'),
			secretConfigured: typeof user.clientSecret === 'string' && user.clientSecret.length > 0,
			clientIdConfigured: typeof user.clientId === 'string' && user.clientId.length > 0,
			effectiveBridgePort: bridge
		}
	}

	/** 进行中的保存数（包在 save 动作外面记的：宿主表单模型没把 saving 暴露成可订阅的值时也有据可依）。 */
	private explicitSaves = 0
	private readonly saveListeners = new Set<() => void>()

	private notifySave(): void {
		for (const listener of [...this.saveListeners]) listener()
	}

	/**
	 * 保存状态，给「检查更新」用：表单模型的 `saving` / `failed`（经它发布的快照读，随快照变化订阅），
	 * 加上 save 动作外包一层记下的「保存进行中」。保存没落定之前，宿主「最后接受」的值还是旧的。
	 * 注意 `failed` 是整张表单的保存结果（宿主先提交普通字段、再写 secret），不是 marketUrl 单个字段的结果。
	 */
	readonly saveWatch: SaveWatch = {
		getSnapshot: () => {
			const shell = this.store.getSnapshot() as { saving?: boolean; failed?: boolean }
			return { saving: this.explicitSaves > 0 || shell.saving === true, failed: shell.failed === true }
		},
		subscribe: (listener) => {
			this.saveListeners.add(listener)
			const off = this.store.subscribe(listener)
			return () => {
				this.saveListeners.delete(listener)
				off()
			}
		}
	}

	private async trackedSave(): Promise<void> {
		this.explicitSaves++
		this.notifySave()
		try {
			await this.form.save()
		} finally {
			this.explicitSaves--
			this.notifySave()
		}
	}

	inject() {
		const actions = this.form.actions()
		return {
			hooks: { gdriveForm: this.store },
			...actions,
			/* 0.2.0-rc.2 的 `actions().save()` 返回 void（内部 `this.save()` 的 Promise 被丢掉），
			 * 所以这里包的是有 Promise 契约的 `form.save()`：开始前计数，finally 里归还。 */
			save: () => {
				void this.trackedSave()
			}
		}
	}

	dispose() {
		this.form.dispose()
	}
}

interface AuthState {
	phase: 'checking' | 'down' | 'ready'
	status?: string
	authorized?: boolean
	scopeMismatch?: boolean
	hint?: string
	starting: boolean
	startedUrl?: string
	error?: string
}

/** 授权向导区：轮询本地桥状态 + 一键授权。 */
function AuthWizard(props: { t: T; bridgePort: number }) {
	const { t } = props
	const [state, setState] = useState<AuthState>({ phase: 'checking', starting: false })
	const base = `http://127.0.0.1:${props.bridgePort}`

	useEffect(() => {
		let alive = true
		const tick = async () => {
			try {
				const res = await fetch(`${base}/gdrive/status`)
				const data = (await res.json()) as Record<string, unknown>
				if (!alive) return
				setState((s) => ({
					...s,
					phase: 'ready',
					status: typeof data.status === 'string' ? data.status : 'no_token',
					authorized: data.authorized === true,
					scopeMismatch: data.scopeMismatch === true,
					hint: typeof data.hint === 'string' ? data.hint : undefined
				}))
			} catch {
				if (alive) setState((s) => ({ ...s, phase: 'down' }))
			}
		}
		void tick()
		const timer = setInterval(() => void tick(), 3000)
		return () => {
			alive = false
			clearInterval(timer)
		}
	}, [base])

	const startAuth = async () => {
		setState((s) => ({ ...s, starting: true, error: undefined }))
		try {
			const res = await fetch(`${base}/gdrive/start-auth`, { method: 'POST' })
			const data = (await res.json()) as { authUrl?: string; error?: string }
			setState((s) => ({ ...s, starting: false, startedUrl: data.authUrl, error: data.error }))
		} catch {
			setState((s) => ({ ...s, starting: false, error: t('bridgeDown') }))
		}
	}

	let badge: { tone: TagTone; text: string }
	if (state.phase === 'checking') badge = { tone: 'neutral', text: t('statusChecking') }
	else if (state.phase === 'down') badge = { tone: 'danger', text: t('bridgeDown') }
	else if (state.scopeMismatch) badge = { tone: 'warning', text: t('statusMismatch') }
	else if (state.authorized) badge = { tone: 'success', text: t('statusAuthorized') }
	else if (state.status === 'pending') badge = { tone: 'warning', text: t('statusPending') }
	else badge = { tone: 'neutral', text: t('statusNoToken') }

	const showAuthButton = state.phase === 'ready' && (state.scopeMismatch === true || !state.authorized)

	return (
		<section>
			<h3>{t('sectionAuth')}</h3>
			<p>
				<Tag tone={badge.tone}>{badge.text}</Tag>
			</p>
			{showAuthButton ? (
				<p>
					<button type="button" disabled={state.starting} onClick={() => void startAuth()}>
						{state.starting ? t('starting') : t('startAuth')}
					</button>
				</p>
			) : null}
			{state.startedUrl && !state.authorized ? (
				<p>
					{t('authStarted')}
					<br />
					{t('openManually')} <code>{state.startedUrl}</code>
				</p>
			) : null}
			{state.error ? <p>{state.error}</p> : null}
		</section>
	)
}

/** GCP 建项目指引（折叠；未配置凭证时默认展开）。 */
function GcpGuide(props: { t: T; defaultOpen: boolean }) {
	const { t } = props
	return (
		<details open={props.defaultOpen || undefined}>
			<summary>{t('guideTitle')}</summary>
			<ol>
				<li>{t('guideStep1')}</li>
				<li>{t('guideStep2')}</li>
				<li>{t('guideStep3')}</li>
				<li>{t('guideStep4')}</li>
			</ol>
			<p>{t('guideNote')}</p>
		</details>
	)
}

export interface PageProps {
	t: T
	view: string
	useGdriveForm: <S>(selector: (s: FormSnapshot) => S) => S
	edit: (field: string, text: string) => void
	resetField: (field: string) => void
	save: () => void
	discard: () => void
}

/** 配置页主体：summary 一行简介；page 渲染完整表单与授权向导。 */
export function GdrivePage(props: PageProps) {
	const { t } = props
	const state = props.useGdriveForm((s) => s)
	if (props.view === 'summary') return <>{t('description')}</>
	const disabled = !state.writable
	return (
		<div>
			<SettingsForm
				labels={{
					unavailable: t('unavailable'),
					readOnly: t('readOnly'),
					saveFailed: t('saveFailed'),
					save: t('save'),
					saving: t('saving')
				}}
				state={state}
				onSave={props.save}
				onDiscard={props.discard}
			>
				<SettingsValueField
					id="gdrive-client-id"
					label={t('clientId')}
					hint={t('clientIdHint')}
					overriddenLabel={t('overridden')}
					resetLabel={t('reset')}
					invalidLabel={t('invalidNumber')}
					disabled={disabled}
					{...state.clientId}
					onEdit={(text) => props.edit('clientId', text)}
					onReset={() => props.resetField('clientId')}
				/>
				<SettingsSecretField
					id="gdrive-client-secret"
					label={t('clientSecret')}
					hint={t('clientSecretHint')}
					disabled={disabled}
					text={state.clientSecret.text}
					configured={state.secretConfigured}
					stateLabel={state.secretConfigured ? t('secretConfigured') : t('secretNotConfigured')}
					onEdit={(text) => props.edit('clientSecret', text)}
				/>
				<SettingsValueField
					id="gdrive-mode"
					label={t('mode')}
					hint={t('modeHint')}
					overriddenLabel={t('overridden')}
					resetLabel={t('reset')}
					invalidLabel={t('invalidMode')}
					placeholder="readonly"
					disabled={disabled}
					{...state.mode}
					onEdit={(text) => props.edit('mode', text)}
					onReset={() => props.resetField('mode')}
				/>
				<SettingsValueField
					id="gdrive-port"
					label={t('port')}
					hint={t('portHint')}
					overriddenLabel={t('overridden')}
					resetLabel={t('reset')}
					invalidLabel={t('invalidNumber')}
					numeric
					disabled={disabled}
					{...state.port}
					onEdit={(text) => props.edit('port', text)}
					onReset={() => props.resetField('port')}
				/>
				<SettingsValueField
					id="gdrive-max-chars"
					label={t('maxChars')}
					hint={t('maxCharsHint')}
					overriddenLabel={t('overridden')}
					resetLabel={t('reset')}
					invalidLabel={t('invalidNumber')}
					numeric
					disabled={disabled}
					{...state.maxChars}
					onEdit={(text) => props.edit('maxChars', text)}
					onReset={() => props.resetField('maxChars')}
				/>
				<SettingsValueField
					id="gdrive-page-size"
					label={t('pageSize')}
					hint={t('pageSizeHint')}
					overriddenLabel={t('overridden')}
					resetLabel={t('reset')}
					invalidLabel={t('invalidNumber')}
					numeric
					disabled={disabled}
					{...state.pageSize}
					onEdit={(text) => props.edit('pageSize', text)}
					onReset={() => props.resetField('pageSize')}
				/>
				<SettingsValueField
					id="gdrive-market-url"
					label={t('marketUrl')}
					hint={t('marketUrlHint')}
					overriddenLabel={t('overridden')}
					resetLabel={t('reset')}
					invalidLabel={t('invalidUrl')}
					placeholder={DEFAULT_MARKET_URL}
					disabled={disabled}
					{...state.marketUrl}
					onEdit={(text) => props.edit('marketUrl', text)}
					onReset={() => props.resetField('marketUrl')}
				/>
			</SettingsForm>
			<GcpGuide t={t} defaultOpen={!(state.clientIdConfigured && state.secretConfigured)} />
			<AuthWizard t={t} bridgePort={state.effectiveBridgePort} />
		</div>
	)
}
