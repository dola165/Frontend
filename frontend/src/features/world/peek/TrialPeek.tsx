import { Link } from 'react-router-dom';
import { Button, ButtonLink, EmptyNote } from '../../../design/primitives';
import { Status } from '../../../design/DataTable';
import { fetchTryout } from '../../tryouts/api';
import { postingLabel } from '../../tryouts/tryoutCopy';
import { useWorldCopy } from '../copy';
import { bilingual, codeLabel, fixtureDay, fixtureTime, shortDate } from '../format';
import { useWorldData } from '../useWorldData';
import { DrawerFrame, DrawerLoading } from './DrawerFrame';
import { peekClick, peekOf, useRelatedOpen } from './usePeek';
import './peek.css';

/**
 * A trial beside the list: the club (it opens over the trial, with a way back), when and where, who it is for, until
 * when to apply, and what the club says about it. Applying happens on the trial's page, where the player's details are.
 */
export default function TrialPeek({ id }: { id: string }) {
    const t = useWorldCopy();
    const relate = useRelatedOpen();
    const trialId = Number(id);
    const valid = Number.isInteger(trialId) && trialId > 0;
    const data = useWorldData(valid ? `trial-peek:${trialId}` : null, signal => fetchTryout(trialId, signal), 'This trial could not load.');
    if (data.loading) return <DrawerFrame title={t('Loading…')}><DrawerLoading /></DrawerFrame>;
    const trial = data.data;
    if (!trial) return (
        <DrawerFrame title={t('Trial')}>
            <EmptyNote title={data.error || t('This trial could not load.')} action={valid ? <Button size="sm" onClick={data.retry}>{t('Try again')}</Button> : undefined} />
        </DrawerFrame>
    );
    const when = trial.tryoutDate ? `${fixtureDay(trial.tryoutDate)} ${fixtureTime(trial.tryoutDate)}` : t('Date to confirm');
    return (
        <DrawerFrame title={trial.title} page={{ to: `/tryouts/${trial.id}`, label: t('Trial page') }}>
            <header className="gk-peek-job">
                <Link className="gk-peek-job__club" to={`/clubs/${trial.clubId}`} onClick={peekClick(peekOf('club', trial.clubId), relate)}><span>{trial.clubName}</span></Link>
                <h3>{trial.title}</h3>
                <p className="gk-peek-job__meta">{[when, trial.location].filter(Boolean).join(' · ')}</p>
                <div className="gk-peek-job__chips">
                    <Status tone={trial.status === 'OPEN' ? 'accent' : 'neutral'}>{postingLabel(trial.status, bilingual)}</Status>
                    {trial.ageGroup && <span className="gk-peek-chip">{codeLabel(trial.ageGroup)}</span>}
                    {trial.position && <span className="gk-peek-chip">{codeLabel(trial.position)}</span>}
                </div>
            </header>
            {trial.status === 'OPEN' && <div className="gk-peek-actions"><ButtonLink size="sm" variant="primary" to={`/tryouts/${trial.id}`}>{t('Apply on the trial page')}</ButtonLink></div>}
            {trial.deadline && <p className="gk-peek-job__meta">{t('Apply by {date}', { date: shortDate(trial.deadline) ?? '' })}</p>}
            <section className="gk-peek-section">
                <h3 className="gk-peek-section__title">{t('About the trial')}</h3>
                <p className="gk-peek-text">{trial.description || t('The club has not described this trial yet.')}</p>
            </section>
        </DrawerFrame>
    );
}
