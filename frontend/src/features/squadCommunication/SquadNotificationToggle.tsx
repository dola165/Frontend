import { useEffect, useRef, useState } from 'react';
import { setChatNotifications } from './api';
import { extractApiErrorMessage } from '../../utils/apiError';

/** One switch for a squad chat's notifications. `label` names it in the words of the page; `quiet` drops the status line under it. */
export function SquadNotificationToggle({id, enabled, onSaved, label = 'Squad chat notifications', quiet = false}: {id: number; enabled: boolean; onSaved: () => void; label?: string; quiet?: boolean}) {
    const [checked, setChecked] = useState(enabled);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const active = useRef(true);
    const saving = useRef(false);
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
    useEffect(() => { if (!saving.current) setChecked(enabled); }, [enabled]);
    return <div className="squad-notification-toggle" data-enabled={checked} aria-busy={busy}>
        <label className="squad-check"><input type="checkbox" role="switch" checked={checked} disabled={busy} onChange={async event => {
            if (saving.current) return;
            const previous = checked, next = event.target.checked;
            saving.current = true; setChecked(next); setBusy(true); setError('');
            try { await setChatNotifications(id, next); if (active.current) onSaved(); }
            catch (e) { if (active.current) { setChecked(previous); setError(extractApiErrorMessage(e, 'Your preference could not be saved. Please try again.')); } }
            finally { saving.current = false; if (active.current) setBusy(false); }
        }}/><span>{label}</span><b aria-hidden="true">{checked ? 'On' : 'Off'}</b></label>
        {!quiet && <span className="squad-preference-status" role="status">{busy ? 'Saving…' : error ? '' : checked ? 'Chat notifications are on' : 'Chat notifications are off'}</span>}
        {error && <p className="squad-error" role="alert">{error}</p>}
    </div>;
}
