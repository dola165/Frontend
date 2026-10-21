import { useAccountCopy } from './accountCopy';
import { useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { BriefcaseBusiness, ShieldCheck, Shirt, Sparkles } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { ButtonLink, GkRoot, List, ListRow, PageFrame, PageHeader, Panel } from '../../../design/primitives';
import { AboutEditor } from './AboutEditor';
import { DiscoveryPreferencesEditor } from './DiscoveryPreferencesEditor';
import { ProfessionsEditor } from './ProfessionsEditor';
import { RolesEditor } from './RolesEditor';
import { createHref } from '../../pages/create/entry';
import { sanitizeAuthRedirect } from '../../../utils/authRedirect';
import { WELCOME_PARAM } from '../../start/welcomeSteps';
import './account-roles.css';

/** `/account/roles`: change your football roles, add what you do professionally, and write about yourself. */
export function AccountRolesPage() {
    const { user, sessionId } = useAuth();
    return <AccountRoles key={`${user?.id}:${sessionId}`} />;
}

function AccountRoles() {
    const copy = useAccountCopy();
    const { user } = useAuth();
    const here = useLocation();
    const { hash } = here;
    const [params] = useSearchParams();
    const firstUse = params.get('setup') === '1';
    const next = sanitizeAuthRedirect(params.get('next'));
    // Links from the profile ("Add a profession", "Write about yourself") land on their section.
    useEffect(() => {
        if (!hash) return;
        const timer = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }), 300);
        return () => window.clearTimeout(timer);
    }, [hash]);
    if (!user) return null;
    return <GkRoot className="gk-page gk-account-roles">
        <PageFrame width="profile">
            <PageHeader crumbs={[{ label: copy('Account'), to: '/account' }, { label: copy('Roles and work') }]}
                title={firstUse ? copy("Make your profile yours") : copy("Roles and work")}
                subtitle={firstUse ? copy("Your account is ready. Add what describes you now; you can change it any time.") : copy("What you do in football and professionally. Change it whenever your life in football changes.")}
                actions={next ? <ButtonLink to={next}>{copy("Back to opportunity", "შეთავაზებაზე დაბრუნება")}</ButtonLink> : <>
                    {/* The welcome after sign-up, from its first step, over Home. */}
                    <ButtonLink variant="ghost" to={`/home?${WELCOME_PARAM}=roles`}><Sparkles aria-hidden="true" />{copy("Guided set-up", "ნაბიჯ-ნაბიჯ დაყენება")}</ButtonLink>
                    <ButtonLink to={`/profile/${user.id}`}>{copy("View your profile")}</ButtonLink>
                </>} />
            <div className="gk-grid gk-grid--split gk-account-roles__body">
                <div className="gk-stack">
                    <RolesEditor />
                    <ProfessionsEditor userId={user.id} />
                    <DiscoveryPreferencesEditor />
                    <AboutEditor userId={user.id} />
                </div>
                <aside className="gk-stack gk-account-roles__side" aria-label={copy("How your profile is organised")}>
                    <Panel title={copy("How your profile reads")}>
                        <List label={copy("Profile layers")}>
                            <ListRow lead={<Shirt aria-hidden="true" size={18} />} title={copy("In football")} meta={copy("Your roles. Several at once; they add profile sections, never club access.")} />
                            <ListRow lead={<BriefcaseBusiness aria-hidden="true" size={18} />} title={copy("Work and skills")} meta={copy("Your profession and experience. Clubs search these for jobs and volunteering.")} />
                            <ListRow lead={<ShieldCheck aria-hidden="true" size={18} />} title={copy("Confirmed")} meta={copy("What a club or GrassKickZ has checked. Only they can add it.")} />
                        </List>
                    </Panel>
                    {firstUse && <Panel title={copy("Next steps")}><List label={copy("Next steps")}>
                        <ListRow to="/home" title={copy("Continue to Home")} />
                        <ListRow to="/world/clubs" title={copy("Find a club")} />
                        <ListRow to={createHref(here, null, 'roles')} title={copy("Create a club or page")} />
                    </List></Panel>}
                    <p className="gk-faint">{copy("Name, photos, privacy and sign-in are in")} <Link className="gk-account-roles__link" to="/account?tab=profile">{copy("Account settings")}</Link>.</p>
                </aside>
            </div>
        </PageFrame>
    </GkRoot>;
}
