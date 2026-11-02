import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Loader2, Plus } from 'lucide-react';
import { Button, ButtonLink } from '../../design/primitives';
import { buildLoginRedirectPath } from '../../utils/authRedirect';
import { useAuth } from '../../context/AuthContext';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { FOLLOW_SETTLED, setFollowing, type FollowSettled, type FollowSubject } from './follow';
import { DO_PARAM, withoutAction } from './registry';
import { useAction } from './useAction';
import './actions.css';

/**
 * Follow, or Following: one toggle for a club or a person, wherever they are shown (the club page, World's cards and
 * peeks, a profile, the clubs you follow). Shown only when the state is known and the rule-checker allows following;
 * the page's own copy of the state changes at once (`onChange`) and goes back if the server refuses.
 * `look="chip"` takes World's round chip (its `gk-people-act` style); `look="plain"` is a bare button styled by its
 * host's `className` (a post on Home, outside the design system); otherwise it is a design-system button, primary when
 * not yet followed if `primary`.
 */
export function FollowButton({ subject, following, name, onChange, size = 'md', primary = false, look = 'button', className }: {
    subject: FollowSubject; following: boolean | undefined; name?: string; onChange: (following: boolean) => void;
    size?: 'md' | 'sm'; primary?: boolean; look?: 'button' | 'chip' | 'plain'; className?: string;
}) {
    const copy = useJourneyCopy();
    const { sessionId, status } = useAuth();
    const location = useLocation();
    const [busy, setBusy] = useState(false);
    // Following is asked of the person once (`me`), never per club row.
    const allowed = useAction('follow', subject.kind === 'person' ? { kind: 'person', id: subject.id } : { kind: 'me' });
    // A follow settled elsewhere (another button for the same club, a follow carried through sign-in) shows here too.
    const current = useRef({ following, onChange });
    current.current = { following, onChange };
    useEffect(() => {
        const settled = (event: Event) => {
            const { subject: other, following: value } = (event as CustomEvent<FollowSettled>).detail;
            if (other.kind === subject.kind && other.id === subject.id && current.current.following !== undefined && current.current.following !== value) current.current.onChange(value);
        };
        window.addEventListener(FOLLOW_SETTLED, settled);
        return () => window.removeEventListener(FOLLOW_SETTLED, settled);
    }, [subject.kind, subject.id]);
    if (following === undefined) return null;
    // Signed out, Follow is the way in: sign in, and come back to the same page with the club followed (ActionHost
    // does it on return). A person's follow is a toggle, so it is left for them to tap again.
    const carried = new URLSearchParams(withoutAction(location.search));
    if (subject.kind === 'club') { carried.set(DO_PARAM, 'follow'); carried.set('do-club', String(subject.id)); }
    const signIn = buildLoginRedirectPath(location.pathname, carried.toString() ? `?${carried}` : '', location.hash);
    if (status === 'anonymous') return look === 'plain'
        ? <Link className={className} to={signIn}><Plus aria-hidden="true" />{copy('Follow', 'გამოწერა')}</Link>
        : <ButtonLink size={size} variant={primary ? 'primary' : 'secondary'} className={`gk-action${className ? ` ${className}` : ''}`}
            to={signIn}><Plus aria-hidden="true" />{copy('Follow', 'გამოწერა')}</ButtonLink>;
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
    if (look !== 'button') return <button type="button" className={look === 'chip' ? `gk-people-act${className ? ` ${className}` : ''}` : className} data-on={following || undefined}
        aria-pressed={following} aria-label={label} disabled={busy || allowed.loading} onClick={() => void toggle()}>{icon}{word}</button>;
    return <Button size={size} variant={primary && !following ? 'primary' : 'secondary'} className={`gk-action${className ? ` ${className}` : ''}`}
        aria-pressed={following} aria-label={label} disabled={busy || allowed.loading} onClick={() => void toggle()}>{icon}{word}</Button>;
}
