import { CreateMenu } from '../compose/CreateMenu';
import { useWorldCopy } from '../copy';
import { DirectoryPage } from '../directory/DirectoryPage';
import { competitions, invitations, mine, organisers } from './competitionSources';

const SOURCES = [competitions, mine, invitations, organisers];

/** World › Competitions: every published competition, my own, invitations to enter, and who runs them. */
export default function CompetitionsDirectory() {
    const t = useWorldCopy();
    return (
        <DirectoryPage
            title={t('Competitions')}
            subtitle={t('Leagues, cups and festivals')}
            sources={SOURCES}
            // Anyone signed in can start: setup helps a new organiser create their organisation first.
            actions={<CreateMenu face="create-competition" />}
        />
    );
}
