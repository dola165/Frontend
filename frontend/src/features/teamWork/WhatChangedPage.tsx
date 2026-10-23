import { useEffect, useId, useState } from 'react';
import { Copy, GitCommitHorizontal, GitMerge } from 'lucide-react';
import { Button, FixtureRow, PageHeader, Skeleton } from '../../design/primitives';
import { formatTime } from '../../utils/formatting';
import { AgendaDays } from '../schedule/board/AgendaDays';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { fetchVersions } from './api';
import { useDayTitle } from './useDayTitle';
import { byDay, commitId, mergedBranch, missing, REPOS, short, updatePrompt, webHistory, type Commit, type Repo, type RepoKey } from './upToDate';
import { ago } from './teamWorkWords';
import './team-work-agenda.css';

const STORAGE = 'gk.teamWork.myVersion';
const NAMES: Record<RepoKey, [string, string]> = { backend: ['Backend', 'ბექენდი'], web: ['Web app', 'ვებ-აპი'] };
/** Each repository's symbol colour, so a row shows at a glance which one changed. */
const TONES: Record<RepoKey, string> = { backend: 'var(--gk-violet)', web: 'var(--gk-info)' };
/** About how many changes the list shows at first, and adds with each "Show earlier days"; always whole days. */
const ROWS = 30;
type Mine = Partial<Record<RepoKey, string>>;

/** A commit's title in plain words: a merge says which branch came in. */
const titleOf = (copy: ReturnType<typeof useJourneyCopy>, commit: Commit) => { const merged = mergedBranch(commit); return merged === null ? commit.title : copy(`merged: ${merged || 'a branch'}`, `შერწყმა: ${merged || 'ბრენჩი'}`); };

const readMine = (): Mine => { try { return JSON.parse(localStorage.getItem(STORAGE) ?? '{}') as Mine; } catch { return {}; } };
const saveMine = (mine: Mine) => { try { localStorage.setItem(STORAGE, JSON.stringify(mine)); } catch { /* the choice just isn't remembered */ } };

/** One repository's newest commit, which is also what is live: the server and this page were built from it. */
function Latest({ name, repo }: { name: RepoKey; repo: Repo | null }) {
    const copy = useJourneyCopy();
    const newest = repo?.known ? repo.commits?.[0] : undefined;
    return <div className="tw-latest">
        <span className="tw-latest__name">{copy(...NAMES[name])} <span className="gk-faint">· {REPOS[name].slug}</span></span>
        {!repo ? <Skeleton height={20} /> : newest ? <span className="tw-latest__commit"><code className="gk-num">{short(newest.id)}</code> {titleOf(copy, newest)} <span className="gk-faint">· {ago(copy, newest.date)}</span></span>
            : <span className="gk-muted">{copy('Not known for this build', 'ამ ვერსიისთვის უცნობია')}</span>}
    </div>;
}

/** Which version a computer is on: picked from the list or pasted, remembered in this browser. */
function MyVersion({ name, repo, value, onChange }: { name: RepoKey; repo: Repo | null; value: string; onChange: (value: string) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const commits = repo?.commits ?? [];
    const listed = commits.some(commit => commit.id === value);
    return <div className="tw-field">
        <label htmlFor={id}>{copy(`My ${NAMES[name][0].toLowerCase()} version`, `ჩემი ${NAMES[name][1]}ს ვერსია`)}</label>
        <div className="tw-version-pick">
            <select id={id} className="gk-input" value={listed ? value : ''} onChange={event => onChange(event.target.value)}>
                <option value="">{copy('Pick the commit your computer is on', 'აირჩიეთ კომიტი, რომელზეც თქვენი კომპიუტერია')}</option>
                {commits.filter(commit => !mergedBranch(commit)).map(commit => <option key={commit.id} value={commit.id}>{short(commit.id)} · {commit.title.slice(0, 70)}</option>)}
            </select>
            <input className="gk-input gk-num" aria-label={copy(`Or paste the ${NAMES[name][0].toLowerCase()} commit id`, `ან ჩასვით ${NAMES[name][1]}ს კომიტის id`)} placeholder={copy('or paste an id', 'ან ჩასვით id')}
                value={listed ? short(value) : value} onChange={event => onChange(event.target.value.trim())} />
        </div>
    </div>;
}

/**
 * What changed: what is live now in both repositories, then every change day by day in the agenda's look (a symbol
 * per repository, the title, the id and who), the newest days first. Picking the version a computer is on narrows
 * the list to what it is missing; "Copy update message" gives Claude or Codex a safe way to bring it up to date.
 * Never calls GitHub: the history is baked into what is live.
 */
export function WhatChangedPage() {
    const copy = useJourneyCopy();
    const dayTitle = useDayTitle();
    const [backend, setBackend] = useState<Repo | null>(null);
    const [mine, setMine] = useState<Mine>(readMine);
    const [copied, setCopied] = useState(false);
    const [rows, setRows] = useState(ROWS);
    const web = webHistory();
    useEffect(() => {
        const controller = new AbortController();
        fetchVersions(controller.signal).then(found => setBackend(found.backend)).catch(() => { if (!controller.signal.aborted) setBackend({ known: false }); });
        return () => controller.abort();
    }, []);
    const choose = (key: RepoKey, value: string) => { const next = { ...mine, [key]: value }; setMine(next); saveMine(next); };
    const repos: Record<RepoKey, Repo> = { backend: backend ?? { known: false }, web };
    const gaps = { backend: missing(repos.backend, mine.backend ?? null), web: missing(repos.web, mine.web ?? null) };
    const picked = (['backend', 'web'] as const).filter(key => commitId(mine[key] ?? ''));
    const shown = (['backend', 'web'] as const).flatMap(key => (picked.includes(key) || picked.length === 0 ? gaps[key].commits : []).map(commit => ({ ...commit, repo: key })));
    const count = shown.filter(commit => !mergedBranch(commit)).length;
    const prompt = updatePrompt(repos);
    const lost = picked.filter(key => !gaps[key].found);
    const days = byDay(shown);
    // Whole days until about `rows` changes are shown, at least one day.
    let shownDays = 0, total = 0;
    for (; shownDays < days.length && (shownDays === 0 || total + days[shownDays][1].length <= rows); shownDays += 1) total += days[shownDays][1].length;
    const copyPrompt = () => void navigator.clipboard?.writeText(prompt).then(() => setCopied(true));

    return <div className="tw-updates">
        <PageHeader title={copy('What changed', 'რა შეიცვალა')} subtitle={copy('What is live, and what your computer is missing', 'რა მუშაობს და რა აკლია თქვენს კომპიუტერს')}
            actions={<Button size="sm" variant="primary" onClick={copyPrompt}><Copy aria-hidden="true" />{copied ? copy('Copied', 'დაკოპირდა') : copy('Copy update message', 'განახლების ტექსტის კოპირება')}</Button>} />

        <section className="tw-section" aria-label={copy('Live now', 'ახლა მუშაობს')}>
            <div className="tw-latest-grid"><Latest name="backend" repo={backend} /><Latest name="web" repo={web} /></div>
        </section>

        <section className="tw-section" aria-labelledby="tw-mine">
            <h2 id="tw-mine" className="tw-section__title">{copy('Your computer', 'თქვენი კომპიუტერი')}</h2>
            <div className="tw-grid">
                <MyVersion name="backend" repo={backend} value={mine.backend ?? ''} onChange={value => choose('backend', value)} />
                <MyVersion name="web" repo={web} value={mine.web ?? ''} onChange={value => choose('web', value)} />
            </div>
        </section>

        <section className="tw-block tw-agenda" aria-labelledby="tw-missing">
            <h2 id="tw-missing" className="tw-heading">{picked.length
                ? count === 0 && lost.length === 0 ? copy('You are up to date', 'განახლებული ხართ') : copy(`You’re missing ${count}`, `გაკლიათ ${count}`)
                : copy('Recent changes', 'ბოლო ცვლილებები')}</h2>
            {lost.length > 0 && <div className="gk-notice gk-notice--warning"><span>{copy('That version is older than this list, or on another branch: you are missing at least these.', 'ეს ვერსია ამ სიაზე ძველია ან სხვა ბრენჩზეა: გაკლიათ მინიმუმ ეს.')}</span>
                <Button size="sm" onClick={copyPrompt}>{copied ? copy('Copied', 'დაკოპირდა') : copy('Copy update message', 'განახლების ტექსტის კოპირება')}</Button></div>}
            {days.length > 0 && <AgendaDays className="tw-agenda__days" days={days.slice(0, shownDays).map(([key, commits]) => {
                const { label, title, today } = dayTitle(key);
                return { key, title, label, today, rows: commits.map(commit => {
                    const merged = mergedBranch(commit) !== null;
                    return <FixtureRow key={`${commit.repo}:${commit.id}`} tone="neutral" time={formatTime(commit.date)} icon={merged ? GitMerge : GitCommitHorizontal} iconColor={merged ? 'var(--gk-text-3)' : TONES[commit.repo]}
                        title={<span className={merged ? 'tw-changes__merge' : undefined} title={commit.title}>{titleOf(copy, commit)}</span>}
                        meta={<span className="gk-num">{copy(...NAMES[commit.repo])} · {short(commit.id)}</span>} trail={<span className="tw-agenda__trail">{commit.author}</span>} />;
                }) };
            })} />}
            {days.length > shownDays && <div className="tw-agenda__more"><Button size="sm" onClick={() => setRows(Math.max(total + ROWS, total + (days[shownDays]?.[1].length ?? 0)))}>{copy('Show earlier days', 'წინა დღეების ჩვენება')}</Button></div>}
        </section>

        <details className="tw-section tw-fold">
            <summary className="tw-section__title">{copy('The update message', 'განახლების ტექსტი')}</summary>
            <textarea className="gk-input tw-paste__text" readOnly rows={12} value={prompt} aria-label={copy('The message for Claude or Codex', 'ტექსტი Claude-სთვის ან Codex-ისთვის')} onFocus={event => event.target.select()} />
        </details>
    </div>;
}
