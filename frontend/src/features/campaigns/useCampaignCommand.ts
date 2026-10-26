import { promptEmailConfirmation } from '../../components/auth/emailConfirmationPrompt';
import { useEffect, useRef, useState } from 'react';
import { getAuthSessionId, getStoredUserId } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';
import { appLanguage } from '../../utils/formatting';
import { changeCampaignState, createCampaign, editCampaign, postCampaignUpdate, type Campaign, type CampaignInput, type CampaignState } from './api';

type Command = { kind: 'create'; input: CampaignInput } | { kind: 'edit'; id: number; input: CampaignInput }
    | { kind: 'state'; campaign: Campaign; status: CampaignState } | { kind: 'update'; campaign: Campaign; title: string; body: string };
type Attempt = { key: string; command: Command };
export const commandCopy = (key: 'retry' | 'held' | 'storage' | 'failure') => ({
    retry: ['Retry original change', 'საწყისი ცვლილების ხელახლა გაგზავნა'],
    held: ['The save was not confirmed. Retry the original change to check its saved result before making another change.', 'შენახვა არ დადასტურდა. სხვა ცვლილებამდე ხელახლა გაგზავნეთ საწყისი მოთხოვნა მისი შედეგის შესამოწმებლად.'],
    storage: ['Recovery storage is unavailable. Your change has not been sent.', 'აღდგენის საცავი მიუწვდომელია. ცვლილება არ გაგზავნილა.'],
    failure: ['The campaign change could not be confirmed.', 'კამპანიის ცვლილება ვერ დადასტურდა.'],
}[key][appLanguage() === 'ka' ? 1 : 0]);

const scopeFor = (club: number) => `gk-campaign-command:${getAuthSessionId() ?? 'legacy'}:${getStoredUserId() ?? 'guest'}:${club}`;
function read(scope: string): Attempt | null {
    const saved = sessionStorage.getItem(scope);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as Attempt;
    if (!parsed.key || !parsed.command || !['create', 'edit', 'state', 'update'].includes(parsed.command.kind)) throw new Error('Invalid campaign recovery record');
    return parsed;
}

/** A single explicit command survives reload; recovery sends its original payload and version. */
export function useCampaignCommand(clubId: number, onSaved: (campaign: Campaign) => void) {
    const scope = scopeFor(clubId), mounted = useRef(false), pending = useRef(false);
    const [initial] = useState(() => { try { return { attempt: read(scope), error: '' }; } catch { return { attempt: null, error: commandCopy('storage') }; } });
    const [attempt, setAttempt] = useState(initial.attempt), [error, setError] = useState(initial.error), [busy, setBusy] = useState(false);
    const current = useRef(attempt);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const active = () => mounted.current && scopeFor(clubId) === scope;
    const send = async (requested?: Command) => {
        if (!active() || pending.current) return;
        let saved: Attempt;
        try {
            // Always prefer the unresolved stored request over new form values.
            saved = read(scope) ?? { key: crypto.randomUUID(), command: JSON.parse(JSON.stringify(requested)) as Command };
            if (!saved.command) return;
            sessionStorage.setItem(scope, JSON.stringify(saved));
        } catch { setError(commandCopy('storage')); return; }
        current.current = saved; setAttempt(saved); pending.current = true; setBusy(true); setError('');
        try {
            const c = saved.command;
            const result = c.kind === 'create' ? await createCampaign(clubId, c.input, saved.key)
                : c.kind === 'edit' ? await editCampaign(clubId, c.id, c.input, saved.key)
                : c.kind === 'state' ? await changeCampaignState(clubId, c.campaign, c.status, saved.key)
                : await postCampaignUpdate(clubId, c.campaign, c.title, c.body, saved.key);
            if (!active() || current.current?.key !== saved.key) return;
            const expectedId = c.kind === 'create' ? result.id : c.kind === 'edit' ? c.id : c.campaign.id;
            if (result.clubId !== clubId || result.id !== expectedId || !Number.isSafeInteger(result.id) || result.id <= 0
                || !Number.isSafeInteger(result.version) || result.version < 0) throw new Error('Invalid campaign reply');
            sessionStorage.removeItem(scope); current.current = null; setAttempt(null); onSaved(result);
        } catch (failure) {
            if (!active()) return;
            const code = (failure as { response?: { status?: number } })?.response?.status;
            // Validation/conflict rejection keeps the editor for correction. An auth denial on retry
            // cannot establish whether the earlier response was lost after commit: retain its identity.
            if (code === 400 || code === 409 || code === 422) {
                try { sessionStorage.removeItem(scope); current.current = null; setAttempt(null); }
                catch { setError(commandCopy('storage')); return; }
            }
            if (!promptEmailConfirmation(failure)) setError(extractApiErrorMessage(failure, commandCopy('failure')));
        } finally { pending.current = false; if (active()) setBusy(false); }
    };
    return { attempt, busy, error, send };
}
