import { useAdmissionCopy } from '../../admissions/applicant/copy';
import type { OfferAsksAnswer } from './offerAsksAnswer';

/**
 * The three asks on a place offer: optional lines, "no" until a parent says yes, and nothing waits on them. A parent who
 * skips them is asked again in Parent Hub.
 */
export function OfferAsks({ answer, onAnswer }: { answer: OfferAsksAnswer; onAnswer: (next: OfferAsksAnswer) => void }) {
    const { copy } = useAdmissionCopy();
    return <fieldset className="admission-stack">
        <legend>{copy('Optional: you can also answer these later', 'არასავალდებულო: ამაზე პასუხი მოგვიანებითაც შეგიძლიათ')}</legend>
        <button type="button" className="admission-button" aria-pressed={answer.photos} onClick={() => onAnswer({ ...answer, photos: !answer.photos })}>{answer.photos ? '✓ ' : ''}{copy('Yes to photos on the club’s posts', 'თანხმობა ფოტოებზე კლუბის პოსტებში')}</button>
        <button type="button" className="admission-button" aria-pressed={answer.trips} onClick={() => onAnswer({ ...answer, trips: !answer.trips })}>{answer.trips ? '✓ ' : ''}{copy('Yes to trips with the squad', 'თანხმობა გუნდთან ერთად გასვლებზე')}</button>
        <label>{copy('A note for the coach: an allergy, asthma', 'შენიშვნა მწვრთნელისთვის: ალერგია, ასთმა')}<input maxLength={500} value={answer.note} onChange={event => onAnswer({ ...answer, note: event.target.value })} /></label>
    </fieldset>;
}
