import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { appLanguage } from '../../utils/formatting';

const WORLD_TITLES: Record<string, string> = {
    clubs: 'Clubs', people: 'People', venues: 'Venues', matches: 'Matches', tournaments: 'Tournaments', competitions: 'Tournaments', opportunities: 'Opportunities', map: 'Map',
};

export const RouteMetadata = () => {
    const { pathname, search } = useLocation();
    const { t, i18n } = useTranslation();
    useEffect(() => {
        let label = '';
        if (pathname === '/parent') label = t('nav.parentHub', 'Parent Hub');
        else if (pathname === '/world' || pathname.startsWith('/world/')) label = WORLD_TITLES[pathname.split('/')[2] ?? ''] ?? 'World';
        else if (pathname === '/my-organizations' && new URLSearchParams(search).get('kind') === 'VENUE') label = t('experience.navigation.venues');
        else if (pathname === '/requests') label = t('experience.navigation.requests');
        else if (pathname === '/reports') label = t('experience.navigation.reports');
        else if (pathname === '/events') label = t('experience.navigation.events');
        else if (pathname === '/tryouts' || pathname.startsWith('/tryouts/')) label = t('experience.navigation.tryouts');
        else if (pathname === '/agent' || pathname.startsWith('/agent/')) label = t('experience.navigation.agent');
        else if (pathname.startsWith('/referees/')) label = t('experience.navigation.referee');
        else if (pathname.startsWith('/organizations/')) label = t('nav.myOrganizations', 'My organizations');
        else if (pathname === '/club-operations') label = 'My club work';
        else if (pathname === '/team-work/chat') label = i18n.language.startsWith('ka') ? 'გუნდის ჩატი' : 'Team chat';
        else if (/^\/clubs\/\d+\/operations$/.test(pathname)) label = 'Club operations';
        else if (pathname === '/match-history') label = i18n.language.startsWith('ka') ? 'შედეგები და ისტორია' : 'Results & history';
        // Football words: a match page is a match, not the exchange it was arranged through.
        else if (pathname.startsWith('/match-exchange')) label = i18n.language.startsWith('ka') ? (pathname === '/match-exchange' ? 'მატჩები' : 'მატჩი') : (pathname === '/match-exchange' ? 'Matches' : 'Match');
        else if (/^\/clubs\/\d+\/workspace$/.test(pathname)) label = t('clubWorkspace.workspace');
        else if (pathname === '/clubs/following') label = t('nav.followedClubs');
        else if (/^\/clubs\/\d+\/store$/.test(pathname)) label = t('nav.store');
        else if (/^\/clubs\/\d+\/campaigns$/.test(pathname)) label = t('nav.campaigns');
        else {
            const key: Record<string, string> = {
                home:'nav.feed', feed:'nav.feed', clubs:'nav.clubs', store:'nav.store', jobs:'nav.jobs', roles:'nav.jobs',
                stadiums:'nav.stadiums',
                campaigns:'nav.campaigns', login:'nav.signIn', account:'nav.account', profile:'nav.profile',
                calendar:'nav.schedule', messages:'nav.messages', notifications:'nav.notifications',
                tournaments:'nav.tournaments', admin:'nav.admin', people:'nav.people', map:'nav.map',
                world:'nav.map', 'my-club':'nav.myClub', 'my-organizations':'nav.myOrganizations', 'app-settings':'nav.appearance',
            };
            const translation = key[pathname.split('/')[1]];
            if (translation) label = t(translation);
        }
        document.title = label ? `${label} | GrassKickZ` : 'GrassKickZ — Connecting the Game';
        document.documentElement.lang = appLanguage();
    }, [pathname, search, t, i18n.resolvedLanguage, i18n.language]);
    return null;
};
