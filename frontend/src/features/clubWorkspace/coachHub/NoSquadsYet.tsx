import { ButtonLink, EmptyNote } from '../../../design/primitives';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { appLanguage } from '../../../utils/formatting';
import { officePath } from '../../clubOffice/officeLinks';

/** The leader prepares squads in Club office; a coach's squads appear once the club gives them a squad job (nothing to ask for). */
export function NoSquadsYet({ clubId, leadership }: { clubId: number; leadership: boolean }) {
    const copy = useCopy('coachHub', coachHubEn);
    const ka = appLanguage() === 'ka';
    const hint = leadership
        ? ka ? 'გახსენით კლუბის გუნდების სია, რათა შექმნათ გუნდი ან აირჩიოთ მისი მწვრთნელი. დანიშნული გუნდები აქ გამოჩნდება.' : 'Open the club’s squad lists to create a squad or choose its coach. Assigned squads appear here.'
        : copy('noSquadsYetHint');
    return <EmptyNote title={copy('noSquadsYet')} action={leadership ? <ButtonLink size="sm" to={officePath(clubId, 'squads')}>{ka ? 'გუნდების სიის გახსნა' : 'Open squad lists'}</ButtonLink> : undefined}>{hint}</EmptyNote>;
}
