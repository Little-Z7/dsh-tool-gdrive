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

test('lib/*.js 引用的 @deepseek-ai/* 都必须声明在 peerDependencies', () => {
	const libDir = new URL('lib/', root)
	const re = /(?:from\s*|import\s*\(\s*)(['"])(@deepseek-ai\/[^/'"]+)\/?[^'"]*\1/g
	const used = new Set<string>()
	for (const file of readdirSync(libDir).filter((f) => f.endsWith('.js'))) {
		const src = readFileSync(new URL(file, libDir), 'utf8')
		for (const m of src.matchAll(re)) used.add(m[2])
	}
	assert.ok(used.size > 0, '没有扫描到任何 @deepseek-ai/* 引用（需先 pnpm build，或扫描正则已失效）')
	const peers = pkg.peerDependencies ?? {}
	const missing = [...used].filter((name) => !(name in peers))
	assert.deepEqual(missing, [], `lib 引用了但未写进 peerDependencies：${missing.join(', ')}。${WHY}`)
})
