/**
 * 测试用：在内存里用 esbuild 构建当前 src/client。
 * 选项直接读 esbuild.options.mjs（与 esbuild.client.mjs 同一份）；
 * client.test.ts 里「与已提交的 lib/client.js 逐字节相同」守着产物不会过期。
 */
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ROOT = fileURLToPath(new URL('../../', import.meta.url))

interface ClientBuildOptions {
	external: string[]
	banner: { js: string }
	footer: { js: string }
	[key: string]: unknown
}

/** 动态导入：.mjs 没有类型声明，不让 tsc 去解析它。 */
async function options(): Promise<ClientBuildOptions> {
	const mod = (await import(pathToFileURL(ROOT + 'esbuild.options.mjs').href)) as { clientBuildOptions: ClientBuildOptions }
	return mod.clientBuildOptions
}

export async function externals(): Promise<string[]> {
	return (await options()).external
}

/** 与 esbuild.client.mjs 相同的构建，但不落盘。 */
export async function buildClientSource(): Promise<string> {
	const result = await build({ ...(await options()), absWorkingDir: ROOT, write: false } as Parameters<typeof build>[0])
	return result.outputFiles![0]!.text
}

/** 单独把 UpdateAction 打成 cjs（不带信封），测试里用替身 React 渲染它。 */
export async function buildComponentSource(): Promise<string> {
	const o = await options()
	const result = await build({
		absWorkingDir: ROOT,
		entryPoints: ['src/client/UpdateAction.tsx'],
		bundle: true,
		format: 'cjs',
		platform: 'browser',
		jsx: 'automatic',
		outfile: 'component.js',
		write: false,
		external: o.external
	})
	return result.outputFiles![0]!.text
}

export const committedClient = (): string => readFileSync(ROOT + 'lib/client.js', 'utf8')
