import { http, HttpResponse } from 'msw';
import type { NewEdition, NewSeries, TournamentDivision, TournamentEdition, TournamentSeries } from '../../features/tournamentSeries/api';
import type { TournamentDetail } from '../../features/tournaments/domain';
import { getMockTournament, setMockTournament } from './tournaments';

const series = new Map<number, TournamentSeries>();
let sequence = 40000;
const nextId = () => ++sequence;
const normalized = (value: string) => value.trim().toLowerCase();
const linked = (id: number) => [...series.values()].find(value => value.editions.some(edition => edition.divisions.some(division => division.tournamentId === id)));
const conflict = (detail: string) => HttpResponse.json({ detail }, { status: 409 });
const view = (value: TournamentSeries) => ({ ...value, editions: value.editions.map(edition => ({ ...edition, divisions: edition.divisions.map(division => divisionOf(getMockTournament(division.tournamentId), division.name, division.id)) })) });
function divisionOf(tournament: TournamentDetail, name: string, id = nextId()): TournamentDivision {
    return { id, tournamentId: tournament.id, name, tournamentName: tournament.name, status: tournament.status, visibility: tournament.visibility, startDate: tournament.startDate || '', endDate: tournament.endDate || '' };
}
function draft(source: TournamentDetail, value: TournamentSeries, edition: TournamentEdition, name: string) {
    const result: TournamentDetail = { ...source, id: nextId(), name: `${value.name} · ${edition.label} · ${name}`.slice(0, 255), status: 'PLANNING', visibility: 'PRIVATE', startDate: edition.startDate, endDate: edition.endDate, registrationOpensAt: null, registrationClosesAt: null, entries: [], stages: [], fixtures: [], championEntryId: null, championName: null,
        staffAssignments: source.staffAssignments.filter(staff => staff.role === 'ADMIN').slice(0, 1) };
    setMockTournament(result);
    return divisionOf(result, name);
}
export const tournamentSeriesHandlers = [
    http.patch('*/api/tournament-series/:seriesId', async ({ params, request }) => {
        const value = series.get(Number(params.seriesId));
        if (!value) return HttpResponse.json({ detail: 'Series not found.' }, { status: 404 });
        const body = await request.json() as { name: string; description?: string };
        if (!body.name?.trim() || body.name.length > 255 || (body.description?.length ?? 0) > 4000) return HttpResponse.json({ detail: 'Check the series details.' }, { status: 400 });
        value.name = body.name.trim(); value.description = body.description?.trim() || null;
        return HttpResponse.json(view(value));
    }),
    http.patch('*/api/tournament-series/:seriesId/editions/:editionId', async ({ params, request }) => {
        const value = series.get(Number(params.seriesId)), edition = value?.editions.find(e => e.id === Number(params.editionId));
        if (!value || !edition) return HttpResponse.json({ detail: 'Edition not found.' }, { status: 404 });
        const body = await request.json() as NewEdition;
        if (!body.label?.trim() || body.label.length > 100 || !Number.isFinite(Date.parse(body.startDate)) || !Number.isFinite(Date.parse(body.endDate)) || body.endDate < body.startDate) return HttpResponse.json({ detail: 'Check the edition dates and label.' }, { status: 400 });
        if (value.editions.some(e => e.id !== edition.id && normalized(e.label) === normalized(body.label))) return conflict('This series already has an edition with that label.');
        if (edition.divisions.some(d => { const t = getMockTournament(d.tournamentId); return !t.startDate || !t.endDate || t.startDate < body.startDate || t.endDate > body.endDate; })) return conflict('The edition dates must include every linked division.');
        edition.label = body.label.trim(); edition.startDate = body.startDate; edition.endDate = body.endDate;
        value.editions.sort((a,b) => b.startDate.localeCompare(a.startDate));
        return HttpResponse.json(view(value));
    }),
    http.get('*/api/tournament-series/:seriesId', ({params}) => {
        const value=series.get(Number(params.seriesId));
        return value?HttpResponse.json(view(value)):HttpResponse.json({detail:'Competition not found.'},{status:404});
    }),
    http.get('*/api/tournament-series/by-tournament/:id', ({ params }) => {
        const value = linked(Number(params.id));
        return HttpResponse.json(value ? view(value) : null);
    }),
    http.post('*/api/tournament-series/from-tournament/:id', async ({ params, request }) => {
        const id = Number(params.id), body = await request.json() as NewSeries;
        if (linked(id)) return conflict('This tournament already belongs to an edition.');
        const tournament = getMockTournament(id);
        const value: TournamentSeries = { id: nextId(), organizerOrganizationId: tournament.organizerOrganizationId, name: body.name.trim(), description: body.description || null, canManage: true,
            editions: [{ id: nextId(), label: body.editionLabel.trim(), startDate: tournament.startDate || '', endDate: tournament.endDate || '', divisions: [divisionOf(tournament, body.divisionName.trim())] }] };
        series.set(value.id, value);
        return HttpResponse.json(view(value));
    }),
    http.post('*/api/tournament-series/:seriesId/editions/:editionId/next', async ({ params, request }) => {
        const value = series.get(Number(params.seriesId)), edition = value?.editions.find(item => item.id === Number(params.editionId));
        if (!value || !edition) return HttpResponse.json({ detail: 'Edition not found.' }, { status: 404 });
        const body = await request.json() as NewEdition;
        if (value.editions.some(item => normalized(item.label) === normalized(body.label))) return conflict('This series already has an edition with that label.');
        if (Date.parse(body.startDate) <= Date.now() || body.endDate < body.startDate) return HttpResponse.json({ detail: 'Use future edition dates with the end on or after the start.' }, { status: 400 });
        const next: TournamentEdition = { id: nextId(), label: body.label.trim(), startDate: body.startDate, endDate: body.endDate, divisions: [] };
        next.divisions = edition.divisions.map(division => draft(getMockTournament(division.tournamentId), value, next, division.name));
        value.editions.push(next); value.editions.sort((a, b) => b.startDate.localeCompare(a.startDate));
        return HttpResponse.json(view(value));
    }),
    http.post('*/api/tournament-series/:seriesId/editions/:editionId/divisions', async ({ params, request }) => {
        const value = series.get(Number(params.seriesId)), edition = value?.editions.find(item => item.id === Number(params.editionId));
        if (!value || !edition) return HttpResponse.json({ detail: 'Edition not found.' }, { status: 404 });
        const body = await request.json() as { name: string; templateTournamentId: number };
        if (edition.divisions.some(item => normalized(item.name) === normalized(body.name))) return conflict('This edition already has a division with that name.');
        if (Date.parse(edition.startDate) <= Date.now()) return HttpResponse.json({ detail: 'The edition dates must be in the future.' }, { status: 400 });
        edition.divisions.push(draft(getMockTournament(body.templateTournamentId), value, edition, body.name.trim()));
        return HttpResponse.json(view(value));
    }),
    http.post('*/api/tournament-series/:seriesId/editions/:editionId/attach', async ({ params, request }) => {
        const value = series.get(Number(params.seriesId)), edition = value?.editions.find(item => item.id === Number(params.editionId));
        if (!value || !edition) return HttpResponse.json({ detail: 'Edition not found.' }, { status: 404 });
        const body = await request.json() as { name: string; tournamentId: number }, tournament = getMockTournament(body.tournamentId);
        if (linked(tournament.id)) return conflict('This tournament already belongs to an edition.');
        if (tournament.organizerOrganizationId !== value.organizerOrganizationId) return conflict('All divisions must belong to the series organizer.');
        if (!tournament.startDate || !tournament.endDate) return conflict('Set both tournament dates before linking this division.');
        if ((tournament.startDate || '') < edition.startDate || (tournament.endDate || '') > edition.endDate) return conflict('The division dates must be inside this edition’s dates.');
        if (edition.divisions.some(item => normalized(item.name) === normalized(body.name))) return conflict('This edition already has a division with that name.');
        edition.divisions.push(divisionOf(tournament, body.name.trim()));
        return HttpResponse.json(view(value));
    }),
];
