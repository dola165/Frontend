import { useEffect, useState } from 'react';
import { LoadFailed } from '../../../design/primitives';
import { apiClient } from '../../../api/axiosConfig';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { FamilyReply } from '../../squadCommunication/SessionAvailability';
import type { AttendancePerson } from '../../squadCommunication/attendance';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import type { SquadCalendarEvent } from '../../squadCommunication/useSquadSchedule';

type CallUp = { id: number; name: string; selected: boolean; response: string; revision: number; canRespond: boolean };
type Team = { squadId: number; squadName: string; canManage: boolean; players: CallUp[] };

/**
 * "Can't come" on a connected fixture (a match arranged through Match Exchange rather than a squad session): the
 * child's own call-up, answered with its revision and the match's, as the match page does. Nothing shows when the child
 * was not called up or the family may not answer for them. A refused answer says why and shows the call-up as it is now.
 */
export function FixtureReply({ event, playerId, ended, onSaved }: { event: SquadCalendarEvent; playerId: number; ended: boolean; onSaved: () => void }) {
    const copy = useJourneyCopy();
    const [load, setLoad] = useState(0);
    const [teams, setTeams] = useState<{ eventId: number; load: number; teams: Team[]; failed: boolean } | null>(null);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
    useEffect(() => {
        const abort = new AbortController();
        apiClient.get<Team[]>(`/match-arrangements/${event.eventId}/participants`, { signal: abort.signal })
            .then(response => {
                if (!abort.signal.aborted) setTeams({ eventId: event.eventId, load, teams: response.data, failed: false });
            }, failure => {
                if (abort.signal.aborted) return;
                const status = (failure as { response?: { status?: number } })?.response?.status;
                setTeams({ eventId: event.eventId, load, teams: [], failed: status !== 403 && status !== 404 });
            });
        return () => abort.abort();
    }, [event.eventId, load]);
    const current = teams?.eventId === event.eventId && teams.load === load ? teams : null;
    if (current?.failed) return <LoadFailed text={copy('Couldn’t load the call-up', 'გამოძახება ვერ ჩაიტვირთა')} retry={copy('Try again', 'ხელახლა ცდა')} onRetry={() => setLoad(n => n + 1)} />;
    const called = (team: Team) => team.players.some(player => player.id === playerId && player.selected);
    const team = current?.teams.find(item => item.squadId === event.squadId && called(item)) ?? current?.teams.find(called);
    const callUp = team?.players.find(player => player.id === playerId && player.selected);
    if (!team || !callUp?.canRespond || event.matchRevision == null) return error ? <p className="ph-next__note ph-next__note--error" role="alert">{error}</p> : null;
    const person = { id: callUp.id, name: callUp.name, response: callUp.response, active: true } as AttendancePerson;
    const reply = async (_: AttendancePerson, response: string) => {
        if (busy) return;
        setBusy(true); setError(''); setSaved(false);
        try {
            await apiClient.post(`/match-arrangements/${event.eventId}/squads/${team.squadId}/attendance`, { playerId, response, revision: callUp.revision, matchRevision: event.matchRevision });
            setSaved(true); onSaved();
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('Your answer could not be saved.', 'პასუხი ვერ შეინახა.'))); onSaved(); }
        finally { setBusy(false); setLoad(n => n + 1); }
    };
    return <>
        <FamilyReply person={person} asking={false} optOut busy={busy} ended={ended} onReply={(who, response) => void reply(who, response)} reasons={false} />
        {error && <p className="ph-next__note ph-next__note--error" role="alert">{error}</p>}
        {saved && !error && <p className="ph-next__note" role="status">{copy('Saved. The coach sees it.', 'შენახულია. მწვრთნელი ხედავს.')}</p>}
    </>;
}
