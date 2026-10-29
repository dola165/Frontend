import { useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ClipboardPaste, Clock, Pencil, UserPlus, X } from 'lucide-react';
import { Avatar, Button, PageFrame } from '../../design/primitives';
import { WorkComments } from '../../components/work/WorkComments';
import { AttachButton, WorkMediaList } from '../../components/work/WorkMedia';
import { PasteFrame } from '../../components/work/PasteFrame';
import { useUploads } from '../../components/work/useUploads';
import { ago, madeBy } from '../../components/work/workWords';
import { useAuth } from '../../context/AuthContext';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { addFile, addPicture, editTalk, pastePlan, PASTE_PLAN_EXAMPLE, removeFile, removeTalk, removeWaitingHelper, talk, type ProjectDetail } from './api';
import { AddHelperDialog } from './AddHelperDialog';
import { ProjectEditDialog } from './ProjectEditDialog';
import { ProjectMoney } from './ProjectMoney';
import { ProjectSteps } from './ProjectSteps';
import { ProjectMark } from './ProjectMark';
import { dayWord, placeOf, projectsPath, statusWords } from './projectWords';

/**
 * One project, the same for everyone on it: its goal, the money (when it raises any), the steps with who does each,
 * photos and files, one talk thread, and its history. `can` decides only which buttons show.
 */
export function ProjectView({ project, onChanged }: { project: ProjectDetail; onChanged: (next: ProjectDetail) => void }) {
    const copy = useJourneyCopy();
    const { user } = useAuth();
    const [editing, setEditing] = useState(false);
    const [pasting, setPasting] = useState(false);
    const [addingHelper, setAddingHelper] = useState(false);
    const { summary, can } = project;
    const clubId = project.club?.id ?? 0;
    const uploads = useUploads<ProjectDetail>({
        picture: file => addPicture(clubId, summary.id, file),
        file: (file, onProgress) => addFile(clubId, summary.id, file, onProgress),
    }, onChanged);
    const people = summary.people.map(person => ({ id: person.id, name: person.name }));
    const facts = [summary.squad?.name, summary.dueOn && copy(`by ${dayWord(copy, summary.dueOn)}`, `${dayWord(copy, summary.dueOn)}-მდე`),
        summary.status !== 'NOW' && copy(...statusWords[summary.status])].filter(Boolean);
    // A file dropped anywhere on the project goes to its photos and files, as the add button says.
    const drop = can.talk ? { onDragOver: (event: DragEvent) => event.preventDefault(), onDrop: (event: DragEvent) => { event.preventDefault(); if (event.dataTransfer.files.length) void uploads.upload([...event.dataTransfer.files]); } } : {};
    return <PageFrame className="pj-page pj-project" {...drop}>
        <Link className="pj-back" to={projectsPath(clubId, placeOf(summary.status))}><ArrowLeft aria-hidden="true" />{copy('All projects', 'ყველა პროექტი')}</Link>
        <header className="pj-head">
            <ProjectMark project={summary} size={40} />
            <div className="pj-head__text">
                <h1 className="pj-head__title">{summary.goal}</h1>
                {(facts.length > 0 || project.purpose) && <p className="pj-quiet">{[project.purpose, ...facts].filter(Boolean).join(' · ')}</p>}
            </div>
            {can.change && <div className="pj-head__actions">
                <Button size="sm" variant="ghost" onClick={() => setPasting(true)}><ClipboardPaste aria-hidden="true" />{copy('Paste a plan', 'გეგმის ჩასმა')}</Button>
                <Button size="sm" onClick={() => setEditing(true)}><Pencil aria-hidden="true" />{copy('Edit', 'რედაქტირება')}</Button>
            </div>}
        </header>

        <div className="pj-grid">
            <div className="pj-col">
                <ProjectMoney project={project} onChanged={onChanged} />
                <ProjectSteps project={project} onChanged={onChanged} />
            </div>
            <div className="pj-col">
                <section className="pj-block" aria-labelledby="pj-files">
                    <div className="pj-block__head"><h2 className="pj-label" id="pj-files">{copy('Photos and files', 'ფოტოები და ფაილები')}</h2>
                        {can.talk && <AttachButton uploads={uploads} label={copy('Add a photo or file', 'ფოტოს ან ფაილის დამატება')} />}</div>
                    {uploads.error && <p className="gk-notice gk-notice--danger" role="alert">{uploads.error}</p>}
                    {project.files.length === 0 ? <p className="pj-quiet">{copy('Quotes and receipts: photograph them, no need to type.', 'ფასები და ქვითრები: გადაუღეთ ფოტო, აკრეფა საჭირო არ არის.')}</p>
                        : <WorkMediaList media={project.files} onChanged={onChanged} actions={{ remove: id => removeFile(clubId, summary.id, id) }} />}
                </section>
                <section className="pj-block" aria-labelledby="pj-talk">
                    <h2 className="pj-label" id="pj-talk">{copy('Talk', 'საუბარი')}</h2>
                    {can.talk ? <WorkComments comments={project.talk} team={people} me={user?.id ?? null} label={copy('Send', 'გაგზავნა')}
                        placeholder={copy('Write to the project; @ tags someone', 'მიწერეთ პროექტს; @ ვინმეს მონიშნავს')}
                        actions={{
                            add: body => talk(clubId, summary.id, body).then(next => { onChanged(next); return next.talk; }),
                            edit: (id, body) => editTalk(clubId, summary.id, id, body).then(next => { onChanged(next); return next.talk; }),
                            remove: id => removeTalk(clubId, summary.id, id).then(next => { onChanged(next); return next.talk; }),
                        }} onChanged={() => undefined} />
                        : <p className="pj-quiet">{copy('Your account can’t write here right now.', 'თქვენი ანგარიში ახლა აქ ვერ წერს.')}</p>}
                </section>
                <section className="pj-block" aria-labelledby="pj-people">
                    <h2 className="pj-label" id="pj-people">{copy('People', 'ხალხი')}</h2>
                    <ul className="pj-people">{summary.people.map(person => <li key={person.id}><Avatar src={person.avatarUrl} name={person.name} size={26} /><span>{person.name}</span></li>)}
                        {/* A helper who hasn't accepted yet: the typed name only, never a photo (a child's address looks the same). */}
                        {(project.waitingHelpers ?? []).map(helper => <li key={helper.ref} className="pj-person-waiting">
                            <span className="pj-waiting-face" aria-hidden="true"><Clock /></span><span>{helper.name}</span><span className="pj-quiet">{copy('waiting', 'ელოდება')}</span>
                            {can.addPeople && <button type="button" className="pj-waiting-remove" aria-label={copy(`Take ${helper.name} off`, `${helper.name}-ის მოხსნა`)}
                                onClick={() => void removeWaitingHelper(clubId, summary.id, helper.ref).then(onChanged).catch(() => undefined)}><X aria-hidden="true" /></button>}
                        </li>)}</ul>
                    {/* Parents and volunteers join one project by name and email (phase B2), as a squad's helpers do. */}
                    {can.addPeople && <button type="button" className="work-link-button" onClick={() => setAddingHelper(true)}><UserPlus aria-hidden="true" />{copy('Add a parent or volunteer', 'მშობლის ან მოხალისის დამატება')}</button>}
                </section>
                {project.history.length > 0 && <details className="pj-block pj-history">
                    <summary className="pj-label">{copy('History', 'ისტორია')}</summary>
                    <ol>{project.history.map((line, index) => <li key={index}><span>{line.text}</span>
                        <span className="pj-quiet">{[madeBy(copy, line.by?.name, line.byDola), ago(copy, line.at)].join(' · ')}</span></li>)}</ol>
                </details>}
            </div>
        </div>

        {editing && <ProjectEditDialog project={project} onClose={() => setEditing(false)} onSaved={next => { setEditing(false); onChanged(next); }} />}
        {addingHelper && <AddHelperDialog project={project} onClose={() => setAddingHelper(false)} onAdded={onChanged} />}
        {pasting && <PasteFrame title={copy('Paste a plan', 'გეგმის ჩასმა')} example={PASTE_PLAN_EXAMPLE} onClose={() => setPasting(false)}
            description={copy('One step a line, from WhatsApp or anywhere; a name and a day after “|”. You see the steps before they are added.', 'თითო ნაბიჯი თითო ხაზზე, WhatsApp-იდან ან სხვაგან; სახელი და დღე „|“-ის შემდეგ. დამატებამდე ნახავთ ნაბიჯებს.')}
            read={(text, apply) => pastePlan(clubId, summary.id, text, apply)} changes={result => result.steps.length}
            applied={result => Boolean(result.project)}
            onApplied={result => { setPasting(false); if (result.project) onChanged(result.project); }}
            preview={result => <>
                <p className="work-paste__summary"><strong>{copy(`${result.steps.length} ${result.steps.length === 1 ? 'step' : 'steps'} to add`, `${result.steps.length} ნაბიჯი დაემატება`)}</strong></p>
                <ol className="work-paste__lines">{result.steps.map(line => <li key={line.line} data-action="NEW">
                    <span className="work-paste__title">{line.title}</span>
                    {(line.person || line.day) && <span className="gk-faint">{[line.person?.name, dayWord(copy, line.day)].filter(Boolean).join(' · ')}</span>}
                    {line.problem && <span className="work-paste__doubled">{line.problem}</span>}
                </li>)}</ol>
                {result.problems.length > 0 && <ul className="gk-notice gk-notice--warning work-paste__problems">{result.problems.map(problem => <li key={problem}>{problem}</li>)}</ul>}
            </>} />}
    </PageFrame>;
}
