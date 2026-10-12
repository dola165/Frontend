import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { getMatchHistory } from '../../../matchHistory/api';
import { notifyWorldChanged, shared, detached } from '../../cache';
import { useWorldCopy } from '../../copy';
import type { NavProps } from '../../directory/types';
import { COACHING_ROLES } from '../../front/coach/mySquads';
import { useWorldRole } from '../../front/useOverviewLayout';
import { peekClick, peekOf, usePeek } from '../../peek/usePeek';
import { useWorldData } from '../../useWorldData';
import { loadMyArrangements } from './arrangements';
import { PastMatchTool } from './PastMatchTool';
import '../../scoreboard/scoreboard.css';
import './matches.css';

/**
 * What needs a coach above their fixtures: up to three of their arrangements waiting for their answer (a reply, a choice
 * of offers; each a dot, its words and an arrow, opening the match), and how many results they may add are still owed.
 * It follows what is done in a drawer.
 */
export function NeedsYouLine({ go }: Pick<NavProps, 'go'>) {
    const t = useWorldCopy();
    const { sessionId } = useAuth();
    const drawers = usePeek();
    const role = useWorldRole();
    const coaching = COACHING_ROLES.has(role);
    const needs = useWorldData(coaching ? `needs-you:${sessionId}` : null, async () => {
        const [arrangements, owed] = await Promise.all([
            loadMyArrangements(sessionId, ''),
            shared(`history:${sessionId}:needs-result`, () => getMatchHistory('period=NEEDS_RESULT&mine=true&size=100', detached(), sessionId)),
        ]);
        // Results are counted once, and only those the person may add (the rest wait on someone else).
        const addable = owed.items.filter(m => m.canRecordResult).length;
        return { items: arrangements.filter(a => a.lane === 'needs' && a.wait?.ask).slice(0, 3), owed: addable, more: addable > 0 && owed.total > owed.items.length };
    }, undefined, { follow: true });
    if (!coaching || !needs.data || (!needs.data.items.length && !needs.data.owed)) return null;
    const { items, owed, more } = needs.data;
    return (
        <ul className="gk-needs-you" aria-label={t('Needs you')}>
            {items.map(a => (
                <li key={a.code}>
                    <Link to={`/match-exchange/${a.m.event_id}`} onClick={peekClick(peekOf('match', a.code), drawers.open)} className="gk-sb__wait" data-tone={a.wait?.tone}>
                        <span>{[a.m.club_name, a.m.opponent_name].filter(Boolean).join(` ${t('v')} `)} · {a.m.squad_name}</span>
                        <b>{a.wait && t(a.wait.word, a.wait.vars)}</b><ArrowRight aria-hidden="true" />
                    </Link>
                </li>
            ))}
            {owed > 0 && <li>
                <button type="button" className="gk-sb__wait" data-tone="warning" onClick={() => go({ period: ['NEEDS_RESULT'], day: [] })}>
                    <b>{owed === 1 && !more ? t('1 result to add') : t('{count} results to add', { count: `${owed}${more ? '+' : ''}` })}</b><ArrowRight aria-hidden="true" />
                </button>
            </li>}
        </ul>
    );
}

/** Above fixtures: what needs a coach, and adding a past match (which every list on the page then shows). */
export function FixtureTools(props: NavProps & { refresh: () => void }) {
    return <><NeedsYouLine go={props.go} /><PastMatchTool {...props} onSaved={() => notifyWorldChanged(['matchday:', 'history:'])} /></>;
}
