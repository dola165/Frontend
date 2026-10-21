import { Link } from 'react-router-dom';
import { Badge, Button, ButtonLink, EmptyNote, Field, List, ListRow, Panel } from '../../../../design/primitives';
import type { ClubPresentation } from '../../../clubs/presentation';

type Mutate = (path: string, body: unknown, method: 'post' | 'put', success: string) => void;

/** Academy and parent-club links. The other club confirms every request; nothing is accepted on its behalf. */
export function AffiliationsEditor({ profile, own, locked, busy, query, matches, searchError, onQuery, act }: {
    profile: ClubPresentation; own: boolean; locked: boolean; busy: boolean; query: string; matches: { id: number; name: string }[]; searchError: string;
    onQuery: (value: string) => void; act: Mutate;
}) {
    const base = '/presentation/affiliations';
    return <Panel flush title="Academy affiliations">
        <p className="rec-form__intro gk-muted">An academy can have one confirmed parent club, and the other club must accept. Academy leadership can separately let its parent club edit programmes, prices and sponsors. Private squad information and staff permissions stay separate.</p>
        {locked && <div className="rec-form__group"><div className="gk-notice gk-notice--warning" role="status">Save your profile changes before managing affiliations.</div></div>}
        {profile.affiliations.length ? <List label="Affiliations">{profile.affiliations.map(a => <li key={a.id}><div className="gk-list-row">
            <span className="gk-list-row__main"><Link className="gk-list-row__title" to={`/clubs/${a.clubId}`}>{a.name}</Link>
                <span className="gk-list-row__meta">{a.status === 'ACTIVE' ? 'Confirmed affiliation' : a.canRespond ? 'Awaiting your confirmation' : 'Waiting for the other club'}</span></span>
            <span className="gk-list-row__trail rec-trail-wrap">
                {a.status === 'ACTIVE' ? <Badge tone="accent">Confirmed</Badge> : <Badge tone="warning">Pending</Badge>}
                {own && a.status === 'PENDING' && a.canRespond && <><Button size="sm" disabled={busy || locked} onClick={() => act(`${base}/${a.id}`, { action: 'ACCEPT' }, 'post', 'Affiliation confirmed.')}>Accept</Button>
                    <Button size="sm" variant="ghost" disabled={busy || locked} onClick={() => act(`${base}/${a.id}`, { action: 'REJECT' }, 'post', 'Request declined.')}>Decline</Button></>}
                {own && (a.status === 'ACTIVE' || !a.canRespond) && <Button size="sm" variant="ghost" disabled={busy || locked} onClick={() => act(`${base}/${a.id}`, { action: 'END' }, 'post', 'Affiliation ended or request withdrawn.')}>{a.status === 'ACTIVE' ? 'End affiliation' : 'Withdraw request'}</Button>}
                {own && profile.profileKind === 'ACADEMY' && a.status === 'ACTIVE' && <Button size="sm" disabled={busy || locked} onClick={() => act(`${base}/${a.id}/profile-management`, { enabled: !a.profileManagementEnabled }, 'put', a.profileManagementEnabled ? 'Parent club profile access revoked.' : 'Parent club can now edit this academy profile.')}>{a.profileManagementEnabled ? 'Revoke profile management' : 'Allow parent club to manage profile'}</Button>}
                {a.canManageProfile && <ButtonLink size="sm" to={`/clubs/${a.clubId}/profile-settings`}>Manage academy profile</ButtonLink>}
            </span>
        </div></li>)}</List> : <EmptyNote title="No affiliations">{own ? 'Find a club below to send a request.' : 'Affiliations are managed by the club’s own leadership.'}</EmptyNote>}
        {own && <div className="rec-form__group">
            <Field label={`Find ${profile.profileKind === 'ACADEMY' ? 'a parent club' : 'an academy'}`} htmlFor="affiliation-search" error={searchError || undefined}>
                <input id="affiliation-search" className="gk-input" disabled={busy || locked} value={query} onChange={e => onQuery(e.target.value)} placeholder="Search by club name" />
            </Field>
            {query.trim().length >= 2 && matches.length > 0 && <Panel flush><List label="Matching clubs">{matches.map(c => <ListRow key={c.id} title={c.name}
                trail={<Button size="sm" disabled={busy || locked} onClick={() => act(base, { clubId: c.id }, 'post', 'Affiliation request sent to the other club.')}>Request affiliation<span className="gk-visually-hidden"> with {c.name}</span></Button>} />)}</List></Panel>}
        </div>}
    </Panel>;
}
