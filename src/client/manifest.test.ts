import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const root = new URL('../../', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as {
	dependencies?: Record<string, string>
	optionalDependencies?: Record<string, string>
	peerDependencies?: Record<string, string>
	devDependencies?: Record<string, string>
}

const WHY =
	'DSH profile 用 nodeLinker: hoisted：写进 dependencies 的 @deepseek-ai/* 会被提升到 profile 根 node_modules、盖过 DSH 自带那份；' +
	'写成 peer 的 DSH 包会被 pnpm 解析到 profile 里已有的副本（例如 0.2.4–0.2.6 留下的），覆盖更新时不会清掉，DSH 又会把插件绑到这份副本。' +
	"两种都会导致所有工具调用报 `Cannot read properties of undefined (reading 'prepare')`。" +
	'修法：只在 peerDependencies 写 @deepseek-ai/dsh 做版本约束，构建用到的 DSH 包写 devDependencies，仓库 pnpm-workspace.yaml 关 autoInstallPeers。'

test('dependencies / optionalDependencies 里不得有 @deepseek-ai/*', () => {
	for (const field of ['dependencies', 'optionalDependencies'] as const) {
		const bad = Object.keys(pkg[field] ?? {}).filter((name) => name.startsWith('@deepseek-ai/'))
		assert.deepEqual(bad, [], `${field} 里不能有 ${bad.join(', ')}。${WHY}`)
	}
})

const CLIENT_BUNDLE = 'client.js'

/** 返回 src 里引用到的 `@deepseek-ai/<名字>`（去掉子路径）。 */
function scanDshRefs(src: string): Set<string> {
	// from '…'（含 export … from、换行）、副作用 import '…'、动态 import('…')、require('…')
	const re = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"])(@deepseek-ai\/[^/'"]+)(?:\/[^'"]*)?\1/g
	const used = new Set<string>()
	for (const m of src.matchAll(re)) used.add(m[2])
	return used
}

test('scanDshRefs 识别各种引用写法', () => {
	const src = [
		`import a from '@deepseek-ai/p-default'`,
		`import { b } from "@deepseek-ai/p-named"`,
		`export * from '@deepseek-ai/p-star'`,
		`export { c } from "@deepseek-ai/p-reexport"`,
		`import {\n  d,\n  e,\n} from\n  '@deepseek-ai/p-multiline'`,
		`import '@deepseek-ai/p-side'`,
		`import "@deepseek-ai/p-side-dq"`,
		`await import( '@deepseek-ai/p-dynamic' )`,
		`const f = require( "@deepseek-ai/p-require" )`,
		`const g = require('@deepseek-ai/p-require-sq')`,
		`import h from '@deepseek-ai/p-sub/sub/deep'`,
		// 反例
		`myrequire("@deepseek-ai/n-myrequire")`,
		`const s = '@deepseek-ai/n-literal'`,
		`import z from 'lodash'`,
		`require("other/@deepseek-ai/n-other")`,
		`require("@deepseek/n-scope")`,
	].join('\n')
	assert.deepEqual(
		scanDshRefs(src),
		new Set([
			'@deepseek-ai/p-default',
			'@deepseek-ai/p-named',
			'@deepseek-ai/p-star',
			'@deepseek-ai/p-reexport',
			'@deepseek-ai/p-multiline',
			'@deepseek-ai/p-side',
			'@deepseek-ai/p-side-dq',
			'@deepseek-ai/p-dynamic',
			'@deepseek-ai/p-require',
			'@deepseek-ai/p-require-sq',
			'@deepseek-ai/p-sub',
		]),
	)
})

test('peerDependencies 里的 @deepseek-ai/* 只能是 @deepseek-ai/dsh，且必须有它', () => {
	const peers = Object.keys(pkg.peerDependencies ?? {}).filter((name) => name.startsWith('@deepseek-ai/'))
	const extra = peers.filter((name) => name !== '@deepseek-ai/dsh')
	assert.deepEqual(extra, [], `peerDependencies 里不能有 ${extra.join(', ')}。${WHY}`)
	assert.ok('@deepseek-ai/dsh' in (pkg.peerDependencies ?? {}), `peerDependencies 必须有 @deepseek-ai/dsh（DSH 运行时版本检查靠它）。${WHY}`)
})

test('lib/*.js 引用的 @deepseek-ai/* 都必须登记在 devDependencies（运行时由 DSH 宿主提供）', () => {
	const libDir = new URL('lib/', root)
	const nodeUsed = new Set<string>()
	let clientUsed = new Set<string>()
	for (const file of readdirSync(libDir).filter((f) => f.endsWith('.js'))) {
		const refs = scanDshRefs(readFileSync(new URL(file, libDir), 'utf8'))
		if (file === CLIENT_BUNDLE) clientUsed = refs
		else for (const name of refs) nodeUsed.add(name)
	}
	assert.ok(nodeUsed.size > 0, 'Node 侧 lib/*.js 没扫到任何 @deepseek-ai/* 引用（需先 pnpm build，或扫描正则已失效）')
	assert.ok(clientUsed.size > 0, `${CLIENT_BUNDLE} 没扫到任何 @deepseek-ai/* 引用（需先 pnpm build，或扫描正则已失效）`)
	const dev = pkg.devDependencies ?? {}
	const runtime = new Set(
		['dependencies', 'optionalDependencies', 'peerDependencies'].flatMap((f) => Object.keys(pkg[f as 'dependencies'] ?? {})),
	)
	for (const [label, used] of [['Node 侧 lib', nodeUsed], [CLIENT_BUNDLE, clientUsed]] as const) {
		const missing = [...used].filter((name) => !(name in dev))
		assert.deepEqual(missing, [], `${label} 引用了但未登记在 devDependencies：${missing.join(', ')}。${WHY}`)
		const bad = [...used].filter((name) => runtime.has(name))
		assert.deepEqual(bad, [], `${label} 引用的 ${bad.join(', ')} 不得写在 dependencies / optionalDependencies / peerDependencies。${WHY}`)
	}
})
