import { useTranslation } from 'react-i18next';
import { appLanguage } from '../../utils/formatting';
import { wt, type CopyVars } from '../world/copy';
import { MATCH_KA } from './copy.ka';

/** Feature copy shares World's existing football words; names and server details remain as supplied. */
export const mt = (text: string, vars?: CopyVars): string => {
    if (appLanguage() !== 'ka') return wt(text, vars);
    const refusal = text.match(/^(.*) does not take (paid|volunteer) matches\.$/);
    if (refusal) return wt(MATCH_KA[`{name} does not take ${refusal[2]} matches.`], { name: refusal[1] });
    return wt(MATCH_KA[text] ?? text, vars);
};
export function useMatchCopy() {
    useTranslation();
    return mt;
}

/** Keep weekend chips readable in embedded browsers whose Georgian date formatter returns English. */
export const matchDateWords = (text: string) => text.replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b/g, word => mt(word));
