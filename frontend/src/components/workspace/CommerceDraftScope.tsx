import { useContext, useSyncExternalStore, type ReactNode } from 'react';
import { CommerceDraftContext, useScopedDraftStore } from './commerceDraftState';
export function CommerceDraftScope({ clubId, feature, children }: { clubId: number; feature: string; children: ReactNode }) {
    const {key, store} = useScopedDraftStore(clubId, feature);
    return <CommerceDraftContext.Provider key={key} value={store}>{children}</CommerceDraftContext.Provider>;
}
export function CommerceDraftNotice() {
    const store = useContext(CommerceDraftContext);
    const active = useSyncExternalStore(store?.subscribe ?? (() => () => {}), () => Boolean(store?.values.get('editing') || store?.values.get('updates')));
    return active ? <p role="status" className="text-sm">Your unfinished work stays here when you switch pages. Save it before closing or reloading the app.</p> : null;
}
