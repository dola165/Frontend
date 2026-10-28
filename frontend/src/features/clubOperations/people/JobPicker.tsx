import { useId, useState } from 'react';
import { Chip, Field } from '../../../design/primitives';
import { ScopeChips } from '../ScopeChips';
import { moduleNames } from '../api';
import { type JobDraft, type PeopleView } from './api';
import { useJobWords } from './jobWords';

/**
 * Which job and where: the main jobs first (`choices`), then, with `extras`, the club's other bundles under More jobs
 * and single tools under Custom. Admin always applies to the whole club.
 */
export function JobPicker({ view, draft, onChange, choices, extras, disabled }: {
    view: PeopleView; draft: JobDraft; onChange: (draft: JobDraft) => void; choices: readonly string[]; extras: boolean; disabled?: boolean;
}) {
    const id = useId();
    const [titleFocused, setTitleFocused] = useState(false);
    const [titleEdited, setTitleEdited] = useState(false);
    const { copy, jobName, titleName } = useJobWords([...view.jobs, ...view.moreJobs]);
    const more = extras && !view.jobs.some(job => job.key === draft.job) && draft.job !== 'CUSTOM' && draft.job !== '';
    const choice = [...view.jobs, ...view.moreJobs].find(c => c.key === draft.job);
    const set = (patch: Partial<JobDraft>) => onChange({ ...draft, ...patch });
    const choose = (job: string) => {
        if (draft.job === job) return;
        setTitleFocused(false); setTitleEdited(false);
        const selected = [...view.jobs, ...view.moreJobs].find(c => c.key === job);
        const squadJob = ['HEAD_COACH', 'ASSISTANT_COACH', 'TEAM_MANAGER', 'SPECIALIST_COACH'].includes(job);
        set({ job, title: selected?.titles?.[0] ?? '', tools: [], ...(job === 'HEAD_OF_COACHING' ? { clubWide: true, squadIds: [] }
            : squadJob ? { clubWide: false, squadIds: draft.squadIds.length ? draft.squadIds : view.viewer.headCoachSquads.length === 1 ? view.viewer.headCoachSquads : [] } : {}) });
    };
    const families = ['CLUB', 'COACHING', 'MATCHDAY', 'PERFORMANCE', 'SCOUTING', 'SAFETY', 'ELSEWHERE'];
    const toggleTool = (tool: string) => set({ tools: draft.tools.includes(tool) ? draft.tools.filter(t => t !== tool) : [...draft.tools, tool] });
    return <div className="pp-picker">
        <fieldset className="pp-picker__jobs" disabled={disabled}>
            <legend className="gk-field__label">{copy('Job', 'სამუშაო')}</legend>
            <div className="gk-chips" role="group" aria-label={copy('Job', 'სამუშაო')}>
                {choices.map(job => <Chip key={job} pressed={draft.job === job} onClick={() => choose(job)}>{jobName(job)}</Chip>)}
                {extras && <>
                    {view.moreJobs.length > 0 && <Chip pressed={more} onClick={() => { if (!more) choose(view.moreJobs[0].key); }}>{copy('More jobs', 'სხვა სამუშაოები')}</Chip>}
                    <Chip pressed={draft.job === 'CUSTOM'} onClick={() => choose('CUSTOM')}>{copy('Custom', 'საკუთარი')}</Chip>
                </>}
            </div>
            {choice && <p className="gk-field__hint">{choice.description}</p>}
        </fieldset>
        {more && <Field label={copy('More jobs', 'სხვა სამუშაოები')} htmlFor={`${id}-more`}>
            <select id={`${id}-more`} className="gk-input" value={draft.job} disabled={disabled} onChange={event => choose(event.target.value)}>
                {families.map(family => {
                    const jobs = view.moreJobs.filter(job => (job.family ?? 'ELSEWHERE') === family);
                    return jobs.length ? <optgroup key={family} label={jobName(family)}>{jobs.map(job => <option key={job.key} value={job.key}>{jobName(job.key, job.title)}</option>)}</optgroup> : null;
                })}
            </select>
        </Field>}
        {extras && (draft.job === 'CUSTOM' || Boolean(choice?.titles?.length)) && <>
            {Boolean(choice?.titles?.length) && <div className="gk-chips" role="group" aria-label={copy('Suggested titles', 'შემოთავაზებული სახელები')}>
                {choice!.titles!.map(title => <Chip key={title} pressed={draft.title === title} disabled={disabled} onClick={() => { setTitleEdited(false); set({ title }); }}>{titleName(title)}</Chip>)}
            </div>}
            <Field label={copy('Name of the job', 'სამუშაოს სახელი')} htmlFor={`${id}-title`}>
                <input id={`${id}-title`} className="gk-input" maxLength={120} value={draft.job === 'CUSTOM' || titleFocused || titleEdited ? draft.title : titleName(draft.title)} disabled={disabled} onFocus={() => setTitleFocused(true)} onBlur={() => setTitleFocused(false)} onChange={event => { setTitleEdited(true); set({ title: event.target.value }); }} />
            </Field>
            {draft.job === 'CUSTOM' && <fieldset className="pp-picker__tools" disabled={disabled}>
                <legend className="gk-field__label">{copy('Tools', 'ხელსაწყოები')}</legend>
                <div className="pp-tools">{view.tools.map(tool => {
                    const [module, level] = tool.split(':');
                    return <label key={tool} className="pp-tool"><input type="checkbox" checked={draft.tools.includes(tool)} onChange={() => toggleTool(tool)} />
                        <span>{moduleNames[module] ?? module} · {level === 'WRITE' ? copy('manage', 'მართვა') : copy('view', 'ნახვა')}</span></label>;
                })}</div>
            </fieldset>}
        </>}
        {draft.job === 'HEAD_OF_COACHING' ? <p className="gk-field__hint">{copy('Whole club', 'მთელი კლუბი')}</p> : draft.job === 'ADMIN'
            ? <p className="gk-field__hint">{copy('Admin applies to the whole club: every tool, its settings and its people.', 'ადმინი მთელ კლუბზე ვრცელდება: ყველა ხელსაწყო, პარამეტრები და ხალხი.')}</p>
            : <ScopeChips squads={view.squads} allowClubWide keepSelected disabled={disabled || (!extras && !choices.includes(draft.job))} legend={copy('Where', 'სად')}
                value={{ clubWide: draft.clubWide, squadIds: draft.squadIds }} onChange={scope => set(scope)} />}
    </div>;
}
