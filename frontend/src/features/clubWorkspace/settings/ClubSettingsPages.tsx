import { PageFrame, PageHeader } from '../../../design/primitives';
import { Tabs, useUrlTab } from '../../../design/Tabs';
import { ClubPresentationSettings } from './presentation/ClubPresentationSettings';
import { ClubOrganizationSection } from './ClubOrganizationSection';
import { JoiningPolicy } from './JoiningPolicy';
import '../club-workspace.css';

const sections = ['joining', 'profile', 'activities', 'facilities', 'imports'] as const;

/** Club configuration only: how players join, the public profile, activities, venue links and imports. Fees live in Club business. */
export function ClubSettingsPage({ clubId, busy }: { clubId: number; busy: boolean }) {
    const [section, setSection] = useUrlTab('section', sections, 'joining');
    return <PageFrame className="cw-page">
        <PageHeader title="Club settings" subtitle="Owner and admin decisions. Programmes and fees are in Club business." />
        <Tabs label="Club settings" value={section} onChange={setSection} items={[
            { id: 'joining', label: 'Joining' }, { id: 'profile', label: 'Public profile' }, { id: 'activities', label: 'Activities' },
            { id: 'facilities', label: 'Venue relationships' }, { id: 'imports', label: 'Imports' },
        ]} />
        <div className="cw-tab-body">
            {section === 'joining' ? <JoiningPolicy clubId={clubId} disabled={busy} />
                : section === 'profile' ? <ClubPresentationSettings clubId={clubId} part="profile" />
                    : <ClubOrganizationSection clubId={clubId} section={section} />}
        </div>
    </PageFrame>;
}

/** Training programmes and their fees, as families see them on the club profile. */
export function ProgrammesPage({ clubId }: { clubId: number }) {
    return <PageFrame className="cw-page">
        <PageHeader title="Programmes & fees" subtitle="Training programmes, ages, sessions and prices shown on the club profile. Saving does not charge anyone." />
        <ClubPresentationSettings clubId={clubId} part="programmes" />
    </PageFrame>;
}
