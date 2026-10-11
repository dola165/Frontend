import { Link } from 'react-router-dom';
import { Button, EmptyNote } from '../../../design/primitives';
import { fetchClubJobs } from '../../clubs/api';
import { fetchClubProfile } from '../api';
import { ClubCard } from '../cards/ClubCard';
import { useWorldCopy } from '../copy';
import { ENGAGEMENT, postedLabel } from '../format';
import { useWorldData } from '../useWorldData';
import { DrawerFrame, DrawerLoading } from './DrawerFrame';
import { peekClick, peekOf, usePeek } from './usePeek';
import './peek.css';

/**
 * A club over World, from the left: who they are and how to join or follow them (the club card), and their open
 * roles; a role opens on the right with the club kept beside it.
 */
export default function ClubPeek({ id }: { id: string }) {
    const t = useWorldCopy();
    const drawers = usePeek();
    const clubId = Number(id);
    const club = useWorldData(`club:${clubId}`, signal => fetchClubProfile(clubId, signal), t('This club could not load.'));
    const jobs = useWorldData(`club-jobs:${clubId}`, signal => fetchClubJobs(clubId, signal));
    if (club.loading) return <DrawerFrame title={t('Loading…')}><DrawerLoading /></DrawerFrame>;
    if (!club.data) return (
        <DrawerFrame title={t('Club')}>
            <EmptyNote title={club.error || t('This club could not load.')} action={<Button size="sm" onClick={club.retry}>{t('Try again')}</Button>} />
        </DrawerFrame>
    );
    const roles = (jobs.data ?? []).filter(job => job.status !== 'CLOSED');
    return (
        <DrawerFrame title={club.data.name} page={{ to: `/clubs/${clubId}`, label: t('Club page') }}>
            <div className="gk-peek-clubcard"><ClubCard club={club.data} /></div>
            {roles.length > 0 && <section className="gk-peek-section">
                <h4>{t('Open roles')}</h4>
                <ul className="gk-peek-list">{roles.map(job => {
                    const terms = ENGAGEMENT[job.engagementType ?? 'UNSPECIFIED'] ?? ENGAGEMENT.UNSPECIFIED;
                    return (
                        <li key={job.id} className="gk-peek-club">
                            <span>
                                <Link to={`/jobs/${job.id}`} onClick={peekClick(peekOf('job', job.id), value => drawers.open(value, { keepSide: true }))} aria-current={drawers.value === peekOf('job', job.id) || undefined}>{job.title}</Link>
                                <small>{[t(terms.label), postedLabel(job.createdAt)].join(' · ')}</small>
                            </span>
                        </li>
                    );
                })}</ul>
            </section>}
        </DrawerFrame>
    );
}
