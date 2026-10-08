import { useEffect, useRef, useState } from 'react';
import { setChatNotifications } from './api';
import { extractApiErrorMessage } from '../../utils/apiError';

export function SquadNotificationToggle({id, enabled, onSaved}: {id: number; enabled: boolean; onSaved: () => void}) {
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
        }}/><span>Squad chat notifications</span><b aria-hidden="true">{checked ? 'On' : 'Off'}</b></label>
        <span className="squad-preference-status" role="status">{busy ? 'Saving…' : error ? '' : checked ? 'Chat notifications are on' : 'Chat notifications are off'}</span>
        {error && <p className="squad-error" role="alert">{error}</p>}
    </div>;
}
