import { describe, expect, it } from 'vitest';
import { addableBoxes, BOX_DEFAULTS, defaultLayout, goLiveCheck, insertionIndex, isLocked, minimumAge, normalizeLayout, setupState, type PageFacts } from '../kinds';
import { findSimilar, latinWords, nameKey } from '../nameMatch';
import { contrast, crestSvg, defaultCrest, initialsFor, letteringOn, normalizeCrest, paint, CREST_COLOURS } from '../crest';
import { coverForColour } from '../photos';
import { phoneDisplay } from '../phone';

const facts = (over: Partial<PageFacts> = {}): PageFacts => ({ kind: 'CLUB', name: 'Rustavi Lions', crestKept: false, grounds: 0, squads: 0, contact: false, fees: false, players: false, staff: 0, posts: 0, about: false, sponsors: 0, ...over });

describe('page types and their boxes', () => {
  it('starts a club with squads, grounds, fees and staff on, and the extras in the tray', () => {
    expect(BOX_DEFAULTS.CLUB).toMatchObject({ squads: 'on', grounds: 'on', fees: 'on', staff: 'on', posts: 'on', involved: 'add', sponsors: 'add', honours: 'add' });
    expect(defaultLayout('CLUB').columns).toEqual({ left: ['contact', 'fees', 'grounds', 'squads'], main: ['posts'], right: ['staff', 'events'] });
  });

  it('gives a fan club no squads, a business its clubs we back, and a plain page only posts', () => {
    expect(BOX_DEFAULTS.FAN_CLUB.squads).toBeUndefined();
    expect(defaultLayout('BUSINESS').columns.right).toEqual(['staff', 'sponsors']);
    expect(defaultLayout('PAGE').columns).toEqual({ left: ['contact'], main: ['posts'], right: [] });
    expect(addableBoxes('PAGE', defaultLayout('PAGE'))).toEqual(['involved']);
  });

  it('designs venues in with bookings, though they have no tile yet', () => {
    expect(defaultLayout('VENUE').columns.right).toContain('bookings');
  });

  it('puts a box added from the tray at its place in the fixed order', () => {
    const layout = defaultLayout('CLUB');
    expect(insertionIndex(layout, 'involved')).toBe(0);
    expect(insertionIndex(layout, 'honours')).toBe(2);
  });

  it('repairs a stored layout: unknown, misplaced and repeated boxes go, contact and posts always stay', () => {
    const repaired = normalizeLayout('CLUB', { columns: { left: ['fees', 'fees', 'posts', 'nonsense'], main: [], right: ['squads', 'staff'] }, hidden: ['contact', 'honours'] });
    expect(repaired.columns.left).toEqual(['contact', 'fees']);
    expect(repaired.columns.main).toEqual(['posts']);
    expect(repaired.columns.right).toEqual(['staff']);
    expect(repaired.hidden).toEqual(['honours']);
    expect(normalizeLayout('PAGE', null)).toEqual(defaultLayout('PAGE'));
  });
});

describe('setup ring and going live', () => {
  it('counts eight things for a club, about included, and points at the next one', () => {
    const state = setupState(facts({ contact: true }));
    expect([state.done, state.total, state.next]).toEqual([2, 8, 'crest']);
    expect(setupState(facts({ crestKept: true, grounds: 1, squads: 2, contact: true, fees: true, players: true })).complete).toBe(false);
    expect(setupState(facts({ crestKept: true, about: true, grounds: 1, squads: 2, contact: true, fees: true, players: true })).complete).toBe(true);
  });

  it('needs a name, a crest and either a ground or a contact to go live', () => {
    expect(goLiveCheck(facts())).toEqual({ ready: false, missing: ['crest', 'groundOrContact'] });
    expect(goLiveCheck(facts({ crestKept: true, contact: true })).ready).toBe(true);
    expect(goLiveCheck(facts({ crestKept: true, grounds: 1 })).ready).toBe(true);
    expect(goLiveCheck(facts({ name: 'R', crestKept: true, contact: true })).missing).toEqual(['name']);
  });
});

describe('verification unlocks, it never blocks', () => {
  it('locks only money, public minors, public trials and the badge until verified', () => {
    expect(isLocked('SELL', 'NONE')).toBe(true);
    expect(isLocked('FUNDRAISE', 'REQUESTED')).toBe(true);
    expect(isLocked('SELL', 'VERIFIED')).toBe(false);
  });

  it('lets a person of 13 make a fan club or a page, and only an adult a club or a business', () => {
    expect([minimumAge('CLUB'), minimumAge('BUSINESS'), minimumAge('FAN_CLUB'), minimumAge('PAGE')]).toEqual([18, 18, 13, 13]);
  });
});

describe('duplicate names', () => {
  const known = ['FC Dinamo Tbilisi', 'FC Dinamo Tbilisi Academy', 'Rustavi Community FC', 'Saburtalo Youth FC', 'Locomotive Tbilisi Academy'].map(name => ({ name }));
  const names = (typed: string) => findSimilar(typed, known).map(match => match.candidate.name);

  it('finds a club typed in Georgian, Russian or Latin letters', () => {
    expect(latinWords('დინამო თბილისი')).toEqual(['dinamo', 'tbilisi']);
    for (const typed of ['Dinamo', 'დინამო', 'Динамо', 'dinamo']) expect(names(typed)).toEqual(['FC Dinamo Tbilisi', 'FC Dinamo Tbilisi Academy']);
    expect(names('ლოკომოტივი')).toEqual(['Locomotive Tbilisi Academy']);
  });

  it('reads abbreviations, spelling variants and small typos', () => {
    expect(names('Dinamo Tb.')).toContain('FC Dinamo Tbilisi');
    expect(names('Dynamo Tbilisi')[0]).toBe('FC Dinamo Tbilisi');
    expect(names('Saburtlo')).toEqual(['Saburtalo Youth FC']);
  });

  it('never matches on a shared town alone or on filler words', () => {
    expect(names('Rustavi Lions')).toEqual([]);
    expect(names('FC')).toEqual([]);
    expect(names('Football Academy')).toEqual([]);
  });

  it('calls a copy of a known name exact, whatever the prefix or the letters', () => {
    expect(nameKey('FC Dinamo Tbilisi Academy')).toBe(nameKey('Dinamo Tbilisi Academy'));
    expect(findSimilar('dinamo tbilisi academy', known)[0]).toMatchObject({ exact: true, candidate: { name: 'FC Dinamo Tbilisi Academy' } });
    expect(findSimilar('Dinamo Tbilisi', known).find(match => match.exact)?.candidate.name).toBe('FC Dinamo Tbilisi');
    expect(findSimilar('Dinamo', known).some(match => match.exact)).toBe(false);
  });

  it('prefers the same town when two names fit equally', () => {
    const twins = [{ name: 'Lions FC', town: 'Kutaisi' }, { name: 'Lions FC', town: 'Rustavi' }];
    expect(findSimilar('Lions', twins, { town: 'Rustavi' })[0].candidate.town).toBe('Rustavi');
  });
});

describe('generated crests', () => {
  it('keeps lettering readable on every colour (WCAG 4.5:1 at least)', () => {
    for (const colour of CREST_COLOURS) expect(contrast(paint(colour), letteringOn(colour))).toBeGreaterThanOrEqual(4.5);
  });

  it('takes initials from the name, skipping filler words, in the name’s own script', () => {
    expect(initialsFor('Rustavi Lions')).toBe('RL');
    expect(initialsFor('FC Dinamo Tbilisi')).toBe('DT');
    expect(initialsFor('საბურთალო')).toBe('ს');
  });

  it('gives a name the same default every time and repairs a broken design', () => {
    expect(defaultCrest('Rustavi Lions')).toEqual(defaultCrest('rustavi lions '));
    expect(normalizeCrest({ shape: 'star', primary: 'pink', initials: '<b>' }, 'Rustavi Lions')).toMatchObject({ shape: 'shield', initials: 'B' });
  });

  it('draws an SVG with the initials escaped', () => {
    const svg = crestSvg({ shape: 'round', primary: 'navy', secondary: 'gold', initials: 'A&B' });
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('A&B');
  });

  it('picks a cover photo that suits the colours', () => {
    expect(coverForColour('red')).toBe('pitch-sun');
    expect(coverForColour('green')).toBe('ball-field');
  });
});

describe('phone numbers as people write them', () => {
  it('groups a stored Georgian mobile and leaves other numbers alone', () => {
    expect(phoneDisplay('+995599123456')).toBe('+995 599 12 34 56');
    expect(phoneDisplay('995 599 12 34 56')).toBe('+995 599 12 34 56');
    expect(phoneDisplay('+44 20 7946 0958')).toBe('+44 20 7946 0958');
  });
});
