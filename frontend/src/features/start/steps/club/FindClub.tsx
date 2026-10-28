import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { Loader2 } from 'lucide-react';
import { promptEmailConfirmation } from '../../../../components/auth/emailConfirmationPrompt';
import { useAuth } from '../../../../context/AuthContext';
import { Button, SearchInput, Skeleton } from '../../../../design/primitives';
import { refreshAccess } from '../../../../hooks/useCan';
import { extractApiErrorMessage } from '../../../../utils/apiError';
import { useOtherClub } from '../../../clubOperations/leaving/useOtherClub';
import { acceptClubInvite, joinStaffInvite, landingFor, previewStaffInvite, type StaffInvitePreview } from '../../../clubOperations/people/inviteLinkApi';
import { useJourneyCopy } from '../../../squadCommunication/journeyCopy';
import { Crest } from '../../../world/Crest';
import { fetchPendingClubInvites, staffCodeFrom, type PendingInvite } from '../../clubJoin';
import { searchClubs } from '../../startApi';
import { WelcomeFrame, type WelcomeStepProps } from '../../WelcomeFrame';
import './club-step.css';

export interface FoundClub { id: number; name: string; logoUrl: string | null; cityName: string | null }

/**
 * "Already in a club?": clubs by name, each with Join. Invited there: Join accepts the invite and opens the club.
 * Not invited: one field for the code the admin gave them (the staff link's code, or the whole link pasted). No club
 * by that name: back to starting it. Nobody asks to join (F2).
 */
export function FindClub({ land, back, close, query: typed, chosen: given, onStart }: WelcomeStepProps & { query: string; chosen: FoundClub | null; onStart: (name: string) => void }) {
    const copy = useJourneyCopy();
    const { refreshNavigationCapabilities } = useAuth();
    const other = useOtherClub();
    const [query, setQuery] = useState(typed);
    const [found, setFound] = useState<{ query: string; clubs: FoundClub[] } | null>(null);
    // The invites are asked for once, as the search opens; Join waits for them if they are still on their way.
    const invites = useRef<Promise<PendingInvite[]> | null>(null);
    const [invited, setInvited] = useState<PendingInvite[]>([]);
    const [asking, setAsking] = useState<FoundClub | null>(null);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState<number | null>(null);
    const [error, setError] = useState('');
    const codeId = useId();
    const searched = query.trim();

    useEffect(() => {
        const controller = new AbortController();
        invites.current = fetchPendingClubInvites(controller.signal);
        void invites.current.then(list => {
            if (controller.signal.aborted) return;
            setInvited(list);
            // A club already named ("Join it" on a name that exists): not invited there, the code field is open at once.
            if (given && !list.some(item => item.clubId === given.id)) setAsking(given);
        });
        return () => controller.abort();
    }, [given]);
    useEffect(() => {
        if (searched.length < 2) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            searchClubs(searched, controller.signal)
                .then(clubs => { if (!controller.signal.aborted) setFound({ query: searched, clubs }); })
                .catch(() => { if (!controller.signal.aborted) setFound({ query: searched, clubs: [] }); });
        }, 300);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [searched]);

    const failed = (failure: unknown, retry: () => void) => {
        if (!other.catchOther(failure, retry) && !promptEmailConfirmation(failure))
            setError(extractApiErrorMessage(failure, copy('That didn’t work. Try again.', 'ვერ მოხერხდა. სცადეთ თავიდან.')));
    };
    const opened = async (to: string) => {
        refreshAccess();
        await refreshNavigationCapabilities().catch(() => undefined);
        land('club', to);
    };
    const join = async (club: FoundClub) => {
        if (busy != null) return;
        setError(''); setBusy(club.id);
        const invite = (await (invites.current ?? Promise.resolve([]))).find(item => item.clubId === club.id);
        if (!invite) { setBusy(null); setAsking(club); setCode(''); return; }
        try {
            await acceptClubInvite(invite);
            await opened(invite.kind === 'APPOINTMENT' ? landingFor([invite]) : `/clubs/${club.id}`);
        } catch (failure) { failed(failure, () => void join(club)); setBusy(null); }
    };
    const joinWithCode = async (event?: FormEvent) => {
        event?.preventDefault();
        const club = asking, entered = staffCodeFrom(code);
        if (!club || !entered || busy != null) return;
        setError(''); setBusy(club.id);
        try {
            let preview: StaffInvitePreview;
            try { preview = await previewStaffInvite(entered); } catch (failure) {
                // The server said no to the code, or the check never arrived: two different things to tell the person.
                const answered = isAxiosError(failure) && failure.response != null && failure.response.status < 500;
                setError(answered ? copy('That code doesn’t work. Check it with your club’s admin.', 'ეს კოდი არ მუშაობს. გადაამოწმეთ კლუბის ადმინთან.')
                    : copy('Couldn’t check the code just now. Check your connection and try again.', 'კოდის შემოწმება ახლა ვერ მოხერხდა. შეამოწმეთ ინტერნეტი და სცადეთ ხელახლა.'));
                setBusy(null); return;
            }
            const refusal = preview.clubId !== club.id ? copy(`That code is for ${preview.clubName}.`, `ეს კოდი ${preview.clubName}-ისთვისაა.`)
                    : preview.status !== 'ACTIVE' ? copy('That code no longer works. Ask your club’s admin for a new one.', 'ეს კოდი აღარ მუშაობს. სთხოვეთ კლუბის ადმინს ახალი.') : null;
            if (refusal) { setError(refusal); setBusy(null); return; }
            const joined = await joinStaffInvite(entered);
            await opened(!preview.clubWide && joined.squads.length ? '/my-squads' : `/clubs/${joined.clubId}/office`);
        } catch (failure) { failed(failure, () => void joinWithCode()); setBusy(null); }
    };

    const isInvited = (club: FoundClub) => invited.some(item => item.clubId === club.id);
    const shown = searched.length >= 2 ? (found?.query === searched ? found.clubs : null) : invited.map(item => ({ id: item.clubId, name: item.clubName, logoUrl: item.clubLogoUrl, cityName: item.clubCity }));
    const list = given && !shown?.some(club => club.id === given.id) && searched === typed ? [given, ...(shown ?? [])] : shown;
    const row = (club: FoundClub) => <li key={club.id} className="gk-wjoin__item">
        <div className="gk-wjoin__row">
            <Crest src={club.logoUrl} name={club.name} size={40} />
            <span className="gk-wjoin__text"><strong>{club.name}</strong>
                <small>{[club.cityName, isInvited(club) ? copy('You’re invited', 'მოწვეული ხართ') : null].filter(Boolean).join(' · ')}</small></span>
            {asking?.id === club.id
                // While its code field is open, the one Join is the code's; this one puts the field away.
                ? <Button size="sm" variant="ghost" disabled={busy != null} onClick={() => { setAsking(null); setError(''); }}>{copy('Cancel', 'გაუქმება')}</Button>
                : <Button size="sm" variant={isInvited(club) ? 'primary' : 'secondary'} disabled={busy != null} aria-label={copy(`Join ${club.name}`, `შეუერთდით: ${club.name}`)} onClick={() => void join(club)}>
                    {busy === club.id && <Loader2 className="gk-welcome__spin" aria-hidden="true" />}{copy('Join', 'შეერთება')}
                </Button>}
        </div>
        {asking?.id === club.id && <form className="gk-wjoin__code" onSubmit={event => void joinWithCode(event)}>
            <label className="gk-welcome__field" htmlFor={codeId}>{copy('Enter the code your admin gave you', 'შეიყვანეთ კოდი, რომელიც ადმინმა მოგცათ')}</label>
            <span className="gk-wjoin__coderow">
                <input id={codeId} className="gk-input" value={code} autoFocus autoComplete="off" spellCheck={false} onChange={event => { setCode(event.target.value); setError(''); }} />
                <Button type="submit" variant="primary" disabled={!staffCodeFrom(code) || busy != null}>{busy === club.id && <Loader2 className="gk-welcome__spin" aria-hidden="true" />}{copy('Join', 'შეერთება')}</Button>
            </span>
        </form>}
    </li>;

    return <WelcomeFrame position={2} size="choose" onClose={close} back={back} title={copy('Find your club', 'იპოვეთ თქვენი კლუბი')}
        hint={copy('Join with your invite, or the code from your club’s admin.', 'შეუერთდით მოწვევით ან კლუბის ადმინის მოცემული კოდით.')} footer={null}>
        <SearchInput aria-label={copy('Club name', 'კლუბის სახელი')} placeholder={copy('Club name', 'კლუბის სახელი')} value={query} autoFocus={!given}
            onChange={event => { setQuery(event.target.value); setAsking(null); setError(''); }} />
        {list == null ? <div role="status" aria-label={copy('Looking for clubs', 'კლუბების ძებნა')} className="gk-welcome__loading"><Skeleton height={56} /><Skeleton height={56} /></div>
            : list.length ? <ul className="gk-wjoin" aria-label={copy('Clubs', 'კლუბები')}>{list.map(row)}</ul>
                : searched.length >= 2 && <div className="gk-notice" role="status">
                    <span>{copy('No club by that name yet.', 'ასეთი სახელის კლუბი ჯერ არ არის.')}</span>
                    <Button size="sm" onClick={() => onStart(searched)}>{copy(`Start ${searched}`, `დააარსეთ ${searched}`)}</Button>
                </div>}
        {error && <p role="alert" className="gk-notice gk-notice--warning">{error}</p>}
        {other.notice}
        <button type="button" className="gk-welcome__quiet" onClick={() => onStart(searched)}>{copy('Starting a new club instead?', 'ახალ კლუბს აარსებთ?')}</button>
    </WelcomeFrame>;
}
