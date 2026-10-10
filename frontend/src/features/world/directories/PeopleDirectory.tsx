import { useMemo, useState } from 'react';
import { ButtonLink } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { hasNavigationCapability } from '../../../context/navigationCapabilities';
import { knownWithoutPeopleDirectory } from '../api';
import { useWorldCopy } from '../copy';
import { DirectoryPage } from '../directory/DirectoryPage';
import { peopleSource } from './peopleSource';

/** World › People: coaches, players, referees, agents and specialists with a public profile. */
export default function PeopleDirectory() {
    const t = useWorldCopy();
    const { user } = useAuth();
    const referee = hasNavigationCapability(user?.navigationCapabilities, 'referee.workspace');
    // Whether the server lacks the people directory is learned from its first answer, once per page load.
    const [searchOnly, setSearchOnly] = useState(knownWithoutPeopleDirectory);
    const source = useMemo(() => peopleSource({ searchOnly, onSearchOnly: () => setSearchOnly(true) }), [searchOnly]);
    return (
        <DirectoryPage title={t('People')} subtitle={t('Coaches, players, referees, agents and specialists with a public football profile.')} sources={[source]}
            actions={user && <>
                {referee && <ButtonLink variant="ghost" to="/referees/me">{t('My referee work')}</ButtonLink>}
                <ButtonLink to="/account/roles">{t('Your football roles')}</ButtonLink>
            </>} />
    );
}
