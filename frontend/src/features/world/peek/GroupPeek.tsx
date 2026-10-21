import { useSearchParams } from 'react-router-dom';
import { Button, ButtonLink, EmptyNote } from '../../../design/primitives';
import { Status } from '../../../design/DataTable';
import { fetchOpportunity } from '../../admissions/api';
import { useAdmissionCopy } from '../../admissions/applicant/copy';
import { useWorldCopy } from '../copy';
import { shortDate } from '../format';
import { useWorldData } from '../useWorldData';
import { groupFor, groupTone } from '../directories/groupFacts';
import { DrawerFrame, DrawerLoading } from './DrawerFrame';
import './peek.css';

/**
 * A place to train beside the list: who runs it, where and when it trains, who it is for, whether there are places, and
 * from when. Asking for a place happens on its page (for the child chosen in the World bar, when there is one).
 */
export default function GroupPeek({ id }: { id: string }) {
    const t = useWorldCopy();
    const { availability } = useAdmissionCopy();
    const [params] = useSearchParams();
    const groupId = Number(id);
    const valid = Number.isInteger(groupId) && groupId > 0;
    const data = useWorldData(valid ? `group-peek:${groupId}` : null, signal => fetchOpportunity(groupId, signal), 'This group could not load.');
    if (data.loading) return <DrawerFrame title={t('Loading…')}><DrawerLoading /></DrawerFrame>;
    const group = data.data;
    if (!group) return (
        <DrawerFrame title={t('Place to train')}>
            <EmptyNote title={data.error || t('This group could not load.')} action={valid ? <Button size="sm" onClick={data.retry}>{t('Try again')}</Button> : undefined} />
        </DrawerFrame>
    );
    const player = params.get('player');
    const page = `/admissions/opportunities/${group.id}${player ? `?player=${player}` : ''}`;
    const tone = groupTone(group), who = groupFor(group, t);
    return (
        <DrawerFrame title={group.name} page={{ to: page, label: t('Group page') }}>
            <header className="gk-peek-job">
                <span className="gk-peek-job__club"><span>{group.organizationName}</span></span>
                <h3>{group.name}</h3>
                <p className="gk-peek-job__meta">{[group.location.name, group.schedule].filter(Boolean).join(' · ')}</p>
                <div className="gk-peek-job__chips">
                    <Status tone={tone}>{availability(group.availability)}</Status>
                    {who.filter(Boolean).map(item => <span key={item} className="gk-peek-chip">{item}</span>)}
                </div>
            </header>
            {tone === 'accent' && <div className="gk-peek-actions"><ButtonLink size="sm" variant="primary" to={page}>{t('Ask about a place')}</ButtonLink></div>}
            <div className="gk-peek-facts">
                <div className="gk-peek-fact"><span>{t('Starts')}</span><b>{shortDate(group.terms.startDate) ?? t('Date to confirm')}</b></div>
                <div className="gk-peek-fact"><span>{t('Where')}</span><b>{group.location.address || group.location.name}</b></div>
            </div>
        </DrawerFrame>
    );
}
