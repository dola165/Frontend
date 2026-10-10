import { Link } from 'react-router-dom';
import { BadgeCheck, BriefcaseBusiness, ShieldCheck } from 'lucide-react';
import { Badge, ButtonLink, EmptyNote, List, ListRow, Panel, Section } from '../../../design/primitives';
import { Crest } from '../../world/Crest';
import { roleLabel, rolePresentation, type FootballRole, type RoleProfile } from '../../roles/domain';
import type { PersonProfile, Profession } from '../api';
import { RoleIcon } from './RoleIcon';

/** How a fact was established, in words. Self-reported and confirmed always look different. */
export function VerificationBadge({ item }: { item: Pick<Profession, 'verification' | 'verifiedBy'> }) {
    if (item.verification === 'CLUB_CONFIRMED') return <Badge tone="accent"><ShieldCheck size={13} aria-hidden="true" />Confirmed{item.verifiedBy ? ` by ${item.verifiedBy}` : ' by a club'}</Badge>;
    if (item.verification === 'DOCUMENT_CHECKED') return <Badge tone="accent"><BadgeCheck size={13} aria-hidden="true" />Document checked</Badge>;
    return <Badge>Self-reported</Badge>;
}


const roleRows = (profile: PersonProfile, roles: string[], own: boolean) => {
    const details = new Map((profile.roleProfiles ?? []).map(item => [item.role, item] as [string, RoleProfile]));
    return roles.map(role => ({ role, detail: details.get(role) })).filter(row => own || row.detail?.published !== false);
};

/**
 * The three separate layers of a person: what they do in football, what they do professionally,
 * and what a club has confirmed. Club permissions are a fourth thing and never appear here.
 */
export function PersonLayers({ profile, roles, professions, professionsFailed, own }: {
    profile: PersonProfile; roles: string[]; professions: Profession[] | null; professionsFailed: boolean; own: boolean;
}) {
    const first = profile.fullName?.split(' ')[0] || profile.username;
    const appointments = profile.footballProfile?.appointments ?? [];
    const rows = roleRows(profile, roles, own);
    return <div className="gk-person-layers">
        <Section title="In football" action={own ? <Link className="gk-section__action" to="/account/roles">Change roles</Link> : undefined}>
            <Panel flush>{rows.length ? <List label="Football roles">{rows.map(({ role, detail }) => <ListRow key={role}
                lead={<RoleIcon role={role} />}
                title={detail?.headline ? `${roleLabel(role)} · ${detail.headline}` : roleLabel(role)}
                meta={[detail?.specialties, detail?.qualifications ? `Qualifications (self-reported): ${detail.qualifications}` : null, detail?.serviceArea].filter(Boolean).join(' · ') || rolePresentation[role as FootballRole]?.description}
                trail={own && detail && !detail.published ? <Badge>Only you</Badge> : detail?.primary ? <Badge tone="info">Main role</Badge> : undefined} />)}</List>
                : <EmptyNote title={own ? 'Add the roles you have in football' : `${first} hasn’t added football roles yet`} action={own ? <ButtonLink size="sm" to="/account/roles">Choose roles</ButtonLink> : undefined}>{own ? 'Player, coach, parent, referee and more. You can hold several at once and change them any time.' : undefined}</EmptyNote>}</Panel>
        </Section>

        {(own || (professions?.length ?? 0) > 0 || professionsFailed) && <Section title="Work and skills" action={own ? <Link className="gk-section__action" to="/account/roles#professions">{professions?.length ? 'Edit' : 'Add'}</Link> : undefined}>
            <Panel flush>{professionsFailed ? <EmptyNote title="Work and skills couldn’t load">Reload the page to try again.</EmptyNote>
                : professions === null ? <EmptyNote title="Loading work and skills…" />
                : professions.length ? <List label="Professions and skills">{professions.map(item => <ListRow key={item.id}
                    lead={<span className="gk-club-icon"><BriefcaseBusiness aria-hidden="true" /></span>}
                    title={item.title}
                    meta={[item.since ? `Since ${item.since}` : null, item.detail, own && !item.published ? 'Hidden from your profile' : null, own && !item.label ? 'Being added to the directory' : null].filter(Boolean).join(' · ')}
                    trail={<VerificationBadge item={item} />} />)}</List>
                : <EmptyNote title="Add what you do professionally" action={<ButtonLink size="sm" to="/account/roles#professions">Add a profession</ButtonLink>}>
                    Physiotherapist, teacher, photographer, sports psychologist… Clubs looking for help can find you in the People directory.
                </EmptyNote>}</Panel>
        </Section>}

        {appointments.length > 0 && <Section title="Confirmed by clubs">
            <Panel flush><List label="Club appointments">{appointments.map(item => <ListRow key={`${item.clubId}:${item.role}`} to={`/clubs/${item.clubId}`}
                lead={<Crest src={item.logoUrl} name={item.clubName} size={40} />}
                title={item.title}
                meta={[item.clubName, item.squads.length ? item.squads.join(', ') : null, item.memberSince ? `Since ${new Date(item.memberSince).getFullYear()}` : null].filter(Boolean).join(' · ')}
                trail={<Badge tone="accent"><ShieldCheck size={13} aria-hidden="true" />Recorded by the club</Badge>} />)}</List>
                {appointments.some(item => item.qualifications) && <p className="gk-panel__foot gk-faint">Qualifications listed by clubs are shown as provided. No credential check has been recorded.</p>}
            </Panel>
        </Section>}
    </div>;
}
