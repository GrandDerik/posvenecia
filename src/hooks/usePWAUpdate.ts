import { useEffect, useRef, useState, useCallback } from 'react';
import { registerSW } from 'virtual:pwa-register';

const UPDATE_CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds while active
const PRELOAD_RELOAD_GUARD_KEY = 'posvenecia_preload_reload_ts';

export function usePWAUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const hadControllerRef = useRef<boolean>(
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller)
  );
  const reloadingRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Recover seamlessly if a lazy-loaded chunk hash changed after a fresh deploy
    const handlePreloadError = (event: Event) => {
      event.preventDefault();
      const lastReload = Number(sessionStorage.getItem(PRELOAD_RELOAD_GUARD_KEY) || '0');
      const now = Date.now();
      // Guard against infinite reload loops (at most once every 15s)
      if (now - lastReload > 15_000) {
        sessionStorage.setItem(PRELOAD_RELOAD_GUARD_KEY, String(now));
        window.location.reload();
      } else {
        setUpdateAvailable(true);
      }
    };
    window.addEventListener('vite:preloadError', handlePreloadError);

    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
      return () => {
        window.removeEventListener('vite:preloadError', handlePreloadError);
      };
    }

    const triggerUpdateCheck = () => {
      if (navigator.onLine && registrationRef.current) {
        registrationRef.current.update().catch(() => {
          // Ignore transient offline/network errors during background update checks
        });
      }
    };

    const handleControllerChange = () => {
      // Only notify/reload if there was already a controlling SW (i.e. an upgrade, not first install)
      if (!hadControllerRef.current) {
        hadControllerRef.current = true;
        return;
      }
      if (reloadingRef.current) return;
      setUpdateAvailable(true);
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    updateSWRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setUpdateAvailable(true);
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        registrationRef.current = registration;
        // Immediately check for a newer build on startup
        triggerUpdateCheck();
      },
      onRegisterError(err) {
        if (import.meta.env.DEV) {
          console.warn('[PosVenecia SW] Registration error:', err);
        }
      }
    });

    const intervalId = window.setInterval(triggerUpdateCheck, UPDATE_CHECK_INTERVAL_MS);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        triggerUpdateCheck();
      }
    };

    window.addEventListener('focus', triggerUpdateCheck);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('vite:preloadError', handlePreloadError);
      window.removeEventListener('focus', triggerUpdateCheck);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(async () => {
    if (reloadingRef.current) return;
    reloadingRef.current = true;
    setIsUpdating(true);
    try {
      // Clear cached HTML/page caches before reload so the newest index.html is guaranteed
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter(name => name.startsWith('posvenecia-pages') || name.startsWith('posvenecia-html'))
            .map(name => caches.delete(name))
        );
      }
      if (updateSWRef.current) {
        await updateSWRef.current(true);
      }
    } catch {
      // Fallback to direct clean reload
    } finally {
      window.location.reload();
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  return {
    updateAvailable,
    isUpdating,
    applyUpdate,
    dismissUpdate
  };
}
