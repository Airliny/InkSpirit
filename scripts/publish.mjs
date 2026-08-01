#!/usr/bin/env node
// Publish InkSpirit release to GitHub Releases via GitHub API.
// Usage:
//   1. GH_TOKEN=ghp_xxx npm run publish:release   (repo scope)
//   2. bump version in package.json first
import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const root = resolve(process.cwd())
const token = process.env.GH_TOKEN
if (!token) {
  console.error('GH_TOKEN env var is required (repo scope).')
  process.exit(1)
}

const OWNER = 'Airliny'
const REPO = 'InkSpirit'
const API = `https://api.github.com/repos/${OWNER}/${REPO}`
const UPLOADS = `https://uploads.github.com/repos/${OWNER}/${REPO}`

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const version = pkg.version

const setup = resolve(root, 'dist', `InkSpirit-Setup-${version}.exe`)
const latestYml = resolve(root, 'dist', 'latest.yml')
const blockmap = `${setup}.blockmap`

for (const f of [setup, latestYml, blockmap]) {
  if (!existsSync(f)) {
    console.error(`Missing file: ${f}\nRun "pnpm package" first.`)
    process.exit(1)
  }
}

const api = (method, url, body) => execSync(
  `curl -s -L -X ${method} "${url}" -H "Authorization: Bearer ${token}" -H "Accept: application/vnd.github+json" ${body ? `-d '${JSON.stringify(body)}'` : ''}`,
  { encoding: 'utf8' }
)

const upload = (url, file, name) => execSync(
  `curl -s -L -X POST "${url}?name=${encodeURIComponent(name)}" -H "Authorization: Bearer ${token}" -H "Content-Type: application/octet-stream" --data-binary @"${file}"`,
  { encoding: 'utf8' }
)

async function main() {
  // Delete existing release + tag if present
  const existing = JSON.parse(api('GET', `${API}/releases/tags/v${version}`))
  if (existing.id) {
    console.log(`Deleting existing release v${version}...`)
    execSync(`curl -s -X DELETE "${API}/releases/${existing.id}" -H "Authorization: Bearer ${token}"`)
    execSync(`curl -s -X DELETE "${API}/git/refs/tags/v${version}" -H "Authorization: Bearer ${token}"`)
  }

  // Create release
  console.log(`Creating release v${version}...`)
  const notesPath = resolve(root, 'RELEASE_NOTES.md')
  const body = existsSync(notesPath)
    ? readFileSync(notesPath, 'utf8')
    : `## InkSpirit ${version}\n\n自动发布：请补充本次更新内容。`
  const rel = JSON.parse(api('POST', `${API}/releases`, {
    tag_name: `v${version}`,
    name: `InkSpirit ${version}`,
    body,
    draft: false,
    prerelease: false
  }))
  const relId = rel.id
  if (!relId) { console.error('Failed to create release:', JSON.stringify(rel)); process.exit(1) }

  // Upload assets
  console.log('Uploading installer...')
  console.log(JSON.parse(upload(`${UPLOADS}/releases/${relId}/assets`, setup, `InkSpirit-Setup-${version}.exe`)).state)
  console.log('Uploading latest.yml...')
  console.log(JSON.parse(upload(`${UPLOADS}/releases/${relId}/assets`, latestYml, 'latest.yml')).state)
  console.log('Uploading blockmap...')
  console.log(JSON.parse(upload(`${UPLOADS}/releases/${relId}/assets`, blockmap, `InkSpirit-Setup-${version}.exe.blockmap`)).state)

  console.log(`\nPublished v${version}: https://github.com/${OWNER}/${REPO}/releases/tag/v${version}`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
