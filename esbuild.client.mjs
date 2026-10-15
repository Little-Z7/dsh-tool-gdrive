// 构建浏览器半侧：产出与官方一致的 window.__ModuleLoader__.load({id, factory}) 形态。
// react / react/jsx-runtime / @deepseek-ai/dsh-client-ui-primitives 由宿主 webview 的模块加载器提供。
// 选项在 esbuild.options.mjs（测试也读它）。
import { build } from 'esbuild'
import { clientBuildOptions } from './esbuild.options.mjs'

await build(clientBuildOptions)

console.log('lib/client.js built')
