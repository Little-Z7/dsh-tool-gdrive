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
	secretConfigured: boolean
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
				settingsNumberField('pageSize')
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
			secretConfigured: typeof user.clientSecret === 'string' && user.clientSecret.length > 0,
			effectiveBridgePort: bridge
		}
	}

	inject() {
		return { hooks: { gdriveForm: this.store }, ...this.form.actions() }
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

/** GCP 建项目指引（折叠，原生 details）。 */
function GcpGuide(props: { t: T }) {
	const { t } = props
	return (
		<details>
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
			</SettingsForm>
			<GcpGuide t={t} />
			<AuthWizard t={t} bridgePort={state.effectiveBridgePort} />
		</div>
	)
}
