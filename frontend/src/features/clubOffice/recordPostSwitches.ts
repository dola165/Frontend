import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { apiClient } from '../../api/axiosConfig';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';

/** The kinds of post a club's records write (step 7), one switch each, all on unless switched off. */
export type RecordPostKind = 'TRIAL' | 'SQUAD' | 'JOB' | 'PROJECT' | 'TOURNAMENT' | 'RESULTS' | 'WEEKEND';
export interface RecordPostSwitches { kinds: { kind: RecordPostKind; on: boolean }[]; version: number; canChange: boolean }

export const fetchRecordPostSwitches = (clubId: number) =>
    apiClient.get<RecordPostSwitches>(`/clubs/${clubId}/record-posts`).then(response => response.data);

/** Saves the kinds switched off; a 409 means someone changed them meanwhile. */
export const saveRecordPostSwitches = (clubId: number, off: RecordPostKind[], version: number) =>
    apiClient.put<RecordPostSwitches>(`/clubs/${clubId}/record-posts`, { off, version }).then(response => response.data);

/** The switches' words, shared by Club office › Settings and the club page's Posts tab. */
export function useRecordPostWords() {
    const copy = useJourneyCopy();
    return { title: copy('Posts from the club’s work', 'პოსტები კლუბის საქმიანობიდან'), hint: copy('All on. Off stops new posts of that kind.', 'ყველა ჩართულია. გამორთვა ახალ პოსტებს აჩერებს.') };
}

type State = { switches: RecordPostSwitches | null; failed: boolean; busy: boolean; changedElsewhere: boolean };

/** The club's switches, with honest loading and failure, and a toggle that keeps the version. */
export function useRecordPostSwitches(clubId: number) {
    const [state, setState] = useState<State>({ switches: null, failed: false, busy: false, changedElsewhere: false });
    const [round, setRound] = useState(0);
    useEffect(() => {
        let live = true;
        fetchRecordPostSwitches(clubId).then(
            switches => { if (live) setState(current => ({ ...current, switches, failed: false })); },
            () => { if (live) setState(current => ({ ...current, failed: true })); });
        return () => { live = false; };
    }, [clubId, round]);
    const reload = () => { setState(current => ({ ...current, failed: false })); setRound(value => value + 1); };
    const toggle = async (kind: RecordPostKind, on: boolean) => {
        const current = state.switches;
        if (!current || state.busy) return;
        const off = current.kinds.filter(item => (item.kind === kind ? !on : !item.on)).map(item => item.kind);
        setState(value => ({ ...value, busy: true, failed: false, changedElsewhere: false, switches: { ...current, kinds: current.kinds.map(item => item.kind === kind ? { ...item, on } : item) } }));
        try {
            const saved = await saveRecordPostSwitches(clubId, off, current.version);
            setState(value => ({ ...value, busy: false, switches: saved }));
        } catch (failure) {
            const conflict = isAxiosError(failure) && failure.response?.status === 409;
            setState(value => ({ ...value, busy: false, switches: current, changedElsewhere: conflict, failed: !conflict }));
            if (conflict) setRound(value => value + 1);
        }
    };
    return { ...state, reload, toggle };
}
