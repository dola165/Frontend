import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectBoard, ProjectDetail, ProjectSummary } from './api';
import { ProjectList } from './ProjectList';
import { ProjectSteps } from './ProjectSteps';
import { markOf, projectsPath, summaryLine } from './projectWords';

vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), changeStep: vi.fn(), startProject: vi.fn() }));

const project = (over: Partial<ProjectSummary> = {}): ProjectSummary => ({
    id: 1, goal: 'New kit for U12', status: 'NOW', squad: { id: 7, name: 'U12 Mixed' }, dueOn: null, target: { amount: 2000, currency: 'GEL' }, raised: 1240,
    progress: 62, progressFromMoney: true, stepsDone: 2, stepsTotal: 5, nextStep: 'Choose a quote', people: [{ id: 3, name: 'Nana Beridze', avatarUrl: null }],
    waitingOnMe: 0, fundraiserStatus: 'PUBLISHED', updatedAt: '2026-10-29T10:00:00Z', ...over,
});
const board = (over: Partial<ProjectBoard> = {}): ProjectBoard => ({
    club: { id: 1, name: 'FC Dinamo Tbilisi Academy', crestUrl: null }, canStart: true, choices: { squads: [{ id: 7, name: 'U12 Mixed' }], people: [] },
    needsYou: [{ projectId: 2, project: 'Goals for Pitch 2', stepId: 9, step: 'Get quotes', day: '2026-11-03' }],
    projects: [project(), project({ id: 2, goal: 'Goals for Pitch 2', squad: null, target: null, raised: null, progressFromMoney: false, progress: 0, stepsDone: 0, stepsTotal: 4, nextStep: 'Get quotes', waitingOnMe: 1 }),
        project({ id: 3, goal: 'Floodlights', status: 'IDEA', squad: null }), project({ id: 4, goal: 'Balls for U10', status: 'DONE', squad: null })],
    ...over,
});

describe('The Projects page', () => {
    it('puts what needs you first, then Now, and opens a project from its row', () => {
        render(<MemoryRouter><ProjectList board={board()} place="projects" onStarted={vi.fn()} /></MemoryRouter>);
        const needs = screen.getByRole('region', { name: 'Needs you' });
        expect(within(needs).getByRole('link', { name: /Get quotes/ })).toHaveAttribute('href', '/projects/2');
        expect(screen.getByRole('link', { name: /New kit for U12/ })).toHaveAttribute('href', '/projects/1');
        expect(screen.queryByText('Floodlights')).not.toBeInTheDocument();
        expect(screen.queryByText('Balls for U10')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'New project' })).toBeInTheDocument();
    });
    it('shows Ideas and Done in their own places, and no New project to someone who cannot start one', () => {
        const { unmount } = render(<MemoryRouter><ProjectList board={board()} place="ideas" onStarted={vi.fn()} /></MemoryRouter>);
        expect(screen.getByText('Floodlights')).toBeInTheDocument();
        unmount();
        render(<MemoryRouter><ProjectList board={board({ canStart: false })} place="done" onStarted={vi.fn()} /></MemoryRouter>);
        expect(screen.getByText('Balls for U10')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /New/ })).not.toBeInTheDocument();
    });
    it('opens New project from the address with Raise money and the squad chosen', () => {
        render(<MemoryRouter initialEntries={['/projects?club=1&new=RAISE_MONEY&squad=7']}><ProjectList board={board()} place="projects" onStarted={vi.fn()} /></MemoryRouter>);
        const dialog = screen.getByRole('dialog', { name: 'New project' });
        expect(within(dialog).getByRole('radio', { name: /Raise money/ })).toHaveAttribute('aria-checked', 'true');
        expect(within(dialog).getByRole('button', { name: 'U12 Mixed' })).toHaveAttribute('aria-pressed', 'true');
    });
    it('speaks of the money as reported, and marks a squad project with its squad', () => {
        const copy = (en: string) => en;
        expect(summaryLine(copy, project())).toMatch(/^1,240 GEL of 2,000 GEL · Choose a quote · Nana$/);
        expect(markOf(project())).toBe('U12');
        expect(markOf(project({ squad: null, goal: 'Goals for Pitch 2' }))).toBe('GF');
        expect(projectsPath(1, 'ideas', { new: 'IDEA' })).toBe('/projects?club=1&place=ideas&new=IDEA');
    });
});

describe('Steps', () => {
    const detail = (runs: boolean): ProjectDetail => ({
        summary: project(), purpose: null, version: 1, startedBy: null, talk: [], files: [], history: [], fundraiser: null,
        can: { change: runs, addPeople: runs, talk: true, startFundraiser: false, publish: false }, club: { id: 1, name: 'Dinamo', crestUrl: null }, choices: runs ? { squads: [], people: [] } : null,
        steps: [{ id: 5, title: 'Hand out at training', done: false, person: { id: 1, name: 'Luka Gelashvili', avatarUrl: null }, day: null, mine: true, canChange: true, version: 0 },
            { id: 6, title: 'Order and pay', done: false, person: { id: 4, name: 'Giorgi Bakradze', avatarUrl: null }, day: null, mine: false, canChange: runs, version: 0 }],
    });
    it('lets the person a step waits on tick it, and nothing else', async () => {
        const api = await import('./api');
        vi.mocked(api.changeStep).mockResolvedValue(detail(false));
        render(<ProjectSteps project={detail(false)} onChanged={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Done: Order and pay' })).toBeDisabled();
        expect(screen.queryByRole('button', { name: /Change/ })).not.toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Add a step')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Done: Hand out at training' }));
        expect(api.changeStep).toHaveBeenCalledWith(1, 1, 5, { version: 0, done: true });
    });
    it('gives whoever runs the project the way to change and add steps', () => {
        render(<ProjectSteps project={detail(true)} onChanged={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Change Order and pay' }));
        expect(screen.getByRole('combobox', { name: 'Who does Order and pay' })).toHaveValue('4');
        expect(screen.getByPlaceholderText('Add a step')).toBeInTheDocument();
    });
});
