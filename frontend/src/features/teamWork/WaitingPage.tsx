import { useState } from 'react';
import { ArrowRight, ListPlus } from 'lucide-react';
import { Avatar, Button, PageHeader } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { AgendaDays } from '../schedule/board/AgendaDays';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { changePlan, changeWork, type Detail, type Person, type Plan, type PlanView, type WorkItem } from './api';
import { FindingRow, PickMenu } from './FindingRow';
import { NOTE, pushedBy, waitingOn } from './findings';
import { ago, shortDate } from './teamWorkWords';
import { useFresh } from './useFresh';
import './team-work-agenda.css';

/**
 * Waiting: findings someone pushed on, read as what needs whom. Each finding sits under the first person it still
 * waits on (you first): someone tagged in it who has not acknowledged it. The rest wait for a decision, which anyone
 * on the team can make with "Make it a task", on its own or in a plan. Rows are the agenda's, newest push first.
 */
export function WaitingPage({ waiting, details, plans, views, team, me, open, onOpen, onPut, onChanged, onIdeas }: {
    waiting: PlanView | undefined; details: Map<number, Detail>; plans: Plan[]; views: Map<number, PlanView>; team: Person[]; me: number | null; open: number | null;
    onOpen: (id: number | null) => void; onPut: (detail: Detail) => void; onChanged: () => void; onIdeas: () => void;
}) {
    const copy = useJourneyCopy();
    const [busy, setBusy] = useState<number | null>(null);
    const [error, setError] = useState('');
    const pushedAt = (item: WorkItem) => { const detail = details.get(item.id); return (detail && pushedBy(detail)?.at) ?? item.updatedAt; };
    const items = (waiting?.tasks ?? []).map(node => node.item).sort((a, b) => pushedAt(b).localeCompare(pushedAt(a)));
    const fresh = useFresh(waiting ? items.map(item => String(item.id)) : null);
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

    // What needs whom: you first, then the others by name, then what only waits for a decision.
    const groups = new Map<string, { person: Person | null; items: WorkItem[] }>();
    for (const item of items) {
        const people = waitingOn(details.get(item.id), team);
        const person = people.find(candidate => candidate.id === me) ?? people[0] ?? null;
        const key = person?.id != null ? `p${person.id}` : 'decision';
        groups.set(key, { person, items: [...groups.get(key)?.items ?? [], item] });
    }
    const order = (group: { person: Person | null }) => group.person == null ? 2 : group.person.id === me ? 0 : 1;
    const sorted = [...groups.entries()].sort(([, a], [, b]) => order(a) - order(b) || (a.person?.name ?? '').localeCompare(b.person?.name ?? ''));
    const heading = (person: Person | null, count: number) => {
        const name = person == null ? copy('Needs a decision', 'გადაწყვეტილებას ელოდება') : person.id === me ? copy('Needs you', 'გელოდებათ') : copy(`Needs ${person.name ?? '—'}`, `ელოდება: ${person.name ?? '—'}`);
        return { label: `${name}, ${count}`, title: <span className="tw-who-title">{person && <Avatar name={person.name} size={24} />}<span>{name}</span><span className="tw-agenda__date gk-num">{count}</span></span> };
    };

    return <>
        <PageHeader title={copy('Waiting', 'მოლოდინში')} subtitle={copy('What needs whom', 'რა ვის ელოდება')} />
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        <section className="tw-block tw-agenda tw-fresh-rows" aria-label={copy(`Waiting: ${items.length}`, `მოლოდინში: ${items.length}`)}>
            {items.length ? <AgendaDays className="tw-agenda__days" days={sorted.map(([key, group]) => {
                const { label, title } = heading(group.person, group.items.length);
                return { key, title, label, rows: group.items.map(item => {
                    const detail = details.get(item.id);
                    const pushed = detail ? pushedBy(detail) : null;
                    const at = pushedAt(item);
                    return <FindingRow key={item.id} item={item} detail={detail} team={team} me={me} open={open === item.id} time={shortDate(copy, new Date(at))} fresh={fresh.has(String(item.id))} newAsks={false}
                        state={group.person ? undefined : copy('Waiting for a decision', 'გადაწყვეტილებას ელოდება')}
                        line={pushed && <span><ArrowRight aria-hidden="true" />{copy(`Pushed by ${pushed.author?.name ?? '—'} · ${ago(copy, pushed.at)}`, `გადმოიტანა ${pushed.author?.name ?? '—'} · ${ago(copy, pushed.at)}`)}</span>}
                        onOpen={onOpen} onPut={onPut}
                        next={<PickMenu label={copy('Make it a task', 'საქმედ ქცევა')} icon={<ListPlus aria-hidden="true" />} disabled={busy !== null}
                            options={[{ key: 'own', label: copy('On its own', 'ცალკე') }, ...targets.map(plan => ({ key: String(plan.id), label: copy(`In ${plan.name}`, `გეგმაში: ${plan.name}`) }))]}
                            onPick={choice => void make(item, choice === 'own' ? null : Number(choice))} />} />;
                }) };
            })} />
                : <div className="tw-quiet-row" role="status"><span className="gk-muted">{copy('Nothing is waiting.', 'მოლოდინში არაფერია.')}</span>
                    <Button size="sm" onClick={onIdeas}>{copy('Go to Ideas', 'იდეებზე გადასვლა')}</Button></div>}
        </section>
    </>;
}
