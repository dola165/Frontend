import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { browsePersonalCompetitions } from '../../../competitions/api';
import { shared } from '../../cache';
import { useWorldCopy } from '../../copy';
import { CARRIED } from '../../directory/useDirectoryState';
import { useWorldData } from '../../useWorldData';
import { detailOf, organiserWork, tournamentInvitations } from './tournamentItem';
import '../../scoreboard/scoreboard.css';
import '../matches/matches.css';

/** The most of the tournaments I run whose detail is read to count the work waiting in them. */
const RUN = 8;

/**
 * What waits for me in tournaments, above This season, as one line to My tournaments: the invitations to answer and the
 * work waiting in the tournaments I run. Never a second list (the rows below show each); it follows what is done in a pane.
 */
export function WaitingLine() {
    const t = useWorldCopy();
    const { sessionId, status, user } = useAuth();
    const location = useLocation();
    const waiting = useWorldData(status === 'authenticated' && user ? `tournaments-waiting:${sessionId}` : null, async () => {
        const [invitations, personal] = await Promise.all([
            tournamentInvitations(sessionId),
            shared(`personal-competitions:${sessionId}`, () => browsePersonalCompetitions({ page: 0, size: 20 })).then(page => page.content),
        ]);
        const live = personal.filter(item => item.status === 'PLANNING' || item.status === 'ACTIVE').slice(0, RUN);
        const details = await Promise.all(live.map(item => detailOf(item.id).catch(() => null)));
        const run = details.filter(detail => detail?.staffAssignments.some(assignment => assignment.userId === user!.id && assignment.status === 'ACTIVE' && (assignment.role === 'ADMIN' || assignment.role === 'STAFF')));
        const work = run.flatMap(detail => organiserWork(detail!));
        const sum = (view: string) => work.filter(item => item.view === view).reduce((total, item) => total + item.count, 0);
        return { invitations, results: sum('schedule'), entries: sum('participants') };
    }, undefined, { follow: true });
    if (!waiting.data || (!waiting.data.invitations.length && !waiting.data.results && !waiting.data.entries)) return null;
    const { invitations, results, entries } = waiting.data;
    const kept = new URLSearchParams();
    new URLSearchParams(location.search).forEach((value, key) => { if (CARRIED.includes(key)) kept.set(key, value); });
    kept.set('tab', 'mine');
    const work = [entries ? (entries === 1 ? t('1 entry to decide') : t('{count} entries to decide', { count: entries })) : null,
        results ? (results === 1 ? t('1 result to add') : t('{count} results to add', { count: results })) : null].filter(Boolean).join(' · ');
    const answers = invitations.length === 1 ? t('1 invitation to answer') : invitations.length ? t('{count} invitations to answer', { count: invitations.length }) : null;
    return (
        <ul className="gk-needs-you" aria-label={t('Waiting for you')}>
            <li><Link to={{ search: `?${kept}` }} className="gk-sb__wait" data-tone="warning"><span>{t('Waiting for you')}</span><b>{[answers, work].filter(Boolean).join(' · ')}</b><ArrowRight aria-hidden="true" /></Link></li>
        </ul>
    );
}
