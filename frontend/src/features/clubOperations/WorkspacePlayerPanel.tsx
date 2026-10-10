import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ExternalLink, Plus } from 'lucide-react';
import { Badge, Button, EmptyNote, Field, List, ListRow, Section, Skeleton } from '../../design/primitives';
import { Dialog } from '../../design/Dialog';
import { squadLabel } from '../../components/squads/squadLabels';
import type { SquadRosterPlayer } from '../../components/squads/SquadRosterTable';
import { extractApiErrorMessage } from '../../utils/apiError';
import { coachHubEn } from '../../locales/workspaceDesign';
import { useCopy } from '../../locales/useCopy';
import { get, post, root, label, type Bootstrap, type OperationRecord } from './api';
import { operationTab, operationTabs } from './workspaceNavigation';
import type { OpenWorkspace } from './workspaceStructure';
import { useClubEditorClose } from './useClubEditorClose';
import { canReadSquad } from './squadAccess';
import './records/records.css';
import './player-panel.css';
import '../clubWorkspace/club-workspace.css';

type RecordGroup = { module: 'AVAILABILITY' | 'DEVELOPMENT'; rows: OperationRecord[]; error: string };
const TOOL_MODULES = ['DEVELOPMENT', 'ATTENDANCE', 'GUARDIANS', 'REGISTRATION', 'EQUIPMENT', 'TRAVEL'];

/**
 * One squad player's notes and tools, beside the list that opened it: their open restrictions, recent
 * development, a quick observation (saved as a draft to review in Development) and the tools for them.
 * Only records this person may read are requested; an unsaved observation is never dropped silently.
 */
export function WorkspacePlayerPanel({ player, squad, squadName, boot, onClose, onOpen }: { player: SquadRosterPlayer; squad: number; squadName: string; boot: Bootstrap | null; onClose: () => void; onOpen: OpenWorkspace }) {
    const { t } = useTranslation();
    const copy = useCopy('coachHub', coachHubEn);
    const [observation, setObservation] = useState(''), [nextSteps, setNextSteps] = useState(''), [adding, setAdding] = useState(false);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false), [revision, setRevision] = useState(0);
    const [records, setRecords] = useState<RecordGroup[] | null>(null);
    const draft = Boolean(observation.trim() || nextSteps.trim());
    const { requestClose, confirmation } = useClubEditorClose(draft, busy, onClose);
    const lock = useRef(false);
    const development = canReadSquad(boot, 'DEVELOPMENT', squad), restrictions = canReadSquad(boot, 'AVAILABILITY', squad);
    const writable = development && Boolean(boot?.modules.some(m => m.id === 'DEVELOPMENT' && (m.globalWrite || m.writeSquads.includes(squad))));
    const club = boot?.clubId;

    useEffect(() => {
        const controller = new AbortController();
        const modules: RecordGroup['module'][] = [...(restrictions ? ['AVAILABILITY' as const] : []), ...(development ? ['DEVELOPMENT' as const] : [])];
        void Promise.all(modules.map(async module => {
            try { return { module, rows: await get<OperationRecord[]>(`/clubs/${club}/workspace-roles/work?module=${module}&squad=${squad}&person=${player.id}${module === 'AVAILABILITY' ? '&state=open' : ''}`, controller.signal), error: '' }; }
            catch (failure) { return { module, rows: [], error: extractApiErrorMessage(failure, copy('infoError')) }; }
        })).then(value => { if (!controller.signal.aborted) setRecords(value); });
        return () => controller.abort();
        // copy changes with the language only; the request does not depend on it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [club, player.id, squad, development, restrictions, revision]);

    const save = async (event: FormEvent) => {
        event.preventDefault();
        if (lock.current || !writable || !observation.trim()) return;
        lock.current = true; setBusy(true); setError('');
        try {
            await post(`${root(club!)}/records`, { kind: 'OBSERVATION', title: `Observation · ${player.name} · ${new Date().toLocaleDateString()}`.slice(0, 160), squadId: squad, subjectUserId: player.id, data: { observation: observation.trim(), nextSteps: nextSteps.trim() } });
            setObservation(''); setNextSteps(''); setAdding(false); setSaved(true); setRevision(value => value + 1);
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('observationError'))); }
        finally { lock.current = false; setBusy(false); }
    };
    const cancelObservation = () => requestClose(() => { setObservation(''); setNextSteps(''); setAdding(false); });
    const facts = [squadName, player.number != null ? copy('shirt', { number: player.number }) : null, player.position ? squadLabel(player.position, t) : null, player.age != null ? copy('age', { age: player.age }) : null].filter(Boolean);
    const tools = operationTabs.filter(tool => TOOL_MODULES.includes(tool.module) && canReadSquad(boot, tool.module, squad));
    const context = { squad: String(squad), person: String(player.id) };

    const group = (item: RecordGroup): ReactNode => {
        const isRestriction = item.module === 'AVAILABILITY';
        return <Section key={item.module} title={isRestriction ? copy('restrictionsTitle') : copy('developmentTitle')}
            action={<button type="button" className="gk-section__action cw-text-button" onClick={() => onOpen(operationTab(item.module), context)}>{copy('viewAll')}</button>}>
            {item.error ? <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{item.error}</span><Button size="sm" onClick={() => setRevision(value => value + 1)}>{copy('retry')}</Button></div>
                : item.rows.length ? <List label={isRestriction ? copy('restrictionsTitle') : copy('developmentTitle')} className="wpp-records">{item.rows.slice(0, 4).map(record => <ListRow key={record.id}
                    title={record.title} meta={[isRestriction ? record.data.restrictions : label(record.status), record.data.reviewOn ? copy('reviewOn', { date: record.data.reviewOn }) : null].filter(Boolean).join(' · ')}
                    trail={isRestriction ? <Badge tone="warning">{label(record.status)}</Badge> : undefined}
                    onClick={() => onOpen(operationTab(record.module), { ...context, record: String(record.id) })} />)}</List>
                    : <p className="gk-muted wpp-quiet">{isRestriction ? copy('noRestrictions') : copy('noDevelopment')}</p>}
        </Section>;
    };

    return <Dialog open size="sheet" title={player.name} closeLabel={copy('panelClose')} onClose={() => requestClose()}
        description={<span className="wpp-facts">{facts.length ? facts.map(fact => <Badge key={String(fact)}>{fact}</Badge>) : copy('panelFallback')}</span>}>
        <div className="wpp-actions">
            {writable && !adding && <Button variant="primary" onClick={() => { setSaved(false); setAdding(true); }}><Plus aria-hidden="true" />{copy('addObservation')}</Button>}
            {player.isRegistered !== false && <Link className="gk-btn gk-btn--ghost" to={`/profile/${player.id}`}
                onClick={event => { if (draft || busy) { event.preventDefault(); setError(copy('saveFirst')); } }}>{copy('publicProfile')}<ExternalLink aria-hidden="true" /></Link>}
        </div>
        {saved && <p role="status" className="gk-notice cw-notices__success">{copy('observationSaved')}</p>}
        {error && <p role="alert" className="gk-notice gk-notice--danger">{error}</p>}
        {confirmation}
        {adding && <form className="wpp-observation" aria-label={copy('observationTitle')} onSubmit={event => void save(event)}>
            <Field label={copy('observationLabel')} htmlFor="wpp-observation">
                <textarea id="wpp-observation" className="gk-input" required rows={5} maxLength={4000} placeholder={copy('observationPlaceholder')} value={observation} onChange={event => setObservation(event.target.value)} disabled={busy} autoFocus />
            </Field>
            <Field label={<>{copy('nextSteps')} <span className="rec-optional">{copy('optional')}</span></>} htmlFor="wpp-next">
                <textarea id="wpp-next" className="gk-input" rows={2} maxLength={4000} value={nextSteps} onChange={event => setNextSteps(event.target.value)} disabled={busy} />
            </Field>
            <div className="gk-row">
                <Button type="submit" variant="primary" disabled={busy || !observation.trim()}>{busy ? copy('saving') : copy('saveObservation')}</Button>
                <Button variant="ghost" disabled={busy} onClick={cancelObservation}>{copy('cancel')}</Button>
            </div>
        </form>}
        {!boot ? <EmptyNote title={copy('workflowsUnavailable')} />
            : records === null ? <div className="cw-skeleton-rows" role="status" aria-label={copy('loadingInfo')}><Skeleton height={40} /><Skeleton height={40} /></div>
                : records.map(group)}
        {tools.length > 0 && <Section title={copy('playerTools')}>
            <List label={copy('playerTools')} className="wpp-records">{tools.map(tool => <ListRow key={tool.id} lead={<tool.icon aria-hidden="true" className="wpp-tool-icon" />} title={tool.label} onClick={() => onOpen(tool.id, context)} />)}</List>
        </Section>}
    </Dialog>;
}
