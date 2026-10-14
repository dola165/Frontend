import { useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { BriefcaseBusiness, ShieldCheck, Shirt } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { ButtonLink, GkRoot, List, ListRow, PageFrame, PageHeader, Panel } from '../../../design/primitives';
import { AboutEditor } from './AboutEditor';
import { ProfessionsEditor } from './ProfessionsEditor';
import { RolesEditor } from './RolesEditor';
import { createHref } from '../../pages/create/entry';
import './account-roles.css';

/** `/account/roles`: change your football roles, add what you do professionally, and write about yourself. */
export function AccountRolesPage() {
    const { user, sessionId } = useAuth();
    return <AccountRoles key={`${user?.id}:${sessionId}`} />;
}

function AccountRoles() {
    const { user } = useAuth();
    const here = useLocation();
    const { hash } = here;
    const [params] = useSearchParams();
    const firstUse = params.get('setup') === '1';
    // Links from the profile ("Add a profession", "Write about yourself") land on their section.
    useEffect(() => {
        if (!hash) return;
        const timer = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }), 300);
        return () => window.clearTimeout(timer);
    }, [hash]);
    if (!user) return null;
    return <GkRoot className="gk-page gk-account-roles">
        <PageFrame width="profile">
            <PageHeader crumbs={[{ label: 'Account', to: '/account' }, { label: 'Roles and work' }]}
                title={firstUse ? 'Make your profile yours' : 'Roles and work'}
                subtitle={firstUse ? 'Your account is ready. Add what describes you now; you can change it any time.' : 'What you do in football and professionally. Change it whenever your life in football changes.'}
                actions={<ButtonLink to={`/profile/${user.id}`}>View your profile</ButtonLink>} />
            <div className="gk-grid gk-grid--split gk-account-roles__body">
                <div className="gk-stack">
                    <RolesEditor />
                    <ProfessionsEditor userId={user.id} />
                    <AboutEditor userId={user.id} />
                </div>
                <aside className="gk-stack gk-account-roles__side" aria-label="How your profile is organised">
                    <Panel title="How your profile reads">
                        <List label="Profile layers">
                            <ListRow lead={<Shirt aria-hidden="true" size={18} />} title="In football" meta="Your roles. Several at once; they add profile sections, never club access." />
                            <ListRow lead={<BriefcaseBusiness aria-hidden="true" size={18} />} title="Work and skills" meta="Your profession and experience. Clubs search these for jobs and volunteering." />
                            <ListRow lead={<ShieldCheck aria-hidden="true" size={18} />} title="Confirmed" meta="What a club or GrassKickZ has checked. Only they can add it." />
                        </List>
                    </Panel>
                    {firstUse && <Panel title="Next steps"><List label="Next steps">
                        <ListRow to="/home" title="Continue to Home" />
                        <ListRow to="/world/clubs" title="Find a club" />
                        <ListRow to={createHref(here, null, 'roles')} title="Create a club or page" />
                    </List></Panel>}
                    <p className="gk-faint">Name, photos, privacy and sign-in are in <Link className="gk-account-roles__link" to="/account?tab=profile">Account settings</Link>.</p>
                </aside>
            </div>
        </PageFrame>
    </GkRoot>;
}
