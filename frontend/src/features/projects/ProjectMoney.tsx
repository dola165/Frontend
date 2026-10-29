import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '../../design/primitives';
import { ago } from '../../components/work/workWords';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { moveFundraiser, type ProjectDetail } from './api';
import { AmountDialog, FundraiserDialog, UpdateDialog } from './FundraiserDialogs';
import { ProgressBar } from './ProgressBar';
import { amount, money } from './projectWords';

type Open = 'amount' | 'start' | 'edit' | 'update' | null;

/**
 * The project's money: the target, what was raised as the club reports it (who and when), and the fundraiser's
 * GoFundMe page. The money itself is given on GoFundMe; GrassKickZ never claims a total it did not count.
 */
export function ProjectMoney({ project, onChanged }: { project: ProjectDetail; onChanged: (next: ProjectDetail) => void }) {
    const copy = useJourneyCopy();
    const [open, setOpen] = useState<Open>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const { summary, fundraiser: f, can } = project;
    const clubId = project.club?.id ?? 0;
    if (!summary.target && !f) return null;
    const currency = summary.target?.currency ?? f?.goal?.currency ?? 'GEL';
    const raised = f?.reportedAmount ?? null;
    const move = async (status: 'PUBLISHED' | 'PAUSED' | 'CLOSED') => {
        if (!f) return;
        setBusy(true); setError('');
        try { onChanged(await moveFundraiser(clubId, summary.id, f.version, status)); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be saved.', 'ვერ შეინახა.'))); }
        finally { setBusy(false); }
    };
    const where = !f ? null
        : f.status === 'DRAFT' ? copy('Draft: only the club sees it', 'მონახაზი: მხოლოდ კლუბი ხედავს')
            : f.publicNow ? (f.status === 'PUBLISHED' ? copy('Public on the club page', 'საჯაროა კლუბის გვერდზე') : f.status === 'PAUSED' ? copy('Paused', 'შეჩერებულია') : copy('Closed', 'დახურულია'))
                : copy('Inside the club until it is verified', 'კლუბის შიგნით, ვერიფიკაციამდე');
    return <section className="pj-block pj-money" aria-labelledby="pj-money">
        <div className="pj-block__head"><h2 className="pj-label" id="pj-money">{copy('Money', 'თანხა')}</h2>{where && <span className="pj-quiet">{where}</span>}</div>
        {summary.target && <ProgressBar wide value={summary.progress} label={copy(`${summary.progress}% of the target`, `მიზნის ${summary.progress}%`)} />}
        <p className="pj-money__line">
            <strong>{amount(raised ?? 0, currency)}</strong>
            {summary.target && <span>{copy(` of ${money(summary.target)}`, ` / ${money(summary.target)}`)}</span>}
            {f && <span className="pj-quiet">{' · '}{f.reportedAt
                ? copy(`reported by the club${f.reportedBy ? `, ${f.reportedBy.name}` : ''}, ${ago(copy, f.reportedAt)}`, `კლუბის ცნობით${f.reportedBy ? `, ${f.reportedBy.name}` : ''}, ${ago(copy, f.reportedAt)}`)
                : copy('nothing reported yet', 'ჯერ არაფერი უცნობებიათ')}</span>}
        </p>
        {f?.donateUrl && <a className="pj-give" href={f.donateUrl} target="_blank" rel="noopener noreferrer">{copy('Give on GoFundMe', 'შეწირვა GoFundMe-ზე')}<ArrowUpRight aria-hidden="true" /></a>}
        <div className="pj-actions">
            {!f && can.startFundraiser && <Button size="sm" variant="primary" onClick={() => setOpen('start')}>{copy('Start a fundraiser', 'შეგროვების დაწყება')}</Button>}
            {f && can.change && <Button size="sm" variant="primary" onClick={() => setOpen('amount')}>{copy('Update amount', 'თანხის განახლება')}</Button>}
            {f && can.publish && f.status !== 'PUBLISHED' && f.status !== 'CLOSED' && <Button size="sm" disabled={busy} onClick={() => void move('PUBLISHED')}>{copy('Publish', 'გამოქვეყნება')}</Button>}
            {f && can.change && f.status === 'PUBLISHED' && <Button size="sm" variant="ghost" onClick={() => setOpen('update')}>{copy('Post an update', 'სიახლის გამოქვეყნება')}</Button>}
            {f && can.change && <Button size="sm" variant="ghost" onClick={() => setOpen('edit')}>{copy('Edit fundraiser', 'შეგროვების რედაქტირება')}</Button>}
            {f && can.change && f.status === 'PUBLISHED' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void move('PAUSED')}>{copy('Pause', 'შეჩერება')}</Button>}
            {f && can.change && (f.status === 'PUBLISHED' || f.status === 'PAUSED') && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void move('CLOSED')}>{copy('Close', 'დახურვა')}</Button>}
        </div>
        {f && !f.clubVerified && <p className="pj-quiet">{copy('A fundraiser goes public once the club is verified.', 'შეგროვება საჯარო ხდება კლუბის ვერიფიკაციის შემდეგ.')}</p>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {open === 'amount' && f && <AmountDialog project={project} onClose={() => setOpen(null)} onSaved={next => { setOpen(null); onChanged(next); }} />}
        {(open === 'start' || open === 'edit') && <FundraiserDialog project={project} onClose={() => setOpen(null)} onSaved={next => { setOpen(null); onChanged(next); }} />}
        {open === 'update' && f && <UpdateDialog project={project} onClose={() => setOpen(null)} onSaved={next => { setOpen(null); onChanged(next); }} />}
    </section>;
}
