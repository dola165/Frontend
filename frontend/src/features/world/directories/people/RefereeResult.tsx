import { MapPin, Send } from 'lucide-react';
import { useWorldCopy } from '../../copy';
import { ResultRow } from '../../directory/ResultRow';
import { peekOf, usePeek } from '../../peek/usePeek';
import { RefereeMark } from './marks';
import { Face, MessageLink, Price } from './PersonResult';
import { kmLabel } from './personData';
import { formatsOf, shortFormat, type RefereeItem } from './refereeData';
import './people.css';

const TILES = ['5_A_SIDE', '7_A_SIDE', '9_A_SIDE', '11_A_SIDE', 'FUTSAL'];

/**
 * A referee as a row: their face (ringed while they take matches), their name with their level as they state it after
 * it, the formats they take (the chosen match's ringed), where they are, how far and how far they travel, Volunteers in
 * green; their fee per match, and Invite when a match is chosen (else Message). A press shows them beside the list.
 */
export function RefereeResult({ item }: { item: RefereeItem }) {
    const t = useWorldCopy();
    const drawers = usePeek();
    const { referee, city, km, match } = item;
    const taken = formatsOf(referee);
    const takes = Boolean(referee.accepts_paid || referee.accepts_volunteer);
    const peek = peekOf('person', referee.user_id);
    const distance = kmLabel(km, true);
    const where = [city, distance && (match ? t('{km} from the ground', { km: distance }) : distance)].filter(Boolean).join(' · ');
    // Inviting is for a chosen match its staff can arrange, and a referee who takes its format at all.
    const invite = match && match.can_arrange_official !== false && takes && match.format && taken.includes(match.format);
    return (
        <ResultRow lead={<Face name={referee.full_name} open={takes} />} title={referee.full_name} to={`/referees/${referee.user_id}`} peek={peek}
            mark={<RefereeMark qualifications={referee.qualifications} />}
            lines={[
                <>
                    <span className="gk-format-tiles" role="list" aria-label={t('Formats: {list}', { list: taken.map(shortFormat).join(', ') })}>
                        {TILES.map(code => <span key={code} role="listitem" aria-hidden="true" data-on={taken.includes(code) || undefined} data-match={match?.format === code || undefined}>{code === 'FUTSAL' ? 'F' : code.split('_')[0]}</span>)}
                    </span>
                    {referee.travel_km > 0 && <span className="gk-faint">{t('travels up to {km} km', { km: referee.travel_km })}</span>}
                </>,
                where && <span className="gk-result__where"><MapPin aria-hidden="true" />{where}</span>,
                !takes ? t('Not taking matches') : referee.accepts_volunteer && <span className="gk-result-open">{referee.accepts_paid ? t('Volunteers, or paid') : t('Volunteers')}</span>,
            ]}
            aside={referee.accepts_paid ? <Price amount={referee.fee} currency={referee.currency} per={t('per match')} /> : undefined}
            action={invite
                ? <button type="button" className="gk-people-act" data-primary onClick={() => drawers.open(peek, { focus: true })} aria-label={t('Invite {name}', { name: referee.full_name })}><Send aria-hidden="true" />{t('Invite')}</button>
                : takes ? <MessageLink id={referee.user_id} name={referee.full_name} /> : undefined} />
    );
}
