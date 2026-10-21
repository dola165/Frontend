import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ButtonLink } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { hasNavigationCapability } from '../../../context/navigationCapabilities';
import { knownWithoutPeopleDirectory } from '../api';
import { CreateMenu } from '../compose/CreateMenu';
import { useWorldCopy } from '../copy';
import { DirectoryPage } from '../directory/DirectoryPage';
import type { WorldRole } from '../front/roles';
import { useWorldRole } from '../front/useWorldRole';
import { useWorldChild } from '../players';
import { WorldLoading } from '../WorldLoading';
import { useWorldSession } from '../worldSession';
import { Dugout } from './people/Dugout';
import { playerSource, specialistSource, staffSource } from './people/personSources';
import { refereeSource } from './people/refereeSource';
import { YourCard } from './people/YourCard';
import './people/people.css';

/** The view People opens on for each role, when the address names none: what that person most likely wants. */
const OPENING: Partial<Record<WorldRole, string>> = {
    'head-coach': 'referees', 'team-manager': 'referees', referee: 'referees', organiser: 'referees', 'venue-operator': 'referees',
    'fitness-coach': 'specialists', specialist: 'specialists', analyst: 'players', agent: 'players', fan: 'players',
};
/** Older links name a role (`role=REFEREE`); each opens its view. */
const ROLE_TABS = { REFEREE: 'referees', SPECIALIST: 'specialists', COACH: 'staff', CLUB_STAFF: 'staff', PLAYER: 'players' };
const referees = { ...refereeSource, Tools: Dugout };

/**
 * World › People: four kinds of football people you want something from, each with its own filters and mark on one
 * card: referees you book, specialists you hire, coaches and staff you get to know, players you scout.
 */
export default function PeopleDirectory() {
    const t = useWorldCopy();
    const { user } = useAuth();
    const role = useWorldRole();
    const { membership } = useWorldSession();
    const { pending } = useWorldChild();
    const [params] = useSearchParams();
    const referee = hasNavigationCapability(user?.navigationCapabilities, 'referee.workspace');
    // Whether the server lacks the people directory is learned from its first answer, once per page load.
    const [searchOnly, setSearchOnly] = useState(knownWithoutPeopleDirectory);
    const sources = useMemo(() => {
        const mode = { searchOnly, onSearchOnly: () => setSearchOnly(true) };
        return [referees, specialistSource(mode), staffSource(mode), playerSource(mode)];
    }, [searchOnly]);
    // The opening view follows the role, which settles once the person's club and children are known.
    if (user && !params.has('tab') && !params.has('role') && (pending || membership === undefined)) return <WorldLoading />;
    return (
        <DirectoryPage title={t('People')} subtitle={t('Referees, specialists, coaches and players')} sources={sources}
            opening={OPENING[role] ?? 'staff'} tabAlias="role" tabValues={ROLE_TABS}
            actions={<>
                {user && referee && <ButtonLink variant="ghost" to="/referees/me">{t('My referee work')}</ButtonLink>}
                {user && <YourCard userId={Number(user.id)} referee={referee} />}
                <CreateMenu />
            </>} />
    );
}
