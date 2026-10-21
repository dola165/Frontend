import { Flag, Shield } from 'lucide-react';
import { positionCode } from '../../../../components/squads/squadLabels';
import type { StatedLicence } from '../../api';
import { useWorldCopy } from '../../copy';
import { ResultMark } from '../../directory/ResultRow';
import { licenceName, refereeLevel, serviceOf } from './peopleWords';

// The mark of what kind of football person someone is: after their name in a row, or in their card's corner (`corner`).
// Marks people state themselves say so.

export function RefereeMark({ qualifications, corner }: { qualifications: string | null | undefined; corner?: boolean }) {
    const t = useWorldCopy();
    const level = refereeLevel(qualifications);
    if (!level) return null;
    return <ResultMark tone="warning" stated variant={corner ? 'corner' : 'pill'} label={t('{name}, as stated', { name: qualifications ?? '' })} icon={corner ? undefined : <Flag aria-hidden="true" />}>{level}</ResultMark>;
}

export function LicenceMark({ licence, corner }: { licence?: StatedLicence | null; corner?: boolean }) {
    const t = useWorldCopy();
    if (!licence) return null;
    return <ResultMark tone="violet" stated variant={corner ? 'corner' : 'pill'} label={t('{name}, as stated', { name: licenceName(licence) })} icon={corner ? undefined : <Shield aria-hidden="true" />}>
        {licence === 'PRO' || licence === 'GK' ? licence : `UEFA ${licence}`}
    </ResultMark>;
}

/** A service: its symbol and name after a name; in a card's corner the symbol alone (the name is in its label). */
export function ServiceMark({ profession, corner }: { profession: string | null | undefined; corner?: boolean }) {
    const t = useWorldCopy();
    const service = serviceOf(profession);
    if (!service) return null;
    const Icon = service.icon;
    return <ResultMark tone="info" variant={corner ? 'corner' : 'pill'} label={profession ?? t(service.label)} icon={<Icon aria-hidden="true" />}>{corner ? null : t(service.label)}</ResultMark>;
}

export function PositionMark({ position, corner }: { position: string | null | undefined; corner?: boolean }) {
    const t = useWorldCopy();
    if (!position) return null;
    return <ResultMark tone="accent" variant={corner ? 'corner' : 'pill'} label={t('Position: {position}', { position: positionCode(position) })}>{positionCode(position)}</ResultMark>;
}
