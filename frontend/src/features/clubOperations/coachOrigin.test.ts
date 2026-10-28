import { expect, it } from 'vitest';
import { coachOriginTarget, coachRecordHref } from './coachOrigin';

const record = { id: 70116, module: 'AVAILABILITY', squad_id: 103 };
const link = () => new URL(coachRecordHref(1, record), 'http://local.test').searchParams;
it('carries the current record, club and squad and resolves only the known coach destination', () => {
    const params = link();
    expect(Object.fromEntries(params)).toEqual({ tab: 'tools', tool: 'restrictions', record: '70116', squad: '103', coachReturn: 'my-squads', coachClub: '1' });
    expect(coachOriginTarget(params, 1, [103, 105])).toBe('/my-squads?clubId=1');
    expect(coachRecordHref(1, { ...record, squad_id: null })).not.toContain('coachReturn');
});
it.each(['https://outside.test', '//outside.test', '/my-squads', 'javascript:alert(1)', '../my-squads'])('refuses a URL-like or arbitrary destination %s', value => {
    const params = link(); params.set('coachReturn', value); expect(coachOriginTarget(params, 1, [103])).toBeNull();
});
it('refuses foreign clubs, revoked/foreign squads, invalid records, missing or duplicated context', () => {
    expect(coachOriginTarget(link(), 2, [103])).toBeNull(); expect(coachOriginTarget(link(), 1, [105])).toBeNull();
    for (const [name, value] of [['record', '0'], ['record', '9007199254740992'], ['squad', '-1'], ['coachClub', '01']]) {
        const params = link(); params.set(name, value); expect(coachOriginTarget(params, 1, [103])).toBeNull();
    }
    for (const name of ['coachReturn', 'coachClub', 'record', 'squad']) {
        const missing = link(); missing.delete(name); expect(coachOriginTarget(missing, 1, [103])).toBeNull();
        const duplicate = link(); duplicate.append(name, duplicate.get(name)!); expect(coachOriginTarget(duplicate, 1, [103])).toBeNull();
    }
});
it('leaves internal workspace and list returns authoritative', () => {
    const internal = link(); internal.set('return', 'tab=squads&squad=103'); expect(coachOriginTarget(internal, 1, [103])).toBeNull();
    const list = link(); list.set('from', 'list'); expect(coachOriginTarget(list, 1, [103])).toBeNull();
    expect(coachOriginTarget(new URLSearchParams('tab=restrictions&record=70116&squad=103'), 1, [103])).toBeNull();
});
