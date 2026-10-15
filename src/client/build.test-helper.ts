/**
 * 测试用：在内存里用 esbuild 构建当前 src/client。
 * 选项与 esbuild.client.mjs 逐项相同（client.test.ts 里「与已提交的 lib/client.js 逐字节相同」守着两边不会各走各的）。
 */
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('../../', import.meta.url))
export const EXTERNALS = ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives']

/** 与 esbuild.client.mjs 相同的构建，但不落盘。 */
export async function buildClientSource(): Promise<string> {
	const result = await build({
		absWorkingDir: ROOT,
		entryPoints: ['src/client/index.tsx'],
		bundle: true,
		format: 'cjs',
		platform: 'browser',
		jsx: 'automatic',
		outfile: 'lib/client.js',
		write: false,
		external: EXTERNALS,
		banner: {
			js: 'window.__ModuleLoader__.load({\n\tid: "dsh-tool-gdrive",\n\tfactory: (require) => {\n\t\tvar module = { exports: {} };\n\t\tvar exports = module.exports;'
		},
		footer: { js: '\t\treturn module.exports;\n\t}\n});' }
	})
	return result.outputFiles[0]!.text
}

/** 单独把 UpdateAction 打成 cjs（不带信封），测试里用替身 React 渲染它。 */
export async function buildComponentSource(): Promise<string> {
	const result = await build({
		absWorkingDir: ROOT,
		entryPoints: ['src/client/UpdateAction.tsx'],
		bundle: true,
		format: 'cjs',
		platform: 'browser',
		jsx: 'automatic',
		outfile: 'component.js',
		write: false,
		external: EXTERNALS
	})
	return result.outputFiles[0]!.text
}

export const committedClient = (): string => readFileSync(ROOT + 'lib/client.js', 'utf8')
