import { useEffect, useId, useState } from 'react';
import { Copy } from 'lucide-react';
import { Button, Skeleton } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { fetchVersions } from './api';
import { BRANCH, byDay, commitId, mergedBranch, missing, REPOS, short, updatePrompt, webHistory, type Commit, type Repo, type RepoKey } from './upToDate';
import { ago, day, shortDate } from './teamWorkWords';

const STORAGE = 'gk.teamWork.myVersion';
const NAMES: Record<RepoKey, [string, string]> = { backend: ['Backend', 'ბექენდი'], web: ['Web app', 'ვებ-აპი'] };
type Mine = Partial<Record<RepoKey, string>>;

/** A commit's title in plain words: a merge says which branch came in. */
const titleOf = (copy: ReturnType<typeof useJourneyCopy>, commit: Commit) => { const merged = mergedBranch(commit); return merged === null ? commit.title : copy(`merged: ${merged || 'a branch'}`, `შერწყმა: ${merged || 'ბრენჩი'}`); };

const readMine = (): Mine => { try { return JSON.parse(localStorage.getItem(STORAGE) ?? '{}') as Mine; } catch { return {}; } };
const saveMine = (mine: Mine) => { try { localStorage.setItem(STORAGE, JSON.stringify(mine)); } catch { /* the choice just isn't remembered */ } };

/** One repository's newest commit, which is also what is live: the server and this page were built from it. */
function Latest({ name, repo, live }: { name: RepoKey; repo: Repo | null; live: string }) {
    const copy = useJourneyCopy();
    const newest = repo?.known ? repo.commits?.[0] : undefined;
    return <div className="tw-latest">
        <span className="tw-latest__name">{copy(...NAMES[name])} <span className="gk-faint">· {REPOS[name].slug}</span></span>
        {!repo ? <Skeleton height={40} /> : newest ? <>
            <span className="tw-latest__commit"><code className="gk-num">{short(newest.id)}</code> {titleOf(copy, newest)}</span>
            <span className="gk-faint">{shortDate(copy, new Date(newest.date))} · {ago(copy, newest.date)} · {newest.author} · {live}</span>
        </> : <span className="gk-muted">{copy('Not known: this build was made without its git history.', 'უცნობია: ეს ვერსია git-ის ისტორიის გარეშე აიწყო.')}</span>}
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
 * Stay up to date: what the newest version of both repositories is (as baked into what is live), which of those
 * changes this computer is missing, and a ready-made message that has Claude or Codex bring the computer up to date
 * safely and say whether it already was. Never calls GitHub.
 */
export function WhatChangedPage() {
    const copy = useJourneyCopy();
    const [backend, setBackend] = useState<Repo | null>(null);
    const [mine, setMine] = useState<Mine>(readMine);
    const [copied, setCopied] = useState(false);
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

    return <div className="tw-updates">
        <div className="tw-plan-head">
            <div className="tw-plan-head__title">
                <h1>{copy('What changed', 'რა შეიცვალა')}</h1>
                <span className="tw-plan-head__people">{copy(`Both plans live on the branch ${BRANCH}. Pick the version your computer is on to see what you are missing, then copy the message below to Claude or Codex.`,
                    `ორივე გეგმა ცხოვრობს ბრენჩზე ${BRANCH}. აირჩიეთ თქვენი კომპიუტერის ვერსია, ნახეთ რა გაკლიათ და ქვემოთ მოცემული ტექსტი გადაეცით Claude-ს ან Codex-ს.`)}</span>
            </div>
        </div>

        <section className="tw-section" aria-labelledby="tw-latest">
            <h2 id="tw-latest" className="tw-section__title">{copy('The latest version (what is live now)', 'უახლესი ვერსია (რაც ახლა მუშაობს)')}</h2>
            <div className="tw-latest-grid">
                <Latest name="backend" repo={backend} live={copy('the server runs this', 'სერვერი ამას იყენებს')} />
                <Latest name="web" repo={web} live={copy('this page was built from it', 'ეს გვერდი ამისგან აიწყო')} />
            </div>
            <p className="gk-faint tw-paste__help">{copy('Something pushed but not yet released shows here after the next release.', 'რაც ატვირთულია, მაგრამ ჯერ არ გამოსულა, აქ შემდეგი გამოშვების შემდეგ გამოჩნდება.')}</p>
        </section>

        <section className="tw-section" aria-labelledby="tw-mine">
            <h2 id="tw-mine" className="tw-section__title">{copy('Your computer', 'თქვენი კომპიუტერი')}</h2>
            <div className="tw-grid">
                <MyVersion name="backend" repo={backend} value={mine.backend ?? ''} onChange={value => choose('backend', value)} />
                <MyVersion name="web" repo={web} value={mine.web ?? ''} onChange={value => choose('web', value)} />
            </div>
            <p className="gk-faint tw-paste__help">{copy('Not sure? Run `git log -1 --oneline` in each plan, or just send the message below: it checks for you.', 'არ იცით? გაუშვით `git log -1 --oneline` თითოეულ გეგმაში, ან უბრალოდ გაგზავნეთ ქვემოთ მოცემული ტექსტი: ის თავად შეამოწმებს.')}</p>
        </section>

        <section className="tw-section" aria-labelledby="tw-missing">
            <h2 id="tw-missing" className="tw-section__title">{picked.length
                ? count === 0 && lost.length === 0 ? copy('You are up to date', 'განახლებული ხართ') : copy(`Changes you’re missing (${count})`, `რაც გაკლიათ (${count})`)
                : copy('Recent changes', 'ბოლო ცვლილებები')}</h2>
            {lost.length > 0 && <p className="gk-notice gk-notice--warning">{copy('That version is older than the changes listed here, or not on this branch: you are missing at least these. Send the message below.',
                'ეს ვერსია აქ ჩამოთვლილზე ძველია ან სხვა ბრენჩზეა: გაკლიათ მინიმუმ ეს ცვლილებები. გაგზავნეთ ქვემოთ მოცემული ტექსტი.')}</p>}
            {!picked.length && <p className="gk-faint tw-paste__help">{copy('Pick your version above to see only what you are missing.', 'აირჩიეთ ვერსია ზემოთ, რომ მხოლოდ ის ნახოთ, რაც გაკლიათ.')}</p>}
            {byDay(shown).map(([key, commits]) => <div key={key} className="tw-day">
                <h3 className="tw-day__title">{shortDate(copy, day(key))}</h3>
                <ul className="tw-changes">{commits.map((commit: Commit & { repo: RepoKey }) => {
                    const merged = mergedBranch(commit);
                    return <li key={`${commit.repo}:${commit.id}`} data-merge={merged !== null || undefined}>
                        <span className="tw-chip">{copy(...NAMES[commit.repo])}</span>
                        <span className="tw-changes__title">{titleOf(copy, commit)}</span>
                        <span className="gk-faint gk-num">{short(commit.id)} · {commit.author}</span>
                    </li>;
                })}</ul>
            </div>)}
        </section>

        <section className="tw-section" aria-labelledby="tw-prompt">
            <div className="tw-prompt-head">
                <h2 id="tw-prompt" className="tw-section__title">{copy('Update my computer', 'ჩემი კომპიუტერის განახლება')}</h2>
                <Button size="sm" variant="primary" onClick={() => void navigator.clipboard?.writeText(prompt).then(() => setCopied(true))}><Copy aria-hidden="true" />{copied ? copy('Copied', 'დაკოპირდა') : copy('Copy', 'კოპირება')}</Button>
            </div>
            <p className="gk-faint tw-paste__help">{copy('Paste it into Claude or Codex on your computer. It keeps your own work safe, never forces anything, and tells you whether you were already up to date.',
                'ჩასვით Claude-ში ან Codex-ში თქვენს კომპიუტერზე. ის თქვენს სამუშაოს შეინახავს, არაფერს აიძულებს და გეტყვით, უკვე განახლებული იყავით თუ არა.')}</p>
            <textarea className="gk-input tw-paste__text" readOnly rows={12} value={prompt} aria-label={copy('The message for Claude or Codex', 'ტექსტი Claude-სთვის ან Codex-ისთვის')} onFocus={event => event.target.select()} />
        </section>
    </div>;
}
