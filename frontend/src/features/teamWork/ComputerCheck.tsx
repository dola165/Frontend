import { useState } from 'react';
import { Archive, Bot, Copy, FolderSearch, Laptop, Monitor, Server } from 'lucide-react';
import { Button } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { canScan, pickFolder, scanFolder, type FoundProject, type ProjectKind } from './computerScan';
import { short } from './upToDate';
import type { Checked } from './updateMessage';
import './team-work-changes.css';

type CopyFn = ReturnType<typeof useJourneyCopy>;
const ICONS: Record<ProjectKind, typeof Server> = { BACKEND: Server, WEB: Monitor, AGENT_DOLA: Bot, OLD_PROJECT: Archive };

const kindName = (copy: CopyFn, kind: ProjectKind) => ({
    BACKEND: copy('Backend', 'ბექენდი'), WEB: copy('Web app', 'ვებ-აპი'),
    AGENT_DOLA: copy('Old AgentDola project', 'ძველი AgentDola პროექტი'), OLD_PROJECT: copy('Old whole project', 'ძველი სრული პროექტი'),
})[kind];

/** Where a copy stands, in a few words; the tone gives the dot its colour. */
function stateOf(copy: CopyFn, p: Checked, live: boolean): { tone: 'good' | 'decide' | 'urgent' | 'quiet'; words: string } {
    const n = p.behind, behindWhat = live ? copy(`${n} ${n === 1 ? 'change' : 'changes'} behind live`, `ლაივს ${n} ცვლილებით ჩამორჩება`)
        : copy(`${n} ${n === 1 ? 'change' : 'changes'} behind this copy`, `ამ ასლს ${n} ცვლილებით ჩამორჩება`);
    switch (p.state) {
        case 'CURRENT': return { tone: 'good', words: p.release ? copy(`Up to date · release ${p.release}`, `განახლებულია · რელიზი ${p.release}`) : copy('Up to date', 'განახლებულია') };
        case 'BEHIND': return { tone: 'decide', words: `${p.release ? copy(`Release ${p.release} · `, `რელიზი ${p.release} · `) : ''}${behindWhat}` };
        case 'OFF_LINE': return { tone: 'decide', words: copy('Own work or another branch', 'საკუთარი ცვლილებები ან სხვა ბრენჩი') };
        case 'OTHER_PROJECT': return { tone: 'urgent', words: copy('Different project · bring your work over', 'სხვა პროექტი · გადმოიტანეთ თქვენი ნამუშევარი') };
        default: return { tone: 'quiet', words: p.git === 'NONE' ? copy('No git · the message checks it', 'git-ის გარეშე · ტექსტი შეამოწმებს') : copy('Not known · the message checks it', 'უცნობია · ტექსტი შეამოწმებს') };
    }
}

function ProjectRow({ project, live }: { project: Checked; live: boolean }) {
    const copy = useJourneyCopy();
    const Icon = ICONS[project.kind];
    const state = stateOf(copy, project, live);
    const where = project.git === 'WORKTREE' ? copy('git worktree', 'git worktree') : project.git === 'NONE' ? copy('files without git', 'ფაილები git-ის გარეშე')
        : `${project.branch ?? copy('detached', 'ბრენჩის გარეშე')}${project.head ? ` · ${short(project.head)}` : ''}`;
    return <li className="tw-computer__row">
        <span className="tw-computer__icon" aria-hidden="true"><Icon /></span>
        <span className="tw-computer__main">
            <strong title={project.path}>{project.path}</strong>
            <span className="gk-faint">{kindName(copy, project.kind)} · <span className="gk-num">{where}</span>{project.schema && project.kind !== 'BACKEND' ? ` · V${project.schema}` : ''}</span>
        </span>
        <span className="tw-computer__state" data-tone={state.tone}><span className="tw-computer__dot" aria-hidden="true" />{state.words}</span>
    </li>;
}

/**
 * Your computer: one button reads the folder that holds your projects (in the browser, nothing uploaded) and lists each
 * GrassKickZ copy with where it stands; the update message then names them. Where the browser cannot read folders, the
 * message alone finds and checks every copy.
 */
export function ComputerCheck({ checked, folder, live, onFound, onCopy, copied }: {
    checked: Checked[] | null; folder: string | null; live: boolean; onFound: (folder: string, projects: FoundProject[]) => void; onCopy: () => void; copied: boolean;
}) {
    const copy = useJourneyCopy();
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const scan = async () => {
        setFailed(false);
        try {
            const root = await pickFolder();
            setBusy(true);
            onFound(root.name, await scanFolder(root));
        } catch (error) {
            if ((error as { name?: string })?.name !== 'AbortError') setFailed(true);
        } finally { setBusy(false); }
    };
    return <section className="tw-answer tw-computer" aria-labelledby="tw-computer">
        <div className="tw-computer__head">
            <h2 id="tw-computer" className="tw-answer__title"><Laptop aria-hidden="true" className="tw-computer__title-icon" />{copy('Your computer', 'თქვენი კომპიუტერი')}</h2>
            <div className="tw-computer__actions">
                {canScan() && <Button size="sm" onClick={() => void scan()} disabled={busy}><FolderSearch aria-hidden="true" />
                    {busy ? copy('Looking…', 'ვეძებ…') : checked ? copy('Check again', 'ხელახლა შემოწმება') : copy('Check my project folders', 'პროექტების საქაღალდის შემოწმება')}</Button>}
                <Button size="sm" variant="primary" onClick={onCopy}><Copy aria-hidden="true" />{copied ? copy('Copied', 'დაკოპირდა') : copy('Copy the update message', 'განახლების ტექსტის კოპირება')}</Button>
            </div>
        </div>
        {failed && <p className="gk-notice gk-notice--warning">{copy('That folder could not be read. Pick the folder that holds your projects.', 'ეს საქაღალდე ვერ წავიკითხე. აირჩიეთ საქაღალდე, სადაც პროექტებია.')}</p>}
        {checked ? checked.length > 0
            ? <ul className="tw-computer__list" aria-label={copy(`Projects in ${folder}`, `პროექტები: ${folder}`)}>{checked.map(project => <ProjectRow key={project.path} project={project} live={live} />)}</ul>
            : <p className="tw-answer__line">{copy(`No GrassKickZ project in ${folder}. Pick the folder that holds them, or just send the message: it searches the whole computer.`,
                `${folder}-ში GrassKickZ-ის პროექტი არ არის. აირჩიეთ სწორი საქაღალდე, ან უბრალოდ გაგზავნეთ ტექსტი: ის მთელ კომპიუტერს მოძებნის.`)}</p>
            : <p className="tw-answer__line">{canScan()
                ? copy('Pick the folder that holds your projects, such as IdeaProjects. Only folder names and git’s small files are read; nothing leaves this computer.',
                    'აირჩიეთ საქაღალდე, სადაც პროექტებია, მაგალითად IdeaProjects. იკითხება მხოლოდ საქაღალდეების სახელები და git-ის პატარა ფაილები; არაფერი იგზავნება.')
                : copy('Paste the message into Claude or Codex on your computer: it finds every copy, keeps your work and brings it up to date.',
                    'ჩასვით ტექსტი Claude-ში ან Codex-ში თქვენს კომპიუტერზე: ის იპოვის ყველა ასლს, შეინახავს თქვენს ნამუშევარს და განაახლებს.')}</p>}
        {checked && checked.length > 0 && <p className="tw-answer__line gk-faint">{copy('Paste the message into Claude or Codex on this computer. It backs up your own work first, updates our copies and brings work from a different project over to today’s code.',
            'ჩასვით ტექსტი Claude-ში ან Codex-ში ამ კომპიუტერზე. ჯერ თქვენს ნამუშევარს შეინახავს, შემდეგ განაახლებს ჩვენს ასლებს და სხვა პროექტიდან ნამუშევარს დღევანდელ კოდზე გადმოიტანს.')}</p>}
    </section>;
}
