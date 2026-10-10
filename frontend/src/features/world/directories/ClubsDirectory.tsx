import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { ButtonLink } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { useWorldCopy } from '../copy';
import { DirectoryPage } from '../directory/DirectoryPage';
import { useWorldChild } from '../players';
import { useWorldArea } from '../useWorldArea';
import { WorldLoading } from '../WorldLoading';
import { useWorldSession } from '../worldSession';
import { clubsSource } from './clubSources';

/** World › Clubs. A parent chooses which child they are searching for, and every card answers for that child. */
export default function ClubsDirectory() {
    const t = useWorldCopy();
    const { status } = useAuth();
    const { membership } = useWorldSession();
    const { children, remember, isParent, pending } = useWorldChild();
    const { area } = useWorldArea();
    const lat = area.centre?.lat, lng = area.centre?.lng;
    const source = useMemo(() => clubsSource({ children, remember, centre: lat != null && lng != null ? { lat, lng } : null }), [children, remember, lat, lng]);
    // A link for one child waits for the person's children, so the first search already fits that child.
    if (pending) return <WorldLoading />;
    return (
        <DirectoryPage
            title={t('Clubs')}
            subtitle={isParent
                ? t('Academies, football schools and community clubs. Choose a child to see what fits their age.')
                : t('Academies, football schools and community clubs. Compare how to join, fees and where they train.')}
            sources={[source]}
            actions={status === 'authenticated' && <>
                <ButtonLink variant="ghost" to="/clubs/following">{t('Clubs you follow')}</ButtonLink>
                {membership?.canCreateClub && <ButtonLink to="/organizations/create?kind=CLUB"><Plus aria-hidden="true" />{t('Create a club')}</ButtonLink>}
            </>}
        />
    );
}
