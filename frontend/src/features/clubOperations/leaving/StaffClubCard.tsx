import { ShieldCheck } from 'lucide-react';
import { ButtonLink } from '../../../design/primitives';
import { formatDate } from '../../../utils/formatting';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { useStaffClubChoice } from './useStaffClubChoice';
import './leaving.css';

/** Home's card for someone who is staff at several clubs today: one line, the deadline, and Choose your club. */
export function StaffClubCard() {
    const copy = useJourneyCopy();
    const { choice } = useStaffClubChoice();
    if (!choice?.needed) return null;
    const kept = choice.clubs.find(club => club.clubId === choice.suggestedClubId)?.name;
    const by = choice.deadline ? formatDate(choice.deadline, { day: 'numeric', month: 'short' }) : null;
    return <section className="gk gk-panel lv-card" aria-label={copy('Choose your club', 'აირჩიეთ კლუბი')}>
        <span className="lv-card__icon" aria-hidden="true"><ShieldCheck /></span>
        <span className="lv-card__text">
            <strong>{copy(`You’re staff at ${choice.clubs.length} clubs. Staff means one club now.`, `${choice.clubs.length} კლუბის თანამშრომელი ხართ. ახლა თანამშრომელი ერთ კლუბშია.`)}</strong>
            {by && kept && <small>{copy(`If you don’t choose by ${by}, we keep ${kept}.`, `თუ ${by}-მდე არ აირჩევთ, დავტოვებთ ${kept}-ს.`)}</small>}
        </span>
        <ButtonLink size="sm" variant="primary" to="/me/staff-club">{copy('Choose your club', 'აირჩიეთ კლუბი')}</ButtonLink>
    </section>;
}
