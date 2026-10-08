import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, Check, ChevronDown, ClipboardCheck, MapPin, ShieldCheck, Users } from 'lucide-react';
import { get, label, transitionLabel, type OperationRecord } from './api';
import { appointmentDate } from './appointmentDate';
import { dateTime, type FamilyPlan } from '../mapPlanning/api';

export type GuardianPermission = OperationRecord & { club_name: string; child_name: string; event_title?: string };

export function GuardianPermissions({ items, selected, busy, onAction }: {
    items: GuardianPermission[]; selected: string | null; busy: boolean;
    onAction: (request: GuardianPermission, status: string) => Promise<void>;
}) {
    const [journeys, setJourneys] = useState<FamilyPlan[]>([]);
    useEffect(() => {
        if (!items.length) return;
        const abort = new AbortController();
        void get<FamilyPlan[]>('/map/plans/family', abort.signal).then(value => {
            if (!abort.signal.aborted && Array.isArray(value)) setJourneys(value);
        }).catch(() => { /* The permission and its exact terms remain independently available. */ });
        return () => abort.abort();
    }, [items]);
    const pending = items.filter(p => p.status === 'PENDING');
    const previous = items.filter(p => p.status !== 'PENDING');
    const card = (p: GuardianPermission) => <PermissionCard key={p.id} request={p} selected={selected === String(p.id)}
        journey={journeys.find(j => j.permission_id === p.id)} busy={busy} onAction={status => onAction(p, status)} />;
    return <section className="connections-permissions connections-section" aria-labelledby="guardian-permissions-title">
        <header><span className="connections-section-icon"><ClipboardCheck size={20} /></span><div><h2 id="guardian-permissions-title">Permissions for your children</h2>
            <p>{pending.length ? `${pending.length} ${pending.length === 1 ? 'request needs' : 'requests need'} your decision.` : 'You’re up to date. Your previous decisions are kept here.'}</p></div>
            <span className="connections-count" data-pending={pending.length > 0}>{pending.length ? `${pending.length} to review` : <Check size={16} aria-label="Up to date" />}</span></header>
        <div className="permission-list">{pending.map(card)}</div>
        {!!previous.length && <details className="permission-history" open={previous.some(p => String(p.id) === selected) || undefined}>
            <summary>Previous decisions <span>{previous.length}</span><ChevronDown size={16} /></summary><div className="permission-list">{previous.map(card)}</div>
        </details>}
        {!items.length && <p className="connections-quiet-note">When your club requests permission for an activity, you can review the arrangements and reply here.</p>}
    </section>;
}

function PermissionCard({ request: p, selected, journey, busy, onAction }: {
    request: GuardianPermission; selected: boolean; journey?: FamilyPlan; busy: boolean; onAction: (status: string) => Promise<void>;
}) {
    const [expanded, setExpanded] = useState(selected), summary = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (!selected) return;
        const frame = requestAnimationFrame(() => {
            setExpanded(true);
            summary.current?.focus({ preventScroll: true });
            summary.current?.scrollIntoView?.({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        });
        return () => cancelAnimationFrame(frame);
    }, [selected]);
    const known = new Set(['purpose', 'wording', 'version', 'expiresOn', 'collector', 'relationship', 'contact', 'instructions']);
    const additional = Object.entries(p.data).filter(([key, value]) => !known.has(key) && value);
    return <article className="permission-card" data-expanded={expanded} id={`permission-${p.id}`}>
        <button ref={summary} type="button" className="permission-summary" aria-expanded={expanded} aria-controls={`permission-body-${p.id}`} onClick={() => setExpanded(v => !v)}>
            <span className="permission-avatar" aria-hidden="true">{p.child_name.split(' ').slice(0, 2).map(n => n[0]).join('')}</span>
            <span className="permission-summary-text"><span>{p.child_name} <span className="permission-club">· {p.club_name}</span></span><strong>{p.title}</strong>
                <small>{p.data.purpose ? `${label(p.data.purpose)} permission` : 'Collection authorisation'}{p.due_on ? ` · ${appointmentDate(p.due_on)}` : ''}</small></span>
            <span className="permission-state" data-state={p.status}>{label(p.status === 'PENDING' ? 'AWAITING_REPLY' : p.status)}</span><ChevronDown className="permission-chevron" size={18} />
        </button>
        <div className="permission-reveal" data-open={expanded} id={`permission-body-${p.id}`} inert={!expanded} aria-hidden={!expanded}><div><div className="permission-body">
            {journey && <>
                <div className="permission-journey-heading"><span><ShieldCheck size={16} />Published journey · version {journey.version}</span><Link to={`/map?plans=family&journey=${journey.plan_id}&journeyChild=${journey.child_id}`}>View journey <ArrowUpRight size={15} /></Link></div>
                <dl className="permission-arrangements">
                    <div><dt><CalendarDays size={16} />When</dt><dd>{dateTime(journey.itinerary.startsAt, journey.itinerary.timezone)}<span>Return {dateTime(journey.itinerary.endsAt, journey.itinerary.timezone)} · {journey.itinerary.timezone}</span></dd></div>
                    <div><dt><MapPin size={16} />Destination</dt><dd>{journey.itinerary.destination}</dd></div>
                    <div><dt><MapPin size={16} />Meet & collect</dt><dd>{journey.itinerary.meetingPoint}<span>Collection · {journey.itinerary.collectionPoint}</span></dd></div>
                    <div><dt><Users size={16} />Supervision contact</dt><dd>{journey.itinerary.supervisionContact}</dd></div>
                </dl>
            </>}
            {p.kind === 'COLLECTION' && <dl className="permission-arrangements">
                {[['Authorised collector', p.data.collector], ['Relationship', p.data.relationship], ['Contact', p.data.contact]].filter(([, value]) => value).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}
            </dl>}
            <section className="permission-terms" aria-label="Exact permission terms"><h3>{p.kind === 'COLLECTION' ? 'Collection instructions' : 'What you’re agreeing to'}</h3>
                <p>{p.data.wording || p.data.instructions || 'Review the collector and contact details above before deciding.'}</p>
                <div className="permission-version">{p.data.version && <span>Terms version · {p.data.version}</span>}{p.data.expiresOn && <span>Valid until {appointmentDate(p.data.expiresOn)}</span>}</div>
            </section>
            {!!additional.length && <details className="permission-extra"><summary>Additional details</summary><dl className="permission-arrangements">{additional.map(([key, value]) => <div key={key}><dt>{label(key.replace(/([A-Z])/g, '_$1'))}</dt><dd>{value}</dd></div>)}</dl></details>}
            <footer className="permission-actions"><p>{p.status === 'GRANTED' ? 'Permission given. You can withdraw it when the request allows.' : p.status === 'PENDING' ? 'Your decision is recorded for this child and these terms.' : `Your decision: ${label(p.status).toLowerCase()}.`}</p>
                {!!p.transitions.length && <div>{p.transitions.map(status => <button type="button" key={status} className={status === 'GRANTED' ? 'ops-primary' : ''} disabled={busy} onClick={() => void onAction(status)}>{busy ? 'Saving…' : transitionLabel(p.kind, status)}</button>)}</div>}
            </footer>
        </div></div></div>
    </article>;
}
