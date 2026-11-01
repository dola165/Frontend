import { useLocation, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, CalendarPlus, MessageCircle, Phone, Share2, UserPlus } from 'lucide-react';
import type { ClubProfile } from '../../../components/discovery/clubDirectoryTypes';
import { Button, ButtonAnchor, LoadFailed, Skeleton } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { formatDate, formatTime } from '../../../utils/formatting';
import { searchOpportunities } from '../../admissions/api';
import type { Opportunity } from '../../admissions/types';
import { searchTryouts } from '../../tryouts/api';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { directionsUrl } from '../../parents/hub/familyEvents';
import { keepPane } from '../peek/usePeek';
import { useWorldChild } from '../players';
import { useWorldData } from '../useWorldData';
import { AskTheClub } from './AskTheClub';
import { BookFirstVisit } from './BookFirstVisit';
import { ShareGroup } from './ShareGroup';
import { bornLabel, firstLine, parentName, telLink, tryoutFits, tryoutIcs, whatsAppLink } from './waysIn';

type Way = { kind: 'book' | 'ask' | 'share'; group: number | null };
const wayOf = (value: string | null): Way | null => {
    const match = value ? /^(book|ask|share):(\d+|club)$/.exec(value) : null;
    return match ? { kind: match[1] as Way['kind'], group: match[2] === 'club' ? null : Number(match[2]) } : null;
};

/**
 * The club opened inside the finder's list: its groups that take the child (born years, days, price, place), its posted
 * tryouts, and only the ways in the club filled in: Call, WhatsApp with a first line ready, Directions, Tryouts with
 * "Add to calendar", Book a first visit where a group lists sessions, and Ask the club always. Book, Ask and Share open
 * here (`way=book:12`), never in a second pop-up. `named`: the group a link opened (shown first, closed or full included).
 * A list that failed to load says so, with Try again, never that the club lists nothing.
 */
export function FinderClub({ club, named }: { club: ClubProfile; named?: Opportunity }) {
    const copy = useJourneyCopy();
    const { status } = useAuth();
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const { child } = useWorldChild();
    const birthYear = child?.dateOfBirth ? Number(child.dateOfBirth.slice(0, 4)) : undefined;
    const groups = useWorldData(`finder-groups:${club.id}:${birthYear ?? ''}:${child?.gender ?? ''}`,
        signal => searchOpportunities({ clubId: club.id, birthYear, gender: child?.gender ?? undefined, acceptingOnly: true, includeWaitlist: true, size: 6 }, signal).then(page => page.items));
    const trials = useWorldData(`finder-trials:${club.id}:${birthYear ?? ''}`, signal => searchTryouts({ clubId: club.id, status: 'OPEN', size: 6, birthYear }, signal)
        .then(page => page.items.filter(item => item.tryoutDate && tryoutFits(item.ageGroup, birthYear)).slice(0, 3)));
    const way = wayOf(params.get('way'));
    const show = (next: Way | null) => setParams(current => {
        const copyParams = new URLSearchParams(current);
        if (next) copyParams.set('way', `${next.kind}:${next.group ?? 'club'}`); else copyParams.delete('way');
        return copyParams;
    }, { replace: true, preventScrollReset: true, state: keepPane(location.state) });
    const childLine = child ? { name: child.name, gender: child.gender, birthYear } : null;
    const call = telLink(club.whatsappNumber), chat = whatsAppLink(club.whatsappNumber, firstLine(copy, childLine));
    const directions = directionsUrl(club.addressText ?? club.cityName, club.latitude, club.longitude);
    const signedIn = status === 'authenticated';
    const panel = (group: Opportunity | null) => way && way.group === (group?.id ?? null) && <div className="gk-finder-way">
        {way.kind === 'book' && group && <BookFirstVisit group={group} onClose={() => show(null)} />}
        {way.kind === 'ask' && <AskTheClub club={club} group={group} onClose={() => show(null)} />}
        {way.kind === 'share' && group && <ShareGroup group={group} clubName={club.name} />}
    </div>;
    // Real life first: the club's own phone and WhatsApp, then its groups (where a first visit is booked), then tryouts.
    return <div className="gk-finder-open" data-guide="open-club">
        <div className="gk-finder-acts gk-finder-acts--club" data-guide="ways-in">
            {call && <ButtonAnchor size="sm" variant="primary" href={call} data-guide="call"><Phone aria-hidden="true" />{copy('Call', 'დარეკვა')}</ButtonAnchor>}
            {chat && <ButtonAnchor size="sm" href={chat} target="_blank" rel="noreferrer" data-guide="whatsapp">{copy('WhatsApp', 'WhatsApp')}</ButtonAnchor>}
            {directions && <ButtonAnchor size="sm" variant="ghost" href={directions} target="_blank" rel="noreferrer">{copy('Directions', 'მარშრუტი')}<ArrowUpRight aria-hidden="true" /></ButtonAnchor>}
            <Button size="sm" variant={way?.kind === 'ask' && way.group === null ? 'primary' : 'ghost'} onClick={() => show({ kind: 'ask', group: null })} data-guide="ask-club"><MessageCircle aria-hidden="true" />{copy('Ask the club', 'კლუბს კითხვა')}</Button>
        </div>
        {panel(null)}
        {[...(named ? [named] : []), ...(groups.data ?? []).filter(group => group.id !== named?.id)].map(group => {
            const charge = group.terms.feesKnown ? group.terms.charges[0] : undefined;
            const visits = group.firstVisits === undefined || group.firstVisits === null ? 3 : group.firstVisits.places;
            const bookable = signedIn && group.squadId != null && visits > 0 && group.availability !== 'CLOSED';
            const groupDirections = directionsUrl(group.location.address || group.location.name, group.location.latitude, group.location.longitude);
            // The club's own name for the group without its age code, the birth years beside it (owner, 29 October).
            const own = parentName(group.name), born = group.name.includes(String(group.birthYearFrom)) ? null : bornLabel(copy, group.birthYearFrom, group.birthYearTo);
            return <section key={group.id} className="gk-finder-group" aria-label={own ?? group.name} data-guide="club-group">
                <header className="gk-finder-group__head">
                    <strong>{own ?? (born ? born.charAt(0).toUpperCase() + born.slice(1) : group.name)}</strong>
                    {own && born && <span className="gk-finder-group__born">{born}</span>}
                </header>
                <p className="gk-finder-group__facts">{[group.schedule, group.location.name, charge ? `${charge.amount} ${charge.currency}${charge.frequency === 'monthly' ? copy(' a month', ' თვეში') : ''}` : group.terms.feesKnown ? copy('Free', 'უფასო') : null].filter(Boolean).join(' · ')}</p>
                <div className="gk-finder-acts">
                    {bookable && <Button size="sm" variant={way?.kind === 'book' && way.group === group.id ? 'primary' : 'secondary'} onClick={() => show({ kind: 'book', group: group.id })} data-guide="book-first-visit"><UserPlus aria-hidden="true" />{copy('Book a first visit', 'პირველი ვიზიტის დაჯავშნა')}</Button>}
                    <Button size="sm" variant="ghost" onClick={() => show({ kind: 'ask', group: group.id })}><MessageCircle aria-hidden="true" />{copy('Ask about this group', 'იკითხეთ ამ ჯგუფზე')}</Button>
                    {groupDirections && <ButtonAnchor size="sm" variant="ghost" href={groupDirections} target="_blank" rel="noreferrer">{copy('Directions', 'მარშრუტი')}<ArrowUpRight aria-hidden="true" /></ButtonAnchor>}
                    <Button size="sm" variant="ghost" onClick={() => show({ kind: 'share', group: group.id })} data-guide="share-group"><Share2 aria-hidden="true" />{copy('Share', 'გაზიარება')}</Button>
                </div>
                {panel(group)}
            </section>;
        })}
        {groups.loading && <Skeleton height={96} />}
        {groups.error && <LoadFailed text={copy('Couldn’t load the club’s groups', 'კლუბის ჯგუფები ვერ ჩაიტვირთა')} retry={copy('Try again', 'ხელახლა ცდა')} onRetry={groups.retry} />}
        {!groups.loading && !groups.error && !named && !(groups.data ?? []).length && <p className="gk-faint">{child ? copy(`No group lists a place for ${child.name.split(' ')[0]} yet. A call or a message is the quickest way.`, `${child.name.split(' ')[0]}-სთვის ჯგუფი ჯერ არ არის. დარეკვა ან მესიჯი ყველაზე სწრაფია.`) : copy('No groups listed yet. A call or a message is the quickest way.', 'ჯგუფები ჯერ არ არის. დარეკვა ან მესიჯი ყველაზე სწრაფია.')}</p>}
        {trials.error && <LoadFailed text={copy('Couldn’t load the tryouts', 'ტესტირებები ვერ ჩაიტვირთა')} retry={copy('Try again', 'ხელახლა ცდა')} onRetry={trials.retry} />}
        {(trials.data ?? []).map(trial => <div key={trial.id} className="gk-finder-tryout" data-guide="tryouts">
            <span><strong>{copy('Tryouts', 'ტესტირება')}</strong> {formatDate(trial.tryoutDate!, { weekday: 'short', day: 'numeric', month: 'short' })}, {formatTime(trial.tryoutDate!)}{trial.ageGroup ? ` · ${trial.title}` : ''}</span>
            <ButtonAnchor size="sm" variant="ghost" download={`tryout-${trial.id}.ics`} href={`data:text/calendar;charset=utf-8,${encodeURIComponent(tryoutIcs({ id: trial.id, title: trial.title, clubName: club.name, tryoutDate: trial.tryoutDate!, location: trial.location }))}`}>
                <CalendarPlus aria-hidden="true" />{copy('Add to calendar', 'კალენდარში დამატება')}</ButtonAnchor>
        </div>)}
    </div>;
}
