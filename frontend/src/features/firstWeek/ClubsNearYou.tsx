import { useState } from 'react';
import { Dialog } from '../../design/Dialog';
import { Button, ButtonLink, EmptyNote, Skeleton } from '../../design/primitives';
import { Crest } from '../../design/visuals';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { FollowButton } from '../actions/FollowButton';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { useClubsNearYou } from './api';

/** "Follow clubs near you", over the current page: the nearest clubs, each with its Follow toggle. */
export function ClubsNearYou({ onClose, onFollowed }: { onClose: () => void; onFollowed: () => void }) {
    const copy = useJourneyCopy();
    const [attempt, setAttempt] = useState(0);
    const [clubs, change] = useClubsNearYou(attempt);
    const followChanged = (id: number, following: boolean) => {
        change(current => current.map(club => club.id === id ? { ...club, following } : club));
        if (following) onFollowed();
    };
    return <Dialog open size="sm" title={copy('Clubs near you', 'ახლომდებარე კლუბები')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        footer={<>
            <ButtonLink variant="ghost" to="/world/clubs" onClick={onClose}>{copy('All clubs', 'ყველა კლუბი')}</ButtonLink>
            <Button variant="primary" onClick={onClose}>{copy('Done', 'მზადაა')}</Button>
        </>}>
        {clubs === null ? <div className="gk-week-clubs" aria-busy="true">{[0, 1, 2, 3].map(row => <Skeleton key={row} height={44} />)}</div>
            : clubs === 'failed' ? <EmptyNote title={copy('Clubs could not load.', 'კლუბები ვერ ჩაიტვირთა.')} action={<Button size="sm" onClick={() => setAttempt(value => value + 1)}>{copy('Try again', 'ხელახლა ცდა')}</Button>} />
            : clubs.length === 0 ? <EmptyNote title={copy('No clubs near you yet.', 'ახლომახლო კლუბები ჯერ არ არის.')} action={<ButtonLink size="sm" to="/world/clubs" onClick={onClose}>{copy('See World', 'World-ის ნახვა')}</ButtonLink>} />
            : <ul className="gk-week-clubs">{clubs.map(club => <li key={club.id} className="gk-week-club">
                <Crest src={resolveMediaUrl(club.logoUrl)} name={club.name} size={36} />
                <span className="gk-week-club__text">
                    <strong>{club.name}</strong>
                    <span>{[club.cityName, club.km != null ? `${Math.round(club.km)} km` : null].filter(Boolean).join(' · ')}</span>
                </span>
                <FollowButton subject={{ kind: 'club', id: club.id }} following={club.following} name={club.name} size="sm" primary onChange={following => followChanged(club.id, following)} />
            </li>)}</ul>}
    </Dialog>;
}
