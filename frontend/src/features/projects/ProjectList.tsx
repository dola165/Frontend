import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import { Button, EmptyNote, List, ListRow, PageFrame } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { ProjectBoard, ProjectDetail, ProjectSummary } from './api';
import { NewProjectDialog } from './NewProjectDialog';
import { ProgressBar } from './ProgressBar';
import { ProjectMark } from './ProjectMark';
import { dayWord, isKind, projectPath, summaryLine, type ProjectsPlace } from './projectWords';

/** One project on one line: its square (the squad's, or the goal's), the goal, one line of what is happening, its progress. */
function ProjectRow({ project }: { project: ProjectSummary }) {
    const copy = useJourneyCopy();
    const trail = project.status === 'DONE' ? <span className="pj-quiet">{copy('Done', 'დასრულდა')}</span>
        : project.waitingOnMe ? <span className="pj-wait"><span className="pj-dot" data-tone="amber" aria-hidden="true" />{copy('Your step', 'თქვენი ნაბიჯი')}</span>
            : <ProgressBar value={project.progress} label={copy(`${project.progress}% done`, `${project.progress}% შესრულებულია`)} />;
    return <ListRow to={projectPath(project.id)} className="pj-row" lead={<ProjectMark project={project} />}
        title={project.goal}
        meta={summaryLine(copy, project) || undefined} trail={trail} />;
}

/**
 * A place of the Projects page. Projects: what needs you first, then Now and Later. Ideas: a thought or a photo before it
 * is a project. Done: what the club finished, with its photos. "New project" opens from the address (`new`, with the
 * kind and squad already chosen when a door asked for them).
 */
export function ProjectList({ board, place, switcher, onStarted }: { board: ProjectBoard; place: ProjectsPlace; switcher?: ReactNode; onStarted: (detail: ProjectDetail) => void }) {
    const copy = useJourneyCopy();
    const [params, setParams] = useSearchParams();
    const opening = params.get('new');
    const open = (extra: Record<string, string>) => setParams(query => { const next = new URLSearchParams(query); Object.entries(extra).forEach(([key, value]) => next.set(key, value)); return next; });
    const close = () => setParams(query => { const next = new URLSearchParams(query); next.delete('new'); next.delete('squad'); return next; }, { replace: true });
    const shown = board.projects.filter(project => place === 'ideas' ? project.status === 'IDEA' : place === 'done' ? project.status === 'DONE' : project.status === 'NOW' || project.status === 'LATER');
    const groups = place === 'projects'
        ? [{ key: 'now', title: copy('Now', 'ახლა'), rows: shown.filter(p => p.status === 'NOW') }, { key: 'later', title: copy('Later', 'მოგვიანებით'), rows: shown.filter(p => p.status === 'LATER') }]
        : [{ key: place, title: null, rows: shown }];
    const heading = place === 'ideas' ? copy('Ideas', 'იდეები') : place === 'done' ? copy('Done', 'დასრულებული') : copy('Projects', 'პროექტები');
    const startLabel = place === 'ideas' ? copy('New idea', 'ახალი იდეა') : copy('New project', 'ახალი პროექტი');
    const squad = Number(params.get('squad'));
    return <PageFrame className="pj-page">
        <header className="pj-head">
            <h1 className="pj-head__title">{heading}</h1>
            <div className="pj-head__actions">
                {switcher}
                {board.canStart && place !== 'done' && <Button variant="primary" size="sm" onClick={() => open({ new: place === 'ideas' ? 'IDEA' : '1' })}><Plus aria-hidden="true" />{startLabel}</Button>}
            </div>
        </header>

        {place === 'projects' && board.needsYou.length > 0 && <section className="pj-block" aria-labelledby="pj-needs">
            <h2 className="pj-label" id="pj-needs">{copy('Needs you', 'თქვენგან ელოდება')}</h2>
            <List className="pj-list">{board.needsYou.map(step => <ListRow key={step.stepId} to={projectPath(step.projectId)} className="pj-row"
                lead={<span className="pj-dot" data-tone="amber" aria-hidden="true" />} title={step.step}
                meta={[step.project, dayWord(copy, step.day)].filter(Boolean).join(' · ')}
                trail={<span className="pj-wait">{copy('Your step', 'თქვენი ნაბიჯი')}<ChevronRight aria-hidden="true" /></span>} />)}</List>
        </section>}

        {shown.length === 0
            ? <EmptyNote title={place === 'ideas' ? copy('No ideas yet', 'იდეები ჯერ არ არის') : place === 'done' ? copy('Nothing finished yet', 'ჯერ არაფერი დასრულებულა') : copy('No projects yet', 'პროექტები ჯერ არ არის')}>
                {place === 'ideas' ? copy('A photo or a thought, before it becomes a project.', 'ფოტო ან აზრი, სანამ პროექტი გახდება.')
                    : place === 'done' ? copy('Finished projects stay here with their photos.', 'დასრულებული პროექტები აქ რჩება ფოტოებით.')
                        : board.canStart ? copy('Start one from a goal: new kit, a sponsor, goals for a pitch.', 'დაიწყეთ მიზნით: ახალი ფორმა, სპონსორი, კარები მოედნისთვის.')
                            : copy('Projects you are on show here.', 'აქ ჩანს პროექტები, რომლებშიც ხართ.')}
            </EmptyNote>
            : groups.filter(group => group.rows.length).map(group => <section key={group.key} className="pj-block" aria-label={group.title ?? heading}>
                {group.title && <h2 className="pj-label">{group.title}</h2>}
                <List className="pj-list">{group.rows.map(project => <ProjectRow key={project.id} project={project} />)}</List>
            </section>)}

        {opening && board.canStart && <NewProjectDialog club={board.club} choices={board.choices}
            kind={isKind(opening) ? opening : null} idea={opening === 'IDEA'} squadId={Number.isSafeInteger(squad) && squad > 0 ? squad : null}
            onClose={close} onStarted={onStarted} />}
    </PageFrame>;
}
