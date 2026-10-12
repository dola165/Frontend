import { useWorldCopy } from '../copy';

/** A step's reason it did not send, with Reload when the thing changed under it. */
export function SendError({ error, changed, reload }: { error: string; changed: boolean; reload: () => void }) {
    const t = useWorldCopy();
    if (!error) return null;
    return <p className="gk-step__error" role="alert">{t(error)}{changed && <> <button type="button" className="gk-step__reload" onClick={reload}>{t('Reload')}</button></>}</p>;
}
