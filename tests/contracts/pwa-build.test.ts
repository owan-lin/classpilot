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
  it('uses native WebView2 selective cleanup without touching local student storage', () => {
    const source = readFileSync(join(process.cwd(), 'src-tauri/src/lib.rs'), 'utf8')
    expect(source).toContain('ClearBrowsingData(')
    expect(source).toContain('COREWEBVIEW2_BROWSING_DATA_KINDS_DISK_CACHE')
    expect(source).toContain('COREWEBVIEW2_BROWSING_DATA_KINDS_SERVICE_WORKERS')
    expect(source).toContain('COREWEBVIEW2_BROWSING_DATA_KINDS_CACHE_STORAGE')
    expect(source).toContain('desktop-webview-cache-cleanup-v5.marker')
    expect(source).toContain('callback_handle.restart()')
    expect(source).not.toMatch(/indexedDB\.deleteDatabase|clear_all_browsing_data|ALL_DOM_STORAGE|ALL_SITE|ALL_PROFILE|LOCAL_STORAGE/)
    expect(source.indexOf('fs::write(&callback_marker')).toBeLessThan(source.indexOf('callback_handle.restart()'))
  })

  it('uses a versioned same-origin window entry without moving storage origins', () => {
    const config = readFileSync(join(process.cwd(), 'src-tauri/tauri.conf.json'), 'utf8')
    expect(config).toContain('"url": "index.html?v=0.3.0"')
    expect(config).not.toContain('useHttpsScheme')
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
      const entry = readdirSync(join(output, 'assets')).find((file) => /^index-.*\.js$/.test(file))
      expect(entry).toBeDefined()
      const frontend = readFileSync(join(output, 'assets', entry!), 'utf8')
      expect(frontend).toContain('录入学生')
      expect(frontend).toContain('排座 / 移位')
      expect(frontend).not.toContain('历史版本')
      expect(frontend).not.toContain('导出 PNG')
      expect(frontend).not.toContain('打印 PDF')
    } finally {
      rmSync(output, { recursive: true, force: true })
    }
  }, 120_000)
})
