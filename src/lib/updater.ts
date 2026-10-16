/**
 * Keeping an installed app current.
 *
 * Adding Flick to the home screen used to pin it to whatever build was live
 * that day: the only reliable way to see a change was to delete it and add it
 * again. The service worker fixes the fetching side of that; this side
 * decides what to do when a newer build turns up.
 *
 * A launch updates itself silently — that is the case being fixed, and being
 * asked to confirm an update you did not know was pending helps nobody.
 * Anything later shows a nudge instead, because reloading out from under
 * someone mid-edit loses what they were typing.
 */

/**
 * The build stamp, or the literal placeholder under `npm run dev`, which
 * skips the inline step. Left raw on purpose: comparing it against the
 * placeholder here gets constant-folded away at build time, taking the token
 * the stamp looks for with it. `isDevBuild` does the check at runtime.
 */
export const BUILD_ID = __BUILD_ID__;

export const isDevBuild = () => BUILD_ID.startsWith('__');
const BASE = __BASE_PATH__;

/** Reloading counts as "just launched" for this long. */
const LAUNCH_GRACE = 6000;

const startedAt = Date.now();
let reloading = false;

function reload() {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}

export interface Updater {
  /** Ask the browser to look for a newer build now. */
  check: () => Promise<void>;
  /** Unregister, drop every cache, reload. The escape hatch. */
  reset: () => Promise<void>;
}

/** Asks the controlling worker for its build stamp; null if it will not say. */
function workerVersion(): Promise<string | null> {
  const ctl = navigator.serviceWorker.controller;
  if (!ctl) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 1500);
    channel.port1.onmessage = (e) => {
      clearTimeout(timer);
      resolve(typeof e.data === 'string' ? e.data : null);
    };
    try {
      ctl.postMessage('flick:version', [channel.port2]);
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

const noop: Updater = { check: async () => {}, reset: async () => {} };

/**
 * @param onWaiting called when a new build is ready but the app has been open
 *   long enough that reloading unprompted would be rude.
 */
export function startUpdater(onWaiting: () => void): Updater {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return noop;
  // A worker needs a secure context; over plain http it simply never registers.
  if (!window.isSecureContext) return noop;

  let registration: ServiceWorkerRegistration | null = null;

  // Whether a worker was already in charge when this page loaded. On a first
  // visit there is none: the page came straight from the network, so the
  // worker that claims it a moment later has nothing newer to offer.
  const hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // A worker taking over used to mean an unconditional reload in the first
    // six seconds. But the worker is network-first, so the page on screen is
    // almost always the newest build already, and the reload only threw away
    // whatever you had just tapped into — the app appeared to flicker and
    // bounce on every launch after a deploy, and on every first visit.
    // Reload only when the build actually differs from the one running.
    if (!hadController) return;
    void workerVersion().then((version) => {
      if (version !== null && version === BUILD_ID) return;
      if (Date.now() - startedAt < LAUNCH_GRACE) reload();
      else onWaiting();
    });
  });

  void navigator.serviceWorker
    // A constant URL on purpose — see the note at the top of sw.js.
    .register(`${BASE}sw.js`, { scope: BASE })
    .then((reg) => {
      registration = reg;
      // Also look on return-to-foreground: an installed app is resumed far
      // more often than it is launched.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => {});
      });
    })
    .catch(() => {
      /* Registration is an enhancement — the app runs fine without it. */
    });

  return {
    check: async () => {
      try {
        await registration?.update();
      } catch {
        /* offline, or the worker is gone */
      }
    },
    reset: async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        }
      } catch {
        /* nothing to clear */
      }
      // Past the HTTP cache as well, so the reload cannot land on the old copy.
      window.location.replace(`${BASE}?v=${Date.now()}${window.location.hash}`);
    },
  };
}
