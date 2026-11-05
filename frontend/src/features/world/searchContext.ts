import { useSearchParams } from 'react-router-dom';
import { useWorldChild } from './players';
import { useSquadFocus } from './front/coach/mySquads';
import { useWorldRole } from './front/useWorldRole';
import type { DirectoryQuery } from './directory/types';

export function applyWorldFor(query: DirectoryQuery, birthYear?: string, ageGroup?: string): DirectoryQuery {
    const values = { ...query.values };
    if (!values.birthYear?.length && !values.age?.length && !values.ageGroup?.length) {
        if (birthYear) values.birthYear = [birthYear];
        else if (ageGroup) values.ageGroup = [ageGroup];
    }
    return { ...query, values };
}
export const hasPublicCohort = (query: DirectoryQuery) => ['birthYear', 'age', 'ageGroup'].some(key => query.values[key]?.length);
const birthYearOf = (value?: string | null) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? value!.slice(0, 4) : undefined;
/** Only anonymous criteria reach public endpoints. The child ID stays in the own-family context. */
export function useWorldFor() {
    const [params] = useSearchParams();
    const child = useWorldChild();
    const focus = useSquadFocus(useWorldRole());
    const squad = params.get('for') ? focus.focus.find(item => String(item.id) === params.get('for')) : undefined;
    const childBirthYear = birthYearOf(child.child?.dateOfBirth);
    return { birthYear: params.get('birthYear') || childBirthYear,
        ageGroup: squad?.publishedAgeGroup, childId: child.child?.id, childBirthYear,
        pending: child.pending || Boolean(params.get('for') && focus.status === 'loading'),
        missingCohort: Boolean(child.child && !childBirthYear || squad && !squad.publishedAgeGroup),
        unavailable: child.unavailable || Boolean(params.get('for') && focus.status !== 'loading' && !squad) };
}
