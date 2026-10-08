import { useLayoutEffect } from 'react';

/** Public identity pages and Home keep their approved presentation, including portals. */
export function productSurface(pathname: string): string | undefined {
    const path = pathname.replace(/\/+$/, '') || '/';
    if (['/home', '/feed'].includes(path) || /^\/(clubs|organizations)\/\d+$/.test(path)) return undefined;
    if (path === '/') return 'landing';
    if (/^\/(login|signup|forgot-password|reset-password|verify-email|consent|onboarding|dob|set-password|oauth2\/callback)$/.test(path)) return 'identity';
    if (/^\/(map|world)$/.test(path)) return 'map';
    if (/^\/(store|campaigns|jobs|roles|stadiums)(\/|$)/.test(path) || /^\/clubs\/\d+\/(store|campaigns)$/.test(path)) return 'opportunities';
    if (/^\/(matches|match-exchange|match-history)(\/|$)/.test(path)) return 'matches';
    if (/^\/(tournaments|tournament-series)(\/|$)/.test(path)) return 'competitions';
    if (/^\/(profile|agents|referees)(\/|$)/.test(path)) return 'people';
    if (/^\/(account|notifications|reports|requests)(\/|$)/.test(path)) return 'account';
    if (/^\/(events|tryouts|people|clubs)(\/|$)/.test(path) && !/\/(workspace|operations|squads|profile-settings)$/.test(path)) return 'discovery';
    return 'work';
}

/** One document scope also reaches menus, toasts and dialogs portalled to body. */
export function useProductDesign(pathname: string) {
    const surface = productSurface(pathname);
    useLayoutEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('product-design-active', Boolean(surface));
        if (!surface) return;
        root.dataset.productSurface = surface;
        const active = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
        let composing = false;
        const clear = (element: HTMLElement) => {
            clearTimeout(active.get(element));
            active.delete(element);
            delete element.dataset.inputActive;
        };
        const onInput = (event: Event) => {
            const element = event.target;
            if (composing || !(element instanceof HTMLElement) || !element.matches('textarea, input:not([type=checkbox],[type=radio],[type=range],[type=file],[type=color],[type=button],[type=submit]), [contenteditable=true]')) return;
            // Only presentation changes: never inspect or buffer the entered value.
            clearTimeout(active.get(element));
            element.dataset.inputActive = 'true';
            active.set(element, setTimeout(() => clear(element), 160));
        };
        const onCompositionStart = () => { composing = true; active.forEach((_, element) => clear(element)); };
        const onCompositionEnd = () => { composing = false; };
        document.addEventListener('input', onInput);
        document.addEventListener('compositionstart', onCompositionStart);
        document.addEventListener('compositionend', onCompositionEnd);
        return () => {
            active.forEach((_, element) => clear(element));
            document.removeEventListener('input', onInput);
            document.removeEventListener('compositionstart', onCompositionStart);
            document.removeEventListener('compositionend', onCompositionEnd);
            root.classList.remove('product-design-active');
            delete root.dataset.productSurface;
        };
    }, [surface]);
    return surface;
}
