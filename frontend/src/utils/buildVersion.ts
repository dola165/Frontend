/** The build this tab runs, written in at build time (vite.config.ts); missing while developing and in tests. */
declare const __BUILD_ID__: string | undefined;

const KEY = 'gk-build';
const RELOADED = 'gk-build-reloaded';
/** Asking the server which build it serves happens at most this often. */
export const BUILD_CHECK_MS = 3 * 60_000;
/** A tab reloads for a new build at most this often, so two builds served side by side can never loop it. */
const RELOAD_GAP_MS = 5 * 60_000;

let remembered: string | null = null;
let lastCheck = 0;

/** The page's own reload, kept apart so tests can watch it. */
export const page = { reload: () => window.location.reload() };

export const runningBuild = () => (typeof __BUILD_ID__ === 'string' && __BUILD_ID__ ? __BUILD_ID__ : null);

const read = () => { try { return localStorage.getItem(KEY) ?? remembered; } catch { return remembered; } };
const write = (id: string) => { remembered = id; try { localStorage.setItem(KEY, id); } catch { /* private mode: this tab still knows */ } };

/** A tab that starts tells the site's other tabs which build is served now. */
export function announceBuild() {
    const id = runningBuild();
    if (id) write(id);
}

/** The site is known to serve another build than this tab runs (learned by this tab, or by a newer tab starting). */
export function staleBuild() {
    const id = runningBuild();
    const served = read();
    return Boolean(id && served && served !== id);
}

/** Asks the server which build it serves, at most every few minutes; resolves to whether this tab is out of date. */
export async function checkBuild(now = Date.now()) {
    if (!runningBuild() || now - lastCheck < BUILD_CHECK_MS) return staleBuild();
    lastCheck = now;
    try {
        const response = await fetch(`/build.json?t=${now}`, { cache: 'no-store' });
        const served = response.ok ? (await response.json() as { id?: unknown }).id : null;
        if (typeof served === 'string' && served) write(served);
    } catch { /* offline or not deployed: asked again later */ }
    return staleBuild();
}

/**
 * Loads the build the site serves now, in place. Drafts already saved in the browser survive a reload. Resolves to
 * false when this tab reloaded for a build only minutes ago, so it carries on instead.
 */
export function reloadForBuild() {
    const now = Date.now();
    try {
        const last = Number(sessionStorage.getItem(RELOADED));
        if (last && now - last < RELOAD_GAP_MS) return false;
        sessionStorage.setItem(RELOADED, String(now));
    } catch { /* without session storage, reload anyway */ }
    page.reload();
    return true;
}

/** For tests: forget what this module learned. */
export function resetBuildKnowledge() { remembered = null; lastCheck = 0; }
