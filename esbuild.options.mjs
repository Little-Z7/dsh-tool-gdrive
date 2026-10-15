// 浏览器半侧的 esbuild 选项（无副作用，只导出常量）。
// esbuild.client.mjs 用它真正构建；测试 helper 用它在内存里构建并与已提交的 lib/client.js 逐字节比对。
// 改这里就会改产物字节：改完必须重新 npm run build 并提交 lib/client.js。
export const clientBuildOptions = {
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
}
