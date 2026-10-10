import { Check } from 'lucide-react';
import type { Participant } from '../../admissions/types';
import type { ClubPresentation, TrainingProgramme } from '../../clubs/presentation';
import { useWorldCopy } from '../copy';
import { ageOn } from '../players';
import { fitsAge, programmeAges, programmeFee, publicProgrammes } from './programmes';

const line = (programme: TrainingProgramme) => [programme.name, programmeAges(programme), programmeFee(programme)].join(' · ');

/**
 * A club's published training programmes on its card: ages and fees, and for a parent searching
 * for a child, which of them fit that child's age. Nothing is claimed for a programme without ages.
 */
export function ClubProgrammes({ presentation, child, compact }: { presentation?: ClubPresentation | null; child?: Participant; compact?: boolean }) {
    const t = useWorldCopy();
    const programmes = publicProgrammes(presentation);
    const age = ageOn(child?.dateOfBirth);
    if (!programmes.length) return null;
    if (child && age != null) {
        const fitting = programmes.filter(programme => fitsAge(programme, age));
        if (!fitting.length) return <p className="gk-world-card__fit gk-world-card__fit--none">{t('No programme listed for age {age}', { age })}</p>;
        return (
            <ul className="gk-world-card__programmes" aria-label={t('Training programmes')}>
                {fitting.slice(0, 2).map(programme => (
                    <li key={programme.id ?? programme.name}>
                        <span className="gk-world-card__fit"><Check aria-hidden="true" />{t('Fits {name}', { name: child.name.split(' ')[0] })}</span>
                        <span>{line(programme)}</span>
                    </li>
                ))}
                {fitting.length > 2 && <li className="gk-faint">{t('{count} more on the club page', { count: fitting.length - 2 })}</li>}
            </ul>
        );
    }
    if (compact) return null;
    return (
        <p className="gk-world-card__fees">
            {line(programmes[0])}
            {programmes.length > 1 && <span className="gk-faint"> · {t('{count} more on the club page', { count: programmes.length - 1 })}</span>}
        </p>
    );
}
