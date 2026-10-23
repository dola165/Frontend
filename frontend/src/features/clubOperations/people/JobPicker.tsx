import { useId } from 'react';
import { Chip, Field } from '../../../design/primitives';
import { ScopeChips } from '../ScopeChips';
import { moduleNames } from '../api';
import { HELPER_JOBS, MAIN_JOBS, type JobDraft, type PeopleView } from './api';
import { useJobWords } from './jobWords';

/**
 * Which job and where: the five jobs first, the club's other bundles under More jobs, single tools under Custom.
 * A head coach sees only the helper jobs and the squads they coach.
 */
export function JobPicker({ view, draft, onChange, headCoachOnly, allowAdmin, disabled }: {
    view: PeopleView; draft: JobDraft; onChange: (draft: JobDraft) => void; headCoachOnly: boolean; allowAdmin: boolean; disabled?: boolean;
}) {
    const id = useId();
    const { copy, jobName } = useJobWords([...view.jobs, ...view.moreJobs]);
    const main = MAIN_JOBS.filter(job => headCoachOnly ? HELPER_JOBS.includes(job) : job !== 'ADMIN' || allowAdmin);
    const more = !MAIN_JOBS.includes(draft.job as typeof MAIN_JOBS[number]) && draft.job !== 'CUSTOM' && draft.job !== '';
    const choice = [...view.jobs, ...view.moreJobs].find(c => c.key === draft.job);
    const squads = headCoachOnly ? view.squads.filter(s => view.viewer.headCoachSquads.includes(s.id)) : view.squads;
    const set = (patch: Partial<JobDraft>) => onChange({ ...draft, ...patch });
    const toggleTool = (tool: string) => set({ tools: draft.tools.includes(tool) ? draft.tools.filter(t => t !== tool) : [...draft.tools, tool] });
    return <div className="pp-picker">
        <fieldset className="pp-picker__jobs" disabled={disabled}>
            <legend className="gk-field__label">{copy('Job', 'სამუშაო')}</legend>
            <div className="gk-chips" role="group" aria-label={copy('Job', 'სამუშაო')}>
                {main.map(job => <Chip key={job} pressed={draft.job === job} onClick={() => set({ job })}>{jobName(job)}</Chip>)}
                {!headCoachOnly && <>
                    <Chip pressed={more} onClick={() => set({ job: view.moreJobs[0]?.key ?? '' })}>{copy('More jobs', 'სხვა სამუშაოები')}</Chip>
                    <Chip pressed={draft.job === 'CUSTOM'} onClick={() => set({ job: 'CUSTOM' })}>{copy('Custom', 'საკუთარი')}</Chip>
                </>}
            </div>
            {choice && <p className="gk-field__hint">{choice.description}</p>}
            {headCoachOnly && <p className="gk-field__hint">{copy('For any other job, ask an admin.', 'სხვა სამუშაოსთვის მიმართეთ ადმინს.')}</p>}
        </fieldset>
        {more && <Field label={copy('More jobs', 'სხვა სამუშაოები')} htmlFor={`${id}-more`}>
            <select id={`${id}-more`} className="gk-input" value={draft.job} disabled={disabled} onChange={event => set({ job: event.target.value })}>
                {view.moreJobs.map(job => <option key={job.key} value={job.key}>{job.title}</option>)}
            </select>
        </Field>}
        {draft.job === 'CUSTOM' && <>
            <Field label={copy('Name of the job', 'სამუშაოს სახელი')} htmlFor={`${id}-title`}>
                <input id={`${id}-title`} className="gk-input" maxLength={120} value={draft.title} disabled={disabled} onChange={event => set({ title: event.target.value })} />
            </Field>
            <fieldset className="pp-picker__tools" disabled={disabled}>
                <legend className="gk-field__label">{copy('Tools', 'ხელსაწყოები')}</legend>
                <div className="pp-tools">{view.tools.map(tool => {
                    const [module, level] = tool.split(':');
                    return <label key={tool} className="pp-tool"><input type="checkbox" checked={draft.tools.includes(tool)} onChange={() => toggleTool(tool)} />
                        <span>{moduleNames[module] ?? module} · {level === 'WRITE' ? copy('manage', 'მართვა') : copy('view', 'ნახვა')}</span></label>;
                })}</div>
            </fieldset>
        </>}
        {draft.job === 'ADMIN'
            ? <p className="gk-field__hint">{copy('Admin applies to the whole club: every tool, its settings and its people.', 'ადმინი მთელ კლუბზე ვრცელდება: ყველა ხელსაწყო, პარამეტრები და ხალხი.')}</p>
            : <ScopeChips squads={squads} allowClubWide={!headCoachOnly} disabled={disabled} legend={copy('Where', 'სად')}
                value={{ clubWide: draft.clubWide, squadIds: draft.squadIds }} onChange={scope => set(scope)} />}
    </div>;
}
