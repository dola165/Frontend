import '../../../i18n';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import css from '../components/tournament-workspace.css?raw';
import { TournamentMatchDialog } from '../components/TournamentMatchDialog';
import type { TournamentDetail, TournamentFixtureDto } from '../domain';
import { AddPlanStepDialog } from '../../teamWork/PlanBits';
import type { Plan, PlanView } from '../../teamWork/api';

/** Every selector in the stylesheet, at-rules left out, split at commas outside :where(…). */
const selectors = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)]
    .map(([, list]) => list.trim())
    .filter(list => !list.startsWith('@'))
    .flatMap(list => {
        const parts: string[] = [];
        let depth = 0, start = 0;
        [...list].forEach((char, at) => {
            if (char === '(') depth++;
            else if (char === ')') depth--;
            else if (char === ',' && depth === 0) { parts.push(list.slice(start, at)); start = at + 1; }
        });
        return [...parts, list.slice(start)].map(part => part.trim());
    });
const dialogRules = selectors.filter(selector => /\.tw-(dialog|field)\b/.test(selector));
const matched = (element: Element) => dialogRules.filter(selector => element.matches(selector));

const fixture: TournamentFixtureDto = { id: 1, stageId: null, stageName: null, homeEntryId: null, awayEntryId: null, homeLabel: 'Home', awayLabel: 'Away', winnerEntryId: null, homeScore: null, awayScore: null, roundNumber: 1, fixtureOrder: 1, scheduledAt: '2027-05-01T11:00:00', locationId: null, status: 'SCHEDULED', linkedMatchId: null };
const tournament: TournamentDetail = { id: 1, name: 'Cup', status: 'ACTIVE', organizerOrganizationId: 1, participantScope: 'SQUAD', visibility: 'PUBLIC', staffAssignments: [], entries: [], stages: [], fixtures: [fixture] };
const plan = (id: number, name: string) => ({ id, name, purpose: null, partOf: null }) as Plan;

describe('the tournament workspace stylesheet', () => {
    it('styles the tournament dialogs: the panel, its title, labels, inputs and actions', () => {
        render(<MemoryRouter><div className="tw-workspace"><TournamentMatchDialog tournament={tournament} fixture={fixture} canManage canScore onUpdate={vi.fn()} onClose={vi.fn()} /></div></MemoryRouter>);
        const dialog = document.querySelector('.tw-modal-backdrop > .tw-dialog')!;
        for (const element of [dialog, dialog.querySelector('h2')!, dialog.querySelector(':scope > p')!, dialog.querySelector('form label')!, dialog.querySelector('form input')!, dialog.querySelector('.tw-actions')!])
            expect(matched(element)).not.toEqual([]);
    });

    it('leaves Team work’s dialogs, which share tw-dialog and tw-field, as they are', () => {
        const view = { plan: plan(1, 'Map v2') } as PlanView;
        render(<MemoryRouter><AddPlanStepDialog view={view} plans={[view.plan, plan(2, 'Club search')]} onClose={vi.fn()} onDone={vi.fn()} /></MemoryRouter>);
        const dialog = document.querySelector('.gk-dialog.tw-dialog')!;
        expect(dialog.querySelector('.tw-field select')).not.toBeNull();
        for (const element of [dialog, ...dialog.querySelectorAll('*')]) expect(matched(element)).toEqual([]);
    });
});
