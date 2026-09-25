import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { appLanguage } from '../../utils/formatting';

export const RouteMetadata = () => {
    const { pathname } = useLocation();
    const { t, i18n } = useTranslation();
    useEffect(() => {
        let label = '';
        if (pathname === '/parent') label = t('nav.parentHub', 'Parent Hub');
        else if (pathname === '/club-operations') label = 'My club work';
        else if (/^\/clubs\/\d+\/operations$/.test(pathname)) label = 'Club operations';
        else if (pathname === '/match-history') label = i18n.language.startsWith('ka') ? 'შედეგები და ისტორია' : 'Results & history';
        else if (pathname.startsWith('/match-exchange')) label = t('nav.matchExchange', 'Match Exchange');
        else if (pathname === '/demo/commerce') label = t('nav.paymentDemo', 'Payment demo');
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
    }, [pathname, t, i18n.resolvedLanguage, i18n.language]);
    return null;
};
