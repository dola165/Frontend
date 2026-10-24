import type { Plan } from './api';

const PLAN_ORDER = { NOW: 0, LATER: 1, FINISHED: 2 } as const;

/** The plans above a plan, from its parent up: a plan can never be a step of one of these. */
export function ancestorsOf(plan: Plan, plans: Plan[]): number[] {
    const above: number[] = [];
    for (let parent = plan.partOf; parent && !above.includes(parent.id); parent = plans.find(candidate => candidate.id === parent!.id)?.partOf ?? null) above.push(parent.id);
    return above;
}

/** Plans in the order they are read: now, later, finished; a plan that is a step of another follows its parent. */
export function sortPlans(plans: Plan[]): Plan[] {
    const sorted = [...plans].sort((a, b) => PLAN_ORDER[a.status] - PLAN_ORDER[b.status]);
    const ids = new Set(sorted.map(plan => plan.id));
    const children = new Map<number, Plan[]>();
    sorted.forEach(plan => { if (plan.partOf && ids.has(plan.partOf.id)) children.set(plan.partOf.id, [...children.get(plan.partOf.id) ?? [], plan]); });
    const out: Plan[] = [];
    const add = (plan: Plan) => { if (out.includes(plan)) return; out.push(plan); children.get(plan.id)?.forEach(add); };
    sorted.filter(plan => !(plan.partOf && ids.has(plan.partOf.id))).forEach(add);
    sorted.forEach(add);
    return out;
}
