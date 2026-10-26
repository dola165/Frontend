import { useEffect, useState } from 'react';
import { Badge } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { fetchOutsideChats, type OutsideChats as Outside } from './api';

type Copy = ReturnType<typeof useJourneyCopy>;

/** Why, in plain words. */
const why = (copy: Copy, person: Outside) => {
    switch (person.reason) {
        case 'NO_ACCOUNT': return copy('No account has this email yet.', 'ამ ელფოსტით ანგარიში ჯერ არ არის.');
        case 'NOT_ACTIVE': return copy(`The account is not active (${person.accountState}), so no Team work and no chats.`,
            `ანგარიში აქტიური არ არის (${person.accountState}), ამიტომ არც გუნდის სამუშაო და არც ჩატები.`);
        case 'UNDER_18': return copy('Their birth date says under 18, and team chats are for adults. If the date is wrong, they correct it in their profile.',
            'დაბადების თარიღით 18 წლამდეა, გუნდის ჩატები კი უფროსებისთვისაა. თუ თარიღი არასწორია, პროფილში შეასწორონ.');
        case 'DOB_REQUIRED': return copy('In the chats, but the app asks for their birth date before it opens for them.',
            'ჩატებშია, მაგრამ აპი ჯერ დაბადების თარიღს სთხოვს და მანამდე არ გაეხსნება.');
        case 'ONBOARDING_REQUIRED': return copy('In the chats, but they have not finished setting up their account.',
            'ჩატებშია, მაგრამ ანგარიშის მომზადება ჯერ არ დაუსრულებია.');
        case 'PASSWORD_CHANGE_REQUIRED': return copy('In the chats, but they must change their password first.',
            'ჩატებშია, მაგრამ ჯერ პაროლი უნდა შეცვალოს.');
    }
};

/**
 * Who on the team list cannot use the team chats now, and why, under the team: left out (no account, not active, under
 * 18) or in them with a step of their own to take first. Nothing when everyone can, so a teammate missing from the
 * chats is never invisible.
 */
export function OutsideChats() {
    const copy = useJourneyCopy();
    const [people, setPeople] = useState<Outside[] | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        fetchOutsideChats(controller.signal).then(list => { if (!controller.signal.aborted) setPeople(list); })
            .catch(() => { if (!controller.signal.aborted) setFailed(true); });
        return () => controller.abort();
    }, []);
    if (failed) return <p className="gk-faint tw-team__hint">{copy('Who can use the team chats could not be checked.', 'ვერ შემოწმდა, ვის შეუძლია გუნდის ჩატების გამოყენება.')}</p>;
    if (!people?.length) return null;
    return <section className="tw-outside" aria-label={copy('Not in the team chats yet', 'ჯერ არ არიან გუნდის ჩატებში')}>
        <h3 className="tw-outside__title">{copy('Not in the team chats yet', 'ჯერ არ არიან გუნდის ჩატებში')}</h3>
        <ul className="tw-outside__list">{people.map(person => <li key={`${person.email}-${person.userId ?? ''}`}>
            <span className="tw-outside__who"><strong>{person.name ?? person.email}</strong>{person.name && <span className="gk-muted">{person.email}</span>}</span>
            {person.inChats ? <Badge tone="info">{copy('In the chats', 'ჩატებშია')}</Badge> : <Badge tone="warning">{copy('Left out', 'გარეთაა')}</Badge>}
            <span className="tw-outside__why">{why(copy, person)}</span>
        </li>)}</ul>
    </section>;
}
