import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ct } from '../copy';
import { commerceCount } from '../count';
import { cataloguePath, readCatalogue } from '../query';
import { jobsPath, readJobs, worldJobsPath } from '../../jobs/query';
import { fundraisingPath, readFundraising } from '../../campaigns/query';

vi.mock('../../../utils/formatting', () => ({ appLanguage: () => 'ka', formatDate: vi.fn(), formatMoney: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

describe('Commerce in Georgian', () => {
    it('translates actions and recovery, while preserving names and optional labels', () => {
        expect(ct('Retry club check')).toBe('კლუბის ხელახლა შემოწმება');
        expect(ct('Your fundraiser draft is saved. Retry checks the same fundraiser.')).not.toMatch(/[a-z]/i);
        expect(ct('Goal {v0}', { v0: 'GEL 5,000' })).toBe('მიზანი: GEL 5,000');
        expect(ct('Alpha FC')).toBe('Alpha FC');
        expect(ct(undefined)).toBeUndefined();
        expect(commerceCount(2, 'product')).toBe('2 პროდუქტი');
    });
    it('keeps server enums, seller choices, selected records and page keys in English URL values', () => {
        const store = readCatalogue(new URLSearchParams('seller=clubs&category=SHIRT&page=2'));
        expect(cataloguePath(store)).toBe('/store/all?category=SHIRT&seller=clubs&page=2');
        const jobs = readJobs(new URLSearchParams('direction=HIRING&poster=people&job=401&page=2'));
        expect(jobsPath(jobs)).toBe('/jobs/all?direction=HIRING&poster=people&page=2&job=401');
        expect(worldJobsPath(jobs)).toBe('/world/opportunities?tab=jobs');
        const campaigns = readFundraising(new URLSearchParams('category=TRAVEL&state=ALL&sort=NEWEST&page=2'));
        expect(fundraisingPath(campaigns)).toBe('/campaigns/all?category=TRAVEL&state=ALL&sort=NEWEST&page=2');
    });
});
