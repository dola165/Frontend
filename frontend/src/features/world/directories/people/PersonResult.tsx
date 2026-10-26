import { Link } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import { Check, MapPin, MessageCircle, Plus } from 'lucide-react';
import { useWorldCopy } from '../../copy';
import { Crest } from '../../Crest';
import { ResultRow } from '../../directory/ResultRow';
import { peekOf } from '../../peek/usePeek';
import { useFollow } from './following';
import { LicenceMark, PositionMark, ServiceMark } from './marks';
import type { PersonItem } from './peopleData';
import { openToWords } from './peopleWords';
import { jobOf, personWhere, playerLine, type PersonKind } from './personData';
import '../../peek/peek.css';

/** Follow, shown only when whether they are followed is known (it is a toggle on the server). */
export function FollowButton({ id, name }: { id: number; name: string }) {
    const t = useWorldCopy();
    const { following, toggle } = useFollow(id);
    if (following === undefined) return null;
    return (
        <button type="button" className="gk-people-act" data-on={following || undefined} aria-pressed={following} aria-label={following ? t('Following {name}', { name }) : t('Follow {name}', { name })}
            onClick={() => { void toggle().catch(() => undefined); }}>
            {following ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}{following ? t('Following') : t('Follow')}
        </button>
    );
}

export function MessageLink({ id, name, primary }: { id: number; name: string; /** The row's main action (they take clients). */ primary?: boolean }) {
    const t = useWorldCopy();
    const { user } = useAuth();
    if (user?.id === id) return <Link className="gk-people-act" to="/account/football">{t('Your football')}</Link>;
    return <Link className="gk-people-act" data-primary={primary || undefined} to={`/messages?chatWith=${id}`} aria-label={t('Message {name}', { name })}><MessageCircle aria-hidden="true" />{t('Message')}</Link>;
}

/** A face, ringed in green while the person is open to something. */
export const Face = ({ src, name, open, size = 40 }: { src?: string | null; name: string; open: boolean; size?: number }) =>
    <span className="gk-result-face" data-open={open || undefined}><Crest src={src} name={name} size={size} round /></span>;

/** A price for a session: the amount bright, "per session" quiet under it. */
export function Price({ amount, currency, per }: { amount: number; currency: string; per: string }) {
    return <><span className="gk-result-price">{`${amount} ${currency}`}</span><small>{per}</small></>;
}

/**
 * A coach, specialist or player as a row, as every World list reads: their face, their name with their mark after it
 * (a position, a licence, a service), what they do, their club and how far, what they are open to; their price for a
 * session when they offer one, and one action (Message when they take clients, else Follow). A press shows them beside the list.
 */
export function PersonResult({ item: person, kind }: { item: PersonItem; kind: PersonKind }) {
    const t = useWorldCopy();
    const open = openToWords(kind, person.openTo);
    const mark = kind === 'staff' ? <LicenceMark licence={person.licence} /> : kind === 'specialist' ? <ServiceMark profession={person.profession} /> : <PositionMark position={person.position} />;
    const club = person.clubName ?? (person.clubId === null ? (kind === 'player' ? t('No club') : t('Independent')) : null);
    const where = personWhere(person);
    const sells = Boolean(person.rate && person.openTo?.includes('SERVICES'));
    return (
        <ResultRow lead={<Face src={person.avatarUrl} name={person.fullName} open={open.length > 0} />}
            title={person.fullName} to={`/profile/${person.id}`} peek={peekOf('person', person.id)} mark={mark}
            lines={[
                kind === 'player' ? playerLine(person) : jobOf(person),
                (club || where) && <><span>{club}</span>{club && where && <span aria-hidden="true">·</span>}{where && <span className="gk-result__where"><MapPin aria-hidden="true" />{where}</span>}</>,
                open.length > 0 && <span className="gk-result-open">{open.join(' · ')}</span>,
            ]}
            aside={sells && person.rate ? <Price amount={person.rate.amount} currency={person.rate.currency} per={t('per session')} /> : undefined}
            action={sells || kind === 'specialist' ? <MessageLink id={person.id} name={person.fullName} primary={sells} /> : <FollowButton id={person.id} name={person.fullName} />} />
    );
}
