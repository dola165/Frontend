import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, GitCommitHorizontal, GitMerge } from 'lucide-react';
import { Button, FixtureRow, PageHeader, Skeleton } from '../../design/primitives';
import { formatDate, formatDateTime, formatTime } from '../../utils/formatting';
import { AgendaDays } from '../schedule/board/AgendaDays';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { fetchVersions, saveSeen } from './api';
import { useDayTitle } from './useDayTitle';
import { byDay, commitId, mergedBranch, missing, short, updatePrompt, webHistory, type Commit, type Repo, type RepoKey } from './upToDate';
import { comparedWithLive, headline, liveSourceLine, newSince, standing, webBuild, type At, type Build, type Release, type Seen, type Standing, type Versions } from './whichVersion';
import { ago } from './teamWorkWords';
import './team-work-agenda.css';

const STORAGE = 'gk.teamWork.myVersion';
const NAMES: Record<RepoKey, [string, string]> = { backend: ['Backend', 'ბექენდი'], web: ['Web app', 'ვებ-აპი'] };
/** Each repository's symbol colour, so a row shows at a glance which one changed. */
const TONES: Record<RepoKey, string> = { backend: 'var(--gk-violet)', web: 'var(--gk-info)' };
/** About how many changes the list shows at first, and adds with each "Show earlier days"; always whole days. */
const ROWS = 30;
/** What a copy built without git runs to find its commit, in each repository's folder. */
const HEAD_COMMAND = 'git rev-parse HEAD';
type Mine = Partial<Record<RepoKey, string>>;
type CopyFn = ReturnType<typeof useJourneyCopy>;

/** A commit's title in plain words: a merge says which branch came in. */
const titleOf = (copy: CopyFn, commit: Commit) => { const merged = mergedBranch(commit); return merged === null ? commit.title : copy(`merged: ${merged || 'a branch'}`, `შერწყმა: ${merged || 'ბრენჩი'}`); };

const readMine = (): Mine => { try { return JSON.parse(localStorage.getItem(STORAGE) ?? '{}') as Mine; } catch { return {}; } };
const saveMine = (mine: Mine) => { try { localStorage.setItem(STORAGE, JSON.stringify(mine)); } catch { /* the choice just isn't remembered */ } };

/** One release: its number and day, what it brought in a line, and the tasks that went live in it. */
function ReleaseCard({ release }: { release: Release }) {
    const copy = useJourneyCopy();
    return <article className="tw-release" aria-label={copy(`Release ${release.number}`, `რელიზი ${release.number}`)}>
        <div className="tw-release__head"><strong>{copy(`Release ${release.number}`, `რელიზი ${release.number}`)}</strong>
            {release.date && <span className="gk-faint">· {formatDate(release.date, { day: 'numeric', month: 'short' })}</span>}</div>
        <p className="tw-release__summary">{release.summary ? copy(release.summary.en, release.summary.ka)
            : <span className="gk-muted">{copy('The live site has it; what it brought arrives with the update.', 'ის ლაივზეა; რა შემოიტანა, განახლებასთან ერთად გამოჩნდება.')}</span>}</p>
        {release.tasks.length > 0 && <ul className="tw-release__tasks">
            {release.tasks.map(task => <li key={task.id}><Link to={`/team-work?task=${task.id}`}><code className="gk-num">{task.key}</code> {task.title}</Link></li>)}
        </ul>}
    </article>;
}

/** One side's build in plain words, for "How this was worked out". */
function BuildLine({ name, build, at, devServer }: { name: RepoKey; build: Build | undefined; at: At; devServer?: boolean }) {
    const copy = useJourneyCopy();
    const where = !at.known ? copy('not known', 'უცნობია') : at.release == null ? copy('before release 1', '1-ელ რელიზამდე')
        : copy(`release ${at.release}${at.changes ? ` plus ${at.changes}` : ''}`, `რელიზი ${at.release}${at.changes ? ` და ${at.changes}` : ''}`);
    return <li><strong>{copy(...NAMES[name])}</strong>: {where}
        {build?.known && build.head && <> · <code className="gk-num">{short(build.head)}</code>{build.branch && <span className="gk-faint"> {copy('on', '')} {build.branch}</span>}</>}
        {build?.builtAt && <span className="gk-faint"> · {devServer ? copy('checked when the dev server started', 'შემოწმდა dev სერვერის ჩართვისას') : copy('built', 'აიწყო')} {formatDateTime(build.builtAt)}</span>}
        {!!build?.dirty && <span className="gk-faint"> · {copy(`${build.dirty} files not committed`, `${build.dirty} ფაილი დაუკომიტებელია`)}</span>}
    </li>;
}

/** Which version a computer is on, picked or pasted by hand, remembered in this browser. */
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

/** The answer: which release, live or a copy, how it compares with live; with one button when a copy cannot tell. */
function Answer({ s, onCopyCommand, copiedCommand }: { s: Standing | null; onCopyCommand: () => void; copiedCommand: boolean }) {
    const copy = useJourneyCopy();
    if (!s) return <section className="tw-answer" aria-busy="true"><Skeleton height={22} /><Skeleton height={16} /></section>;
    return <section className="tw-answer" data-place={s.place} aria-label={copy('Your version', 'თქვენი ვერსია')}>
        <h2 className="tw-answer__title"><span className="tw-answer__dot" aria-hidden="true" />{headline(copy, s)}</h2>
        <p className="tw-answer__line">{comparedWithLive(copy, s)}</p>
        {!s.known && !s.oldBackend && <div className="gk-notice gk-notice--warning tw-answer__ask">
            <span>{copy(`Open a terminal in your GrassKickZ folder, run ${HEAD_COMMAND}, and paste what it prints into “My backend version” under “Every change” below. Do the same in your Frontend folder for “My web app version”.`,
                `გახსენით ტერმინალი GrassKickZ საქაღალდეში, გაუშვით ${HEAD_COMMAND} და ჩასვით შედეგი „ჩემი ბექენდის ვერსია“-ში ქვემოთ, „ყველა ცვლილება“-ში. იგივე გააკეთეთ Frontend საქაღალდეში „ჩემი ვებ-აპის ვერსია“-სთვის.`)}</span>
            <Button size="sm" onClick={onCopyCommand}><Copy aria-hidden="true" />{copiedCommand ? copy('Copied', 'დაკოპირდა') : copy('Copy the command', 'ბრძანების კოპირება')}</Button>
        </div>}
    </section>;
}

/**
 * What changed, answer first: which release this person is on, whether this is the live site or their local copy, and
 * how it compares with live. Then what is new since they last looked (remembered per person on the server) and, on a
 * copy behind live, what it is missing, in releases and their tasks. How it was worked out, every release and every
 * commit day by day are folded below. Never calls GitHub: each build carries its own history.
 */
export function WhatChangedPage() {
    const copy = useJourneyCopy();
    const dayTitle = useDayTitle();
    const [versions, setVersions] = useState<Versions | null>(null);
    // What the person had seen before this visit: the page saves the new one at once, but shows what was new.
    const [before, setBefore] = useState<Seen | null>(null);
    const [mine, setMine] = useState<Mine>(readMine);
    const [copied, setCopied] = useState('');
    const [rows, setRows] = useState(ROWS);
    const web = webHistory();
    const build = webBuild();
    useEffect(() => {
        const controller = new AbortController();
        fetchVersions(controller.signal).then(found => { setVersions(found); setBefore(found.seen ?? null); })
            .catch(() => { if (!controller.signal.aborted) setVersions({ backend: { known: false } }); });
        return () => controller.abort();
    }, []);
    const s = versions ? standing(versions, build, mine) : null;
    const releases = versions?.releases ?? [];
    const nowSeen = s && versions?.releases ? { release: s.release, backend: versions.build?.head ?? null, web: build.head ?? null } : null;
    const seenKey = nowSeen ? JSON.stringify(nowSeen) : '';
    useEffect(() => {
        if (!seenKey || !versions) return;
        const previous = versions.seen;
        const next = JSON.parse(seenKey) as Omit<Seen, 'at'>;
        if (previous && previous.release === next.release && previous.backend === next.backend && previous.web === next.web) return;
        // Remembered quietly: a failure only means the next visit shows these changes again.
        saveSeen(next).catch(() => undefined);
    }, [seenKey, versions]);

    const choose = (key: RepoKey, value: string) => { const next = { ...mine, [key]: value }; setMine(next); saveMine(next); };
    const repos: Record<RepoKey, Repo> = { backend: versions?.backend ?? { known: false }, web };
    const gaps = { backend: missing(repos.backend, mine.backend ?? null), web: missing(repos.web, mine.web ?? null) };
    const picked = (['backend', 'web'] as const).filter(key => commitId(mine[key] ?? ''));
    const shown = (['backend', 'web'] as const).flatMap(key => (picked.includes(key) || picked.length === 0 ? gaps[key].commits : []).map(commit => ({ ...commit, repo: key })));
    const count = shown.filter(commit => !mergedBranch(commit)).length;
    const liveRelease = s?.live.release != null ? releases.find(release => release.number === s.live.release) : undefined;
    const prompt = updatePrompt(repos, liveRelease && s?.place === 'COPY' ? { release: liveRelease.number, backend: liveRelease.backend, web: liveRelease.web } : undefined);
    const lost = picked.filter(key => !gaps[key].found);
    const days = byDay(shown);
    // Whole days until about `rows` changes are shown, at least one day.
    let shownDays = 0, total = 0;
    for (; shownDays < days.length && (shownDays === 0 || total + days[shownDays][1].length <= rows); shownDays += 1) total += days[shownDays][1].length;
    const copyText = (what: string, text: string) => void navigator.clipboard?.writeText(text).then(() => setCopied(what));
    const copyPrompt = () => copyText('prompt', prompt);
    const fresh = s && versions?.releases ? newSince(before, s.release, releases) : null;
    // Within the same release, the smaller changes since the commits seen last time.
    const smaller = before && fresh && fresh.releases.length === 0
        ? (['backend', 'web'] as const).reduce((sum, key) => { const gap = missing(repos[key], before[key] ?? null); return sum + (gap.found ? gap.commits.filter(commit => !mergedBranch(commit)).length : 0); }, 0) : 0;

    return <div className="tw-updates">
        <PageHeader title={copy('What changed', 'რა შეიცვალა')} subtitle={copy('Which version you’re on, and what’s new', 'რომელ ვერსიაზე ხართ და რა არის ახალი')}
            actions={<Button size="sm" variant="primary" onClick={copyPrompt}><Copy aria-hidden="true" />{copied === 'prompt' ? copy('Copied', 'დაკოპირდა') : copy('Copy update message', 'განახლების ტექსტის კოპირება')}</Button>} />

        <Answer s={s} onCopyCommand={() => copyText('command', HEAD_COMMAND)} copiedCommand={copied === 'command'} />

        {fresh && (fresh.releases.length > 0 || before) && <section className="tw-block" aria-labelledby="tw-new">
            <h2 id="tw-new" className="tw-heading">{fresh.first ? copy(`What’s in release ${s?.release}`, `რა არის რელიზ ${s?.release}-ში`)
                : copy('New since you last looked', 'ახალი ბოლო ნახვის შემდეგ')}
                {before?.at && <span className="gk-faint">· {ago(copy, before.at)}{before.release != null ? copy(`, on release ${before.release}`, `, რელიზ ${before.release}-ზე`) : ''}</span>}</h2>
            {fresh.releases.length > 0 ? fresh.releases.slice().reverse().map(release => <ReleaseCard key={release.number} release={release} />)
                : <p className="gk-muted tw-answer__line">{smaller > 0 ? copy(`No new release; ${smaller === 1 ? '1 smaller change' : `${smaller} smaller changes`} came in (Every change, below).`, `ახალი რელიზი არ არის; შემოვიდა ${smaller} მცირე ცვლილება (ყველა ცვლილება, ქვემოთ).`)
                    : copy('Nothing new since then.', 'მას შემდეგ ახალი არაფერია.')}</p>}
        </section>}

        {s && s.place === 'COPY' && s.behind.length > 0 && <section className="tw-block" aria-labelledby="tw-behind">
            <h2 id="tw-behind" className="tw-heading">{copy('What your copy is missing', 'რა აკლია თქვენს ასლს')}</h2>
            {s.behind.slice().reverse().map(release => <ReleaseCard key={release.number} release={release} />)}
            <div><Button size="sm" onClick={copyPrompt}><Copy aria-hidden="true" />{copied === 'prompt' ? copy('Copied', 'დაკოპირდა') : copy('Copy update message', 'განახლების ტექსტის კოპირება')}</Button>
                <span className="gk-faint tw-release__hint"> {copy('Paste it to Claude or Codex on your computer.', 'ჩასვით Claude-ში ან Codex-ში თქვენს კომპიუტერზე.')}</span></div>
        </section>}

        <details className="tw-section tw-fold">
            <summary className="tw-section__title">{copy('How this was worked out', 'როგორ დადგინდა')}</summary>
            {s && <ul className="tw-how">
                <li>{s.place === 'LIVE' ? copy('This server is the live site.', 'ეს სერვერი ლაივ საიტია.')
                    : copy(`This server is a copy, not the live site${versions?.liveOrigin ? ` (${versions.liveOrigin})` : ''}.`, `ეს სერვერი ასლია და არა ლაივ საიტი${versions?.liveOrigin ? ` (${versions.liveOrigin})` : ''}.`)}</li>
                <BuildLine name="backend" build={versions?.build} at={s.backend} />
                <BuildLine name="web" build={build} at={s.web} devServer={import.meta.env.DEV} />
                <li>{liveSourceLine(copy, s)}{s.live.checkedAt && s.live.source === 'LIVE_SITE' ? <span className="gk-faint"> · {formatTime(s.live.checkedAt)}</span> : null}</li>
                <li className="gk-faint">{copy('A copy contains a release when that release’s commit is in its history; its changes are the commits it has on top. Facts are taken when the server or dev server starts: restart it after you update.',
                    'ასლი შეიცავს რელიზს, როცა ამ რელიზის კომიტი მის ისტორიაშია; ცვლილებები ის კომიტებია, რაც ზემოდან აქვს. მონაცემები სერვერის ან dev სერვერის ჩართვისას აიღება: განახლების შემდეგ გადატვირთეთ.')}</li>
            </ul>}
        </details>

        {releases.length > 0 && <details className="tw-section tw-fold">
            <summary className="tw-section__title">{copy(`All releases (${releases.length})`, `ყველა რელიზი (${releases.length})`)}</summary>
            <div className="tw-releases">{releases.map(release => <ReleaseCard key={release.number} release={release} />)}</div>
        </details>}

        <details className="tw-section tw-fold" open={s ? !s.known : false}>
            <summary className="tw-section__title">{copy('Every change, day by day', 'ყველა ცვლილება, დღეების მიხედვით')}</summary>
            <div className="tw-grid">
                <MyVersion name="backend" repo={versions?.backend ?? null} value={mine.backend ?? ''} onChange={value => choose('backend', value)} />
                <MyVersion name="web" repo={web} value={mine.web ?? ''} onChange={value => choose('web', value)} />
            </div>
            <section className="tw-block tw-agenda" aria-labelledby="tw-missing">
                <h2 id="tw-missing" className="tw-heading">{picked.length
                    ? count === 0 && lost.length === 0 ? copy('You are up to date', 'განახლებული ხართ') : copy(`You’re missing ${count}`, `გაკლიათ ${count}`)
                    : copy('Recent changes', 'ბოლო ცვლილებები')}</h2>
                {lost.length > 0 && <div className="gk-notice gk-notice--warning"><span>{copy('That version is older than this list, or on another branch: you are missing at least these.', 'ეს ვერსია ამ სიაზე ძველია ან სხვა ბრენჩზეა: გაკლიათ მინიმუმ ეს.')}</span>
                    <Button size="sm" onClick={copyPrompt}>{copied === 'prompt' ? copy('Copied', 'დაკოპირდა') : copy('Copy update message', 'განახლების ტექსტის კოპირება')}</Button></div>}
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
        </details>

        <details className="tw-section tw-fold">
            <summary className="tw-section__title">{copy('The update message', 'განახლების ტექსტი')}</summary>
            <textarea className="gk-input tw-paste__text" readOnly rows={12} value={prompt} aria-label={copy('The message for Claude or Codex', 'ტექსტი Claude-სთვის ან Codex-ისთვის')} onFocus={event => event.target.select()} />
        </details>
    </div>;
}
