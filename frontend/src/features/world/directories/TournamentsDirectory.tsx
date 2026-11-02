import { Plus } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Button } from '../../../design/primitives';
import { drawPeek } from '../../tournaments/create/drawDraft';
import { usePeek } from '../peek/usePeek';
import { useWorldCopy } from '../copy';
import { DirectoryPage } from '../directory/DirectoryPage';
import { allTournaments } from './tournaments/allSource';
import { myTournaments } from './tournaments/mineSource';
import { season } from './tournaments/seasonSource';

const SOURCES = [season, allTournaments, myTournaments];

/** World › Tournaments: this season (mine first), every published tournament, and my own with what waits for me. */
export default function TournamentsDirectory() {
    const t = useWorldCopy();
    const { status } = useAuth();
    const drawers = usePeek();
    return (
        <DirectoryPage
            title={t('Tournaments')}
            subtitle={t('Leagues, cups and festivals')}
            sources={SOURCES}
            // Anyone signed in can start: setup helps a new organiser create their organisation first.
            actions={status === 'authenticated' && <Button variant="primary" onClick={() => drawers.open(drawPeek())}><Plus aria-hidden="true" />{t('Create a tournament')}</Button>}
        />
    );
}
