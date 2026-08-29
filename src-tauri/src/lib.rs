#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(windows)]
            schedule_desktop_cache_cleanup(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ClassPilot");
}

/// Clears only the three stale web-resource stores that can replace Tauri's
/// embedded frontend. This deliberately excludes IndexedDB, LocalStorage,
/// cookies, AllDomStorage, AllSite and AllProfile.
///
/// The marker is a small native file, separate from WebView2's DOM stores. It
/// is written only after `ClearBrowsingData` succeeds; then the process is
/// restarted so the first rendered document is read after the disk cache is
/// gone. A failure leaves no marker and retries on the next manual launch.
#[cfg(windows)]
fn schedule_desktop_cache_cleanup(app: &tauri::App) {
    use std::{fs, path::PathBuf};
    use tauri::Manager;
    use webview2_com::{
        ClearBrowsingDataCompletedHandler,
        Microsoft::Web::WebView2::Win32::{
            ICoreWebView2Profile2, ICoreWebView2_13,
            COREWEBVIEW2_BROWSING_DATA_KINDS_CACHE_STORAGE,
            COREWEBVIEW2_BROWSING_DATA_KINDS_DISK_CACHE,
            COREWEBVIEW2_BROWSING_DATA_KINDS_SERVICE_WORKERS,
        },
    };
    use windows_core::Interface;

    const MARKER_NAME: &str = "desktop-webview-cache-cleanup-v5.marker";

    fn marker_path(app: &tauri::AppHandle, marker_name: &str) -> Option<PathBuf> {
        app.path()
            .app_local_data_dir()
            .ok()
            .map(|dir| dir.join(marker_name))
    }

    let app_handle = app.handle().clone();
    let Some(marker) = marker_path(&app_handle, MARKER_NAME) else {
        eprintln!("ClassPilot: cannot resolve desktop cache-cleanup marker path");
        return;
    };
    if marker.exists() {
        return;
    }

    let Some(main_window) = app.get_webview_window("main") else {
        eprintln!("ClassPilot: main WebView was unavailable for cache cleanup");
        return;
    };

    let _ = main_window.with_webview(move |webview| {
        let callback_handle = app_handle.clone();
        let callback_marker = marker.clone();
        let result: windows_core::Result<()> = (|| unsafe {
            let core = webview.controller().CoreWebView2()?;
            let profile = core
                .cast::<ICoreWebView2_13>()?
                .Profile()?
                .cast::<ICoreWebView2Profile2>()?;
            profile.ClearBrowsingData(
                COREWEBVIEW2_BROWSING_DATA_KINDS_DISK_CACHE
                    | COREWEBVIEW2_BROWSING_DATA_KINDS_SERVICE_WORKERS
                    | COREWEBVIEW2_BROWSING_DATA_KINDS_CACHE_STORAGE,
                &ClearBrowsingDataCompletedHandler::create(Box::new(move |outcome| {
                    if outcome.is_ok() {
                        let wrote_marker = callback_marker
                            .parent()
                            .and_then(|parent| fs::create_dir_all(parent).ok())
                            .is_some()
                            && fs::write(&callback_marker, b"v5\n").is_ok();
                        if wrote_marker {
                            callback_handle.restart();
                        } else {
                            eprintln!("ClassPilot: cache cleared but marker write failed; retry next launch");
                        }
                    } else {
                        eprintln!("ClassPilot: selective WebView2 cache cleanup failed; retry next launch");
                    }
                    Ok(())
                })),
            )?;
            Ok(())
        })();
        if let Err(error) = result {
            eprintln!("ClassPilot: unable to schedule selective WebView2 cache cleanup: {error}");
        }
    });
}
