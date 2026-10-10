import { useMemo, useState } from 'react';
import { ButtonLink } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { hasNavigationCapability } from '../../../context/navigationCapabilities';
import { useWorldCopy } from '../copy';
import { DirectoryPage } from '../directory/DirectoryPage';
import { peopleSource } from './peopleSource';

/** Whether the server lacks the people directory, learned once per page load from its first answer. */
let directoryMissing = false;

/** World › People: coaches, players, referees, agents and specialists with a public profile. */
export default function PeopleDirectory() {
    const t = useWorldCopy();
    const { user } = useAuth();
    const referee = hasNavigationCapability(user?.navigationCapabilities, 'referee.workspace');
    const [searchOnly, setSearchOnly] = useState(directoryMissing);
    const source = useMemo(() => peopleSource({ searchOnly, onSearchOnly: () => { directoryMissing = true; setSearchOnly(true); } }), [searchOnly]);
    return (
        <DirectoryPage title={t('People')} subtitle={t('Coaches, players, referees, agents and specialists with a public football profile.')} sources={[source]}
            actions={user && <>
                {referee && <ButtonLink variant="ghost" to="/referees/me">{t('My referee work')}</ButtonLink>}
                <ButtonLink to="/account/roles">{t('Your football roles')}</ButtonLink>
            </>} />
    );
}
