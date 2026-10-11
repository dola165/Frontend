import { useId, type ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { ChoiceChips } from '../../../../design/ChoiceChips';
import { ButtonLink, EmptyNote } from '../../../../design/primitives';
import { buildLoginRedirectPath } from '../../../../utils/authRedirect';
import { useWorldCopy } from '../../copy';
import { ErrorNote } from '../../directory/DirectoryResults';
import type { WorldRole } from '../roles';
import { COACHING_ROLES, useSquadFocus, type SquadFocus } from './mySquads';
import './coach.css';

/**
 * Which of the coach's squads World is for: all of them, or one (`?for=`, kept in the URL). Chips for a few
 * squads, a select for a whole club's. Shown only to coaching roles with two or more squads.
 */
export function SquadSwitch({ role }: { role: WorldRole }) {
    const t = useWorldCopy();
    const id = useId();
    const { status, squads } = useSquadFocus(role);
    const [params, setParams] = useSearchParams();
    if (!COACHING_ROLES.has(role) || status !== 'ready' || squads.length < 2) return null;
    const value = squads.some(squad => String(squad.id) === params.get('for')) ? params.get('for')! : '';
    const choose = (next: string) => setParams(current => {
        const updated = new URLSearchParams(current);
        if (next) updated.set('for', next); else updated.delete('for');
        return updated;
    }, { replace: true, preventScrollReset: true });
    if (squads.length > 4) return (
        <label className="gk-world-area" htmlFor={id}>
            <span className="gk-faint">{t('For')}</span>
            <select id={id} className="gk-input" value={value} onChange={event => choose(event.target.value)}>
                <option value="">{t('All squads')}</option>
                {squads.map(squad => <option key={squad.id} value={squad.id}>{squad.name}</option>)}
            </select>
        </label>
    );
    return (
        <div className="gk-squad-switch">
            <span className="gk-faint" id={id}>{t('For')}</span>
            <ChoiceChips labelledBy={id} value={value} onChange={choose}
                choices={[{ value: '', label: t('All squads') }, ...squads.map(squad => ({ value: String(squad.id), label: squad.name }))]} />
        </div>
    );
}

/**
 * What a squad field shows before it has squads to follow: a way to sign in, a way to get a squad, or the error.
 * Renders its children once the squads are known.
 */
export function SquadGate({ focus, children }: { focus: SquadFocus; children: ReactNode }) {
    const t = useWorldCopy();
    const location = useLocation();
    if (focus.status === 'error') return <ErrorNote message={focus.error} onRetry={focus.retry} />;
    if (focus.status === 'signed-out') return <EmptyNote title={t('Sign in to follow your squads')} action={<ButtonLink size="sm" to={buildLoginRedirectPath(location.pathname, location.search)}>{t('Sign in')}</ButtonLink>} />;
    if (focus.status === 'none') return <EmptyNote title={t('This follows the squads you coach')} action={<ButtonLink size="sm" to="/my-squads?tab=coaches">{t('Ask for a squad')}</ButtonLink>} />;
    return <>{children}</>;
}
