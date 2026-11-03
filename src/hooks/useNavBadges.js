import { useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { systemService } from '../services/systemService';

/**
 * Menu badge counts shared by the sidebar and the bottom bar: one poll for the whole app,
 * refreshed on navigation, when the tab regains focus, and on `refreshNavBadges()`.
 */
const POLL_MS = 30000;
const EMPTY = { unreadChats: 0, artisanProjects: 0 };

let state = EMPTY;
let timer = null;
let inFlight = null;
const listeners = new Set();

const emit = () => listeners.forEach((l) => l());

async function load() {
  if (inFlight) return inFlight;
  inFlight = systemService
    .getNavBadges()
    .then((data) => {
      const next = {
        unreadChats: Math.max(0, Number(data?.unreadChats) || 0),
        artisanProjects: Math.max(0, Number(data?.artisanProjects) || 0),
      };
      if (next.unreadChats !== state.unreadChats || next.artisanProjects !== state.artisanProjects) {
        state = next;
        emit();
      }
    })
    .catch(() => {
      // Badges are best-effort; keep the last known counts.
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

const onVisible = () => {
  if (document.visibilityState === 'visible') load();
};

function subscribe(listener) {
  listeners.add(listener);
  if (listeners.size === 1) {
    load();
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = null;
      document.removeEventListener('visibilitychange', onVisible);
    }
  };
}

/** Call after something changes a count (e.g. a chat was read, a project was posted). */
export function refreshNavBadges() {
  load();
}

export function useNavBadges() {
  const location = useLocation();
  const badges = useSyncExternalStore(subscribe, () => state, () => EMPTY);
  useEffect(() => {
    load();
  }, [location.pathname]);
  return badges;
}

/** "9", "99+" etc. Returns null when there is nothing to show. */
export function badgeLabel(count) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  return n > 99 ? '99+' : String(n);
}
