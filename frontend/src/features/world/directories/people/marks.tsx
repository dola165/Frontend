import { Flag, Shield } from 'lucide-react';
import { positionCode } from '../../../../components/squads/squadLabels';
import type { StatedLicence } from '../../api';
import { useWorldCopy } from '../../copy';
import { ResultMark } from '../../directory/ResultRow';
import { licenceName, refereeLevel, serviceOf } from './peopleWords';

// The mark after a person's name in a result: what kind of football person they are. Marks people state themselves say so.

export function RefereeMark({ qualifications }: { qualifications: string | null | undefined }) {
    const t = useWorldCopy();
    const level = refereeLevel(qualifications);
    if (!level) return null;
    return <ResultMark tone="warning" stated label={t('{name}, as stated', { name: qualifications ?? '' })} icon={<Flag aria-hidden="true" />}>{level}</ResultMark>;
}

export function LicenceMark({ licence }: { licence?: StatedLicence | null }) {
    const t = useWorldCopy();
    if (!licence) return null;
    return <ResultMark tone="violet" stated label={t('{name}, as stated', { name: licenceName(licence) })} icon={<Shield aria-hidden="true" />}>{licence === 'PRO' || licence === 'GK' ? licence : `UEFA ${licence}`}</ResultMark>;
}

export function ServiceMark({ profession }: { profession: string | null | undefined }) {
    const t = useWorldCopy();
    const service = serviceOf(profession);
    if (!service) return null;
    const Icon = service.icon;
    return <ResultMark tone="info" label={profession ?? t(service.label)} icon={<Icon aria-hidden="true" />}>{t(service.label)}</ResultMark>;
}

export function PositionMark({ position }: { position: string | null | undefined }) {
    const t = useWorldCopy();
    if (!position) return null;
    return <ResultMark tone="accent" label={t('Position: {position}', { position: positionCode(position) })}>{positionCode(position)}</ResultMark>;
}
