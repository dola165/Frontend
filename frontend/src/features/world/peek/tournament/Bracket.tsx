import type { CSSProperties } from 'react';
import { Star } from 'lucide-react';
import type { TournamentDetail } from '../../../tournaments/domain';
import type { CupRound, Tie, TieSide } from '../../../tournaments/shape/shapeOf';
import { useWorldCopy } from '../../copy';
import { Crest } from '../../Crest';
import { fixtureDay, fixtureTime } from '../../format';
import { zoned } from '../../scoreboard/standings';
import { entryById, fixtureMatch, sideName } from './tournamentPane';

/**
 * A cup as its rounds side by side, each an ordered list of ties: the two sides with their crests and the score over
 * the tie, the side that went through in bold, mine starred. Each tie that is a match opens it (stacked over the pane);
 * a bye just says so. Later rounds sit between the ties that feed them.
 */
export function Bracket({ rounds, detail, mine, label, open }: {
    rounds: CupRound[]; detail: TournamentDetail; mine: Set<number>; label: string; open: (value: string) => void;
}) {
    const t = useWorldCopy();
    return (
        <div className="gk-bracket" role="group" aria-label={label} style={{ '--rounds': rounds.length } as CSSProperties}>
            {rounds.map(round => (
                <section key={round.round} className="gk-bracket__round" aria-label={t(round.name, { n: round.round })}>
                    <h4>{t(round.name, { n: round.round })}</h4>
                    <ol>{round.ties.map(tie => <li key={tie.id}><TieCard tie={tie} detail={detail} mine={mine} open={open} /></li>)}</ol>
                </section>
            ))}
        </div>
    );
}

function TieCard({ tie, detail, mine, open }: { tie: Tie; detail: TournamentDetail; mine: Set<number>; open: (value: string) => void }) {
    const t = useWorldCopy();
    const last = tie.fixtures[tie.fixtures.length - 1];
    const label = (side: TieSide, fallback: string | null) => sideName(entryById(detail, side.entryId), fallback) ?? (tie.state === 'bye' ? t('Bye') : t('To be decided'));
    const side = (which: 'home' | 'away') => {
        const value = tie[which], entry = entryById(detail, value.entryId), name = label(value, which === 'home' ? tie.fixtures[0].homeLabel : tie.fixtures[0].awayLabel);
        return (
            <span className="gk-tie__side" data-won={value.won || undefined} data-tbd={value.entryId == null || undefined} data-mine={(value.entryId != null && mine.has(value.entryId)) || undefined}>
                <Crest name={name} size={16} round />
                {value.entryId != null && mine.has(value.entryId) && <Star className="gk-tie__mine" role="img" aria-label={t('Your team')} />}
                <span className="gk-tie__name">{name}{entry?.squadName && <small>{entry.squadName}</small>}</span>
                <b>{value.score ?? ''}</b>
            </span>
        );
    };
    const when = tie.state === 'next' ? (tie.scheduledAt ? `${fixtureDay(zoned(tie.scheduledAt))} ${fixtureTime(zoned(tie.scheduledAt))}` : t('Date to confirm'))
        : tie.state === 'level' ? t('Level · winner to confirm') : tie.state === 'bye' ? t('Through without playing') : null;
    const body = <>{side('home')}{side('away')}{when && <small className="gk-tie__when">{when}</small>}</>;
    if (tie.state === 'bye') return <div className="gk-tie" data-state="bye">{body}</div>;
    return <button type="button" className="gk-tie" data-state={tie.state} onClick={() => open(`match-${fixtureMatch(detail, last).code}`)}>{body}</button>;
}
