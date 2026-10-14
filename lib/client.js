window.__ModuleLoader__.load({
	id: "dsh-tool-gdrive",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  NS: () => NS,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/locales.ts
var NS = "gdrive.settings";
var en = {
  title: "Google Drive",
  description: "Read and write Google Drive files, Docs and Sheets with an in-app OAuth wizard.",
  summary: "Configure OAuth credentials and authorize your Google account.",
  sectionCredentials: "Google OAuth credentials",
  clientId: "Client ID",
  clientIdHint: 'OAuth client of type "Desktop app" from Google Cloud Console.',
  clientSecret: "Client Secret",
  clientSecretHint: "Write-only: saved but never displayed. Leave blank to keep the stored value.",
  secretConfigured: "Configured",
  secretNotConfigured: "Not configured",
  mode: "Mode",
  modeHint: "readonly | readwrite | full. readwrite can modify files this plugin created plus Docs/Sheets content; full can modify everything.",
  port: "OAuth callback port",
  portHint: "Loopback port for the OAuth callback; auto-increments when occupied.",
  bridgePort: "Bridge port",
  bridgePortHint: "Loopback port this page uses to talk to the plugin; 0 means callback port + 10.",
  maxChars: "Read cap (chars)",
  maxCharsHint: "Maximum characters returned by a single read; longer content is marked truncated.",
  pageSize: "Page size",
  pageSizeHint: "Default page size for list and search.",
  guideTitle: "How to create the OAuth client (one time, ~3 min)",
  guideStep1: "Open console.cloud.google.com with your Gmail and create a project.",
  guideStep2: "Enable three APIs: Google Drive API, Google Docs API, Google Sheets API.",
  guideStep3: "OAuth consent screen: External, add your Gmail as a test user.",
  guideStep4: 'Credentials \u2192 Create OAuth client ID \u2192 type "Desktop app" \u2192 copy the Client ID and Secret here.',
  guideNote: 'The consent screen stays in testing mode, so Google shows an "unverified app" warning during authorization \u2014 that is expected, click Continue.',
  sectionAuth: "Authorization",
  statusChecking: "Checking status\u2026",
  statusNoToken: "Not authorized",
  statusPending: "Authorization in progress \u2014 finish signing in in the browser",
  statusAuthorized: "Authorized",
  statusMismatch: "Authorized but scopes do not match the current mode \u2014 re-authorize",
  bridgeDown: "Cannot reach the plugin bridge. Is the plugin enabled? (Also upgrade if this version predates the bridge.)",
  startAuth: "Start authorization",
  starting: "Starting\u2026",
  authStarted: "Browser opened. After signing in, come back \u2014 this page updates automatically.",
  openManually: "If no browser opened, copy this link:",
  unavailable: "This plugin is not loaded, so it cannot be configured right now.",
  readOnly: "This deployment stores settings read-only.",
  saveFailed: "The deployment did not accept these values; they were left for you to correct.",
  save: "Save",
  saving: "Saving\u2026",
  invalidNumber: "Enter a number, or leave blank to use the default.",
  invalidMode: "Must be one of: readonly, readwrite, full.",
  overridden: "Overridden",
  reset: "Reset to default"
};
var zh = {
  title: "Google \u4E91\u7AEF\u786C\u76D8",
  description: "\u8BFB\u5199 Google \u4E91\u7AEF\u786C\u76D8\u6587\u4EF6\u3001\u6587\u6863\u4E0E\u8868\u683C\uFF0C\u5185\u7F6E OAuth \u6388\u6743\u5411\u5BFC\u3002",
  summary: "\u914D\u7F6E OAuth \u51ED\u8BC1\u5E76\u6388\u6743\u4F60\u7684 Google \u8D26\u53F7\u3002",
  sectionCredentials: "Google OAuth \u51ED\u8BC1",
  clientId: "Client ID",
  clientIdHint: "\u5728 Google Cloud Console \u521B\u5EFA\u7684\u201C\u684C\u9762\u5E94\u7528\u201D\u7C7B\u578B OAuth \u5BA2\u6237\u7AEF\u3002",
  clientSecret: "Client Secret",
  clientSecretHint: "\u53EA\u5199\u4E0D\u8BFB\uFF1A\u4FDD\u5B58\u540E\u6C38\u4E0D\u56DE\u663E\u3002\u7559\u7A7A\u8868\u793A\u4FDD\u7559\u5DF2\u5B58\u503C\u3002",
  secretConfigured: "\u5DF2\u914D\u7F6E",
  secretNotConfigured: "\u672A\u914D\u7F6E",
  mode: "\u6743\u9650\u6863\u4F4D mode",
  modeHint: "readonly | readwrite | full\u3002readwrite \u53EF\u6539\u672C\u63D2\u4EF6\u521B\u5EFA\u7684\u6587\u4EF6\u5E76\u53EF\u8BFB\u5199 Docs/Sheets \u5185\u5BB9\uFF1Bfull \u53EF\u6539\u5168\u90E8\u6587\u4EF6\u3002",
  port: "OAuth \u56DE\u8C03\u7AEF\u53E3",
  portHint: "OAuth \u56DE\u8C03\u7684\u672C\u673A\u56DE\u73AF\u7AEF\u53E3\uFF0C\u88AB\u5360\u7528\u65F6\u81EA\u52A8\u9012\u589E\u3002",
  bridgePort: "\u6865\u63A5\u7AEF\u53E3",
  bridgePortHint: "\u672C\u9875\u9762\u4E0E\u63D2\u4EF6\u901A\u4FE1\u7684\u672C\u673A\u7AEF\u53E3\uFF1B0 \u8868\u793A\u81EA\u52A8\u53D6\u56DE\u8C03\u7AEF\u53E3 + 10\u3002",
  maxChars: "\u8BFB\u53D6\u4E0A\u9650\uFF08\u5B57\u7B26\uFF09",
  maxCharsHint: "\u5355\u6B21\u8BFB\u53D6\u8FD4\u56DE\u7684\u6700\u5927\u5B57\u7B26\u6570\uFF0C\u8D85\u51FA\u4F1A\u6807\u6CE8\u622A\u65AD\u3002",
  pageSize: "\u5206\u9875\u5927\u5C0F",
  pageSizeHint: "\u5217\u76EE\u5F55\u4E0E\u641C\u7D22\u7684\u9ED8\u8BA4\u5206\u9875\u5927\u5C0F\u3002",
  guideTitle: "\u5982\u4F55\u521B\u5EFA OAuth \u5BA2\u6237\u7AEF\uFF08\u4E00\u6B21\u6027\uFF0C\u7EA6 3 \u5206\u949F\uFF09",
  guideStep1: "\u7528 Gmail \u6253\u5F00 console.cloud.google.com\uFF0C\u65B0\u5EFA\u4E00\u4E2A\u9879\u76EE\u3002",
  guideStep2: "\u542F\u7528\u4E09\u4E2A API\uFF1AGoogle Drive API\u3001Google Docs API\u3001Google Sheets API\u3002",
  guideStep3: "OAuth \u540C\u610F\u5C4F\u5E55\uFF1A\u9009 External\uFF0C\u628A\u6D4B\u8BD5\u7528\u6237\u52A0\u4E0A\u4F60\u81EA\u5DF1\u7684 Gmail\u3002",
  guideStep4: "\u51ED\u636E \u2192 \u521B\u5EFA OAuth \u5BA2\u6237\u7AEF ID \u2192 \u7C7B\u578B\u9009\u201C\u684C\u9762\u5E94\u7528\u201D\u2192 \u628A Client ID \u548C Secret \u586B\u5230\u4E0A\u9762\u3002",
  guideNote: "\u540C\u610F\u5C4F\u5E55\u5904\u4E8E\u6D4B\u8BD5\u6001\uFF0C\u6388\u6743\u65F6 Google \u4F1A\u663E\u793A\u201C\u6B64\u5E94\u7528\u672A\u7ECF\u9A8C\u8BC1\u201D\u7684\u8B66\u544A\u9875\u2014\u2014\u6B63\u5E38\u73B0\u8C61\uFF0C\u70B9\u201C\u7EE7\u7EED\u201D\u5373\u53EF\u3002",
  sectionAuth: "\u6388\u6743",
  statusChecking: "\u6B63\u5728\u67E5\u8BE2\u72B6\u6001\u2026",
  statusNoToken: "\u672A\u6388\u6743",
  statusPending: "\u6388\u6743\u8FDB\u884C\u4E2D\u2014\u2014\u8BF7\u5728\u6D4F\u89C8\u5668\u91CC\u5B8C\u6210\u767B\u5F55",
  statusAuthorized: "\u5DF2\u6388\u6743",
  statusMismatch: "\u5DF2\u6388\u6743\u4F46\u4E0E\u5F53\u524D mode \u7684\u6388\u6743\u8303\u56F4\u4E0D\u5339\u914D\u2014\u2014\u8BF7\u91CD\u65B0\u6388\u6743",
  bridgeDown: "\u8FDE\u4E0D\u4E0A\u63D2\u4EF6\u6865\u63A5\uFF1A\u63D2\u4EF6\u672A\u542F\u7528\uFF0C\u6216\u5F53\u524D\u7248\u672C\u5C1A\u65E0\u6865\u63A5\uFF08\u8BF7\u5148\u5347\u7EA7\u63D2\u4EF6\uFF09\u3002",
  startAuth: "\u5F00\u59CB\u6388\u6743",
  starting: "\u6B63\u5728\u53D1\u8D77\u2026",
  authStarted: "\u6D4F\u89C8\u5668\u5DF2\u6253\u5F00\u6388\u6743\u9875\u3002\u767B\u5F55\u5B8C\u6210\u540E\u56DE\u5230\u8FD9\u91CC\uFF0C\u9875\u9762\u4F1A\u81EA\u52A8\u5237\u65B0\u72B6\u6001\u3002",
  openManually: "\u5982\u679C\u6D4F\u89C8\u5668\u6CA1\u6709\u5F39\u51FA\uFF0C\u8BF7\u624B\u52A8\u6253\u5F00\uFF1A",
  unavailable: "\u8BE5\u63D2\u4EF6\u5F53\u524D\u672A\u52A0\u8F7D\uFF0C\u6682\u65F6\u65E0\u6CD5\u914D\u7F6E\u3002",
  readOnly: "\u672C\u90E8\u7F72\u7684\u8BBE\u7F6E\u4E3A\u53EA\u8BFB\u3002",
  saveFailed: "\u672C\u90E8\u7F72\u6CA1\u6709\u63A5\u53D7\u8FD9\u4E9B\u503C\uFF0C\u5DF2\u4FDD\u7559\u4F9B\u4F60\u4FEE\u6539\u3002",
  save: "\u4FDD\u5B58",
  saving: "\u4FDD\u5B58\u4E2D\u2026",
  invalidNumber: "\u8BF7\u586B\u6570\u5B57\uFF1B\u7559\u7A7A\u8868\u793A\u4F7F\u7528\u9ED8\u8BA4\u503C\u3002",
  invalidMode: "\u5FC5\u987B\u662F readonly\u3001readwrite\u3001full \u4E4B\u4E00\u3002",
  overridden: "\u5DF2\u8986\u76D6",
  reset: "\u6062\u590D\u9ED8\u8BA4"
};

// src/client/page.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime = require("react/jsx-runtime");
function settingsModeField(field) {
  return {
    field,
    format: (v) => String(v ?? ""),
    parse: (text) => {
      const v = text.trim();
      if (v === "") return { kind: "clear" };
      if (v === "readonly" || v === "readwrite" || v === "full") return { kind: "set", value: v };
      return void 0;
    }
  };
}
var GdriveFormController = class {
  constructor(scope) {
    this.scope = scope;
    const secrets = [
      {
        field: "clientSecret",
        write: (text) => scope.mutate([{ op: "set", path: ["clientSecret"], value: text }])
      }
    ];
    this.form = new import_dsh_client_ui_primitives.SettingsFormModel(
      scope,
      [
        (0, import_dsh_client_ui_primitives.settingsTextField)("clientId"),
        settingsModeField("mode"),
        (0, import_dsh_client_ui_primitives.settingsNumberField)("port"),
        (0, import_dsh_client_ui_primitives.settingsNumberField)("bridgePort"),
        (0, import_dsh_client_ui_primitives.settingsNumberField)("maxChars"),
        (0, import_dsh_client_ui_primitives.settingsNumberField)("pageSize")
      ],
      secrets
    );
    this.store = this.form.bind(() => this.projection());
  }
  form;
  store;
  projection() {
    const snap = this.scope.getSnapshot();
    const value = snap.value ?? {};
    const user = snap.user ?? {};
    const port = typeof value.port === "number" ? value.port : 55414;
    const bridge = typeof value.bridgePort === "number" && value.bridgePort > 0 ? value.bridgePort : port + 10;
    return {
      ...this.form.shell(),
      clientId: this.form.field("clientId"),
      clientSecret: this.form.field("clientSecret"),
      mode: this.form.field("mode"),
      port: this.form.field("port"),
      bridgePort: this.form.field("bridgePort"),
      maxChars: this.form.field("maxChars"),
      pageSize: this.form.field("pageSize"),
      secretConfigured: typeof user.clientSecret === "string" && user.clientSecret.length > 0,
      effectiveBridgePort: bridge
    };
  }
  inject() {
    return { hooks: { gdriveForm: this.store }, ...this.form.actions() };
  }
  dispose() {
    this.form.dispose();
  }
};
function AuthWizard(props) {
  const { t } = props;
  const [state, setState] = (0, import_react.useState)({ phase: "checking", starting: false });
  const base = `http://127.0.0.1:${props.bridgePort}`;
  (0, import_react.useEffect)(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`${base}/gdrive/status`);
        const data = await res.json();
        if (!alive) return;
        setState((s) => ({
          ...s,
          phase: "ready",
          status: typeof data.status === "string" ? data.status : "no_token",
          authorized: data.authorized === true,
          scopeMismatch: data.scopeMismatch === true,
          hint: typeof data.hint === "string" ? data.hint : void 0
        }));
      } catch {
        if (alive) setState((s) => ({ ...s, phase: "down" }));
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 3e3);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [base]);
  const startAuth = async () => {
    setState((s) => ({ ...s, starting: true, error: void 0 }));
    try {
      const res = await fetch(`${base}/gdrive/start-auth`, { method: "POST" });
      const data = await res.json();
      setState((s) => ({ ...s, starting: false, startedUrl: data.authUrl, error: data.error }));
    } catch {
      setState((s) => ({ ...s, starting: false, error: t("bridgeDown") }));
    }
  };
  let badge;
  if (state.phase === "checking") badge = { tone: "neutral", text: t("statusChecking") };
  else if (state.phase === "down") badge = { tone: "danger", text: t("bridgeDown") };
  else if (state.scopeMismatch) badge = { tone: "warning", text: t("statusMismatch") };
  else if (state.authorized) badge = { tone: "success", text: t("statusAuthorized") };
  else if (state.status === "pending") badge = { tone: "warning", text: t("statusPending") };
  else badge = { tone: "neutral", text: t("statusNoToken") };
  const showAuthButton = state.phase === "ready" && (state.scopeMismatch === true || !state.authorized);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: t("sectionAuth") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tag, { tone: badge.tone, children: badge.text }) }),
    showAuthButton ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: state.starting, onClick: () => void startAuth(), children: state.starting ? t("starting") : t("startAuth") }) }) : null,
    state.startedUrl && !state.authorized ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
      t("authStarted"),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
      t("openManually"),
      " ",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: state.startedUrl })
    ] }) : null,
    state.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: state.error }) : null
  ] });
}
function GcpGuide(props) {
  const { t } = props;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: t("guideTitle") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: t("guideStep1") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: t("guideStep2") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: t("guideStep3") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: t("guideStep4") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("guideNote") })
  ] });
}
function GdrivePage(props) {
  const { t } = props;
  const state = props.useGdriveForm((s) => s);
  if (props.view === "summary") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: t("description") });
  const disabled = !state.writable;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      import_dsh_client_ui_primitives.SettingsForm,
      {
        labels: {
          unavailable: t("unavailable"),
          readOnly: t("readOnly"),
          saveFailed: t("saveFailed"),
          save: t("save"),
          saving: t("saving")
        },
        state,
        onSave: props.save,
        onDiscard: props.discard,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.SettingsValueField,
            {
              id: "gdrive-client-id",
              label: t("clientId"),
              hint: t("clientIdHint"),
              overriddenLabel: t("overridden"),
              resetLabel: t("reset"),
              invalidLabel: t("invalidNumber"),
              disabled,
              ...state.clientId,
              onEdit: (text) => props.edit("clientId", text),
              onReset: () => props.resetField("clientId")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.SettingsSecretField,
            {
              id: "gdrive-client-secret",
              label: t("clientSecret"),
              hint: t("clientSecretHint"),
              disabled,
              text: state.clientSecret.text,
              configured: state.secretConfigured,
              stateLabel: state.secretConfigured ? t("secretConfigured") : t("secretNotConfigured"),
              onEdit: (text) => props.edit("clientSecret", text)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.SettingsValueField,
            {
              id: "gdrive-mode",
              label: t("mode"),
              hint: t("modeHint"),
              overriddenLabel: t("overridden"),
              resetLabel: t("reset"),
              invalidLabel: t("invalidMode"),
              placeholder: "readonly",
              disabled,
              ...state.mode,
              onEdit: (text) => props.edit("mode", text),
              onReset: () => props.resetField("mode")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.SettingsValueField,
            {
              id: "gdrive-port",
              label: t("port"),
              hint: t("portHint"),
              overriddenLabel: t("overridden"),
              resetLabel: t("reset"),
              invalidLabel: t("invalidNumber"),
              numeric: true,
              disabled,
              ...state.port,
              onEdit: (text) => props.edit("port", text),
              onReset: () => props.resetField("port")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.SettingsValueField,
            {
              id: "gdrive-max-chars",
              label: t("maxChars"),
              hint: t("maxCharsHint"),
              overriddenLabel: t("overridden"),
              resetLabel: t("reset"),
              invalidLabel: t("invalidNumber"),
              numeric: true,
              disabled,
              ...state.maxChars,
              onEdit: (text) => props.edit("maxChars", text),
              onReset: () => props.resetField("maxChars")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.SettingsValueField,
            {
              id: "gdrive-page-size",
              label: t("pageSize"),
              hint: t("pageSizeHint"),
              overriddenLabel: t("overridden"),
              resetLabel: t("reset"),
              invalidLabel: t("invalidNumber"),
              numeric: true,
              disabled,
              ...state.pageSize,
              onEdit: (text) => props.edit("pageSize", text),
              onReset: () => props.resetField("pageSize")
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GcpGuide, { t }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthWizard, { t, bridgePort: state.effectiveBridgePort })
  ] });
}

// src/client/index.tsx
var inject = ["slots", "locale", "configForms"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "gdrive: dictionaries");
  const controller = new GdriveFormController(ctx.configForms.get("gdrive"));
  ctx.effect(() => () => controller.dispose(), "gdrive: form subscription");
  ctx.effect(
    () => ctx.slots.inject(
      "plugins.row.config",
      () => ctx.slots.register(
        {
          name: "plugins.row.config",
          key: "dsh-tool-gdrive#gdrive",
          locale: NS,
          inject: () => controller.inject()
        },
        GdrivePage
      )
    ),
    "gdrive: config page"
  );
}
		return module.exports;
	}
});
