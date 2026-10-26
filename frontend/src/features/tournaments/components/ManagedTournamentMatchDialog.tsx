import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDialogFocus } from '../../../components/workspace/useDialogFocus';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { getDraw, operation, saveCompetitionResult, type DrawState, type Profile } from '../../competitions/api';
import { useCompetitionCommand } from '../../competitions/useCompetitionCommand';
import { useCompetitionTime } from '../../competitions/useCompetitionTime';
import { CompetitionRecoveryPanel } from '../../competitions/CompetitionRecoveryPanel';
import { cancelFixture, fetchTournament } from '../api';
import type { TournamentDetail, TournamentFixtureDto } from '../domain';
import { distinctParticipantNames } from '../participantLabels';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { VenueReservationSummary } from '../../eventVenues/VenueReservationSummary';
import { ScoreInputs } from '../../scores/ScoreInputs';

interface Props {
    tournament: TournamentDetail; fixture: TournamentFixtureDto; profile: Profile;
    canManage: boolean; canScore: boolean; onUpdate: (value: TournamentDetail) => void; onClose: () => void;
}

/** Managed fixtures share one canonical slot and a versioned result receipt. */
export function ManagedTournamentMatchDialog({ tournament, fixture, profile, canManage, canScore, onUpdate, onClose }: Props) {
    const { i18n } = useTranslation();
    const copy = (en: string, ka: string) => i18n.language.startsWith('ka') ? ka : en;
    const rules = profile.rules!;
    const [home, setHome] = useState(fixture.homeScore == null ? '' : String(fixture.homeScore));
    const [away, setAway] = useState(fixture.awayScore == null ? '' : String(fixture.awayScore));
    const [kickoff, setKickoff] = useState(fixture.scheduledAt?.slice(0, 16) ?? '');
    const [pitch, setPitch] = useState<number>();
    const [reason, setReason] = useState('');
    const [draw, setDraw] = useState<DrawState>();
    const [loadError, setLoadError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [now, setNow] = useState(Date.now);
    const [confirm, setConfirm] = useState<'cancel' | 'reopen' | null>(null);
    const [otherBusy, setOtherBusy] = useState(false);
    const commands = useCompetitionCommand();
    const time = useCompetitionTime(rules.timezone);
    const busy = commands.busy || otherBusy;
    const ref = useRef<HTMLDivElement>(null);
    useDialogFocus(true, ref, () => { if (!busy) onClose(); });
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 5000);
        return () => window.clearInterval(timer);
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        void getDraw(tournament.id, controller.signal).then(value => {
            if (controller.signal.aborted) return;
            setDraw(value); setLoadError('');
            setPitch(value.slots.find(slot => slot.fixture_id === fixture.id)?.pitch_number);
        }).catch(error => { if (!controller.signal.aborted) setLoadError(extractApiErrorMessage(error, 'Could not load the saved pitch slot.')); });
        return () => controller.abort();
    }, [tournament.id, fixture.id, fixture.scheduledAt, attempt]);
    const refresh = async () => { onUpdate(await fetchTournament(tournament.id)); setAttempt(value => value + 1); };
    const name = distinctParticipantNames(tournament.entries);
    const homeName = name(tournament.entries.find(entry => entry.id === fixture.homeEntryId));
    const awayName = name(tournament.entries.find(entry => entry.id === fixture.awayEntryId));
    const valid = home !== '' && away !== '' && [Number(home), Number(away)].every(value => Number.isInteger(value) && value >= 0 && value <= 999);
    const active = tournament.status === 'ACTIVE';
    const end = fixture.scheduledAt ? Date.parse(fixture.scheduledAt) + rules.matchMinutes * 60000 : Number.NaN;
    const fullTime = Number.isFinite(end) && now >= end;
    const score = async (action: 'COMPLETE' | 'CORRECT' | 'REOPEN') => {
        const winner = Number(home) === Number(away) ? null : Number(home) > Number(away) ? fixture.homeEntryId : fixture.awayEntryId;
        await commands.run('fixtures/result', {
            fixtureId: fixture.id, action,
            homeScore: action === 'REOPEN' ? null : Number(home), awayScore: action === 'REOPEN' ? null : Number(away),
            winnerEntryId: action === 'COMPLETE' ? winner : null,
            reason: reason.trim() || copy('Final score confirmed by tournament operator', 'საბოლოო ანგარიში დადასტურებულია ტურნირის ორგანიზატორის მიერ'),
        }, profile.revision, payload => saveCompetitionResult(tournament.id, payload), async value => { onUpdate(value); setConfirm(null); }, () => { void refresh().catch(() => {}); });
    };
    const schedule = async () => {
        const startsAt = time.resolve(kickoff);
        if (!startsAt || pitch == null || !reason.trim()) return;
        await commands.run('fixtures/postpone', { fixtureId: fixture.id, startsAt, pitch, locationId: fixture.locationId, reason: reason.trim() }, profile.revision,
            payload => operation(tournament.id, 'fixtures/postpone', payload), refresh, () => { void refresh().catch(() => {}); });
    };
    const cancel = async () => {
        if (busy) return;
        setOtherBusy(true); setLoadError('');
        try { onUpdate(await cancelFixture(tournament.id, fixture.id)); setConfirm(null); }
        catch (error) { setLoadError(extractApiErrorMessage(error, copy('Could not cancel the fixture.', 'მატჩი ვერ გაუქმდა.'))); }
        finally { setOtherBusy(false); }
    };
    return <div className="tw-modal-backdrop"><div ref={ref} className="tw-dialog" role="dialog" aria-modal="true" aria-labelledby="managed-match-title">
        <header className="tw-section-title"><div><h2 id="managed-match-title">{copy('Match details', 'მატჩის დეტალები')}</h2><p>{homeName} vs {awayName}</p></div><button type="button" className="tw-icon" disabled={busy} onClick={onClose} aria-label={copy('Close match', 'მატჩის დახურვა')}><X size={18}/></button></header>
        <p>{fixture.stageName} · {fixture.status} · {rules.timezone}</p>
        <VenueReservationSummary value={fixture.venueReservation}/>
        {canManage && <Link className="tw-button" to={`/tournaments/${tournament.id}/workspace?view=bracket`}>{copy('Venue reservations & referee appointments', 'სტადიონის ჯავშნები და მსაჯების დანიშვნა')}</Link>}
        <CompetitionRecoveryPanel id={tournament.id} changed={refresh}/>
        {(commands.error || loadError || time.error) && <p role="alert">{commands.error || loadError || time.error} <button type="button" className="tw-button" disabled={busy} onClick={() => { setAttempt(value => value + 1); void refresh().catch(() => {}); }}>{copy('Refresh saved match', 'შენახული მატჩის განახლება')}</button></p>}
        {commands.notice && <p role="status">{commands.notice}</p>}
        <div className="gk"><ScoreInputs home={{ name: homeName }} away={{ name: awayName }} value={{ home, away }} onChange={value => { setHome(value.home); setAway(value.away); }}
            disabled={busy || !canScore || !active || fixture.status === 'CANCELLED'}/></div>
        {canScore && active && !fullTime && fixture.status === 'SCHEDULED' && <p>{copy('Confirm the final result after full time.', 'საბოლოო შედეგი დაადასტურეთ მატჩის დასრულების შემდეგ.')}</p>}
        {valid && home === away && tournament.stages.find(stage => stage.id === fixture.stageId)?.stageType === 'KNOCKOUT' && <p>{copy('Save the tied score, then record the tie decision in Draw & qualification.', 'შეინახეთ ფრე ანგარიში, შემდეგ ჩაწერეთ გადაწყვეტილება ბადის მართვის განყოფილებაში.')}</p>}
        {(canManage || canScore) && <label>{copy('Reason or result note', 'მიზეზი ან შედეგის შენიშვნა')}<textarea value={reason} maxLength={1000} disabled={busy} onChange={event => setReason(event.target.value)}/></label>}
        {canScore && active && fixture.status !== 'CANCELLED' && <div className="tw-actions">
            <button type="button" className="tw-button" disabled={busy || !valid || fixture.homeEntryId == null || fixture.awayEntryId == null || (fixture.status === 'SCHEDULED' ? !fullTime : !reason.trim())} onClick={() => void score(fixture.status === 'COMPLETED' ? 'CORRECT' : 'COMPLETE')}>{fixture.status === 'COMPLETED' ? copy('Save score correction', 'ანგარიშის შესწორება') : copy('Confirm final result', 'საბოლოო შედეგის დადასტურება')}</button>
            {fixture.status === 'COMPLETED' && canManage && <button type="button" className="tw-button" disabled={busy || !reason.trim()} onClick={() => setConfirm('reopen')}>{copy('Reopen result', 'შედეგის ხელახლა გახსნა')}</button>}
        </div>}
        {canManage && ['PLANNING', 'ACTIVE'].includes(tournament.status) && fixture.status === 'SCHEDULED' && <form onSubmit={event => { event.preventDefault(); void schedule(); }}>
            <h3>{copy('Schedule', 'განრიგი')}</h3>
            <label>{copy('Kickoff', 'დაწყების დრო')} ({rules.timezone})<input type="datetime-local" required aria-label={copy('Kickoff', 'დაწყების დრო')} value={kickoff} min={tournament.startDate?.slice(0, 16)} max={tournament.endDate?.slice(0, 16)} disabled={busy || !draw} onChange={event => setKickoff(event.target.value)}/></label>
            <label>{copy('Pitch allocation', 'მოედნის განაწილება')}<select required value={pitch ?? ''} disabled={busy || !draw} onChange={event => setPitch(Number(event.target.value))}><option value="">{copy('Choose pitch', 'აირჩიეთ მოედანი')}</option>{Array.from({ length: rules.pitches }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
            <button className="tw-button" type="submit" disabled={busy || !draw || pitch == null || !kickoff || !reason.trim()}>{copy('Save kickoff', 'დროის შენახვა')}</button>
            {active && <button type="button" className="tw-button" disabled={busy} onClick={() => setConfirm('cancel')}>{copy('Cancel fixture', 'მატჩის გაუქმება')}</button>}
        </form>}
        <ConfirmDialog open={confirm != null} title={confirm === 'reopen' ? copy('Reopen this result?', 'გაიხსნას შედეგი ხელახლა?') : copy('Cancel this fixture?', 'გაუქმდეს ეს მატჩი?')} message={copy('The saved match and its history remain available.', 'შენახული მატჩი და მისი ისტორია ხელმისაწვდომი დარჩება.')} confirmLabel={copy('Confirm', 'დადასტურება')} onCancel={() => { if (!busy) setConfirm(null); }} onConfirm={() => { void (confirm === 'reopen' ? score('REOPEN') : cancel()); }}/>
    </div></div>;
}
