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

```yaml
# cordis.yml / profile 里的插件条目
- id: gdrive
  name: dsh-tool-gdrive
  config:
    clientId: xxx.apps.googleusercontent.com
    clientSecret: xxx
    mode: readwrite        # readonly（默认）| readwrite | full
    # port: 55414          # 可选，回调端口
    # maxChars: 8000       # 可选，读取截断
    # pageSize: 20         # 可选，分页大小
```

## 使用流程

1. 对话里让 Agent 调 `gdrive_auth_start` → 浏览器打开授权页 → 登录同意。
2. `gdrive_auth_status` 确认已授权。
3. 正常使用其余工具。写操作在 `readonly` 模式下会被拒绝并给出切换指引；切换 `mode` 后需删除 token 文件（默认 `~/.config/dsh/gdrive-tokens.json`）重新授权。

## 开发与打包

```bash
pnpm install
pnpm build                 # tsc → lib/
dsh plugin --profile <name> add ./dsh-tool-gdrive
dsh --profile <name> --dump-config   # 验证挂载
```

## 已知边界（首版不做）

共享盘管理、权限共享 API、版本历史恢复、增量同步、批量操作；共享盘文件仅通过 `supportsAllDrives` 透传可读写。`readwrite` 档的 Drive 文件写操作只覆盖本插件创建的文件（`drive.file` scope 限制），要改任意文件用 `full`。
