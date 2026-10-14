// 构建浏览器半侧：产出与官方一致的 window.__ModuleLoader__.load({id, factory}) 形态。
// react / react/jsx-runtime / @deepseek-ai/dsh-client-ui-primitives 由宿主 webview 的模块加载器提供。
import { build } from 'esbuild'

await build({
	entryPoints: ['src/client/index.tsx'],
	bundle: true,
	format: 'cjs',
	platform: 'browser',
	jsx: 'automatic',
	outfile: 'lib/client.js',
	external: ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
	banner: {
		js: 'window.__ModuleLoader__.load({\n\tid: "dsh-tool-gdrive",\n\tfactory: (require) => {\n\t\tvar module = { exports: {} };\n\t\tvar exports = module.exports;'
	},
	footer: {
		js: '\t\treturn module.exports;\n\t}\n});'
	}
})

console.log('lib/client.js built')
