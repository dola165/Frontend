import { appLanguage } from '../../utils/formatting';

const nouns: Record<string, string> = { product: 'პროდუქტი', item: 'ნივთი', variant: 'ვარიანტი', listing: 'განცხადება', person: 'სპეციალისტი', job: 'ვაკანსია', donation: 'შემოწირულება', day: 'დღე', applicant: 'კანდიდატი', enquiry: 'შეკითხვა' };
/** Georgian keeps the noun singular after a number. These are UI nouns, never request values. */
export function commerceCount(count: number, one: string, other = `${one}s`) {
    return appLanguage() === 'ka' ? `${count.toLocaleString('ka-GE')} ${nouns[one] ?? one}` : `${count} ${count === 1 ? one : other}`;
}
