import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { extractApiErrorMessage } from '../../utils/apiError';
import { attachTournamentDivision, createNextEdition, createTournamentDivision, createTournamentSeries, fetchTournamentSeries, updateTournamentEdition, updateTournamentSeries, type TournamentEdition, type TournamentSeries } from './api';
import './tournament-series.css';

interface Props { tournamentId: number; canCreate?: boolean; tournamentName?: string }
type Editor = { kind: 'next' | 'division' | 'attach' | 'edit-edition'; edition: TournamentEdition } | { kind: 'series' } | { kind: 'edit-series' } | null;

/** Each division remains a normal tournament, keeping registration, staff, and results independent. */
export function TournamentSeriesPanel({ tournamentId, canCreate = false, tournamentName = '' }: Props) {
    const { i18n } = useTranslation();
    const copy = (en: string, ka: string) => i18n.language.startsWith('ka') ? ka : en;
    const [series, setSeries] = useState<TournamentSeries | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState('');
    const [editor, setEditor] = useState<Editor>(null);
    const [busy, setBusy] = useState(false);
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        let active = true;
        setLoading(true); setError(''); setEditor(null); setSaved(''); setSeries(null);
        fetchTournamentSeries(tournamentId).then(value => { if (active) setSeries(value); })
            .catch(e => { if (active) setError(extractApiErrorMessage(e, 'Could not load tournament editions.')); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [tournamentId, retry]);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!editor || busy) return;
        const values = new FormData(event.currentTarget);
        const field = (name: string) => String(values.get(name) || '').trim();
        setBusy(true); setError(''); setSaved('');
        try {
            let result: TournamentSeries;
            if (editor.kind === 'series') result = await createTournamentSeries(tournamentId, { name: field('name'), description: field('description'), editionLabel: field('label'), divisionName: field('division') });
            else if (!series) return;
            else if (editor.kind === 'edit-series') result = await updateTournamentSeries(series.id, { name: field('name'), description: field('description') });
            else if (editor.kind === 'next' || editor.kind === 'edit-edition') {
                if (!field('start') || !field('end') || field('end') < field('start')) throw new Error(copy('The end must be on or after the start.', 'დასრულება დაწყების შემდეგ უნდა იყოს.'));
                const payload = { label: field('label'), startDate: `${field('start')}:00`, endDate: `${field('end')}:00` };
                result = editor.kind === 'next' ? await createNextEdition(series.id, editor.edition.id, payload) : await updateTournamentEdition(series.id, editor.edition.id, payload);
            } else if (editor.kind === 'division') result = await createTournamentDivision(series.id, editor.edition.id, { name: field('name'), templateTournamentId: Number(field('template')) });
            else result = await attachTournamentDivision(series.id, editor.edition.id, { name: field('name'), tournamentId: Number(field('tournamentId')) });
            setSeries(result); setEditor(null); setSaved(copy('Tournament editions updated.', 'ტურნირის გამოშვებები განახლდა.'));
        } catch (e) { setError(extractApiErrorMessage(e, e instanceof Error ? e.message : copy('Could not save. Try again.', 'შენახვა ვერ მოხერხდა. სცადეთ ხელახლა.'))); }
        finally { setBusy(false); }
    }

    const open = (value: Editor) => { setEditor(value); setError(''); setSaved(''); };
    return <section className="ts-panel" aria-label={copy('Tournament series and editions', 'ტურნირის სერია და გამოშვებები')}>
        <header><div><h2>{series?.name || copy('Series and editions', 'სერია და გამოშვებები')}</h2><p>{series?.description || copy('Keep recurring editions and age-group divisions connected, with separate registrations and results.', 'დააკავშირეთ განმეორებადი გამოშვებები და ასაკობრივი დივიზიონები, დამოუკიდებელი რეგისტრაციითა და შედეგებით.')}</p></div></header>
        {loading && <p role="status">{copy('Loading editions…', 'გამოშვებების ჩატვირთვა…')}</p>}
        {error && <div role="alert"><p>{error}</p>{!editor && <button type="button" onClick={() => setRetry(n => n + 1)}>{copy('Try again', 'ხელახლა ცდა')}</button>}</div>}
        {saved && <p role="status">{saved}</p>}
        {series && <Link to={`/tournament-series/${series.id}`}>{copy('Competition history & editions', 'შეჯიბრის ისტორია და გამოშვებები')}</Link>}
        {series?.canManage && <div className="ts-actions"><button type="button" disabled={busy} onClick={() => open({ kind: 'edit-series' })}>{copy('Edit series details', 'სერიის დეტალების შეცვლა')}</button></div>}
        {!loading && !error && !series && !editor && (canCreate
            ? <button type="button" onClick={() => open({ kind: 'series' })}>{copy('Start a series from this tournament', 'ამ ტურნირით სერიის დაწყება')}</button>
            : <p>{copy('This tournament is not part of a series yet.', 'ეს ტურნირი ჯერ არ არის სერიის ნაწილი.')}</p>)}
        {series?.editions.map(edition => <article className="ts-edition" key={edition.id}>
            <h3>{edition.label}</h3><p>{edition.startDate.slice(0, 10)} – {edition.endDate.slice(0, 10)}</p>
            <ul>{edition.divisions.map(division => <li key={division.id}><Link to={`/tournaments/${division.tournamentId}${series.canManage ? '/workspace' : ''}`}>{division.name}</Link><span>{copy(division.status === 'PLANNING' ? 'Draft' : division.status === 'ACTIVE' ? 'Active' : division.status === 'COMPLETED' ? 'Completed' : 'Cancelled', division.status === 'PLANNING' ? 'მონახაზი' : division.status === 'ACTIVE' ? 'აქტიური' : division.status === 'COMPLETED' ? 'დასრულებული' : 'გაუქმებული')}{division.visibility === 'PRIVATE' ? copy(' · Private', ' · პირადი') : ''}</span></li>)}</ul>
            {series.canManage && <div className="ts-actions"><button type="button" disabled={busy} onClick={() => open({ kind: 'edit-edition', edition })}>{copy('Edit edition dates & label', 'გამოშვების თარიღებისა და სახელის შეცვლა')}</button><button type="button" disabled={busy} onClick={() => open({ kind: 'next', edition })}>{copy('Prepare next edition', 'შემდეგი გამოშვების მომზადება')}</button><button type="button" disabled={busy} onClick={() => open({ kind: 'division', edition })}>{copy('Add division', 'დივიზიონის დამატება')}</button><button type="button" disabled={busy} onClick={() => open({ kind: 'attach', edition })}>{copy('Link existing tournament', 'არსებული ტურნირის დაკავშირება')}</button></div>}
        </article>)}
        {editor && <form key={`${editor.kind}-${'edition' in editor ? editor.edition.id : ''}`} onSubmit={submit} className="ts-form">
            <h3>{editor.kind === 'edit-series' ? copy('Edit series details', 'სერიის დეტალების შეცვლა') : editor.kind === 'edit-edition' ? copy('Edit edition', 'გამოშვების შეცვლა') : editor.kind === 'series' ? copy('Create tournament series', 'ტურნირის სერიის შექმნა') : editor.kind === 'next' ? copy('Next edition draft', 'შემდეგი გამოშვების მონახაზი') : editor.kind === 'division' ? copy('New division draft', 'ახალი დივიზიონის მონახაზი') : copy('Link a division', 'დივიზიონის დაკავშირება')}</h3>
            {editor.kind === 'edit-series' && <><label>{copy('Series name', 'სერიის სახელი')}<input name="name" required maxLength={255} defaultValue={series?.name}/></label><label>{copy('Description', 'აღწერა')}<textarea name="description" maxLength={4000} defaultValue={series?.description ?? ''}/></label></>}
            {editor.kind === 'edit-edition' && <><p>{copy('Expand the edition dates before moving a division outside its current window. To narrow the window, first move all division dates inside it. This does not move fixtures or change past results.', 'დივიზიონის თარიღების გადატანამდე გააფართოვეთ გამოშვების პერიოდი. პერიოდის შესამცირებლად ჯერ ყველა დივიზიონის თარიღები მოაქციეთ მის ფარგლებში. მატჩები და წარსული შედეგები არ იცვლება.')}</p><label>{copy('Edition label', 'გამოშვების სახელი')}<input name="label" required maxLength={100} defaultValue={editor.edition.label}/></label><label>{copy('Edition starts', 'გამოშვება იწყება')}<input name="start" type="datetime-local" required defaultValue={editor.edition.startDate.slice(0,16)}/></label><label>{copy('Edition ends', 'გამოშვება სრულდება')}<input name="end" type="datetime-local" required defaultValue={editor.edition.endDate.slice(0,16)}/></label></>}
            {editor.kind === 'series' && <><label>{copy('Series name', 'სერიის სახელი')}<input name="name" required maxLength={255} defaultValue={tournamentName}/></label><label>{copy('Description', 'აღწერა')}<textarea name="description" maxLength={4000}/></label><label>{copy('Current edition label', 'მიმდინარე გამოშვების სახელი')}<input name="label" required maxLength={100} placeholder="2026"/></label><label>{copy('Current division name', 'მიმდინარე დივიზიონის სახელი')}<input name="division" required maxLength={100} placeholder="U12"/></label></>}
            {editor.kind === 'next' && <><p>{copy('Copies division names and tournament settings into private planning drafts. Teams, players, staff, fixtures, results, and registration dates are not copied. Review each division before publishing.', 'დივიზიონების სახელები და პარამეტრები დაკოპირდება პირად მონახაზებში. გუნდები, მოთამაშეები, პერსონალი, მატჩები, შედეგები და რეგისტრაციის თარიღები არ დაკოპირდება. გამოქვეყნებამდე შეამოწმეთ თითოეული დივიზიონი.')}</p><label>{copy('New edition label', 'ახალი გამოშვების სახელი')}<input name="label" required maxLength={100}/></label><label>{copy('Edition starts', 'გამოშვება იწყება')}<input name="start" type="datetime-local" required/></label><label>{copy('Edition ends', 'გამოშვება სრულდება')}<input name="end" type="datetime-local" required/></label></>}
            {(editor.kind === 'division' || editor.kind === 'attach') && <label>{copy('Division name', 'დივიზიონის სახელი')}<input name="name" required maxLength={100} placeholder="U14"/></label>}
            {editor.kind === 'division' && <><p>{copy('Creates a private tournament using this edition’s dates. Review its rules and registration settings before publishing.', 'შეიქმნება პირადი ტურნირი ამ გამოშვების თარიღებით. გამოქვეყნებამდე შეამოწმეთ წესები და რეგისტრაციის პარამეტრები.')}</p><label>{copy('Copy settings from', 'პარამეტრების კოპირება')}<select name="template" required>{editor.edition.divisions.map(division => <option key={division.tournamentId} value={division.tournamentId}>{division.name}</option>)}</select></label></>}
            {editor.kind === 'attach' && <><p>{copy('Use the tournament ID from its URL. It must belong to the same organizer, fit these edition dates, and not already belong to another edition. You must be its admin.', 'გამოიყენეთ ტურნირის ID მისამართიდან. მას უნდა ჰყავდეს იგივე ორგანიზატორი, მისი თარიღები უნდა ჯდებოდეს ამ გამოშვებაში და არ უნდა ეკუთვნოდეს სხვა გამოშვებას. თქვენ უნდა იყოთ მისი ადმინისტრატორი.')}</p><label>{copy('Tournament ID', 'ტურნირის ID')}<input name="tournamentId" type="number" min={1} step={1} required/></label></>}
            <div className="ts-actions"><button type="submit" disabled={busy}>{busy ? copy('Saving…', 'ინახება…') : copy('Save', 'შენახვა')}</button><button type="button" disabled={busy} onClick={() => open(null)}>{copy('Cancel', 'გაუქმება')}</button></div>
        </form>}
    </section>;
}
