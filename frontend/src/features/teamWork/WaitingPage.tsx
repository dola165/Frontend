import { useState } from 'react';
import { ArrowRight, Hourglass, ListPlus } from 'lucide-react';
import { PageHeader } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { changePlan, changeWork, type Detail, type Person, type Plan, type PlanView, type WorkItem } from './api';
import { FindingCard, PickMenu } from './FindingCard';
import { NOTE, pushedBy } from './findings';
import { ago } from './teamWorkWords';

/**
 * Waiting: findings someone pushed on, waiting for a decision. Each shows who pushed it and when; anyone can still
 * acknowledge or comment, and "Make it a task" turns it into a task, on its own or in a plan.
 */
export function WaitingPage({ waiting, details, plans, views, team, me, open, onOpen, onPut, onChanged }: {
    waiting: PlanView | undefined; details: Map<number, Detail>; plans: Plan[]; views: Map<number, PlanView>; team: Person[]; me: number | null; open: number | null;
    onOpen: (id: number | null) => void; onPut: (detail: Detail) => void; onChanged: () => void;
}) {
    const copy = useJourneyCopy();
    const [busy, setBusy] = useState<number | null>(null);
    const [error, setError] = useState('');
    const items = (waiting?.tasks ?? []).map(node => node.item);
    const targets = plans.filter(plan => plan.status !== 'FINISHED');
    const make = async (item: WorkItem, projectId: number | null) => {
        if (!waiting) return;
        setBusy(item.id); setError('');
        try {
            onPut(await changeWork(item.id, { version: details.get(item.id)?.item.version ?? item.version, update: NOTE.madeTask }));
            const plan = projectId == null ? undefined : views.get(projectId);
            if (plan) await changePlan(plan.plan.id, { version: plan.plan.version, order: [...plan.tasks.map(node => node.item.id), item.id] });
            await changePlan(waiting.plan.id, { version: waiting.plan.version, order: waiting.tasks.map(node => node.item.id).filter(id => id !== item.id) });
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('It couldn’t be made a task.', 'საქმედ ვერ იქცა.'))); }
        finally { setBusy(null); onChanged(); }
    };
    return <>
        <PageHeader title={copy('Waiting', 'მოლოდინში')} subtitle={copy('Findings waiting for a decision', 'მიგნებები, რომლებიც გადაწყვეტილებას ელოდება')} />
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        <section className="tw-block" aria-labelledby="tw-waiting">
            <h2 id="tw-waiting" className="tw-heading"><Hourglass aria-hidden="true" />{copy('Waiting', 'ელოდება')} <span className="gk-faint gk-num">{items.length}</span></h2>
            {items.length ? <ul className="tw-findings">{items.map(item => {
                const detail = details.get(item.id);
                const pushed = detail ? pushedBy(detail) : null;
                return <FindingCard key={item.id} item={item} detail={detail} team={team} me={me} open={open === item.id} onOpen={onOpen} onPut={onPut}
                    line={pushed && <span className="tw-finding__seen"><ArrowRight aria-hidden="true" />{copy(`Pushed by ${pushed.author?.name ?? '—'} · ${ago(copy, pushed.at)}`, `გადმოიტანა ${pushed.author?.name ?? '—'} · ${ago(copy, pushed.at)}`)}</span>}
                    next={<PickMenu label={copy('Make it a task', 'საქმედ ქცევა')} icon={<ListPlus aria-hidden="true" />} disabled={busy !== null}
                        options={[{ key: 'own', label: copy('On its own', 'ცალკე') }, ...targets.map(plan => ({ key: String(plan.id), label: copy(`In ${plan.name}`, `გეგმაში: ${plan.name}`) }))]}
                        onPick={key => void make(item, key === 'own' ? null : Number(key))} />} />;
            })}</ul>
                : <p className="gk-muted tw-quiet">{copy('Nothing waiting.', 'მოლოდინში არაფერია.')}</p>}
        </section>
    </>;
}
