import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RecordChoicePicker } from './RecordChoicePicker';
import { RecordForm } from './RecordForm';
import { RecordDetail } from '../RecordDetail';
import type { Bootstrap, Definition, OperationRecord } from '../api';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: api }));
const field = (key: string, type = 'text') => ({ key, label: key, type, required: true, options: [] });
const definitions: Definition[] = [
    { kind: 'INSTALMENT', module: 'FINANCE', label: 'Membership instalment', states: ['DUE'], fields: [field('amount', 'money'), field('currency', 'currency'), field('period')] },
    { kind: 'EQUIPMENT_ISSUE', module: 'EQUIPMENT', label: 'Equipment assignment', states: ['ISSUED'], fields: [field('quantity', 'integer'), field('conditionOut')] },
    { kind: 'FACILITY_TASK', module: 'FACILITIES', label: 'Ground work', states: ['SCHEDULED'], fields: [field('work', 'textarea')] },
];
const boot: Bootstrap = { clubId: 10, clubName: 'Dinamo', actorId: 7, leadership: true, definitions, specialisations: [], permissions: [], settings: { setting: 'COMMUNITY', playing_level: 'AMATEUR', enabled_modules: ['FINANCE', 'EQUIPMENT', 'FACILITIES'], revision: 0 },
    modules: ['FINANCE', 'EQUIPMENT', 'FACILITIES'].map(id => ({ id, writable: true, globalWrite: true, writeSquads: [] })), squads: [], staff: [{ id: 7, name: 'Grounds lead' }], guardians: [], venues: [], events: [], sessions: [],
    people: Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, name: `Existing player ${i + 1}` })),
    links: Array.from({ length: 2000 }, (_, i) => ({ id: 9000 + i, title: 'Newer attendance', kind: 'ATTENDANCE', module: 'ATTENDANCE', squad_id: null })) };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); api.get.mockReset(); api.post.mockReset(); }); afterEach(cleanup);
it.each(definitions)('CR5: $kind completes against valid choices missing from capped people/record bootstrap', async definition => {
    api.get.mockImplementation(async (path: string) => {
        const q = new URL(path, 'https://synthetic.local').searchParams;
        const target = q.get('target'), search = q.get('q');
        return { data: { page: Number(q.get('page')), hasMore: !search, items: target === 'PERSON' && search === 'later' ? [{ id: 1001, name: 'Eligible later player' }] : target === 'ASSET' && search === 'old' ? [{ id: 11, name: 'Old stock batch' }] : target === 'FACILITY' && search === 'old' ? [{ id: 21, name: 'Old academy ground' }] : [] } };
    });
    const saved = vi.fn().mockResolvedValue(undefined); api.post.mockResolvedValue({ data: { id: 100, title: 'Actual club work', kind: definition.kind } });
    render(<MemoryRouter><RecordForm boot={boot} definition={definition} backLabel="Back" onSaved={saved} onCancel={vi.fn()} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Actual club work' } });
    if (definition.kind !== 'FACILITY_TASK') {
        fireEvent.change(screen.getByLabelText('Search person'), { target: { value: 'later' } }); await screen.findByRole('option', { name: 'Eligible later player' });
        fireEvent.change(screen.getByLabelText('Person', { exact: true }), { target: { value: '1001' } });
    }
    if (definition.kind === 'INSTALMENT') {
        fireEvent.change(screen.getByLabelText('amount', { exact: true }), { target: { value: '100.00' } });
        fireEvent.change(screen.getByLabelText('currency', { exact: true }), { target: { value: 'GEL' } });
        fireEvent.change(screen.getByLabelText('period', { exact: true }), { target: { value: 'October' } });
    } else {
        const label = definition.kind === 'EQUIPMENT_ISSUE' ? 'Related asset' : 'Related facility';
        fireEvent.change(screen.getByLabelText(`Search ${label.toLowerCase()}`), { target: { value: 'old' } }); await screen.findByRole('option', { name: definition.kind === 'EQUIPMENT_ISSUE' ? 'Old stock batch' : 'Old academy ground' });
        fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value: definition.kind === 'EQUIPMENT_ISSUE' ? '11' : '21' } });
        if (definition.kind === 'EQUIPMENT_ISSUE') { fireEvent.change(screen.getByLabelText('quantity'), { target: { value: '2' } }); fireEvent.change(screen.getByLabelText('conditionOut'), { target: { value: 'Good' } }); }
        else { fireEvent.change(screen.getByLabelText('work'), { target: { value: 'Clear the drainage' } }); fireEvent.change(screen.getByLabelText('Responsible staff member'), { target: { value: '7' } }); }
    }
    fireEvent.click(screen.getByRole('button', { name: /^Save / })); await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][1]).toMatchObject(definition.kind === 'INSTALMENT' ? { subjectUserId: 1001 } : { relatedRecordId: definition.kind === 'EQUIPMENT_ISSUE' ? 11 : 21 });
    expect(api.get.mock.calls.every(call => call[0].includes('/record-choices?forKind='))).toBe(true);
});
it('CR5: pagination states incompleteness and retains the selected reference while searching another page', async () => {
    api.get.mockResolvedValueOnce({ data: { items: [{ id: 11, name: 'Selected batch' }], page: 0, hasMore: true } }).mockResolvedValue({ data: { items: [{ id: 12, name: 'Later batch' }], page: 1, hasMore: false } });
    const selected = vi.fn(); render(<RecordChoicePicker club={10} forKind="EQUIPMENT_ISSUE" target="ASSET" squad="9" value="11" selected={{ id: 11, name: 'Selected batch' }} label="Related asset" required onChange={selected} />);
    await screen.findByText(/More choices available/); fireEvent.click(screen.getByRole('button', { name: 'More choices' })); await screen.findByRole('option', { name: 'Later batch' });
    expect(screen.getByLabelText('Related asset', { exact: true })).toHaveValue('11'); expect(api.get.mock.calls[1][0]).toContain('page=1'); expect(api.get.mock.calls[1][0]).toContain('squad=9');
});
it.each([{ person: 50, state: 'RETURNED', action: 'Record equipment return' }, { person: 51, state: 'LOST', action: 'Lost' }])('CR6: departed borrower $person is distinguished and the original assignment records $state', async ({ person, state, action }) => {
    const record = { id: 12 + person, club_id: 10, module: 'EQUIPMENT', kind: 'EQUIPMENT_ISSUE', title: 'Borrowed balls', status: 'ISSUED', revision: 0, borrowerCurrent: false, subject_user_id: person, squad_id: null, assigned_user_id: null, event_id: null, session_id: null, related_record_id: 11, due_on: null, data: { quantity: '2', conditionOut: 'Good' }, transitions: [state], canEdit: false, created_at: '2026-10-30', updated_at: '2026-10-30' } satisfies OperationRecord;
    api.get.mockResolvedValue({ data: [] }); api.post.mockResolvedValue({ data: { ...record, revision: 1, status: state } });
    render(<MemoryRouter><RecordDetail club={10} boot={{ ...boot, people: [] }} record={record} definition={definitions[1]} backLabel="Kit" onClose={vi.fn()} onEdit={vi.fn()} onChanged={vi.fn().mockResolvedValue(undefined)} /></MemoryRouter>);
    expect(screen.getByText(`Former club member · Person #${person}`)).toBeVisible();
    fireEvent.change(screen.getByLabelText(/Decision or action note/), { target: { value: state === 'LOST' ? 'Loss reported after departure' : 'Returned in good condition after departure' } });
    fireEvent.click(screen.getByRole('button', { name: action }));
    if (screen.queryByRole('alertdialog')) fireEvent.click(screen.getAllByRole('button', { name: action }).at(-1)!);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/clubs/10/operations/records/${record.id}/transition`, expect.objectContaining({ status: state, revision: 0 }), expect.any(Object)));
    expect(api.post.mock.calls[0][0]).not.toContain('/appointments');
});
