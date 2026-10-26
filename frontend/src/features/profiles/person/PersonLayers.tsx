import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { Link } from 'react-router-dom';
import { BadgeCheck, BriefcaseBusiness, ShieldCheck } from 'lucide-react';
import { Badge, Button, ButtonLink, EmptyNote, List, ListRow, Panel, Section } from '../../../design/primitives';
import type { PersonProfile, Profession } from '../api';
import { CareerCards, CareerTotalsRow, FootballLines } from '../football/FootballLines';
import type { FootballProfileData } from '../football/api';

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
export function PersonLayers({ profile, football, professions, professionsFailed, own, onRetryProfessions }: {
    profile: PersonProfile; football: FootballProfileData | null; professions: Profession[] | null; professionsFailed: boolean; own: boolean;
    onRetryProfessions?: () => void;
}) {
    const copy = useJourneyCopy();
    const first = profile.fullName?.split(' ')[0] || profile.username;
    // The server already leaves parent lines out for other viewers; the page never shows one even if it came.
    const lines = (football?.lines ?? []).filter(line => own || line.kind !== 'PARENT_OF');
    const totals = football?.totals;
    const hasCareer = Boolean(football && (football.career.length || totals!.sessionsCoached || totals!.matchesPlayed || totals!.matchesRefereed));
    return <div className="gk-person-layers">
        {(own || lines.length > 0) && <Section boxed title={own ? copy('Where you are', 'სად ხართ') : copy(`Where ${first} is`, `სად არის ${first}`)} action={own ? <Link className="gk-section__action" to="/account/football">{copy('Manage', 'მართვა')}</Link> : undefined}>
            {lines.length ? <FootballLines lines={lines} own={false} />
                : <p className="gk-fp-empty">{copy('Nothing yet. A line appears when a coach takes you into a squad, a club gives you a job, or you add your child.', 'ჯერ არაფერია. ხაზი გამოჩნდება, როცა მწვრთნელი გუნდში მიგიღებთ, კლუბი სამსახურს მოგცემთ, ან შვილს დაამატებთ.')}</p>}
        </Section>}
        {hasCareer && <Section boxed title={copy('Career', 'კარიერა')} hint={copy('From the clubs’ records', 'კლუბების ჩანაწერებიდან')}><CareerTotalsRow totals={totals!} /><CareerCards rows={football!.career} /></Section>}

        {(own || (professions?.length ?? 0) > 0 || professionsFailed) && <Section boxed title={own ? copy('What you do', 'რას აკეთებთ') : copy(`What ${first} does`, `რას აკეთებს ${first}`)} action={own ? <Link className="gk-section__action" to="/account/football#work">{professionsFailed || professions === null ? copy('Manage', 'მართვა') : professions.length ? copy('Edit', 'შეცვლა') : copy('Add', 'დამატება')}</Link> : undefined}>
            <Panel flush>{professionsFailed ? <EmptyNote title={copy('Work and skills couldn’t load', 'სამუშაო და უნარები ვერ ჩაიტვირთა')} action={onRetryProfessions ? <Button size="sm" onClick={onRetryProfessions}>{copy('Try again', 'ხელახლა ცდა')}</Button> : undefined} />
                : professions === null ? <EmptyNote title={copy('Loading work and skills…', 'იტვირთება…')} />
                : professions.length ? <List label={copy('Professions and skills', 'პროფესიები და უნარები')}>{professions.map(item => <ListRow key={item.id}
                    lead={<span className="gk-club-icon"><BriefcaseBusiness aria-hidden="true" /></span>}
                    title={item.title}
                    meta={[item.since ? copy(`Since ${item.since}`, `${item.since}-დან`) : null, item.detail, own && !item.published ? copy('Hidden from your profile', 'დამალულია პროფილზე') : null, own && !item.label ? copy('Being added to the directory', 'ემატება ცნობარში') : null].filter(Boolean).join(' · ')}
                    trail={<VerificationBadge item={item} />} />)}</List>
                : <EmptyNote title={copy('Add what you do professionally', 'დაამატეთ თქვენი პროფესია')} action={<ButtonLink size="sm" to="/account/football#work">{copy('Add a profession', 'პროფესიის დამატება')}</ButtonLink>}>
                    {copy('Physiotherapist, teacher, photographer, sports psychologist… Clubs looking for help can find you in the People directory.', 'ფიზიოთერაპევტი, მასწავლებელი, ფოტოგრაფი, სპორტის ფსიქოლოგი… დახმარების მაძიებელი კლუბები გიპოვიან ადამიანების ცნობარში.')}
                </EmptyNote>}</Panel>
        </Section>}
    </div>;
}
