import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const root = new URL('../../', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as {
	dependencies?: Record<string, string>
	optionalDependencies?: Record<string, string>
	peerDependencies?: Record<string, string>
}

const WHY =
	'DSH profile 用 nodeLinker: hoisted，写进 dependencies 的 @deepseek-ai/* 会被提升到 profile 根 node_modules、' +
	"盖过 DSH 自带那份，导致所有工具调用报 `Cannot read properties of undefined (reading 'prepare')`；" +
	'要写进 peerDependencies（开发构建另写 devDependencies）。'

test('dependencies / optionalDependencies 里不得有 @deepseek-ai/*', () => {
	for (const field of ['dependencies', 'optionalDependencies'] as const) {
		const bad = Object.keys(pkg[field] ?? {}).filter((name) => name.startsWith('@deepseek-ai/'))
		assert.deepEqual(bad, [], `${field} 里不能有 ${bad.join(', ')}。${WHY}`)
	}
})

/** lib/client.js 是浏览器端产物：其中的 require 由 DSH 前端宿主的模块加载器提供，不经 profile 安装。 */
const CLIENT_BUNDLE = 'client.js'
const HOST_PROVIDED_CLIENT_MODULES = ['@deepseek-ai/dsh-client-ui-primitives']

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

test('lib/*.js 引用的 @deepseek-ai/* 都必须声明在 peerDependencies（client.js 可另用宿主模块白名单）', () => {
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
	const peers = pkg.peerDependencies ?? {}
	const nodeMissing = [...nodeUsed].filter((name) => !(name in peers))
	assert.deepEqual(nodeMissing, [], `Node 侧 lib 引用了但未写进 peerDependencies：${nodeMissing.join(', ')}。${WHY}`)
	const clientMissing = [...clientUsed].filter((name) => !(name in peers) && !HOST_PROVIDED_CLIENT_MODULES.includes(name))
	assert.deepEqual(
		clientMissing,
		[],
		`${CLIENT_BUNDLE} 引用了既未写进 peerDependencies、也不在 HOST_PROVIDED_CLIENT_MODULES 的模块：${clientMissing.join(', ')}。${WHY}`,
	)
	const stale = HOST_PROVIDED_CLIENT_MODULES.filter((name) => !clientUsed.has(name))
	assert.deepEqual(stale, [], `HOST_PROVIDED_CLIENT_MODULES 里的 ${stale.join(', ')} 已不被 ${CLIENT_BUNDLE} 引用，白名单过期，请删除。`)
	const hostInNode = HOST_PROVIDED_CLIENT_MODULES.filter((name) => nodeUsed.has(name))
	assert.deepEqual(
		hostInNode,
		[],
		`${hostInNode.join(', ')} 被 Node 侧 lib 引用：白名单只放行浏览器产物 ${CLIENT_BUNDLE}，Node 侧用到就必须写进 peerDependencies。${WHY}`,
	)
})
