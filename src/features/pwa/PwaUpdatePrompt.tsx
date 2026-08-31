import { useEffect } from 'react'

const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000

/**
 * Uses the browser service-worker API directly so the same update prompt also
 * works in tests and does not depend on a Vite-only virtual module at runtime.
 */
export function PwaUpdatePrompt() {
  useEffect(() => {
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) return
    let active = true
    let interval: number | undefined
    let checkForUpdate: (() => void) | undefined
    const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`
    const onControllerChange = () => window.location.reload()
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    void navigator.serviceWorker.register(serviceWorkerUrl).then((nextRegistration) => {
      if (!active) return
      checkForUpdate = () => {
        if (navigator.onLine) void nextRegistration.update()
      }
      checkForUpdate()
      interval = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)
      window.addEventListener('online', checkForUpdate)
    })
    return () => {
      active = false
      if (interval !== undefined) window.clearInterval(interval)
      if (checkForUpdate) window.removeEventListener('online', checkForUpdate)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  return null
}
