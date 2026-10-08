import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { ClubPresentationSettings } from '../components/workspace/tabs/ClubPresentationSettings';

/** Scoped profile editing does not open the club's operational workspace. */
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
    if (!Number.isSafeInteger(clubId) || clubId <= 0) return <p>Club not found.</p>;
    return <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 text-[var(--fc-text-primary)]">
        <Link to={`/clubs/${clubId}`} className="text-sm text-[var(--fc-accent)]">← Back to club</Link>
        <h1 className="text-2xl font-bold">{identity?.id === clubId ? identity.name : 'Club'} — profile settings</h1>
        <ClubPresentationSettings clubId={clubId} />
    </main>;
};
