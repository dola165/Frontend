import { useEffect, useState } from 'react';
import { ALTERNATIVES, MIXES, layoutFor, type AltId, type MixId } from './model';
import { Phone } from './Phone';

const read = () => new URLSearchParams(window.location.search);
const pick = <T extends string>(value: string | null, options: Record<T, unknown>, fallback: T): T => value && value in options ? value as T : fallback;

/**
 * F11, a decision for the owner: the phone tab bar for people with several roles. Today and three alternatives,
 * each a clickable 390px phone, for five role mixes. Everything lives in the address so a view can be shared.
 */
export function NavigationStudy() {
    const [state, setState] = useState(() => {
        const params = read();
        return {
            view: params.get('view') === 'alt' ? 'alt' as const : 'mix' as const,
            mix: pick<MixId>(params.get('mix'), MIXES, 'coach-parent'),
            alt: pick<AltId>(params.get('alt'), ALTERNATIVES, 'a'),
            ka: params.get('lang') === 'ka',
            light: params.get('theme') === 'light',
        };
    });
    useEffect(() => {
        const params = new URLSearchParams({ view: state.view, ...(state.view === 'mix' ? { mix: state.mix } : { alt: state.alt }), ...(state.ka ? { lang: 'ka' } : {}), ...(state.light ? { theme: 'light' } : {}) });
        window.history.replaceState(null, '', `?${params}`);
        document.documentElement.classList.toggle('dark', !state.light);
        document.documentElement.lang = state.ka ? 'ka' : 'en';
    }, [state]);
    const set = (patch: Partial<typeof state>) => setState(current => ({ ...current, ...patch }));
    const t = (en: string, ka: string) => state.ka ? ka : en;
    const frames = state.view === 'mix'
        ? (Object.keys(ALTERNATIVES) as AltId[]).map(alt => ({ key: alt, alt, mix: state.mix, title: ALTERNATIVES[alt][state.ka ? 'ka' : 'en'], note: ALTERNATIVES[alt].note[state.ka ? 'ka' : 'en'] }))
        : (Object.keys(MIXES) as MixId[]).map(mix => ({ key: mix, alt: state.alt, mix, title: MIXES[mix][state.ka ? 'ka' : 'en'], note: '' }));

    return (
        <div className="gk nav-study">
            <header className="nav-study__head">
                <h1>{t('Phone navigation for several roles', 'ტელეფონის ნავიგაცია რამდენიმე როლისთვის')} <small>F11 · {t('for the owner to choose', 'მფლობელის არჩევანისთვის')}</small></h1>
                <div className="nav-study__controls">
                    <div className="nav-seg" role="group" aria-label="View">
                        <button type="button" aria-pressed={state.view === 'mix'} onClick={() => set({ view: 'mix' })}>{t('Compare layouts', 'განლაგებების შედარება')}</button>
                        <button type="button" aria-pressed={state.view === 'alt'} onClick={() => set({ view: 'alt' })}>{t('One layout, every role', 'ერთი განლაგება, ყველა როლი')}</button>
                    </div>
                    {state.view === 'mix'
                        ? <div className="nav-seg" role="group" aria-label="Role mix">{(Object.keys(MIXES) as MixId[]).map(mix => <button key={mix} type="button" aria-pressed={state.mix === mix} onClick={() => set({ mix })}>{MIXES[mix][state.ka ? 'ka' : 'en']}<b>{layoutFor('today', MIXES[mix].person, false).tabs.length}</b></button>)}</div>
                        : <div className="nav-seg" role="group" aria-label="Layout">{(Object.keys(ALTERNATIVES) as AltId[]).map(alt => <button key={alt} type="button" aria-pressed={state.alt === alt} onClick={() => set({ alt })}>{ALTERNATIVES[alt][state.ka ? 'ka' : 'en']}</button>)}</div>}
                    <div className="nav-seg" role="group" aria-label="Language and theme">
                        <button type="button" aria-pressed={!state.ka} onClick={() => set({ ka: false })}>EN</button>
                        <button type="button" aria-pressed={state.ka} onClick={() => set({ ka: true })}>ქა</button>
                        <button type="button" aria-pressed={!state.light} onClick={() => set({ light: false })}>{t('Dark', 'მუქი')}</button>
                        <button type="button" aria-pressed={state.light} onClick={() => set({ light: true })}>{t('Light', 'ღია')}</button>
                    </div>
                </div>
            </header>
            {state.view === 'alt' && <p className="nav-study__note">{ALTERNATIVES[state.alt].note[state.ka ? 'ka' : 'en']}</p>}
            <div className="nav-study__frames">
                {frames.map(frame => <figure key={frame.key} className="nav-study__frame">
                    <figcaption><strong>{frame.title}</strong><span>{layoutFor(frame.alt, MIXES[frame.mix].person, false).tabs.length} {t('tabs', 'ჩანართი')}</span>{frame.note && <p>{frame.note}</p>}</figcaption>
                    <Phone key={`${frame.alt}-${frame.mix}-${state.ka}`} alt={frame.alt} person={MIXES[frame.mix].person} ka={state.ka} />
                </figure>)}
            </div>
        </div>
    );
}
