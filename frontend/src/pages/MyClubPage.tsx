import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Search, Shield } from 'lucide-react';
import { ClubAccessEntry } from '../components/layout/ClubAccessEntry';
import { accessibleClubs } from '../components/layout/clubAccess';
import { useAuth } from '../context/AuthContext';
import { GkRoot, PageFrame, Section } from '../design/primitives';
import { fetchMyClubMembershipContext } from '../features/clubs/api';
import { MyClubInvitationsPanel } from '../features/invites/components/MyClubInvitationsPanel';
import { usePagesCopy } from '../features/pages/copy';
import { createHref } from '../features/pages/create/entry';
import '../features/pages/pages.css';

export const MyClubPage = () => <ClubAccessEntry><SingleClubPage /></ClubAccessEntry>;

/**
 * `/my-club` for someone without a club yet: two choices with pictures, find it or start it, then any invitations.
 * A role at a club comes from the club (joining, an invitation, creating it), never from what the account says.
 */
const SingleClubPage = () => {
    const t = usePagesCopy();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const ownClubIds = accessibleClubs(user?.navigationCapabilities).map(club => club.id).join(',');
    const hasProjection = user?.navigationCapabilities !== undefined;

    // While the start sheet is open over this page the person is making their club: no redirect until it closes. The
    // sheet's own navigation takes them to the new page in edit mode, and this page stays on screen while that page's
    // code loads, so a redirect fired meanwhile would replace it.
    const sheetOpen = new URLSearchParams(location.search).has('create');
    useEffect(() => {
        let current = true;
        if (sheetOpen) return () => { current = false; };
        fetchMyClubMembershipContext()
            .then(context => {
                if (!current) return;
                if (context?.clubId && (!hasProjection || ownClubIds.split(',').includes(String(context.clubId)))) {
                    navigate(`/clubs/${context.clubId}`, { replace: true });
                    return;
                }
                setLoading(false);
            })
            .catch(() => { if (current) setLoading(false); });
        return () => { current = false; };
    }, [navigate, ownClubIds, hasProjection, sheetOpen]);

    if (loading && !sheetOpen) return <GkRoot className="gk-page gk-myclub"><PageFrame width="profile"><div className="gk-myclub__loading" role="status" aria-label={t('My Club')}><Loader2 className="gk-spin" aria-hidden="true" /></div></PageFrame></GkRoot>;
    return (
        <GkRoot className="gk-page gk-myclub"><PageFrame width="profile">
            <Section title={t('My Club')} hint={t('No club yet')}>
                <div className="gk-ctiles gk-ctiles--two">
                    <Link to="/world/clubs" className="gk-ctile" style={{ '--tile-photo': 'url(/venue-demo/pitch-aerial.jpg)', '--tile': 'var(--gk-info)' } as CSSProperties}>
                        <span className="gk-ctile__icon"><Search aria-hidden="true" /></span>
                        <span className="gk-ctile__label">{t('Find your club')}</span><span className="gk-ctile__hint">{t('Clubs near you')}</span>
                    </Link>
                    <Link to={createHref(location, 'CLUB', 'my-club')} className="gk-ctile" style={{ '--tile-photo': 'url(/football/ball-field.jpg)', '--tile': 'var(--gk-accent)' } as CSSProperties}>
                        <span className="gk-ctile__icon"><Shield aria-hidden="true" /></span>
                        <span className="gk-ctile__label">{t('Start your club')}</span><span className="gk-ctile__hint">{t('Your page in a minute')}</span>
                    </Link>
                </div>
            </Section>
            <MyClubInvitationsPanel onInvitationAccepted={invitation => navigate(`/clubs/${invitation.clubId}`)} />
        </PageFrame></GkRoot>
    );
};
