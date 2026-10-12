import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Button, EmptyNote } from '../../../design/primitives';
import { Status } from '../../../design/DataTable';
import { fetchHostTournaments, fetchTournamentHost } from '../../tournaments/api';
import { shared } from '../cache';
import { plural, useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { fromSummary, tournamentFact } from '../directories/tournaments/tournamentItem';
import { dateColumn } from '../format';
import { DateLead } from '../directory/ResultRow';
import { zoned } from '../scoreboard/standings';
import { useWorldData } from '../useWorldData';
import { DrawerFrame, DrawerLoading } from './DrawerFrame';
import { FollowHost } from './tournament/FollowHost';
import { peekClick, peekOf, usePeek } from './usePeek';
import './peek.css';
import './pane.css';
import './tournament/tournament-pane.css';

/** `club.3` or `org.801` as the organiser it names. */
const parse = (id: string) => {
    const [kind, value] = id.split('.');
    const number = Number(value);
    return (kind === 'club' || kind === 'org') && Number.isInteger(number) && number > 0 ? { kind: kind === 'club' ? 'CLUB' as const : 'ORGANIZATION' as const, id: number } : null;
};

/**
 * Who runs a tournament (`organiser-club.3`, `organiser-org.801`): their crest and name, a club or an organisation and
 * how many tournaments, Follow, and their tournaments, each opening beside the list; their own page one link away.
 */
export default function OrganiserPeek({ id }: { id: string }) {
    const t = useWorldCopy();
    const drawers = usePeek();
    const who = parse(id);
    const data = useWorldData(who ? `organiser:${who.kind}:${who.id}` : null, async signal => {
        const [host, tournaments] = await Promise.all([
            shared(`tournament-host:${who!.kind}:${who!.id}`, () => fetchTournamentHost(who!.kind, who!.id)),
            fetchHostTournaments({ kind: who!.kind, id: who!.id, page: 0, size: 12 }, signal),
        ]);
        return { host, tournaments };
    }, t('This organiser could not load.'));
    if (data.loading) return <DrawerFrame title={t('Loading…')}><DrawerLoading /></DrawerFrame>;
    if (!data.data || !who) return (
        <DrawerFrame title={t('Organiser')}>
            <EmptyNote title={data.error || t('This organiser could not load.')} action={who ? <Button size="sm" onClick={data.retry}>{t('Try again')}</Button> : undefined} />
        </DrawerFrame>
    );
    const { host, tournaments } = data.data;
    const page = who.kind === 'CLUB' ? { to: `/clubs/${who.id}`, label: t('Club page') } : { to: `/organizations/${who.id}`, label: t('Organisation page') };
    return (
        <DrawerFrame title={host.name} page={page}>
            <div className="gk-pane-top">
                <div className="gk-pane-cover" />
                <header className="gk-pane-head">
                    <Crest src={host.logoUrl} name={host.name} size={64} />
                    <div>
                        <h3>{host.name}</h3>
                        <p>{[who.kind === 'CLUB' ? t('Club') : t('Organisation'), plural(host.tournamentCount, 'tournament')].join(' · ')}</p>
                    </div>
                </header>
                <div className="gk-tpane-actions"><FollowHost host={host} /></div>
                <section className="gk-pane-section">
                    <header>
                        <h3 className="gk-peek-section__title">{t('Their tournaments')}</h3>
                        <Link className="gk-pane-more" to={`/world/tournaments?tab=all&host=${who.kind}:${who.id}`}>{t('Show in All tournaments')}<ChevronRight aria-hidden="true" /></Link>
                    </header>
                    {tournaments.content.length ? <ul className="gk-tpane-hosted">{tournaments.content.map(summary => {
                        const date = dateColumn(zoned(summary.startDate)), fact = tournamentFact(fromSummary(summary, null));
                        return (
                            <li key={summary.id}>
                                <Link to={`/tournaments/${summary.id}`} onClick={peekClick(peekOf('tournament', summary.id), drawers.open)}>
                                    <DateLead top={date.time} bottom={date.day} /><span>{summary.name}</span><Status tone={fact.tone}>{fact.label}</Status>
                                </Link>
                            </li>
                        );
                    })}</ul> : <p className="gk-faint">{t('No tournaments published yet')}</p>}
                </section>
            </div>
        </DrawerFrame>
    );
}
