import { CreateMenu } from '../compose/CreateMenu';
import { useWorldCopy } from '../copy';
import { DirectoryPage } from '../directory/DirectoryPage';
import { allTournaments } from './tournaments/allSource';
import { myTournaments } from './tournaments/mineSource';
import { season } from './tournaments/seasonSource';

const SOURCES = [season, allTournaments, myTournaments];

/** World › Tournaments: this season (mine first), every published tournament, and my own with what waits for me. */
export default function TournamentsDirectory() {
    const t = useWorldCopy();
    return (
        <DirectoryPage
            title={t('Tournaments')}
            subtitle={t('Leagues, cups and festivals')}
            sources={SOURCES}
            // Anyone signed in can start: setup helps a new organiser create their organisation first.
            actions={<CreateMenu face="create-tournament" />}
        />
    );
}
