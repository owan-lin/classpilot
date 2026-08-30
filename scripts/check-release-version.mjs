import { readFileSync } from 'node:fs'

const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version
const tauriVersion = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).version
const cargoText = readFileSync('src-tauri/Cargo.toml', 'utf8')
const cargoVersion = cargoText.match(/^version\s*=\s*"([^"]+)"/m)?.[1]
const cargoLockText = readFileSync('src-tauri/Cargo.lock', 'utf8')
const cargoLockVersion = cargoLockText.match(/\[\[package\]\]\r?\nname = "classpilot"\r?\nversion = "([^"]+)"/)?.[1]
const tagVersion = process.env.GITHUB_REF_TYPE === 'tag'
  ? process.env.GITHUB_REF_NAME?.replace(/^v/, '')
  : undefined

const versions = { packageVersion, tauriVersion, cargoVersion, cargoLockVersion }
if (new Set(Object.values(versions)).size !== 1) {
  throw new Error(`Release versions differ: ${JSON.stringify(versions)}`)
}
if (tagVersion && tagVersion !== packageVersion) {
  throw new Error(`Tag v${tagVersion} does not match package version ${packageVersion}`)
}

console.log(`Release version ${packageVersion} is consistent.`)
