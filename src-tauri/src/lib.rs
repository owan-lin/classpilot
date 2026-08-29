#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![restart_after_cache_cleanup])
        .append_invoke_initialization_script(DESKTOP_CACHE_CLEANUP_SCRIPT)
        .run(tauri::generate_context!())
        .expect("error while running ClassPilot");
}

#[tauri::command]
fn restart_after_cache_cleanup(app: tauri::AppHandle) {
    app.restart();
}

/// Runs before document parsing so a stale web service worker cannot serve the old app shell.
/// IndexedDB is intentionally untouched; the marker prevents a reload loop.
const DESKTOP_CACHE_CLEANUP_SCRIPT: &str = r#"(() => {
  const durableMarker = 'classpilot:desktop-cache-cleanup-v3';
  const attemptedMarker = 'classpilot:desktop-cache-attempted-v3';
  let durable = false;
  try { durable = localStorage.getItem(durableMarker) === '1'; } catch (_) {}
  if (durable) { try { sessionStorage.removeItem(attemptedMarker); } catch (_) {} return; }
  let attempted = false;
  let sessionStorageAvailable = true;
  try {
    attempted = sessionStorage.getItem(attemptedMarker) === '1';
    if (attempted) sessionStorage.removeItem(attemptedMarker);
    sessionStorage.setItem(attemptedMarker, '1');
  } catch (_) { sessionStorageAvailable = false; }
  (async () => {
    let cleaned = true;
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch (_) { cleaned = false; }
    if (cleaned) {
      try { localStorage.setItem(durableMarker, '1'); } catch (_) {}
      try { sessionStorage.removeItem(attemptedMarker); } catch (_) {}
      try {
        const invoke = window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke;
        if (typeof invoke === 'function') await invoke('restart_after_cache_cleanup');
      } catch (_) {}
    } else if (sessionStorageAvailable) {
      // Keep the attempted marker so a single failed run cannot reload forever.
      try { sessionStorage.setItem(attemptedMarker, '1'); } catch (_) {}
    }
  })();
})();"#;
