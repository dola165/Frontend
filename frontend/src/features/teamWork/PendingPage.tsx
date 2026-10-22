import { useState } from 'react';
import { ArrowRight, Hourglass, ListPlus } from 'lucide-react';
import { PageHeader } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { changeRoadmap, changeWork, type Detail, type Person, type Roadmap, type RoadmapView, type WorkItem } from './api';
import { FindingCard, PickMenu } from './FindingCard';
import { NOTE, pushedBy } from './findings';
import { ago } from './teamWorkWords';

/**
 * Pending: findings someone pushed on, waiting for a decision. Each shows who pushed it and when; anyone can still
 * acknowledge or comment, and "Make it a task" turns it into a task, on its own or in a project.
 */
export function PendingPage({ pending, details, projects, views, team, me, open, onOpen, onPut, onChanged }: {
    pending: RoadmapView | undefined; details: Map<number, Detail>; projects: Roadmap[]; views: Map<number, RoadmapView>; team: Person[]; me: number | null; open: number | null;
    onOpen: (id: number | null) => void; onPut: (detail: Detail) => void; onChanged: () => void;
}) {
    const copy = useJourneyCopy();
    const [busy, setBusy] = useState<number | null>(null);
    const [error, setError] = useState('');
    const items = (pending?.pieces ?? []).map(node => node.item);
    const targets = projects.filter(project => project.status !== 'FINISHED');
    const make = async (item: WorkItem, projectId: number | null) => {
        if (!pending) return;
        setBusy(item.id); setError('');
        try {
            onPut(await changeWork(item.id, { version: details.get(item.id)?.item.version ?? item.version, update: NOTE.madeTask }));
            const project = projectId == null ? undefined : views.get(projectId);
            if (project) await changeRoadmap(project.roadmap.id, { version: project.roadmap.version, order: [...project.pieces.map(node => node.item.id), item.id] });
            await changeRoadmap(pending.roadmap.id, { version: pending.roadmap.version, order: pending.pieces.map(node => node.item.id).filter(id => id !== item.id) });
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('It couldn’t be made a task.', 'საქმედ ვერ იქცა.'))); }
        finally { setBusy(null); onChanged(); }
    };
    return <>
        <PageHeader title={copy('Pending', 'მოლოდინში')} subtitle={copy('Findings waiting for a decision', 'მიგნებები, რომლებიც გადაწყვეტილებას ელოდება')} />
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        <section className="tw-block" aria-labelledby="tw-pending">
            <h2 id="tw-pending" className="tw-heading"><Hourglass aria-hidden="true" />{copy('Waiting', 'ელოდება')} <span className="gk-faint gk-num">{items.length}</span></h2>
            {items.length ? <ul className="tw-findings">{items.map(item => {
                const detail = details.get(item.id);
                const pushed = detail ? pushedBy(detail) : null;
                return <FindingCard key={item.id} item={item} detail={detail} team={team} me={me} open={open === item.id} onOpen={onOpen} onPut={onPut}
                    line={pushed && <span className="tw-finding__seen"><ArrowRight aria-hidden="true" />{copy(`Pushed by ${pushed.author?.name ?? '—'} · ${ago(copy, pushed.at)}`, `გადმოიტანა ${pushed.author?.name ?? '—'} · ${ago(copy, pushed.at)}`)}</span>}
                    next={<PickMenu label={copy('Make it a task', 'საქმედ ქცევა')} icon={<ListPlus aria-hidden="true" />} disabled={busy !== null}
                        options={[{ key: 'own', label: copy('On its own', 'ცალკე') }, ...targets.map(project => ({ key: String(project.id), label: copy(`In ${project.name}`, `პროექტში: ${project.name}`) }))]}
                        onPick={key => void make(item, key === 'own' ? null : Number(key))} />} />;
            })}</ul>
                : <p className="gk-muted tw-quiet">{copy('Nothing pending.', 'მოლოდინში არაფერია.')}</p>}
        </section>
    </>;
}
