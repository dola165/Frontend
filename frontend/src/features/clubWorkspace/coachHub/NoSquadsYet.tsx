import { ButtonLink, EmptyNote } from '../../../design/primitives';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { appLanguage } from '../../../utils/formatting';

/** The leader can prepare squads directly; a coach's squads appear once the club gives them a squad job (nothing to ask for). */
export function NoSquadsYet({ clubId, leadership, canOpenWorkspace }: { clubId: number; leadership: boolean; canOpenWorkspace: boolean }) {
    const copy = useCopy('coachHub', coachHubEn);
    const ka = appLanguage() === 'ka';
    const target = canOpenWorkspace ? `/clubs/${clubId}/workspace?tab=squads` : `/clubs/${clubId}`;
    const action = canOpenWorkspace ? ka ? 'გუნდების სიის გახსნა' : 'Open squad lists' : copy('clubPage');
    const hint = leadership ? canOpenWorkspace
        ? ka ? 'გახსენით კლუბის გუნდების სია, რათა შექმნათ გუნდი ან აირჩიოთ მისი მწვრთნელი. დანიშნული გუნდები აქ გამოჩნდება.' : 'Open the club’s squad lists to create a squad or choose its coach. Assigned squads appear here.'
        : ka ? 'დანიშნული გუნდები აქ გამოჩნდება. კლუბის წვდომის სანახავად გახსენით კლუბის გვერდი.' : 'Assigned squads appear here. Open the club page to review your club access.'
        : copy('noSquadsYetHint');
    return <EmptyNote title={copy('noSquadsYet')} action={leadership ? <ButtonLink size="sm" to={target}>{action}</ButtonLink> : undefined}>{hint}</EmptyNote>;
}
