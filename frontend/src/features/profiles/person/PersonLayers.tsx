import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { BadgeCheck, BriefcaseBusiness, PenLine, Plus, ShieldCheck } from 'lucide-react';
import { Badge, Button, EmptyNote, List, ListRow, Panel, Section } from '../../../design/primitives';
import type { PersonProfile, Profession } from '../api';
import { CareerCards, CareerTotalsRow, FootballLines } from '../football/FootballLines';
import type { FootballProfileData } from '../football/api';
import { StartDoors } from '../football/StartDoors';
import { WhatYouDo } from '../football/WhatYouDo';

/** How a fact was established, in words. Self-reported and confirmed always look different. */
export function VerificationBadge({ item }: { item: Pick<Profession, 'verification' | 'verifiedBy'> }) {
    const copy = useJourneyCopy();
    if (item.verification === 'CLUB_CONFIRMED') return <Badge tone="accent"><ShieldCheck size={13} aria-hidden="true" />{item.verifiedBy ? copy(`Confirmed by ${item.verifiedBy}`, `დაადასტურა: ${item.verifiedBy}`) : copy('Confirmed by a club', 'დაადასტურა კლუბმა')}</Badge>;
    if (item.verification === 'DOCUMENT_CHECKED') return <Badge tone="accent"><BadgeCheck size={13} aria-hidden="true" />{copy('Document checked', 'დოკუმენტი შემოწმებულია')}</Badge>;
    return <Badge>{copy('Self-reported', 'თავად მითითებული')}</Badge>;
}

/**
 * A person's football as the viewer may see it: where they are (their real links and jobs), their career from the
 * clubs' records, and what they do. Only what the server sends is shown; a child's lines and a parent's link never
 * reach other viewers. Club permissions are a separate thing and never appear here.
 */
export function PersonLayers({ profile, football, professions, professionsFailed, own, editWork = false, onRetryProfessions, onProfessionsChanged }: {
    profile: PersonProfile; football: FootballProfileData | null; professions: Profession[] | null; professionsFailed: boolean; own: boolean;
    /** Opens "What you do" in place (`?edit=work`). */
    editWork?: boolean;
    onRetryProfessions?: () => void;
    onProfessionsChanged?: () => void;
}) {
    const copy = useJourneyCopy();
    const [editing, setEditing] = useState(own && editWork);
    // The server's first name ("Where Luka is"); the whole name when it sends none.
    const name = football?.firstName || profile.fullName?.trim() || profile.username;
    // The server already leaves parent lines out for other viewers; the page never shows one even if it came.
    const lines = (football?.lines ?? []).filter(line => own || line.kind !== 'PARENT_OF');
    const totals = football?.totals;
    const hasCareer = Boolean(football && (football.career.length || totals!.sessionsCoached || totals!.matchesPlayed || totals!.matchesRefereed));
    return <div className="gk-person-layers">
        {(own || lines.length > 0) && <Section boxed title={own ? copy('Where you are', 'სად ხართ') : copy(`Where ${name} is`, `სად არის ${name}`)} action={own ? <Link className="gk-section__action" to="/account/football">{copy('Manage', 'მართვა')}</Link> : undefined}>
            {lines.length ? <FootballLines lines={lines} own={false} />
                : <>
                    <p className="gk-fp-empty">{copy('Nothing yet. This fills itself when a coach or a club adds you.', 'ჯერ არაფერია. შეივსება, როცა მწვრთნელი ან კლუბი დაგამატებთ.')}</p>
                    <StartDoors />
                </>}
        </Section>}
        {hasCareer && <Section boxed title={own ? copy('Your career', 'თქვენი კარიერა') : copy(`${name}’s career`, 'კარიერა')} hint={copy('From the clubs’ records', 'კლუბების ჩანაწერებიდან')}><CareerTotalsRow totals={totals!} /><CareerCards rows={football!.career} /></Section>}

        {(own || (professions?.length ?? 0) > 0 || professionsFailed) && <Section boxed id="work" title={own ? copy('What you do', 'რას აკეთებთ') : copy(`What ${name} does`, `რას აკეთებს ${name}`)}
            action={own && !editing && professions?.length ? <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><PenLine aria-hidden="true" />{copy('Edit', 'შეცვლა')}</Button> : undefined}>
            {own && editing ? <>
                <WhatYouDo />
                <div className="gk-about__foot"><Button size="sm" variant="primary" onClick={() => { setEditing(false); onProfessionsChanged?.(); }}>{copy('Done', 'მზადაა')}</Button></div>
            </> : professionsFailed ? <Panel flush><EmptyNote title={copy('Work and skills couldn’t load', 'სამუშაო და უნარები ვერ ჩაიტვირთა')} action={onRetryProfessions ? <Button size="sm" onClick={onRetryProfessions}>{copy('Try again', 'ხელახლა ცდა')}</Button> : undefined} /></Panel>
                : professions === null ? <Panel flush><EmptyNote title={copy('Loading work and skills…', 'იტვირთება…')} /></Panel>
                : professions.length ? <Panel flush><List label={copy('Professions and skills', 'პროფესიები და უნარები')}>{professions.map(item => <ListRow key={item.id}
                    lead={<span className="gk-club-icon"><BriefcaseBusiness aria-hidden="true" /></span>}
                    title={item.title}
                    meta={[item.since ? copy(`Since ${item.since}`, `${item.since}-დან`) : null, item.detail, own && !item.published ? copy('Hidden from your profile', 'დამალულია პროფილზე') : null, own && !item.label ? copy('Being added to the directory', 'ემატება ცნობარში') : null].filter(Boolean).join(' · ')}
                    trail={<VerificationBadge item={item} />} />)}</List></Panel>
                : <div className="gk-fp-start">
                    <p className="gk-faint">{copy('Coach, physio, photographer, volunteer… Clubs looking for help find you by it.', 'მწვრთნელი, ფიზიოთერაპევტი, ფოტოგრაფი, მოხალისე… დახმარების მაძიებელი კლუბები ამით გიპოვიან.')}</p>
                    <Button size="sm" variant="primary" onClick={() => setEditing(true)}><Plus aria-hidden="true" />{copy('Add what you do', 'დაამატეთ, რას აკეთებთ')}</Button>
                </div>}
        </Section>}
    </div>;
}
