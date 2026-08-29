import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function buildWithEnvironment(tauri: boolean): string {
  const output = mkdtempSync(join(tmpdir(), tauri ? 'classpilot-tauri-' : 'classpilot-web-'))
  const environment = { ...process.env }
  delete environment.TAURI_ENV_PLATFORM
  delete environment.GITHUB_ACTIONS
  if (tauri) environment.TAURI_ENV_PLATFORM = 'windows'
  try {
    execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', output], {
      cwd: process.cwd(),
      env: environment,
      stdio: 'pipe',
    })
    return output
  } catch (error) {
    rmSync(output, { recursive: true, force: true })
    throw error
  }
}

describe('PWA build isolation', () => {
  it('installs document-start desktop cleanup without touching IndexedDB', () => {
    const source = readFileSync(join(process.cwd(), 'src-tauri/src/lib.rs'), 'utf8')
    expect(source).toContain('append_invoke_initialization_script')
    expect(source).toContain('serviceWorker')
    expect(source).toContain('caches.delete')
    expect(source).toContain('restart_after_cache_cleanup')
    expect(source).toContain('app.restart()')
    expect(source).toContain('classpilot:desktop-cache-cleanup-v3')
    expect(source).toContain('classpilot:desktop-cache-attempted-v3')
    expect(source).not.toContain('classpilot:desktop-cache-cleanup-v2')
    expect(source).not.toContain('location.reload')
    expect(source).not.toMatch(/indexedDB\.deleteDatabase|clear_all_browsing_data/)
    expect(source.indexOf('localStorage.setItem(durableMarker')).toBeGreaterThan(source.indexOf('await Promise.all(registrations'))
    expect(source).toContain('sessionStorage')
  })

  it('keeps the web PWA integration', () => {
    const output = buildWithEnvironment(false)
    try {
      const index = readFileSync(join(output, 'index.html'), 'utf8')
      expect(index).toContain('registerSW.js')
      expect(readdirSync(output)).toEqual(expect.arrayContaining(['manifest.webmanifest', 'sw.js']))
    } finally {
      rmSync(output, { recursive: true, force: true })
    }
  }, 120_000)

  it('omits PWA registration and manifest from a Tauri build', () => {
    const output = buildWithEnvironment(true)
    try {
      const index = readFileSync(join(output, 'index.html'), 'utf8')
      expect(index).not.toMatch(/registerSW|serviceWorker|manifest\.webmanifest/i)
      expect(readdirSync(output)).not.toEqual(expect.arrayContaining(['manifest.webmanifest', 'sw.js', 'registerSW.js']))
    } finally {
      rmSync(output, { recursive: true, force: true })
    }
  }, 120_000)
})
