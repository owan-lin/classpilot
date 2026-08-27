import { useEffect, useState } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * Uses the browser service-worker API directly so the same update prompt also
 * works in tests and does not depend on a Vite-only virtual module at runtime.
 */
export function PwaUpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>()
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) return
    let active = true
    const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`
    const onControllerChange = () => window.location.reload()
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    void navigator.serviceWorker.register(serviceWorkerUrl).then((nextRegistration) => {
      if (!active) return
      setRegistration(nextRegistration)
      if (nextRegistration.waiting) setNeedRefresh(true)
      else if (navigator.serviceWorker.controller) setOfflineReady(true)

      nextRegistration.addEventListener('updatefound', () => {
        const installing = nextRegistration.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            setNeedRefresh(true)
          }
        })
      })
    })
    return () => {
      active = false
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  useEffect(() => {
    if (!registration) return
    const check = () => {
      if (navigator.onLine) void registration.update()
    }
    const interval = window.setInterval(check, UPDATE_CHECK_INTERVAL_MS)
    window.addEventListener('online', check)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('online', check)
    }
  }, [registration])

  function updateNow(): void {
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
  }

  if (!needRefresh && !offlineReady) return null

  return (
    <aside className="pwa-update" role="status" aria-live="polite">
      {needRefresh ? <RefreshCw size={18} /> : <WifiOff size={18} />}
      <div>
        <strong>{needRefresh ? 'ClassPilot 有新版本' : '已可离线使用'}</strong>
        <span>{needRefresh ? '更新会在本地重新载入应用，不会上传班级资料。' : '断网后仍可继续使用。'}</span>
      </div>
      {needRefresh ? (
        <button onClick={updateNow}>立即更新</button>
      ) : (
        <button onClick={() => setOfflineReady(false)}>知道了</button>
      )}
      {needRefresh && <button className="pwa-later" aria-label="稍后更新" onClick={() => setNeedRefresh(false)}>稍后</button>}
    </aside>
  )
}
