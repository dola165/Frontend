import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { fetchJobs, type CATEGORIES } from '../../jobs/api';
import { jobsPath, type JobsSearch } from '../../jobs/query';
import { fetchDiscoveryPreferences, fetchOwnProfessions, saveDiscoveryPreferences, saveProfessions } from '../../profiles/api';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { WelcomeFrame, type WelcomeStepProps } from '../WelcomeFrame';

/** What people do, as real job titles, each with the jobs category it opens. */
const WORK: { id: string; en: string; ka: string; category: typeof CATEGORIES[number]['value'] }[] = [
    { id: 'coach', en: 'Coach', ka: 'მწვრთნელი', category: 'COACHING' },
    { id: 'assistant', en: 'Assistant coach', ka: 'მწვრთნელის ასისტენტი', category: 'COACHING' },
    { id: 'goalkeeping', en: 'Goalkeeper coach', ka: 'მეკარეთა მწვრთნელი', category: 'COACHING' },
    { id: 'referee', en: 'Referee', ka: 'მსაჯი', category: 'MATCHDAY' },
    { id: 'physio', en: 'Physio', ka: 'ფიზიოთერაპევტი', category: 'MEDICAL' },
    { id: 'analyst', en: 'Analyst', ka: 'ანალიტიკოსი', category: 'FOOTBALL_OPERATIONS' },
    { id: 'scout', en: 'Scout', ka: 'სკაუტი', category: 'FOOTBALL_OPERATIONS' },
    { id: 'manager', en: 'Team manager', ka: 'გუნდის მენეჯერი', category: 'FOOTBALL_OPERATIONS' },
    { id: 'agent', en: 'Agent', ka: 'აგენტი', category: 'OTHER' },
    { id: 'media', en: 'Photographer', ka: 'ფოტოგრაფი', category: 'MEDIA_COMMUNICATIONS' },
    { id: 'volunteer', en: 'Volunteer', ka: 'მოხალისე', category: 'OTHER' },
];

/**
 * Where to land: the first of these searches with listings near the person (as Jobs & volunteering will search), else
 * every listing, so the person never lands on an empty list that another of their answers would have filled.
 */
async function landingFor(searches: Partial<JobsSearch>[], near: string | undefined) {
    for (const search of searches) {
        try {
            const page = await fetchJobs({ size: 1, direction: 'ALL', category: search.category || undefined, terms: search.terms || undefined, near });
            if (page.totalElements > 0) return jobsPath(search);
        } catch { return jobsPath(search); }
    }
    return jobsPath({});
}

/**
 * Step 2 of Work or volunteer: what the person does (chips) and "Open to work", on by default. The chips go on their
 * profile as what they do, "Open to work" into who can find them; then Jobs & volunteering opens on the first of
 * them with listings near the person.
 */
export function WorkStep({ facts, land, back, close }: WelcomeStepProps) {
    const copy = useJourneyCopy();
    const [chosen, setChosen] = useState<string[]>([]);
    const [open, setOpen] = useState(true);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const toggle = (id: string) => setChosen(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id]));
    const picked = WORK.filter(item => chosen.includes(item.id));
    const finish = async () => {
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
        const onlyVolunteer = chosen.length === 1 && chosen[0] === 'volunteer';
        const searches = onlyVolunteer ? [{ terms: 'VOLUNTEER' }] : [...new Set(picked.map(item => item.category))].map(category => ({ category }));
        const to = await landingFor(searches, facts.place?.source === 'SAVED' ? facts.place.name : undefined);
        setBusy(false);
        land('work', to);
    };
    return <WelcomeFrame position={2} onClose={close} back={back} title={copy('What do you do?', 'რას აკეთებთ?')}
        hint={copy('Pick all that fit.', 'აირჩიეთ ყველა, რაც გეხებათ.')}
        footer={<Button variant="primary" disabled={busy} onClick={() => void finish()}>
            {busy && <Loader2 className="gk-welcome__spin" aria-hidden="true" />}{copy('Show jobs', 'სამსახურების ნახვა')}
        </Button>}>
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
            <span><strong>{copy('Open to work', 'ღია ვარ სამსახურისთვის')}</strong><small>{copy('Clubs looking for help can find you.', 'კლუბები, რომლებსაც დახმარება სჭირდებათ, გიპოვიან.')}</small></span>
        </label>
        {failed && <p role="alert" className="gk-notice gk-notice--warning">{copy('That couldn’t be saved. Your choices are still here.', 'ვერ შეინახა. არჩევანი აქვეა.')}</p>}
    </WelcomeFrame>;
}
