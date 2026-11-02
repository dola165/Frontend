import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import type { ProjectDetail, ProjectFundraiser, ProjectSummary } from './api';
import { ProjectMoney } from './ProjectMoney';

const fundraiser = (over: Partial<ProjectFundraiser> = {}): ProjectFundraiser => ({
    id: 7, status: 'PUBLISHED', phase: 'ACTIVE', donateUrl: null, goal: { amount: 200, currency: 'GEL' },
    reportedAmount: 50, reportedNote: 'Counted outside funds', reportedBy: null, reportedAt: '2026-10-30T10:00:00Z',
    publishedBy: null, publishedAt: '2026-10-29T10:00:00Z', clubVerified: true, publicNow: true, version: 3,
    currency: 'GEL', summary: 'Kit support', description: 'Replacement kit', beneficiary: 'The club', useOfFunds: 'Kit',
    category: 'EQUIPMENT', startsOn: null, endsOn: null, images: [], ...over,
});

function moneyPanel(f: ProjectFundraiser, over: Partial<ProjectSummary> = {}) {
    const project: ProjectDetail = {
        summary: {
            id: 1, goal: 'Kit support', status: 'NOW', squad: null, dueOn: null,
            target: { amount: 200, currency: 'GEL' }, raised: f.reportedAmount, progress: 0, progressFromMoney: true,
            stepsDone: 0, stepsTotal: 0, nextStep: null, people: [], waitingOnMe: 0,
            fundraiserStatus: f.status, updatedAt: '2026-10-30T10:00:00Z', ...over,
        },
        purpose: null, version: 1, startedBy: null, steps: [], talk: [], files: [], history: [], fundraiser: f,
        can: { change: false, addPeople: false, talk: false, startFundraiser: false, publish: false },
        club: { id: 1, name: 'FC Dinamo Tbilisi Academy (synthetic)', crestUrl: null }, choices: null,
    };
    return render(<MemoryRouter><ProjectMoney project={project} onChanged={vi.fn()} /></MemoryRouter>);
}

describe('Project fundraiser reports (ROUND1 F1/F2)', () => {
    it.each(['EUR', 'USD', 'GBP'] as const)('keeps a no-target report in its actual %s currency', currency => {
        moneyPanel(fundraiser({ currency, goal: null }), { target: null });
        expect(screen.getByText(`50 ${currency}`, { selector: 'strong' })).toBeInTheDocument();
        expect(screen.queryByText('50 GEL', { selector: 'strong' })).not.toBeInTheDocument();
    });

    it('keeps an archived report in its original currency after the Project target changes', () => {
        moneyPanel(fundraiser({ status: 'ARCHIVED', phase: 'ARCHIVED', publicNow: false,
            currency: 'EUR', goal: { amount: 200, currency: 'EUR' } }),
        { target: { amount: 500, currency: 'USD' }, progress: 10 });
        expect(screen.getByText('50 EUR', { selector: 'strong' })).toBeInTheDocument();
        expect(screen.getByText('of 500 USD')).toBeInTheDocument();
        expect(screen.queryByText('50 USD', { selector: 'strong' })).not.toBeInTheDocument();
    });

    it('shows an unknown report without asserting zero-percent progress', () => {
        moneyPanel(fundraiser({ reportedAmount: null, reportedAt: null }));
        expect(screen.getByText('Not reported yet', { selector: 'strong' })).toBeInTheDocument();
        expect(screen.queryByRole('img', { name: /% of the target/ })).not.toBeInTheDocument();
        expect(screen.queryByText('0 GEL', { selector: 'strong' })).not.toBeInTheDocument();
    });

    it('keeps a real reported zero eligible for zero-percent progress', () => {
        moneyPanel(fundraiser({ reportedAmount: 0 }));
        expect(screen.getByText('0 GEL', { selector: 'strong' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: '0% of the target' })).toBeInTheDocument();
        expect(screen.queryByText('Not reported yet')).not.toBeInTheDocument();
    });
});
