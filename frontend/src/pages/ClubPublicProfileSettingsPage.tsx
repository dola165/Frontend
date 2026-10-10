import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { EmptyNote, GkRoot, PageFrame, PageHeader } from '../design/primitives';
import { ClubPresentationSettings } from '../features/clubWorkspace/settings/presentation/ClubPresentationSettings';

/** Scoped profile editing (for example a parent club editing its academy) does not open the club's workspace. */
export const ClubPublicProfileSettingsPage = () => {
    const { id } = useParams();
    const clubId = Number(id);
    const [identity, setIdentity] = useState<{ id: number; name: string } | null>(null);
    useEffect(() => {
        let current = true;
        if (Number.isSafeInteger(clubId) && clubId > 0) {
            void apiClient.get<{ name: string }>(`/clubs/${clubId}`).then(r => {
                if (current) setIdentity({ id: clubId, name: r.data.name });
            }).catch(() => { /* The editor reports access and loading errors. */ });
        }
        return () => { current = false; };
    }, [clubId]);
    if (!Number.isSafeInteger(clubId) || clubId <= 0) return <GkRoot><PageFrame><EmptyNote title="Club not found" /></PageFrame></GkRoot>;
    const name = identity?.id === clubId ? identity.name : 'Club';
    return <GkRoot className="gk-page"><PageFrame className="rec-page">
        <PageHeader crumbs={[{ label: name, to: `/clubs/${clubId}` }, { label: 'Profile settings' }]} title={`${name} profile settings`} subtitle="Programmes, fees, sponsors and affiliations shown on the public club page." />
        <ClubPresentationSettings clubId={clubId} />
    </PageFrame></GkRoot>;
};
