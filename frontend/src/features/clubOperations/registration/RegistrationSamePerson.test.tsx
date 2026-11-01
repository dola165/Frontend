import { render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import i18n from '../../../i18n';
import { label } from '../api';
import { RegistrationSummary } from './RegistrationPanel';
import type { RegistrationProfile } from './api';

afterEach(async () => { await i18n.changeLanguage('en'); });

const profile = (): RegistrationProfile => ({
    clubId: 7, personId: 4, squadId: 2, asOf: '2026-11-02', currentPlayer: true, staff: true, canCreate: false, affiliations: [], departurePath: null,
    records: [{ id: 21, kind: 'REGISTRATION', title: 'League entry', status: 'APPROVED', revision: 2, previousId: null, canReplace: false, canOpen: false,
        requirements: null, requirementsSource: null,
        eligibility: { state: 'RECORDED_CURRENT', reasons: [], expiresOn: '2026-12-31', credentialIds: [], supersededBy: null },
        history: [
            { id: 3, action: 'PREPARED_AND_APPROVED_BY_THE_SAME_PERSON', status: null, note: null, actor: 'Nino Owner', at: '2026-11-02T09:00:00Z' },
            { id: 2, action: 'TRANSITION', status: 'APPROVED', note: 'Federation card checked', actor: 'Nino Owner', at: '2026-11-02T09:00:00Z' },
        ] }],
} as unknown as RegistrationProfile);

it('names an approval by the person who prepared it in the record history, in both languages', async () => {
    expect(label('PREPARED_AND_APPROVED_BY_THE_SAME_PERSON')).toBe('Prepared and approved by the same person');
    await i18n.changeLanguage('ka');
    expect(label('PREPARED_AND_APPROVED_BY_THE_SAME_PERSON')).toBe('მოამზადა და დაამტკიცა ერთმა ადამიანმა');
});

it('shows the same-person line in a registration history above the approval', () => {
    render(<RegistrationSummary data={profile()} />);
    const lines = screen.getAllByRole('listitem').map(item => item.textContent ?? '');
    expect(lines[0]).toContain('prepared and approved by the same person');
    expect(lines[1]).toContain('transition · approved');
});
