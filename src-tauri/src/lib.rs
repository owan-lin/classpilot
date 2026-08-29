#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .append_invoke_initialization_script(DESKTOP_CACHE_CLEANUP_SCRIPT)
        .run(tauri::generate_context!())
        .expect("error while running ClassPilot");
}

/// Runs before document parsing so a stale web service worker cannot serve the old app shell.
/// IndexedDB is intentionally untouched; the marker prevents a reload loop.
const DESKTOP_CACHE_CLEANUP_SCRIPT: &str = r#"(() => {
  const durableMarker = 'classpilot:desktop-cache-cleanup-v2';
  const attemptedMarker = 'classpilot:desktop-cache-attempted-v1';
  let durable = false;
  try { durable = localStorage.getItem(durableMarker) === '1'; } catch (_) {}
  if (durable) { try { sessionStorage.removeItem(attemptedMarker); } catch (_) {} return; }
  let attempted = false;
  let sessionStorageAvailable = true;
  try {
    attempted = sessionStorage.getItem(attemptedMarker) === '1';
    if (attempted) { sessionStorage.removeItem(attemptedMarker); return; }
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
      location.reload();
    } else if (sessionStorageAvailable) {
      location.reload();
    }
  })();
})();"#;
