# dsh-tool-gdrive

DeepSeek Harness（DSH）的 Google 云端硬盘插件：读写闭环 + 工具内 OAuth 授权向导。

## 特性

- **授权向导**：`gdrive_auth_start` 生成授权链接并自动拉起浏览器，本地回环回调收 code，token 落盘（0600）后自动刷新——不用手动跑任何脚本。
- **读写闭环**：列目录 / 搜索 / 元数据 / 读取 / 上传 / 更新（改内容、改名、移动、软删）/ Google Docs 读写 / Sheets 读写。
- **读取体验**：分页透传 `pageToken`，超长自动截断并标注 `truncated/totalChars`，二进制只回元数据，错误信息中文且带下一步操作指引。
- **最小权限三档**：`readonly`（默认）/ `readwrite`（写本插件创建的文件 + Docs/Sheets 内容）/ `full`（Drive 全量）。

## 工具（10 个）

| 工具 | 说明 |
| --- | --- |
| `gdrive_auth_status` | 授权状态 / scope / 过期时间 |
| `gdrive_auth_start` | 生成授权链接，本地回调收 code |
| `gdrive_list` | 列目录（默认根目录，分页） |
| `gdrive_search` | 文件名+全文搜索，mimeType/folderId 过滤 |
| `gdrive_get` | 文件元数据 |
| `gdrive_read` | 读内容：Docs 导出纯文本、Sheets 导 CSV、文本直读、二进制回元数据 |
| `gdrive_upload` | 上传文本/本地文件，或新建文件夹 |
| `gdrive_update` | 改内容 / 改名 / 移动 / 软删与恢复 |
| `gdrive_docs` | Docs：read / append / replace |
| `gdrive_sheets` | Sheets：meta / read / write / append |

## 准备：GCP OAuth Client（一次性）

1. [Google Cloud Console](https://console.cloud.google.com/) 建项目 → 启用 **Drive API / Docs API / Sheets API**。
2. 「API 和服务 → OAuth 同意屏幕」配成 External、测试态（加上自己的测试用户邮箱）。
3. 「凭据 → 创建 OAuth 客户端 ID」，类型选 **桌面应用**（回环地址 `http://127.0.0.1` 免登记）。
4. 记下 Client ID / Client Secret。

## 配置

**推荐：插件内置配置页（0.2.0+）。** 桌面版 / Web 侧栏「插件 → dsh-tool-gdrive → 配置」里直接填 Client ID / Secret、选 mode，保存即生效——不用手编任何 YAML。页面上还有 GCP 建项目图文指引、实时授权状态和「开始授权」按钮（点一下自动拉起浏览器，授权完成页面自动变成已授权）。

也可以手写配置（cordis.yml / profile 的插件条目）：

```yaml
- id: gdrive
  name: dsh-tool-gdrive
  config:
    clientId: xxx.apps.googleusercontent.com
    clientSecret: xxx
    mode: readwrite        # readonly（默认）| readwrite | full
    # port: 55414          # 可选，OAuth 回调端口
    # bridgePort: 0        # 可选，配置页桥接端口；0 = port+10
    # maxChars: 8000       # 可选，读取截断
    # pageSize: 20         # 可选，分页大小
    # marketUrl: ''        # 可选，检查更新读取的市场地址；留空 = https://tv.auraaigc.ccwu.cc:56814
```

`clientId/clientSecret` 在 0.2.0 起为可选：未配置时插件正常加载、配置页可用，只有 API 调用会给出中文指引报错。

## 使用流程

1. 在插件配置页填入 `clientId/clientSecret` 并保存（页内有 GCP 建项目图文指引）。
2. 点页面上的「开始授权」（或对话里让 Agent 调 `gdrive_auth_start`）→ 浏览器打开授权页 → 登录同意。
3. 页面状态变为「已授权」（或调 `gdrive_auth_status` 确认）。
4. 正常使用其余工具。写操作在 `readonly` 模式下会被拒绝并给出切换指引；切换 `mode` 后需删除 token 文件（默认 `~/.config/dsh/gdrive-tokens.json`）重新授权。

## 0.2.4–0.2.6 的已知问题（0.2.7 已修）

这三个版本装进某个 profile 后，该 profile 里**所有**工具（不只 gdrive）的调用都会失败，报 `Cannot read properties of undefined (reading 'prepare')`，新会话必现，Mac / Windows 都一样。

原因：插件把 DSH 自带的包（`@deepseek-ai/dsh-tools`、`@deepseek-ai/schemastery`）写进了 dependencies，安装时被提升到 profile 根的 `node_modules` 里，盖过了 DSH 自己那份。0.2.7 起 DSH 自带的包既不写 dependencies 也不写 peer，只用 `@deepseek-ai/dsh` 这一个 peer 做版本约束。

恢复方法：升到 0.2.7，然后重启 DSH。

1. 0.2.6：在插件详情页点「更新到 0.2.7」，装好后重启 DSH。
2. 更早的版本：用灵环 TV 插件市场的安装命令更新，然后重启 DSH。
3. 暂时没法更新：先卸载本插件，再重启 DSH。

## 更新

0.2.6 起，在 DSH 插件页打开本插件（dsh-tool-gdrive）的组合包详情，页头有「检查更新」按钮；有新版时按钮变成「更新到 x.y.z」，点一下由 DSH 安装，**装好后要重启 DSH 才生效**。插件被停用时，它的浏览器半侧也不加载，详情页不会出现这个按钮——先启用插件再更新。

- 0.2.5 及更早的版本没有这个按钮，或是从 `github:` 地址装的：先用灵环 TV 插件市场里的安装命令更新一次，之后就能用按钮。
- 检查读的市场地址默认是 `https://tv.auraaigc.ccwu.cc:56814`，可以在配置页「插件市场地址」改（只接受 https；本机地址如 `http://127.0.0.1:8765` 可以用 http，仅供测试）。留空恢复缺省。
- 用按钮装过之后，DSH 里记录的安装来源会变成市场的下载地址（`http(s)://…/dsh-market/…tgz`）；市场的安装、卸载命令对它照常有效。
- 网页版只刷新页面、不重启 DSH 时，页面会误显示「已是最新」，因为 DSH 不告诉页面宿主半侧跑的是哪一版。
- 打开详情页会访问一次灵环 TV（读 `/dsh-market/index.json`），请求不带 Referer 和 Cookie，TV 的访问日志里会有你的 IP 和时间。
- 已知限制：DSH 宿主的安装调用一直不返回时，重新进入的详情页会停在「正在安装…」；刷新页面即可恢复。

## 安全说明

- token 只存本机文件（0600），不随包分发、不进任何远程。
- 配置页桥接仅绑定 `127.0.0.1`：`/gdrive/status` 不含 token，`/gdrive/start-auth` 仅接受 POST；CORS 放开仅限本机回环场景。
- OAuth 回调带随机 `state` 校验，防回环授权码注入。
- 一键更新不核对市场给的摘要，只有 pnpm 自己的完整性记录；信任来源是配置的市场地址（默认 https 的灵环 TV）。要核对摘要，请用市场的安装命令。

## 开发与打包

```bash
pnpm install
pnpm build                 # tsc → lib/
pnpm test                  # 类型检查 + node --test（需 Node ≥22.19；client.test 读已构建的 lib/client.js）
dsh plugin --profile <name> add ./dsh-tool-gdrive
dsh --profile <name> --dump-config   # 验证挂载
```

约定：`@deepseek-ai/*` 不能写进 `dependencies` / `optionalDependencies`，`peerDependencies` 里也只能有 `@deepseek-ai/dsh`（做 DSH 运行时的版本检查）；构建用到的 DSH 包只写 `devDependencies`，运行时由 DSH 宿主提供。原因：profile 用 `nodeLinker: hoisted`，写进 dependencies 的会被提升到 profile 根 `node_modules`、盖过 DSH 自带那份；写成 peer 的 DSH 包会被 pnpm 解析到 profile 里已有的旧副本，覆盖更新时不会清掉，DSH 又会把插件绑到这份副本，同样导致所有工具调用失败。仓库的 `pnpm-workspace.yaml` 设了 `autoInstallPeers: false`，否则 pnpm 会把 `@deepseek-ai/dsh` 整个装成开发依赖。由 `src/client/manifest.test.ts` 守卫。

## 已知边界（首版不做）

共享盘管理、权限共享 API、版本历史恢复、增量同步、批量操作；共享盘文件仅通过 `supportsAllDrives` 透传可读写。`readwrite` 档的 Drive 文件写操作只覆盖本插件创建的文件（`drive.file` scope 限制），要改任意文件用 `full`。
