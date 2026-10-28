import { PageFrame, PageHeader } from '../../../design/primitives';
import { ClubPresentationSettings } from './presentation/ClubPresentationSettings';
import '../club-workspace.css';

/** Training programmes and their fees, as families see them on the club profile. */
export function ProgrammesPage({ clubId }: { clubId: number }) {
    return <PageFrame className="cw-page">
        <PageHeader title="Programmes & fees" subtitle="Training programmes, ages, sessions and prices shown on the club profile. Saving does not charge anyone." />
        <ClubPresentationSettings clubId={clubId} part="programmes" />
    </PageFrame>;
}
