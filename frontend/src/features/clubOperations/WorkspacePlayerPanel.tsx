import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { Avatar, Badge, Button, EmptyNote, Field, List, ListRow, Panel, Section, Skeleton } from '../../design/primitives';
import { Dialog } from '../../design/Dialog';
import { squadLabel } from '../../components/squads/squadLabels';
import type { SquadRosterPlayer } from '../../components/squads/SquadRosterTable';
import { extractApiErrorMessage } from '../../utils/apiError';
import { formatDate } from '../../utils/formatting';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { coachHubEn } from '../../locales/workspaceDesign';
import { useCopy } from '../../locales/useCopy';
import { get, post, root, label, type Bootstrap, type OperationRecord } from './api';
import { operationTabs } from './workspaceNavigation';
import { useClubEditorClose } from './useClubEditorClose';
import { guardWorkspaceNavigation } from './workspaceGuard';
import { canReadSquad } from './squadAccess';
import { withoutScope } from './scopedParams';
import { WorkDrawer } from './WorkDrawer';
import './records/records.css';
import './player-panel.css';
import '../clubWorkspace/club-workspace.css';

type RecordGroup = { module: 'AVAILABILITY' | 'DEVELOPMENT'; rows: OperationRecord[]; error: string };
// Everything the club keeps about one player opens here, filtered to them; attendance stays on paper (the owner, 14 October).
const TOOL_MODULES = ['DEVELOPMENT', 'GUARDIANS', 'REGISTRATION', 'EDUCATION', 'MEDICAL', 'WELFARE', 'DEPARTURES', 'EQUIPMENT', 'TRAVEL'];

/**
 * One squad player's notes and tools, beside the list that opened it: their open restrictions, recent
 * development, a quick observation (saved as a draft to review in Development) and the tools for them.
 * A tool or record opens in a drawer that slides in beside the sheet, so the coach never leaves the page;
 * which one is open lives in the URL (`tool`, `tool.record`). Only records this person may read are
 * requested; an unsaved observation or record is never dropped silently.
 */
export function WorkspacePlayerPanel({ player, squad, squadName, boot, onClose, onChanged, onRemove }: {
    player: SquadRosterPlayer; squad: number; squadName: string; boot: Bootstrap | null; onClose: () => void;
    /** A record was saved in a tool opened from here, so the page behind may refresh its signs. */ onChanged?: () => void;
    /** Takes the player out of this squad (the roster is managed wherever the player is seen). */ onRemove?: () => void;
}) {
    const { t } = useTranslation();
    const copy = useCopy('coachHub', coachHubEn);
    const [params, setParams] = useSearchParams();
    const [observation, setObservation] = useState(''), [nextSteps, setNextSteps] = useState(''), [adding, setAdding] = useState(false);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false), [revision, setRevision] = useState(0);
    const [records, setRecords] = useState<RecordGroup[] | null>(null);
    const [closing, setClosing] = useState(false);
    const draft = Boolean(observation.trim() || nextSteps.trim());
    const { requestClose, confirmation } = useClubEditorClose(draft, busy, onClose);
    const lock = useRef(false);
    const development = canReadSquad(boot, 'DEVELOPMENT', squad), restrictions = canReadSquad(boot, 'AVAILABILITY', squad);
    const writable = development && Boolean(boot?.modules.some(m => m.id === 'DEVELOPMENT' && (m.globalWrite || m.writeSquads.includes(squad))));
    const club = boot?.clubId;
    const tools = operationTabs.filter(tool => TOOL_MODULES.includes(tool.module) && canReadSquad(boot, tool.module, squad));

    // The open tool belongs to this player and squad, and to a module this person may read.
    const readable = [...(restrictions ? ['AVAILABILITY'] : []), ...(development ? ['DEVELOPMENT'] : []), ...tools.map(tool => tool.module)];
    const asked = params.get('tool'), forThisPlayer = params.get('tool.person') === String(player.id) && params.get('tool.squad') === String(squad);
    const module = boot && asked && forThisPlayer && readable.includes(asked) ? asked : null;
    const openRecord = module ? params.get('tool.record') : null;
    const listedHere = (id: string | null) => Boolean(id && records?.some(item => item.rows.some(record => String(record.id) === id)));
    const toolLabel = operationTabs.find(tool => tool.module === module)?.label ?? '';

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

    /** Opens a tool (or one of its records) in the drawer; a changed record in the open drawer asks first. */
    const openTool = (target: string, record?: number) => {
        const go = () => {
            const next = withoutScope(params, 'tool');
            next.set('tool', target); next.set('tool.squad', String(squad)); next.set('tool.person', String(player.id));
            if (record) next.set('tool.record', String(record));
            setClosing(false); setParams(next);
        };
        if (module) guardWorkspaceNavigation(go, 'tool'); else go();
    };
    const closeTool = () => guardWorkspaceNavigation(() => setClosing(true), 'tool');
    const closedTool = () => { setClosing(false); setParams(withoutScope(params, 'tool'), { replace: true }); };
    // Closing the sheet closes its drawer too, asking about unsaved work in either.
    const closeSheet = () => guardWorkspaceNavigation(() => requestClose(() => {
        if (asked) setParams(withoutScope(params, 'tool'), { replace: true });
        onClose();
    }), 'tool');

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

    const group = (item: RecordGroup): ReactNode => {
        const isRestriction = item.module === 'AVAILABILITY';
        // Each group is one calm box, like the drawer beside it: a title, then rows or one quiet line.
        return <Section key={item.module} boxed title={isRestriction ? copy('restrictionsTitle') : copy('developmentTitle')} hint={item.rows.length ? `${item.rows.length}` : undefined}
            action={<button type="button" className="gk-section__action cw-text-button" onClick={() => openTool(item.module)}>{copy('viewAll')}</button>}>
            <Panel flush>{item.error ? <div className="cw-panel-notice"><div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{item.error}</span><Button size="sm" onClick={() => setRevision(value => value + 1)}>{copy('retry')}</Button></div></div>
                : item.rows.length ? <List label={isRestriction ? copy('restrictionsTitle') : copy('developmentTitle')} className="wpp-records">{item.rows.slice(0, 4).map(record => <ListRow key={record.id}
                    lead={<span className={`cw-dot cw-dot--${isRestriction ? 'warning' : record.status === 'DRAFT' ? 'neutral' : 'info'}`} aria-hidden="true" />}
                    title={record.title.split(' — ')[0]} meta={[isRestriction ? record.data.restrictions : label(record.status), record.data.reviewOn ? copy('reviewOn', { date: formatDate(record.data.reviewOn.slice(0, 10), { day: 'numeric', month: 'short' }) }) : null].filter(Boolean).join(' · ')}
                    trail={isRestriction ? <Badge tone="warning">{label(record.status)}</Badge> : undefined} current={openRecord === String(record.id)}
                    onClick={() => openTool(record.module, record.id)} />)}</List>
                    : <EmptyNote title={isRestriction ? copy('noRestrictions') : copy('noDevelopment')} />}</Panel>
        </Section>;
    };

    return <Dialog open size="sheet" title={player.name} closeLabel={copy('panelClose')} onClose={closeSheet} onEscape={() => module ? closeTool() : closeSheet()}
        description={<span className="wpp-facts">{facts.length ? facts.map(fact => <Badge key={String(fact)}>{fact}</Badge>) : copy('panelFallback')}</span>}>
        <div className="wpp-actions">
            {writable && !adding && <Button variant="primary" onClick={() => { setSaved(false); setAdding(true); }}><Plus aria-hidden="true" />{copy('addObservation')}</Button>}
            {/* The public profile opens in a new tab, so the work here stays where it is. */}
            {player.isRegistered !== false && <Link className="gk-btn gk-btn--ghost" to={`/profile/${player.id}`} target="_blank" rel="noreferrer">{copy('publicProfile')}<ExternalLink aria-hidden="true" /></Link>}
            {onRemove && <Button variant="ghost" className="wpp-remove" onClick={onRemove}><Trash2 aria-hidden="true" />{copy('removeFromSquad', { squad: squadName })}</Button>}
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
        {tools.length > 0 && <Section boxed title={copy('playerTools')}>
            <Panel flush><List label={copy('playerTools')} className="wpp-records">{tools.map(tool => <ListRow key={tool.id} lead={<tool.icon aria-hidden="true" className="wpp-tool-icon" />} title={tool.label}
                trail={<ChevronRight className="cw-chevron" aria-hidden="true" />} current={module === tool.module && !listedHere(openRecord)} onClick={() => openTool(tool.module)} />)}</List></Panel>
        </Section>}
        {module && boot && <WorkDrawer boot={boot} module={module} label={`${toolLabel}: ${player.name}`} closing={closing} onClose={closeTool} onClosed={closedTool}
            context={<><Avatar src={resolveMediaUrl(player.photoUrl) || null} name={player.name} size={24} /><strong>{player.name}</strong><span>{squadName}</span></>}
            onRefresh={async () => { setRevision(value => value + 1); onChanged?.(); }} />}
    </Dialog>;
}
