import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { Link } from 'react-router-dom';
import { BadgeCheck, BriefcaseBusiness, ShieldCheck } from 'lucide-react';
import { Badge, Button, ButtonLink, EmptyNote, List, ListRow, Panel, Section } from '../../../design/primitives';
import { Crest } from '../../world/Crest';
import { roleCopy, type RoleProfile } from '../../roles/domain';
import type { PersonProfile, Profession } from '../api';
import { RoleIcon } from './RoleIcon';

/** How a fact was established, in words. Self-reported and confirmed always look different. */
export function VerificationBadge({ item }: { item: Pick<Profession, 'verification' | 'verifiedBy'> }) {
    const copy = useJourneyCopy();
    if (item.verification === 'CLUB_CONFIRMED') return <Badge tone="accent"><ShieldCheck size={13} aria-hidden="true" />{item.verifiedBy ? copy(`Confirmed by ${item.verifiedBy}`, `დაადასტურა: ${item.verifiedBy}`) : copy('Confirmed by a club', 'დაადასტურა კლუბმა')}</Badge>;
    if (item.verification === 'DOCUMENT_CHECKED') return <Badge tone="accent"><BadgeCheck size={13} aria-hidden="true" />{copy('Document checked', 'დოკუმენტი შემოწმებულია')}</Badge>;
    return <Badge>{copy('Self-reported', 'თავად მითითებული')}</Badge>;
}


const roleRows = (profile: PersonProfile, roles: string[], own: boolean) => {
    const details = new Map((profile.roleProfiles ?? []).map(item => [item.role, item] as [string, RoleProfile]));
    return roles.map(role => ({ role, detail: details.get(role) })).filter(row => own || row.detail?.published !== false);
};

/**
 * The three separate layers of a person: what they do in football, what they do professionally,
 * and what a club has confirmed. Club permissions are a fourth thing and never appear here.
 */
export function PersonLayers({ profile, roles, professions, professionsFailed, own, onRetryProfessions }: {
    profile: PersonProfile; roles: string[]; professions: Profession[] | null; professionsFailed: boolean; own: boolean;
    onRetryProfessions?: () => void;
}) {
    const copy = useJourneyCopy();
    const first = profile.fullName?.split(' ')[0] || profile.username;
    const appointments = profile.footballProfile?.appointments ?? [];
    const rows = roleRows(profile, roles, own);
    return <div className="gk-person-layers">
        <Section title={copy('In football', 'ფეხბურთში')} action={own ? <Link className="gk-section__action" to="/account/roles">{copy('Change roles', 'როლების შეცვლა')}</Link> : undefined}>
            <Panel flush>{rows.length ? <List label={copy('Football roles', 'საფეხბურთო როლები')}>{rows.map(({ role, detail }) => <ListRow key={role}
                lead={<RoleIcon role={role} />}
                title={detail?.headline ? `${roleCopy(role, copy).label} · ${detail.headline}` : roleCopy(role, copy).label}
                meta={[detail?.specialties, detail?.qualifications ? copy(`Qualifications (self-reported): ${detail.qualifications}`, `კვალიფიკაცია (თავად მითითებული): ${detail.qualifications}`) : null, detail?.serviceArea].filter(Boolean).join(' · ') || roleCopy(role, copy).description}
                trail={own && detail && !detail.published ? <Badge>{copy('Only you', 'მხოლოდ თქვენ')}</Badge> : detail?.primary ? <Badge tone="info">{copy('Main role', 'მთავარი როლი')}</Badge> : undefined} />)}</List>
                : <EmptyNote title={own ? copy('Add the roles you have in football', 'დაამატეთ თქვენი როლები ფეხბურთში') : copy(`${first} hasn’t added football roles yet`, `${first}-ს საფეხბურთო როლები ჯერ არ დაუმატებია`)} action={own ? <ButtonLink size="sm" to="/account/roles">{copy('Choose roles', 'როლების არჩევა')}</ButtonLink> : undefined}>{own ? copy('Player, coach, parent, referee and more. You can hold several at once and change them any time.', 'მოთამაშე, მწვრთნელი, მშობელი, მსაჯი და სხვა. შეგიძლიათ რამდენიმე როლი გქონდეთ და ნებისმიერ დროს შეცვალოთ.') : undefined}</EmptyNote>}</Panel>
        </Section>

        {(own || (professions?.length ?? 0) > 0 || professionsFailed) && <Section title={copy('Work and skills', 'სამუშაო და უნარები')} action={own ? <Link className="gk-section__action" to="/account/roles#professions">{professionsFailed || professions === null ? copy('Manage', 'მართვა') : professions.length ? copy('Edit', 'შეცვლა') : copy('Add', 'დამატება')}</Link> : undefined}>
            <Panel flush>{professionsFailed ? <EmptyNote title={copy('Work and skills couldn’t load', 'სამუშაო და უნარები ვერ ჩაიტვირთა')} action={onRetryProfessions ? <Button size="sm" onClick={onRetryProfessions}>{copy('Try again', 'ხელახლა ცდა')}</Button> : undefined} />
                : professions === null ? <EmptyNote title={copy('Loading work and skills…', 'იტვირთება…')} />
                : professions.length ? <List label={copy('Professions and skills', 'პროფესიები და უნარები')}>{professions.map(item => <ListRow key={item.id}
                    lead={<span className="gk-club-icon"><BriefcaseBusiness aria-hidden="true" /></span>}
                    title={item.title}
                    meta={[item.since ? copy(`Since ${item.since}`, `${item.since}-დან`) : null, item.detail, own && !item.published ? copy('Hidden from your profile', 'დამალულია პროფილზე') : null, own && !item.label ? copy('Being added to the directory', 'ემატება ცნობარში') : null].filter(Boolean).join(' · ')}
                    trail={<VerificationBadge item={item} />} />)}</List>
                : <EmptyNote title={copy('Add what you do professionally', 'დაამატეთ თქვენი პროფესია')} action={<ButtonLink size="sm" to="/account/roles#professions">{copy('Add a profession', 'პროფესიის დამატება')}</ButtonLink>}>
                    {copy('Physiotherapist, teacher, photographer, sports psychologist… Clubs looking for help can find you in the People directory.', 'ფიზიოთერაპევტი, მასწავლებელი, ფოტოგრაფი, სპორტის ფსიქოლოგი… დახმარების მაძიებელი კლუბები გიპოვიან ადამიანების ცნობარში.')}
                </EmptyNote>}</Panel>
        </Section>}

        {appointments.length > 0 && <Section title={copy('Confirmed by clubs', 'კლუბების მიერ დადასტურებული')}>
            <Panel flush><List label={copy('Club appointments', 'კლუბის დანიშვნები')}>{appointments.map(item => <ListRow key={`${item.clubId}:${item.role}`} to={`/clubs/${item.clubId}`}
                lead={<Crest src={item.logoUrl} name={item.clubName} size={40} />}
                title={item.title}
                meta={[item.clubName, item.squads.length ? item.squads.join(', ') : null, item.memberSince ? copy(`Since ${new Date(item.memberSince).getFullYear()}`, `${new Date(item.memberSince).getFullYear()}-დან`) : null].filter(Boolean).join(' · ')}
                trail={<Badge tone="accent"><ShieldCheck size={13} aria-hidden="true" />{copy('Recorded by the club', 'კლუბის ჩანაწერი')}</Badge>} />)}</List>
                {appointments.some(item => item.qualifications) && <p className="gk-panel__foot gk-faint">{copy('Qualifications listed by clubs are shown as provided. No credential check has been recorded.', 'კლუბების მიერ მითითებული კვალიფიკაცია ნაჩვენებია ისე, როგორც მოგვაწოდეს. დოკუმენტები არ შემოწმებულა.')}</p>}
            </Panel>
        </Section>}
    </div>;
}
