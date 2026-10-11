import { Plus } from 'lucide-react';
import { ButtonLink } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { hasNavigationCapability } from '../../../context/navigationCapabilities';
import { useWorldCopy } from '../copy';
import { DirectoryPage } from '../directory/DirectoryPage';
import { competitions, invitations, mine, organisers } from './competitionSources';

const SOURCES = [competitions, mine, invitations, organisers];

/** World › Competitions: every published competition, my own, invitations to enter, and who runs them. */
export default function CompetitionsDirectory() {
    const t = useWorldCopy();
    const { user } = useAuth();
    return (
        <DirectoryPage
            title={t('Competitions')}
            subtitle={t('Leagues, cups and festivals')}
            sources={SOURCES}
            // Anyone signed in can start: setup helps a new organiser create their organisation first.
            actions={user && <ButtonLink variant={hasNavigationCapability(user.navigationCapabilities, 'tournament.create') ? 'primary' : 'secondary'} to="/tournaments/setup"><Plus aria-hidden="true" />{t('Create a competition')}</ButtonLink>}
        />
    );
}
