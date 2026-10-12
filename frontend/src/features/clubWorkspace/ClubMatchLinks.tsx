import { CalendarCheck2, ClipboardList, Handshake, History, Trophy } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { List, ListRow, Panel, Section } from '../../design/primitives';
import { arrangePath } from '../world/compose/arrangeSeed';
import { useWorldCopy } from '../world/copy';
import './club-match-links.css';

/**
 * The club's own matches. Their lists live in World for now (PRODUCT_MODEL §13, 10 October);
 * the workspace links to them so club work is reachable from My Club. `filter` is the tool search.
 */
export function ClubMatchLinks({ filter = '' }: { filter?: string }) {
    const t = useWorldCopy();
    const { id } = useParams();
    const club = Number(id) > 0 ? `&clubId=${Number(id)}` : '';
    const needle = filter.trim().toLowerCase();
    const links = [
        { to: '/world/matches?tab=mine', icon: Handshake, label: 'My arrangements', meta: 'Friendlies you arranged or answered, and open matches you posted.' },
        { to: `/world/matches?period=NEEDS_RESULT${club}`, icon: ClipboardList, label: 'Matches that need a result', meta: 'Played matches still waiting for a score.' },
        { to: `/world/matches?period=HISTORY${club}`, icon: History, label: 'Results and past matches', meta: 'Every result, and adding a match played before GrassKickZ.' },
        { to: '/world/tournaments?tab=mine', icon: Trophy, label: 'My tournaments', meta: 'Tournaments the club plays in or runs, and invitations to answer.' },
        { to: arrangePath({ mode: 'direct' }), icon: CalendarCheck2, label: 'Arrange a match', meta: 'Set up a match with another club.' },
    ].filter(link => !needle || `${link.label} ${link.meta} ${t(link.label)} ${t(link.meta)} match`.toLowerCase().includes(needle));
    if (!links.length) return null;
    return (
        <Section title={t('Club matches')} hint={t('Arrangements, results and tournaments')}>
            <Panel flush>
                <List label={t('Club matches')}>
                    {links.map(link => <ListRow key={link.to} to={link.to} lead={<span className="gk-world-tool-icon"><link.icon aria-hidden="true" /></span>} title={t(link.label)} meta={t(link.meta)} />)}
                </List>
            </Panel>
        </Section>
    );
}
