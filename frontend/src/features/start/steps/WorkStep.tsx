import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button, Skeleton } from '../../../design/primitives';
import { fetchJobs, type Job } from '../../jobs/api';
import { jobsPath, type JobsSearch } from '../../jobs/query';
import { fetchDiscoveryPreferences, fetchOwnProfessions, saveDiscoveryPreferences, saveProfessions } from '../../profiles/api';
import { WORK_CHIPS as WORK } from '../../profiles/workChips';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { Crest } from '../../world/Crest';
import { WelcomeFrame, type WelcomeStepProps } from '../WelcomeFrame';

/** What the chips search for, as Jobs & volunteering searches: one search per kind of work (volunteering alone by its terms). */
const searchesFor = (chosen: string[]): Partial<JobsSearch>[] => {
    if (chosen.length === 1 && chosen[0] === 'volunteer') return [{ terms: 'VOLUNTEER' }];
    const categories = [...new Set(WORK.filter(item => chosen.includes(item.id)).map(item => item.category))];
    return categories.length ? categories.map(category => ({ category })) : [{}];
};

/**
 * Step 2 of Work or volunteer, where the answer is shown (owner, 27 October): what the person does (chips) and "Open
 * to work", on by default, and under them the listings near them that match, updating as chips are tapped. Finish
 * keeps the chips on their profile as what they do and "Open to work" in who can find them, then lands on Home; "See
 * all jobs" opens Jobs & volunteering on the same search.
 */
export function WorkStep({ facts, land, back, close }: WelcomeStepProps) {
    const copy = useJourneyCopy();
    const [chosen, setChosen] = useState<string[]>([]);
    const [open, setOpen] = useState(true);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const near = facts.place?.source === 'SAVED' ? facts.place.name : undefined;
    const key = `${[...chosen].sort().join(',')}|${near ?? ''}`;
    const [found, setFound] = useState<{ key: string; total: number; jobs: Job[] } | null>(null);
    const shown = found?.key === key ? found : null;
    const toggle = (id: string) => setChosen(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id]));
    const picked = WORK.filter(item => chosen.includes(item.id));

    // The same search Jobs & volunteering runs, near the person, a breath after the last tap.
    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            void Promise.all(searchesFor(key.split('|')[0].split(',').filter(Boolean)).map(search =>
                fetchJobs({ size: 4, direction: 'ALL', category: search.category || undefined, terms: search.terms || undefined, near }, controller.signal).catch(() => ({ content: [], totalElements: 0 }))))
                .then(pages => {
                    if (controller.signal.aborted) return;
                    const jobs = [...new Map(pages.flatMap(page => page.content).map(job => [job.id, job])).values()].slice(0, 4);
                    setFound({ key, total: pages.reduce((sum, page) => sum + page.totalElements, 0), jobs });
                });
        }, 250);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [key, near]);

    const finish = async (to: string | null) => {
        setBusy(true); setFailed(false);
        try {
            if (picked.length) {
                const own = await fetchOwnProfessions();
                const known = new Set(own.items.map(item => item.title.trim().toLowerCase()));
                const added = picked.map(item => copy(item.en, item.ka)).filter(title => !known.has(title.toLowerCase()));
                if (added.length) await saveProfessions([
                    ...own.items.map(({ id, title, detail, since, published }) => ({ id, title, detail, since, published })),
                    ...added.map(title => ({ title, detail: null, since: null, published: true })),
                ], own.version, crypto.randomUUID());
            }
            if (open) {
                const discovery = await fetchDiscoveryPreferences();
                const openTo = [...new Set([...discovery.openTo, 'WORK' as const, ...(chosen.includes('volunteer') ? ['VOLUNTEER' as const] : [])])];
                if (openTo.length !== discovery.openTo.length) await saveDiscoveryPreferences({ openTo, licence: discovery.licence, rate: discovery.rate }, discovery.version, crypto.randomUUID());
            }
        } catch { setBusy(false); setFailed(true); return; }
        setBusy(false);
        land('work', to);
    };
    const where = (job: Job) => [job.poster?.name ?? job.clubName, job.poster?.city ?? job.clubCityName, job.distanceKm != null ? copy(`${Math.round(job.distanceKm)} km`, `${Math.round(job.distanceKm)} კმ`) : null].filter(Boolean).join(' · ');

    return <WelcomeFrame position={2} onClose={close} back={back} title={copy('What do you do?', 'რას აკეთებთ?')}
        hint={copy('Pick all that fit.', 'აირჩიეთ ყველა, რაც გეხებათ.')}
        footer={<>
            <Button variant="secondary" disabled={busy} onClick={() => void finish(jobsPath(searchesFor(chosen)[0]))}>{copy('See all jobs', 'ყველა სამუშაო')}</Button>
            <Button variant="primary" disabled={busy} onClick={() => void finish(null)}>
                {busy && <Loader2 className="gk-welcome__spin" aria-hidden="true" />}{copy('Finish', 'დასრულება')}
            </Button>
        </>}>
        <div className="gk-welcome-chips" role="group" aria-label={copy('What do you do?', 'რას აკეთებთ?')}>
            {WORK.map(item => {
                const on = chosen.includes(item.id);
                return <button key={item.id} type="button" className="gk-welcome-chip" aria-pressed={on} onClick={() => toggle(item.id)}>
                    {on && <Check aria-hidden="true" />}{copy(item.en, item.ka)}
                </button>;
            })}
        </div>
        <label className="gk-welcome__switch">
            <input type="checkbox" role="switch" checked={open} onChange={event => setOpen(event.target.checked)} />
            <span><strong>{copy('Open to work', 'ვეძებ სამუშაოს')}</strong><small>{copy('Clubs looking for help can find you.', 'კლუბები, რომლებსაც დახმარება სჭირდებათ, გიპოვიან.')}</small></span>
        </label>
        <section className="gk-wjobs" aria-label={copy('Jobs near you', 'სამუშაო თქვენთან ახლოს')} aria-live="polite">
            {!shown ? <div role="status" aria-label={copy('Looking for jobs', 'სამუშაოს ძებნა')} className="gk-welcome__loading"><Skeleton height={48} /><Skeleton height={48} /></div>
                : shown.total === 0 ? <p className="gk-welcome__hint">{chosen.length
                    ? copy('Nothing near you for that yet. Clubs who need help can still find you.', 'ამისთვის ახლოს ჯერ არაფერია. კლუბები, რომლებსაც დახმარება სჭირდებათ, მაინც გიპოვიან.')
                    : copy('No listings near you yet. Clubs who need help can still find you.', 'ახლოს განცხადებები ჯერ არ არის. კლუბები, რომლებსაც დახმარება სჭირდებათ, მაინც გიპოვიან.')}</p>
                    : <>
                        <p className="gk-wjobs__count"><strong>{shown.total}</strong> {copy('near you', 'თქვენთან ახლოს')}</p>
                        <ul className="gk-wjobs__list">{shown.jobs.map(job => <li key={job.id} className="gk-wjobs__row">
                            <Crest src={job.poster?.avatarUrl ?? job.clubLogoUrl ?? null} name={job.poster?.name ?? job.clubName ?? job.title} size={32} />
                            <span className="gk-wjobs__text"><strong>{job.title}</strong><small>{where(job)}</small></span>
                        </li>)}</ul>
                    </>}
        </section>
        {failed && <p role="alert" className="gk-notice gk-notice--warning">{copy('That couldn’t be saved. Your choices are still here.', 'ვერ შეინახა. არჩევანი აქვეა.')}</p>}
    </WelcomeFrame>;
}
