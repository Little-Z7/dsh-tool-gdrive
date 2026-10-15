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
  reset: "Reset to default",
  marketUrl: "Plugin market URL (for updates)",
  marketUrlHint: "Where update checks read the DSH plugin market index. Leave blank for Aura TV (https://tv.auraaigc.ccwu.cc:56814). Change it only for testing.",
  invalidUrl: "Enter an https:// origin without a path (http:// is accepted only for a local address such as http://127.0.0.1:8765), or leave blank for the default.",
  updateCheck: "Check for updates",
  updateChecking: "Checking for updates\u2026",
  updateLatest: "Up to date ({version})",
  updateInstall: "Update to {version}",
  updateInstalling: "Installing {version}\u2026",
  updateDoneRestart: "{version} is installed. Restart DSH to use it.",
  updateDone: "Updated to {version}",
  updateCheckFailed: "Update check failed: {reason}",
  updateFailed: "Update failed; the current version is unchanged: {reason}",
  updateRetry: "Retry",
  updateReasonBadSite: `The market URL "{value}" is invalid. Fix it on this plugin's settings page (https only; http is accepted for a local address), or clear it to use the default.`,
  updateReasonNetwork: "Cannot reach {origin} ({message}). A dropped network, a wrong address, or a market that does not allow cross-origin reads all look like this.",
  updateReasonTimeout: "{origin} did not respond within {seconds} s",
  updateReasonHttp: "The market returned HTTP {status}",
  updateReasonNotJson: "The market did not return a JSON index",
  updateReasonSchema: "Unsupported index format {schema}; update the plugin with the market install command first",
  updateReasonMissing: "dsh-tool-gdrive is not in the market index",
  updateReasonBadEntry: "The dsh-tool-gdrive entry is malformed: {detail}",
  updateReasonBadFile: 'Rejected "{file}": not the versioned package of dsh-tool-gdrive {version}',
  updateReasonCancelled: "Installation was cancelled",
  updateReasonInstall: "{text}",
  updateReasonConfigLoading: "The settings of this plugin cannot be read yet. Click Retry in a moment.",
  updateReasonUnexpected: "Unexpected error: {message}",
  updateSaveFailedNote: "The last save of the market URL did not go through; this result uses the previously saved address."
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
  reset: "\u6062\u590D\u9ED8\u8BA4",
  marketUrl: "\u63D2\u4EF6\u5E02\u573A\u5730\u5740\uFF08\u68C0\u67E5\u66F4\u65B0\u7528\uFF09",
  marketUrlHint: "\u68C0\u67E5\u66F4\u65B0\u65F6\u4ECE\u8FD9\u91CC\u8BFB DSH \u63D2\u4EF6\u5E02\u573A\u6E05\u5355\u3002\u7559\u7A7A\u7528\u7075\u73AF TV\uFF08https://tv.auraaigc.ccwu.cc:56814\uFF09\uFF1B\u53EA\u5728\u6D4B\u8BD5\u65F6\u624D\u9700\u8981\u6539\u3002",
  invalidUrl: "\u8BF7\u586B https:// \u5F00\u5934\u3001\u4E0D\u5E26\u8DEF\u5F84\u7684\u5730\u5740\uFF08\u53EA\u6709\u672C\u673A\u5730\u5740\u5982 http://127.0.0.1:8765 \u53EF\u4EE5\u7528 http\uFF09\uFF1B\u7559\u7A7A\u7528\u7F3A\u7701\u5730\u5740\u3002",
  updateCheck: "\u68C0\u67E5\u66F4\u65B0",
  updateChecking: "\u6B63\u5728\u68C0\u67E5\u66F4\u65B0\u2026",
  updateLatest: "\u5DF2\u662F\u6700\u65B0 {version}",
  updateInstall: "\u66F4\u65B0\u5230 {version}",
  updateInstalling: "\u6B63\u5728\u5B89\u88C5 {version}\u2026",
  updateDoneRestart: "\u5DF2\u88C5\u597D {version}\uFF0C\u91CD\u542F DSH \u540E\u751F\u6548",
  updateDone: "\u5DF2\u66F4\u65B0\u5230 {version}",
  updateCheckFailed: "\u68C0\u67E5\u5931\u8D25\uFF1A{reason}",
  updateFailed: "\u66F4\u65B0\u5931\u8D25\uFF0C\u5F53\u524D\u7248\u672C\u4E0D\u53D8\uFF1A{reason}",
  updateRetry: "\u91CD\u8BD5",
  updateReasonBadSite: "\u5E02\u573A\u5730\u5740\u300C{value}\u300D\u4E0D\u5BF9\uFF0C\u8BF7\u5728\u672C\u63D2\u4EF6\u914D\u7F6E\u9875\u6539\u6210 https:// \u5F00\u5934\u3001\u4E0D\u5E26\u8DEF\u5F84\u7684\u5730\u5740\uFF08\u672C\u673A\u5730\u5740\u53EF\u4EE5\u7528 http\uFF09\uFF0C\u6216\u6E05\u7A7A\u7528\u7F3A\u7701\u5730\u5740",
  updateReasonNetwork: "\u8FDE\u4E0D\u4E0A {origin}\uFF08{message}\uFF09\u3002\u7F51\u7EDC\u65AD\u5F00\u3001\u5730\u5740\u5199\u9519\u3001\u5E02\u573A\u6CA1\u653E\u5F00\u8DE8\u6E90\u8BBF\u95EE\u90FD\u4F1A\u8FD9\u6837",
  updateReasonTimeout: "{origin} \u5728 {seconds} \u79D2\u5185\u6CA1\u6709\u54CD\u5E94",
  updateReasonHttp: "\u5E02\u573A\u8FD4\u56DE HTTP {status}",
  updateReasonNotJson: "\u5E02\u573A\u8FD4\u56DE\u7684\u4E0D\u662F JSON \u6E05\u5355",
  updateReasonSchema: "\u5E02\u573A\u6E05\u5355\u7684\u683C\u5F0F\u7248\u672C {schema} \u672C\u63D2\u4EF6\u4E0D\u8BA4\u8BC6\uFF0C\u8BF7\u5148\u7528\u5E02\u573A\u9875\u7684\u5B89\u88C5\u547D\u4EE4\u66F4\u65B0\u63D2\u4EF6",
  updateReasonMissing: "\u5E02\u573A\u6E05\u5355\u91CC\u6CA1\u6709 dsh-tool-gdrive",
  updateReasonBadEntry: "\u5E02\u573A\u6E05\u5355\u91CC dsh-tool-gdrive \u7684\u6761\u76EE\u4E0D\u5B8C\u6574\uFF1A{detail}",
  updateReasonBadFile: "\u5E02\u573A\u7ED9\u7684\u5B89\u88C5\u5305\u300C{file}\u300D\u4E0D\u662F dsh-tool-gdrive {version} \u7684\u7248\u672C\u5316\u6587\u4EF6\uFF0C\u5DF2\u62D2\u7EDD",
  updateReasonCancelled: "\u5B89\u88C5\u88AB\u53D6\u6D88",
  updateReasonInstall: "{text}",
  updateReasonConfigLoading: "\u8FD8\u8BFB\u4E0D\u5230\u672C\u63D2\u4EF6\u7684\u914D\u7F6E\uFF0C\u7A0D\u540E\u70B9\u91CD\u8BD5",
  updateReasonUnexpected: "\u51FA\u73B0\u610F\u5916\u9519\u8BEF\uFF1A{message}",
  updateSaveFailedNote: "\u4E0A\u6B21\u4FDD\u5B58\u5E02\u573A\u5730\u5740\u6CA1\u6709\u6210\u529F\uFF0C\u4EE5\u4E0B\u662F\u6309\u5DF2\u4FDD\u5B58\u7684\u65E7\u5730\u5740\u68C0\u67E5\u7684\u7ED3\u679C"
};

// src/client/page.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/update.ts
var PLUGIN_NAME = "dsh-tool-gdrive";
var DEFAULT_MARKET_URL = "https://tv.auraaigc.ccwu.cc:56814";
var INDEX_PATH = "/dsh-market/index.json";
var ARCHIVE_PATH = "/dsh-market/";
var CHECK_TIMEOUT_MS = 15e3;
var RESTART_KEY = "dsh-tool-gdrive.restart-pending";
var INFLIGHT_KEY = "dsh-tool-gdrive.install-inflight";
var WINDOW_STORE_NAME = "dsh-tool-gdrive.window-store";
var WINDOW_INSTALLS_NAME = "dsh-tool-gdrive.window-installs";
var REASON_MAX = 400;
function clampReason(text) {
  const one = text.replace(/\s*\n\s*/g, " ").trim();
  return one.length > REASON_MAX ? `${one.slice(0, REASON_MAX - 1)}\u2026` : one;
}
function describeValue(v) {
  if (typeof v === "number" || typeof v === "string") return clampReason(String(v)).slice(0, 40);
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}
var LOOPBACK_HOSTS = /* @__PURE__ */ new Set(["127.0.0.1", "localhost", "[::1]"]);
var SITE_CHARS = /^https?:\/\/[A-Za-z0-9.:[\]-]+$/;
function marketSite(raw) {
  if (typeof raw !== "string" || raw.trim() === "") return { ok: true, origin: DEFAULT_MARKET_URL };
  const text = raw.trim();
  const bad = { ok: false, value: text };
  const bare = text.endsWith("/") ? text.slice(0, -1) : text;
  if (!SITE_CHARS.test(bare)) return bad;
  let url;
  try {
    url = new URL(bare);
  } catch {
    return bad;
  }
  if (url.username !== "" || url.password !== "") return bad;
  if (url.protocol === "http:" && !LOOPBACK_HOSTS.has(url.hostname)) return bad;
  if (url.protocol !== "http:" && url.protocol !== "https:") return bad;
  if (bare !== url.origin) return bad;
  return { ok: true, origin: url.origin };
}
var SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
function compareVersions(a, b) {
  const parse = (v) => {
    const [core = "", pre] = (v.split("+")[0] ?? "").split(/-(.+)/);
    return { n: core.split(".").map(Number), pre: pre ?? null };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) {
    const xi = x.n[i] ?? 0;
    const yi = y.n[i] ?? 0;
    if (xi !== yi) return xi < yi ? -1 : 1;
  }
  if (x.pre === y.pre) return 0;
  if (x.pre === null) return 1;
  if (y.pre === null) return -1;
  const xs = x.pre.split(".");
  const ys = y.pre.split(".");
  for (let i = 0; i < Math.max(xs.length, ys.length); i++) {
    const xp = xs[i];
    const yp = ys[i];
    if (xp === void 0) return -1;
    if (yp === void 0) return 1;
    const xn = /^\d+$/.test(xp);
    const yn = /^\d+$/.test(yp);
    if (xn && yn) {
      if (Number(xp) !== Number(yp)) return Number(xp) < Number(yp) ? -1 : 1;
    } else if (xn !== yn) return xn ? -1 : 1;
    else if (xp !== yp) return xp < yp ? -1 : 1;
  }
  return 0;
}
var isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function parseMarketIndex(raw) {
  const entryBad = (detail) => ({ ok: false, failure: { code: "bad-entry", detail } });
  if (!isRecord(raw)) return { ok: false, failure: { code: "not-json" } };
  if (raw.schemaVersion !== 1) return { ok: false, failure: { code: "schema", schema: describeValue(raw.schemaVersion) } };
  if (!Array.isArray(raw.plugins)) return entryBad("plugins");
  const mine = raw.plugins.filter((p) => isRecord(p) && p.name === PLUGIN_NAME);
  if (mine.length === 0) return { ok: false, failure: { code: "missing" } };
  if (mine.length > 1) return entryBad("name");
  const plugin = mine[0];
  const latest = plugin.latest;
  if (typeof latest !== "string" || !SEMVER_RE.test(latest)) return entryBad("latest");
  const versions = Array.isArray(plugin.versions) ? plugin.versions : [];
  const row = versions.find((v) => isRecord(v) && v.version === latest);
  if (!isRecord(row)) return entryBad("versions");
  const sha = row.tarSha256;
  if (typeof sha !== "string" || !/^[0-9a-f]{64}$/.test(sha)) return entryBad("tarSha256");
  const file = row.file;
  if (typeof file !== "string") return entryBad("file");
  if (file !== `${PLUGIN_NAME}-${latest}-${sha.slice(0, 12)}.tgz`) {
    return { ok: false, failure: { code: "bad-file", file, version: latest } };
  }
  return { ok: true, entry: { version: latest, file } };
}
var errorMessage = (e) => {
  try {
    return clampReason(e instanceof Error ? e.message : String(e));
  } catch {
    return "unknown error";
  }
};
async function checkUpdate(fetchImpl, rawSite, installed, options = {}) {
  try {
    return await runCheck(fetchImpl, rawSite, installed, options);
  } catch (e) {
    return { kind: "failed", failure: { code: "unexpected", message: errorMessage(e) } };
  }
}
async function runCheck(fetchImpl, rawSite, installed, options) {
  const site = marketSite(rawSite);
  if (!site.ok) return { kind: "failed", failure: { code: "bad-site", value: site.value } };
  const origin = site.origin;
  if (options.signal?.aborted) return { kind: "failed", failure: { code: "cancelled" } };
  const timeoutMs = options.timeoutMs ?? CHECK_TIMEOUT_MS;
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });
  let timer;
  let timedOut = false;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      ctl.abort();
      reject(new Error("timeout"));
    }, timeoutMs);
  });
  timeout.catch(() => {
  });
  const fail = (e, parsing) => {
    if (timedOut) return { kind: "failed", failure: { code: "timeout", origin, seconds: Math.round(timeoutMs / 1e3) } };
    if (parsing && e instanceof SyntaxError) return { kind: "failed", failure: { code: "not-json" } };
    return { kind: "failed", failure: { code: "network", origin, message: errorMessage(e) } };
  };
  try {
    let response;
    try {
      response = await Promise.race([
        fetchImpl(origin + INDEX_PATH, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", signal: ctl.signal }),
        timeout
      ]);
    } catch (e) {
      return fail(e, false);
    }
    if (!response.ok) return { kind: "failed", failure: { code: "http", status: response.status } };
    let body;
    try {
      body = await Promise.race([response.json(), timeout]);
    } catch (e) {
      return fail(e, true);
    }
    const parsed = parseMarketIndex(body);
    if (!parsed.ok) return { kind: "failed", failure: parsed.failure };
    const { version, file } = parsed.entry;
    if (installed !== void 0 && compareVersions(version, installed) <= 0) {
      return { kind: "latest", version: installed };
    }
    return { kind: "available", version, url: origin + ARCHIVE_PATH + file, origin };
  } finally {
    if (timer !== void 0) clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
var CONFIG_WAIT_MS = 1e4;
function waitForMarketUrl(scope, options = {}) {
  const { signal, save } = options;
  const read = () => {
    const snap = scope.getSnapshot();
    if (snap.status === "loading") return void 0;
    const state = save?.getSnapshot();
    if (state?.saving) return void 0;
    return { ok: true, raw: snap.status === "ready" ? snap.value?.marketUrl : void 0, saveFailed: state?.failed === true };
  };
  if (signal?.aborted) return Promise.resolve({ ok: false });
  const now = read();
  if (now) return Promise.resolve(now);
  return new Promise((resolve) => {
    let done = false;
    const offs = [];
    let timer;
    const finish = (result) => {
      if (done) return;
      done = true;
      if (timer !== void 0) clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      for (const off of offs.splice(0)) off();
      resolve(result);
    };
    const onAbort = () => finish({ ok: false });
    const onChange = () => {
      const r = read();
      if (r) finish(r);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => finish({ ok: false }), options.timeoutMs ?? CONFIG_WAIT_MS);
    for (const source of [scope, save]) {
      if (!source) continue;
      const off = source.subscribe(onChange);
      if (done) off();
      else offs.push(off);
    }
    onChange();
  });
}
function siteKey(raw) {
  const site = marketSite(raw);
  return site.ok ? `ok:${site.origin}` : `bad:${site.value}`;
}
function sameSite(raw, origin) {
  const site = marketSite(raw);
  return site.ok && site.origin === origin;
}
function watchMarketUrl(scope, onChange) {
  const current = () => {
    const snap = scope.getSnapshot();
    return snap.status === "loading" ? void 0 : siteKey(snap.status === "ready" ? snap.value?.marketUrl : void 0);
  };
  let last = current();
  return scope.subscribe(() => {
    const now = current();
    if (now === void 0) return;
    const changed = last !== void 0 && last !== now;
    last = now;
    if (changed) onChange();
  });
}
function updateSpec(url) {
  return `dsh-tool-gdrive@${url}`;
}
function newRequestId(now = Date.now()) {
  return `gdrive-update-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
async function installUpdate(manager, url, enabled, requestId = newRequestId()) {
  let answer;
  try {
    answer = await manager.installBundle(updateSpec(url), { enabled, requestId });
  } catch (e) {
    answer = { ok: false, error: { code: "rejected", message: errorMessage(e) } };
  }
  if (!answer.ok) {
    let recovered;
    try {
      recovered = await manager.waitForInstall(requestId);
    } catch {
      recovered = void 0;
    }
    if (recovered?.ok && recovered.value) answer = { ok: true, value: recovered.value };
    else return { kind: "failed", failure: { code: "install", text: clampReason(answer.error.message || answer.error.code) } };
  }
  const result = answer.value;
  if (result.application === "restart-required") return { kind: "restart" };
  if (result.application === "applied") return { kind: "applied" };
  if (result.application === "cancelled") return { kind: "failed", failure: { code: "cancelled" } };
  return { kind: "failed", failure: { code: "install", text: failureText(result) } };
}
function errorBlock(text) {
  if (!text) return void 0;
  const lines = text.split("\n");
  const start = lines.findIndex((line) => /^\s*Error:/.test(line));
  if (start < 0) return void 0;
  let out = "";
  for (const line of lines.slice(start)) {
    const t = line.trim();
    if (t === "") continue;
    out += out === "" || out.endsWith("-") ? t : ` ${t}`;
  }
  return out;
}
function failureText(result) {
  const output = result.packageResult?.output?.trim();
  const lines = output?.split("\n").filter((line) => line.includes("ERR_PNPM_")) ?? [];
  const pnpmLine = lines.find((line) => !line.trimStart().startsWith("[WARN]")) ?? lines[0];
  const diagnostic = result.error?.diagnostic;
  const chosen = pnpmLine?.trim() || errorBlock(output) || errorBlock(diagnostic) || diagnostic || result.error?.code || result.application;
  return clampReason(chosen);
}
function reasonMessage(failure) {
  switch (failure.code) {
    case "bad-site":
      return { key: "updateReasonBadSite", params: { value: failure.value } };
    case "network":
      return { key: "updateReasonNetwork", params: { origin: failure.origin, message: failure.message } };
    case "timeout":
      return { key: "updateReasonTimeout", params: { origin: failure.origin, seconds: failure.seconds } };
    case "http":
      return { key: "updateReasonHttp", params: { status: failure.status } };
    case "not-json":
      return { key: "updateReasonNotJson", params: {} };
    case "schema":
      return { key: "updateReasonSchema", params: { schema: failure.schema } };
    case "missing":
      return { key: "updateReasonMissing", params: {} };
    case "bad-entry":
      return { key: "updateReasonBadEntry", params: { detail: failure.detail } };
    case "bad-file":
      return { key: "updateReasonBadFile", params: { file: failure.file, version: failure.version } };
    case "cancelled":
      return { key: "updateReasonCancelled", params: {} };
    case "install":
      return { key: "updateReasonInstall", params: { text: failure.text } };
    case "config-loading":
      return { key: "updateReasonConfigLoading", params: {} };
    case "unexpected":
      return { key: "updateReasonUnexpected", params: { message: failure.message } };
  }
}
function markRestartPending(store, version) {
  try {
    store?.setItem(RESTART_KEY, version);
  } catch {
  }
}
function clearRestartPending(store) {
  try {
    store?.removeItem(RESTART_KEY);
  } catch {
  }
}
function restartPending(store, installed) {
  if (installed === void 0) return false;
  try {
    return store?.getItem(RESTART_KEY) === installed || store?.getItem(INFLIGHT_KEY) === installed;
  } catch {
    return false;
  }
}
function runInstall(registry, store, manager, url, version, enabled) {
  if (registry.current) return registry.current.promise;
  const requestId = newRequestId();
  try {
    store?.setItem(INFLIGHT_KEY, version);
  } catch {
  }
  const promise = (async () => {
    let outcome = { kind: "failed", failure: { code: "unexpected", message: "install did not finish" } };
    try {
      outcome = await installUpdate(manager, url, enabled, requestId);
    } catch (e) {
      outcome = { kind: "failed", failure: { code: "unexpected", message: errorMessage(e) } };
    } finally {
      registry.current = void 0;
      try {
        store?.removeItem(INFLIGHT_KEY);
      } catch {
      }
      if (outcome.kind === "restart") markRestartPending(store, version);
      else if (outcome.kind === "applied") clearRestartPending(store);
    }
    return outcome;
  })();
  registry.current = { requestId, version, promise };
  return promise;
}

// src/client/page.tsx
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
function settingsMarketUrlField(field) {
  return {
    field,
    format: (v) => String(v ?? ""),
    parse: (text) => {
      if (text.trim() === "") return { kind: "clear" };
      const site = marketSite(text);
      return site.ok ? { kind: "set", value: site.origin } : void 0;
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
        (0, import_dsh_client_ui_primitives.settingsNumberField)("pageSize"),
        settingsMarketUrlField("marketUrl")
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
      marketUrl: this.form.field("marketUrl"),
      secretConfigured: typeof user.clientSecret === "string" && user.clientSecret.length > 0,
      clientIdConfigured: typeof user.clientId === "string" && user.clientId.length > 0,
      effectiveBridgePort: bridge
    };
  }
  /** 进行中的保存数（包在 save 动作外面记的：宿主表单模型没把 saving 暴露成可订阅的值时也有据可依）。 */
  explicitSaves = 0;
  saveListeners = /* @__PURE__ */ new Set();
  notifySave() {
    for (const listener of [...this.saveListeners]) listener();
  }
  /**
   * 保存状态，给「检查更新」用：表单模型的 `saving` / `failed`（经它发布的快照读，随快照变化订阅），
   * 加上 save 动作外包一层记下的「保存进行中」。保存没落定之前，宿主「最后接受」的值还是旧的。
   */
  saveWatch = {
    getSnapshot: () => {
      const shell = this.store.getSnapshot();
      return { saving: this.explicitSaves > 0 || shell.saving === true, failed: shell.failed === true };
    },
    subscribe: (listener) => {
      this.saveListeners.add(listener);
      const off = this.store.subscribe(listener);
      return () => {
        this.saveListeners.delete(listener);
        off();
      };
    }
  };
  inject() {
    const actions = this.form.actions();
    return {
      hooks: { gdriveForm: this.store },
      ...actions,
      save: () => {
        const result = actions.save();
        if (result && typeof result.then === "function") {
          this.explicitSaves++;
          this.notifySave();
          const done = () => {
            this.explicitSaves--;
            this.notifySave();
          };
          result.then(done, done);
        }
        return result;
      }
    };
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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { open: props.defaultOpen || void 0, children: [
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
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.SettingsValueField,
            {
              id: "gdrive-market-url",
              label: t("marketUrl"),
              hint: t("marketUrlHint"),
              overriddenLabel: t("overridden"),
              resetLabel: t("reset"),
              invalidLabel: t("invalidUrl"),
              placeholder: DEFAULT_MARKET_URL,
              disabled,
              ...state.marketUrl,
              onEdit: (text) => props.edit("marketUrl", text),
              onReset: () => props.resetField("marketUrl")
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GcpGuide, { t, defaultOpen: !(state.clientIdConfigured && state.secretConfigured) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthWizard, { t, bridgePort: state.effectiveBridgePort })
  ] });
}

// src/client/UpdateAction.tsx
var import_react2 = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime2 = require("react/jsx-runtime");
var WRAP = { display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" };
var STATUS_BASE = { maxWidth: "min(360px, max(96px, calc(100vw - 390px)))", fontSize: 12, lineHeight: "18px", overflowWrap: "anywhere" };
var ERROR_TOKEN = "var(--dsw-alias-state-error-primary, #b3261e)";
var ERROR_MIXED = `color-mix(in srgb, ${ERROR_TOKEN} 80%, var(--dsw-alias-label-primary, #1c1c1e))`;
var SECONDARY = "var(--dsw-alias-label-secondary, #5f6368)";
function supportsColorMix() {
  try {
    return typeof CSS !== "undefined" && CSS.supports("color", "color-mix(in srgb, red 50%, blue)");
  } catch {
    return false;
  }
}
function statusStyle(tone) {
  const color = tone === "error" ? supportsColorMix() ? ERROR_MIXED : ERROR_TOKEN : SECONDARY;
  return { ...STATUS_BASE, color };
}
function unexpected(e) {
  let message = "unknown error";
  try {
    message = clampReason(e instanceof Error ? e.message : String(e));
  } catch {
  }
  return { code: "unexpected", message };
}
function reasonText(t, failure) {
  const { key, params } = reasonMessage(failure);
  return t(key, params);
}
function UpdateAction({ subject, t, checkUpdate: checkUpdate2, installUpdate: installUpdate2, inflight, watchSite, restartPending: isRestartPending }) {
  const own = subject.kind === "bundle" && subject.pkg.name === PLUGIN_NAME && subject.pkg.installed;
  const installed = subject.kind === "bundle" ? subject.pkg.version : void 0;
  const enabled = subject.kind === "bundle" ? subject.pkg.enabled !== false : true;
  const [phase, setPhase] = (0, import_react2.useState)({ kind: "checking" });
  const live = (0, import_react2.useRef)(true);
  const running = (0, import_react2.useRef)(null);
  const installing = (0, import_react2.useRef)(false);
  (0, import_react2.useEffect)(() => {
    live.current = true;
    return () => {
      live.current = false;
      running.current?.abort();
    };
  }, []);
  const check = () => {
    running.current?.abort();
    const ctl = new AbortController();
    running.current = ctl;
    setPhase({ kind: "checking" });
    void checkUpdate2(installed, ctl.signal).catch((e) => ({ kind: "failed", failure: unexpected(e) })).then((result) => {
      if (live.current && running.current === ctl) setPhase({ kind: "checked", check: result });
    });
  };
  const settle = (version, outcome) => {
    installing.current = false;
    if (!live.current) return;
    if (outcome.kind === "stale") check();
    else setPhase({ kind: "installed", version, outcome });
  };
  const follow = (version, promise) => {
    installing.current = true;
    setPhase({ kind: "installing", version });
    void promise.catch((e) => ({ kind: "failed", failure: unexpected(e) })).then((outcome) => settle(version, outcome));
  };
  (0, import_react2.useEffect)(() => {
    if (!own) return;
    const ongoing = inflight?.();
    if (ongoing) follow(ongoing.version, ongoing.promise);
    else check();
  }, [own, installed]);
  (0, import_react2.useEffect)(() => {
    if (!own || !watchSite) return;
    return watchSite(() => {
      if (!installing.current) check();
    });
  }, [own, installed]);
  if (!own) return null;
  const restartPending2 = isRestartPending(installed);
  const install = (url, version, origin) => {
    follow(version, installUpdate2(url, version, enabled, origin));
  };
  let button;
  let status = null;
  switch (phase.kind) {
    case "checking":
      button = { label: t("updateChecking"), busy: true };
      break;
    case "installing":
      button = { label: t("updateInstalling", { version: phase.version }), busy: true };
      break;
    case "installed":
      if (phase.outcome.kind === "failed") {
        button = { label: t("updateRetry"), onClick: check };
        status = { text: t("updateFailed", { reason: reasonText(t, phase.outcome.failure) }), tone: "error" };
      } else {
        button = { label: t("updateCheck"), onClick: check };
        status = { text: t(phase.outcome.kind === "restart" ? "updateDoneRestart" : "updateDone", { version: phase.version }), tone: "ok" };
      }
      break;
    case "checked": {
      const result = phase.check;
      if (result.kind === "available") {
        button = { label: t("updateInstall", { version: result.version }), onClick: () => install(result.url, result.version, result.origin), primary: true };
      } else if (result.kind === "failed") {
        button = { label: t("updateRetry"), onClick: check };
        status = { text: t("updateCheckFailed", { reason: reasonText(t, result.failure) }), tone: "error" };
      } else {
        button = { label: t("updateCheck"), onClick: check };
        status = restartPending2 ? { text: t("updateDoneRestart", { version: installed }), tone: "ok" } : { text: t("updateLatest", { version: result.version }), tone: "muted" };
      }
      break;
    }
  }
  const note = phase.kind === "checked" && phase.check.saveFailed ? t("updateSaveFailedNote") : null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: WRAP, children: [
    note !== null ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: statusStyle("muted"), role: "status", children: note }) : null,
    status !== null ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: statusStyle(status.tone), role: status.tone === "error" ? "alert" : "status", children: status.text }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: button.primary ? "primary" : "outline", size: "sm", disabled: button.busy === true, onClick: button.onClick, children: button.busy ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.TextShimmer, { active: true, children: button.label }) : button.label })
  ] });
}

// src/client/index.tsx
var WINDOW_STORE = Symbol.for(WINDOW_STORE_NAME);
var WINDOW_INSTALLS = Symbol.for(WINDOW_INSTALLS_NAME);
function pageStore() {
  const holder = globalThis;
  const map = holder[WINDOW_STORE] ??= /* @__PURE__ */ new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    }
  };
}
function installRegistry() {
  const holder = globalThis;
  return holder[WINDOW_INSTALLS] ??= {};
}
var inject = ["slots", "locale", "configForms", "remote"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "gdrive: dictionaries");
  const form = ctx.configForms.get("gdrive");
  const controller = new GdriveFormController(form);
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
  ctx.inject(["remote.pluginManager"], (scope) => {
    const manager = scope.remote.pluginManager;
    const registry = installRegistry();
    scope.slots.inject(
      "plugins.detail.actions",
      () => scope.slots.register(
        {
          name: "plugins.detail.actions",
          id: "gdrive-update",
          order: 10,
          locale: NS,
          inject: () => ({
            /*
             * 调用时才现读配置：用户在配置页改了市场地址，下一次检查就生效。
             * 先等配置就绪、且本插件的配置表单没有正在进行的保存（宿主「最后接受」的值要等保存落定才变），
             * 不拿缺省市场或旧地址顶替；保存失败则按旧的已接受值检查，结果带 saveFailed。
             */
            checkUpdate: async (installed, signal) => {
              const site = await waitForMarketUrl(form, { signal, save: controller.saveWatch });
              if (!site.ok) return { kind: "failed", failure: { code: "config-loading" } };
              const result = await checkUpdate((url, init) => globalThis.fetch(url, init), site.raw, installed, { signal });
              return site.saveFailed ? { ...result, saveFailed: true } : result;
            },
            /* 已接受的市场地址变了就通知，组件据此作废当前结果并重新检查。 */
            watchSite: (listener) => watchMarketUrl(form, listener),
            /*
             * 已有安装在进行：不再发起新安装，等同一个结果。否则先确认当前已接受的站点还是结果读的那个，
             * 不是就不装（stale），由组件重新检查；然后走 runInstall（状态机见 update.ts）。
             */
            installUpdate: async (url, version, enabled, origin) => {
              if (registry.current) return registry.current.promise;
              const site = await waitForMarketUrl(form, { save: controller.saveWatch, timeoutMs: 3e3 });
              if (!site.ok || !sameSite(site.raw, origin)) return { kind: "stale" };
              return runInstall(registry, pageStore(), manager, url, version, enabled);
            },
            inflight: () => registry.current ? { version: registry.current.version, promise: registry.current.promise } : void 0,
            restartPending: (installed) => restartPending(pageStore(), installed)
          })
        },
        UpdateAction
      )
    );
  });
}
		return module.exports;
	}
});
