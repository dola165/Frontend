import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { CompetitionFixtureConcerns } from './CompetitionFixtureConcerns';
import { CompetitionQualificationRepair } from './CompetitionQualificationRepair';
import { concernCommand, getFixtureConcerns, getQualificationRepair, repairQualification, type FixtureConcerns } from './fixtureReviewApi';
import type { TournamentFixtureDto } from '../tournaments/domain';

const auth = vi.hoisted(() => ({ user: { id: 21 }, sessionId: 'participant-session' }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('./fixtureReviewApi', () => ({ concernCommand: vi.fn(), getFixtureConcerns: vi.fn(), getQualificationRepair: vi.fn(), repairQualification: vi.fn() }));
vi.mock('./CompetitionRecoveryPanel', () => ({ CompetitionRecoveryPanel: () => null }));
const fixture = { id: 4, status: 'COMPLETED', homeScore: 2, awayScore: 0 } as TournamentFixtureDto;
const participant: FixtureConcerns = { revision: 3, resultRevision: 2, canRaise: true, canReview: false, entries: [{ id: 11, label: 'Synthetic Dinamo team' }], concerns: [] };
const pending = { id: 5, entryId: 11, status: 'PENDING', version: 0, reason: 'The recorded score reverses our score sheet', history: [{ action: 'SUBMITTED', reason: 'The recorded score reverses our score sheet', at: '2026-10-30T10:00Z' }] } as const;
const view = () => render(<MemoryRouter><CompetitionFixtureConcerns id={8} fixture={fixture} changed={vi.fn().mockResolvedValue(undefined)}/></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); auth.user = { id: 21 }; auth.sessionId = 'participant-session'; vi.mocked(getFixtureConcerns).mockResolvedValue(participant); });

it('submits an actual participant concern and displays its pending receipt without offering a score write', async () => {
  vi.mocked(concernCommand).mockResolvedValue({ ...participant, concerns: [pending] } as unknown as FixtureConcerns);
  view();
  fireEvent.change(await screen.findByLabelText('Concern reason'), { target: { value: pending.reason } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit concern' }));
  await screen.findByText('Concern #5 · Awaiting organiser review');
  expect(concernCommand).toHaveBeenCalledWith(8, 'fixtures/4/concerns', expect.objectContaining({ entryId: 11, resultRevision: 2, revision: 3, reason: pending.reason, requestId: expect.any(String) }));
  expect(screen.queryByLabelText('Corrected home score')).not.toBeInTheDocument();
});

it('the organiser corrects through the case review and the participant sees its history', async () => {
  vi.mocked(getFixtureConcerns).mockResolvedValue({ ...participant, canRaise: false, canReview: true, entries: [], concerns: [pending] } as unknown as FixtureConcerns);
  vi.mocked(concernCommand).mockResolvedValue({ ...participant, concerns: [{ ...pending, status: 'CORRECTED', version: 1, history: [...pending.history, { action: 'CORRECTED', reason: 'Checked original sheet', at: '2026-10-30T11:00Z' }] }] } as unknown as FixtureConcerns);
  view();
  fireEvent.change(await screen.findByLabelText('Organiser decision'), { target: { value: 'CORRECT' } });
  fireEvent.change(screen.getByLabelText('Corrected home score'), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText('Corrected away score'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Decision reason'), { target: { value: 'Checked original sheet' } });
  fireEvent.click(screen.getByRole('button', { name: 'Record concern decision' }));
  await screen.findByText('Concern #5 · Result corrected');
  expect(concernCommand).toHaveBeenCalledWith(8, 'fixtures/4/concerns/5/review', expect.objectContaining({ action: 'CORRECT', homeScore: 0, awayScore: 3, concernVersion: 0, revision: 3, resultRevision: 2 }));
  expect(screen.getByText(/Checked original sheet/)).toBeInTheDocument();
});

it('rejects with a reason and null scores', async () => {
  vi.mocked(getFixtureConcerns).mockResolvedValue({ ...participant, canRaise: false, canReview: true, concerns: [pending] } as unknown as FixtureConcerns);
  vi.mocked(concernCommand).mockResolvedValue({ ...participant, concerns: [{ ...pending, status: 'REJECTED', version: 1 }] } as unknown as FixtureConcerns);
  view(); fireEvent.change(await screen.findByLabelText('Decision reason'), { target: { value: 'The signed sheet confirms the result' } });
  fireEvent.click(screen.getByRole('button', { name: 'Record concern decision' }));
  await screen.findByText('Concern #5 · Concern rejected');
  expect(concernCommand).toHaveBeenCalledWith(8, expect.any(String), expect.objectContaining({ action: 'REJECT', homeScore: null, awayScore: null, reason: 'The signed sheet confirms the result' }));
});

it('keeps the original concern intent and text after an uncertain acknowledgement', async () => {
  vi.mocked(concernCommand).mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValue({ ...participant, concerns: [pending] } as unknown as FixtureConcerns);
  view(); fireEvent.change(await screen.findByLabelText('Concern reason'), { target: { value: pending.reason } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit concern' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Concern reason')).toHaveValue(pending.reason);
  fireEvent.click(screen.getByRole('button', { name: 'Submit concern' }));
  await waitFor(() => expect(concernCommand).toHaveBeenCalledTimes(2));
  expect(vi.mocked(concernCommand).mock.calls[1][2]).toEqual(vi.mocked(concernCommand).mock.calls[0][2]);
});

it('retires the private draft immediately on account/session change', async () => {
  const rendered = view(); fireEvent.change(await screen.findByLabelText('Concern reason'), { target: { value: 'Private prior-account draft' } });
  auth.user = { id: 99 }; auth.sessionId = 'other-session';
  rendered.rerender(<MemoryRouter><CompetitionFixtureConcerns id={8} fixture={fixture} changed={vi.fn()}/></MemoryRouter>);
  expect(await screen.findByLabelText('Concern reason')).toHaveValue('');
});

it('gives the blocked legacy correction a real versioned reset and resume path', async () => {
  vi.mocked(getQualificationRepair).mockResolvedValue({ revision: 3, available: true, paused: false, sourceStageId: 2, fixtureIds: [7] });
  vi.mocked(repairQualification).mockResolvedValue({} as never);
  const saved = vi.fn();
  const rendered = render(<MemoryRouter><CompetitionQualificationRepair id={8} fixture={4} revision={3} reason="Correct source score sheet" saved={saved}/></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Reset unplayed qualification slots' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(repairQualification).toHaveBeenCalledWith(8, 'fixtures/4/qualification/reset', expect.objectContaining({ revision: 3, requestId: expect.any(String), reason: 'Correct source score sheet' })));
  expect(saved).toHaveBeenCalled();
  vi.mocked(getQualificationRepair).mockResolvedValue({ revision: 4, available: true, paused: true, sourceStageId: 2, fixtureIds: [7] });
  rendered.rerender(<MemoryRouter><CompetitionQualificationRepair id={8} fixture={4} revision={4} reason="Keep saved result" saved={saved}/></MemoryRouter>);
  expect(await screen.findByRole('button', { name: 'Resume saved qualification' })).toBeEnabled();
});

it('preserves a decision draft but refreshes its revision after a qualification reset', async () => {
  const reviewing = { ...participant, canReview: true, canRaise: false, concerns: [pending] } as unknown as FixtureConcerns;
  vi.mocked(getFixtureConcerns).mockResolvedValue(reviewing);
  vi.mocked(concernCommand).mockResolvedValue({ ...reviewing, concerns: [{ ...pending, status: 'CORRECTED', version: 1 }] } as unknown as FixtureConcerns);
  const reasonChanged = vi.fn();
  const rendered = render(<MemoryRouter><CompetitionFixtureConcerns id={8} fixture={fixture} refreshKey={3} onDecisionReason={reasonChanged} changed={vi.fn()}/></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText('Organiser decision'), { target: { value: 'CORRECT' } });
  fireEvent.change(screen.getByLabelText('Corrected away score'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Decision reason'), { target: { value: 'Checked original sheet; reset retained places' } });
  expect(reasonChanged).toHaveBeenCalledWith('Checked original sheet; reset retained places');
  vi.mocked(getFixtureConcerns).mockResolvedValue({ ...reviewing, revision: 4 });
  rendered.rerender(<MemoryRouter><CompetitionFixtureConcerns id={8} fixture={fixture} refreshKey={4} onDecisionReason={reasonChanged} changed={vi.fn()}/></MemoryRouter>);
  await waitFor(() => expect(getFixtureConcerns).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText('Decision reason')).toHaveValue('Checked original sheet; reset retained places');
  fireEvent.click(screen.getByRole('button', { name: 'Record concern decision' }));
  await waitFor(() => expect(concernCommand).toHaveBeenCalledWith(8, expect.any(String), expect.objectContaining({ revision: 4, awayScore: 3 })));
});
