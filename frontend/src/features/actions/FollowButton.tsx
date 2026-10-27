import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Loader2, Plus } from 'lucide-react';
import { Button, ButtonLink } from '../../design/primitives';
import { buildLoginRedirectPath } from '../../utils/authRedirect';
import { useAuth } from '../../context/AuthContext';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { setFollowing, type FollowSubject } from './follow';
import { useAction } from './useAction';
import './actions.css';

/**
 * Follow, or Following: one toggle for a club or a person, wherever they are shown (the club page, World's cards and
 * peeks, a profile, the clubs you follow). Shown only when the state is known and the rule-checker allows following;
 * the page's own copy of the state changes at once (`onChange`) and goes back if the server refuses.
 * `look="chip"` takes World's round chip (its `gk-people-act` style); otherwise it is a design-system button,
 * primary when not yet followed if `primary`.
 */
export function FollowButton({ subject, following, name, onChange, size = 'md', primary = false, look = 'button', className }: {
    subject: FollowSubject; following: boolean | undefined; name?: string; onChange: (following: boolean) => void;
    size?: 'md' | 'sm'; primary?: boolean; look?: 'button' | 'chip'; className?: string;
}) {
    const copy = useJourneyCopy();
    const { sessionId, status } = useAuth();
    const location = useLocation();
    const [busy, setBusy] = useState(false);
    // Following is asked of the person once (`me`), never per club row.
    const allowed = useAction('follow', subject.kind === 'person' ? { kind: 'person', id: subject.id } : { kind: 'me' });
    if (following === undefined) return null;
    // Signed out, Follow is the way in: sign in, and come back to the same page.
    if (status === 'anonymous') return <ButtonLink size={size} variant={primary ? 'primary' : 'secondary'} className={`gk-action${className ? ` ${className}` : ''}`}
        to={buildLoginRedirectPath(location.pathname, location.search, location.hash)}><Plus aria-hidden="true" />{copy('Follow', 'გამოწერა')}</ButtonLink>;
    if (!allowed.allowed) return null;
    const toggle = async () => {
        if (busy) return;
        const next = !following;
        setBusy(true);
        onChange(next);
        try { const settled = await setFollowing(subject, next, sessionId); if (settled !== next) onChange(settled); }
        catch { onChange(following); toast.error(copy('Following could not be updated.', 'გამოწერა ვერ განახლდა.')); }
        finally { setBusy(false); }
    };
    const icon = busy ? <Loader2 className="gk-spin" aria-hidden="true" /> : following ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />;
    const word = following ? copy('Following', 'გამოწერილია') : copy('Follow', 'გამოწერა');
    const label = name ? (following ? copy(`Following ${name}`, `${name}: გამოწერილია`) : copy(`Follow ${name}`, `${name}: გამოწერა`)) : undefined;
    if (look === 'chip') return <button type="button" className={`gk-people-act${className ? ` ${className}` : ''}`} data-on={following || undefined}
        aria-pressed={following} aria-label={label} disabled={busy || allowed.loading} onClick={() => void toggle()}>{icon}{word}</button>;
    return <Button size={size} variant={primary && !following ? 'primary' : 'secondary'} className={`gk-action${className ? ` ${className}` : ''}`}
        aria-pressed={following} aria-label={label} disabled={busy || allowed.loading} onClick={() => void toggle()}>{icon}{word}</Button>;
}
