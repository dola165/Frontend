import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Badge, Button, ButtonLink, EmptyNote, GkRoot, PageFrame, PageHeader, Panel, Skeleton } from '../design/primitives';
import { Crest } from '../features/world/Crest';
import { useAuth } from '../context/AuthContext';
import { refreshAccess } from '../hooks/useCan';
import { extractApiErrorMessage } from '../utils/apiError';
import { formatDate } from '../utils/formatting';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { useJourneyCopy } from '../features/squadCommunication/journeyCopy';
import { chooseStaffClub } from '../features/clubOperations/leaving/api';
import { useOtherClub } from '../features/clubOperations/leaving/useOtherClub';
import { useStaffClubChoice } from '../features/clubOperations/leaving/useStaffClubChoice';
import '../features/clubOperations/leaving/leaving.css';

/**
 * Choose your club (owner, 27 October 2026): someone who is staff at several clubs today keeps one. The club they're
 * most active in is chosen already; each other club shows the jobs that end there. Their careers keep every job, and
 * those clubs' admins are told. After the deadline the suggested club is kept for them. The choice is in the address.
 */
export function StaffClubPage() {
    const copy = useJourneyCopy();
    const { refreshNavigationCapabilities } = useAuth();
    const [params, setParams] = useSearchParams();
    const { choice, error, reload } = useStaffClubChoice(true, copy('Your clubs couldn’t load.', 'თქვენი კლუბები ვერ ჩაიტვირთა.'));
    const other = useOtherClub();
    const [busy, setBusy] = useState(false), [failed, setFailed] = useState(''), [done, setDone] = useState<{ club: string; clubId: number; ended: string[] } | null>(null);
    const picked = Number(params.get('club')) || choice?.suggestedClubId || choice?.clubs[0]?.clubId || null;
    const pick = (clubId: number) => setParams(current => { const next = new URLSearchParams(current); next.set('club', String(clubId)); return next; }, { replace: true });
    const keep = async () => {
        const club = choice?.clubs.find(c => c.clubId === picked);
        if (!club || busy) return;
        setBusy(true); setFailed('');
        try {
            const answer = await chooseStaffClub(club.clubId);
            refreshAccess();
            await refreshNavigationCapabilities().catch(() => undefined);
            setDone({ club: club.name, clubId: club.clubId, ended: answer.ended.map(e => e.name) });
        } catch (failure) {
            // Owning another club: hand it over first (the leave flow), then keep this one.
            if (!other.catchOther(failure, () => void keep())) setFailed(extractApiErrorMessage(failure, copy('Your choice wasn’t saved. Try again.', 'არჩევანი ვერ შეინახა. სცადეთ ხელახლა.')));
        } finally { setBusy(false); }
    };

    const by = choice?.deadline ? formatDate(choice.deadline, { day: 'numeric', month: 'short' }) : null;
    const suggested = choice?.clubs.find(c => c.clubId === choice.suggestedClubId);
    const body = done ? <Panel padded>
        <EmptyNote title={copy(`You’re staff at ${done.club}.`, `${done.club}-ის თანამშრომელი ხართ.`)}
            action={<ButtonLink variant="primary" to={`/clubs/${done.clubId}/office`}>{copy(`Open ${done.club}`, `${done.club}-ის გახსნა`)}</ButtonLink>}>
            {done.ended.length ? copy(`Your jobs at ${done.ended.join(', ')} ended and stay in your career. Their admins are told.`, `${done.ended.join(', ')}-ში სამუშაოები დასრულდა და კარიერაში რჩება. მათ ადმინებს ეცნობათ.`) : null}
        </EmptyNote></Panel>
        : error ? <Panel><EmptyNote title={error} action={<Button onClick={reload}>{copy('Try again', 'თავიდან')}</Button>} /></Panel>
            : !choice ? <div className="gk-stack" role="status" aria-label={copy('Loading your clubs', 'კლუბები იტვირთება')}><Skeleton height={64} /><Skeleton height={64} /></div>
                : !choice.needed ? <Panel><EmptyNote title={copy('Nothing to choose', 'ასარჩევი არაფერია')} action={<ButtonLink to="/home">{copy('Go Home', 'მთავარზე')}</ButtonLink>}>
                    {choice.chosenClubId ? copy('Your club is chosen.', 'კლუბი არჩეულია.') : copy('You’re staff at one club or none.', 'ერთი კლუბის თანამშრომელი ხართ ან არცერთის.')}</EmptyNote></Panel>
                    : <>
                        <ul className="lv-clubs" aria-label={copy('Your clubs', 'თქვენი კლუბები')}>{choice.clubs.map(club => {
                            const chosen = club.clubId === picked;
                            return <li key={club.clubId}><button type="button" className="lv-club" aria-pressed={chosen} onClick={() => pick(club.clubId)}>
                                <Crest src={resolveMediaUrl(club.logoUrl) || null} name={club.name} size={40} />
                                <span className="lv-club__text">
                                    <strong>{club.name}{club.suggested && <> <Badge tone="info">{copy('Most active', 'ყველაზე აქტიური')}</Badge></>}</strong>
                                    <small>{club.jobs.join(' · ')}{club.activity ? ` · ${club.activity}` : ''}</small>
                                    {!chosen && <small className="lv-club__ends">{copy(`Ends: ${club.jobs.join(', ')}`, `სრულდება: ${club.jobs.join(', ')}`)}</small>}
                                </span>
                                {chosen && <Check aria-hidden="true" />}
                            </button></li>;
                        })}</ul>
                        {other.notice}
                        {failed && <p className="gk-notice gk-notice--danger" role="alert">{failed}</p>}
                        <div className="lv-choose__foot">
                            <Button variant="primary" disabled={busy || !picked} onClick={() => void keep()}>
                                {copy(`Keep ${choice.clubs.find(c => c.clubId === picked)?.name ?? ''}`, `${choice.clubs.find(c => c.clubId === picked)?.name ?? ''}-ში დარჩენა`)}</Button>
                            {by && suggested && <span className="gk-faint">{copy(`If you don’t choose by ${by}, we keep ${suggested.name}.`, `თუ ${by}-მდე არ აირჩევთ, დაგტოვებთ ${suggested.name}-ში.`)}</span>}
                        </div>
                    </>;
    return <GkRoot className="gk-page"><PageFrame className="lv-choose">
        <PageHeader title={copy('Choose your club', 'აირჩიეთ კლუბი')}
            subtitle={copy('Staff means one club. Keep one: your jobs at the others end and stay in your career.', 'თანამშრომელი ერთ კლუბშია. აირჩიეთ ერთი: სხვაგან სამუშაოები სრულდება და კარიერაში რჩება.')} />
        {body}
        {!done && choice?.needed && <ButtonLink variant="ghost" to="/home">{copy('Decide later', 'მოგვიანებით')}</ButtonLink>}
    </PageFrame></GkRoot>;
}
