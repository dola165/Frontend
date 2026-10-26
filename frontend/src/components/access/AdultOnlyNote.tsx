import { ButtonLink } from '../../design/primitives';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import type { useAdultOnly } from '../../hooks/useAdultOnly';
import './ask-admin.css';

/** Where an adults-only door is closed: the plain reason, and "Add your date of birth" when that is what is missing. */
export function AdultOnlyNote({ adult, className = 'gk-notice gk-notice--warning' }: { adult: ReturnType<typeof useAdultOnly>; className?: string }) {
    const copy = useJourneyCopy();
    if (adult.allowed) return null;
    return <div className={`gk-ask-admin ${className}`} role="status">
        <span>{adult.reason}</span>
        {adult.needsBirthDate && <ButtonLink size="sm" to="/onboarding">{copy('Add your date of birth', 'დაბადების თარიღის მითითება')}</ButtonLink>}
    </div>;
}
