import { ButtonLink } from '../../../../design/primitives';
import { Status } from '../../../../design/DataTable';
import { FormatGlyph } from '../../../tournaments/shape/FormatGlyph';
import { plannedShape } from '../../../tournaments/shape/shapeOf';
import { useWorldCopy } from '../../copy';
import { DateLead, ResultRow } from '../../directory/ResultRow';
import { dateColumn } from '../../format';
import { peekOf } from '../../peek/usePeek';
import { feeLabel, placesLabel, tournamentFact, whatLabel, type TournamentItem } from './tournamentItem';
import './tournaments.css';

/**
 * A tournament as one row: its first day where a crest would be, its name (to its page), its format as a small picture
 * with what it is (age, players per side, who enters), who runs it where with the places taken and the fee, and one
 * fact. A press shows it beside the list.
 */
export function TournamentRow({ item }: { item: TournamentItem }) {
    const t = useWorldCopy();
    const date = dateColumn(item.start);
    const shape = plannedShape(item.rules, item.entryCap, item.entryCount);
    // An invitation's row shows its Answer button, so its fact is the tournament's own (when entries close).
    const fact = tournamentFact(item.invitation ? { ...item, invitation: undefined } : item);
    const what = [shape && t(shape.word), ...whatLabel(item)].filter(Boolean).join(' · ');
    const invited = item.invitation && (item.invitation.squadName || item.invitation.clubName || t('you'));
    return (
        <ResultRow lead={<DateLead top={date.time} bottom={date.day} />} title={item.name} to={`/tournaments/${item.id}`} peek={peekOf('tournament', item.id)}
            lines={[
                what && <>
                    {shape && <span className="gk-trow__glyph" data-finished={item.status === 'COMPLETED' || item.status === 'CANCELLED' || undefined}><FormatGlyph kind={shape.kind} /></span>}
                    <span className="gk-trow__text">{what}</span>
                </>,
                [invited ? t('Invites {team}', { team: invited }) : null, item.organizer, item.rules?.city, placesLabel(item), feeLabel(item.rules)].filter(Boolean).join(' · '),
            ]}
            aside={<Status tone={fact.tone}>{fact.label}</Status>}
            // Answering moves into the tournament's pane with Phase E's third step; until then it is answered in Requests.
            action={item.invitation ? <ButtonLink size="sm" variant="primary" to="/requests">{t('Answer')}</ButtonLink> : undefined} />
    );
}
