// A small stand-in for the vitest API, enough to run focused component and logic tests where vitest itself
// cannot start (no rollup native binary). Mocks are wired by run.mjs at bundle time.
import { chai, JestChaiExpect, JestExtend, JestAsymmetricMatchers, ASYMMETRIC_MATCHERS_OBJECT, getState, setState } from '@vitest/expect';
import { fn, spyOn, clearAllMocks, restoreAllMocks, resetAllMocks } from '@vitest/spy';
import * as matchers from '@testing-library/jest-dom/matchers';

chai.use(JestExtend);
chai.use(JestChaiExpect);
chai.use(JestAsymmetricMatchers);
// Mirrors vitest's createExpect.
export const expect = (value, message) => {
  const { assertionCalls } = getState(expect);
  setState({ assertionCalls: assertionCalls + 1 }, expect);
  return chai.expect(value, message);
};
Object.assign(expect, chai.expect);
Object.assign(expect, globalThis[ASYMMETRIC_MATCHERS_OBJECT]);
expect.getState = () => getState(expect);
expect.setState = state => setState(state, expect);
setState({ assertionCalls: 0, isExpectingAssertions: false, isExpectingAssertionsError: null, expectedAssertionsNumber: null, expectedAssertionsNumberErrorGen: null }, expect);
expect.extend = expects => chai.expect.extend(expect, expects);
expect.extend(matchers);

const root = { name: '', tests: [], children: [], before: [], after: [], beforeAll: [], afterAll: [], parent: null };
let current = root;
export function describe(name, body) {
  const suite = { name, tests: [], children: [], before: [], after: [], beforeAll: [], afterAll: [], parent: current };
  current.children.push(suite);
  const previous = current; current = suite;
  try { body(); } finally { current = previous; }
}
describe.each = rows => (name, body) => rows.forEach((row, index) => describe(format(name, row, index), () => body(...(Array.isArray(row) ? row : [row]))));
function format(name, row, index) { return name.replace('%#', String(index)).replace('%s', String(Array.isArray(row) ? row[0] : row)); }
export function it(name, body) { current.tests.push({ name, body }); }
it.each = rows => (name, body) => rows.forEach((row, index) => it(format(name, row, index), () => body(...(Array.isArray(row) ? row : [row]))));
it.skip = () => {};
export const test = it;
export const beforeEach = hook => current.before.push(hook);
export const afterEach = hook => current.after.push(hook);
export const beforeAll = hook => current.beforeAll.push(hook);
export const afterAll = hook => current.afterAll.push(hook);

const stubbed = [];
// Some window properties (navigator) only have getters, so stubs are defined rather than assigned.
const setGlobal = (key, value) => {
  for (const target of [globalThis, window]) {
    try { Object.defineProperty(target, key, { value, configurable: true, writable: true }); } catch { try { target[key] = value; } catch { /* left as it is */ } }
  }
};
export const vi = {
  fn, spyOn,
  hoisted: factory => factory(),
  mocked: value => value,
  mock: () => { /* Registered by run.mjs. */ },
  importActual: async spec => { const load = globalThis.__vtActual?.[spec]; if (!load) throw new Error('importActual needs a vi.mock of ' + spec); return load(); },
  clearAllMocks, restoreAllMocks, resetAllMocks,
  stubGlobal: (key, value) => { stubbed.push([key, globalThis[key]]); setGlobal(key, value); },
  unstubAllGlobals: () => { while (stubbed.length) { const [key, value] = stubbed.pop(); setGlobal(key, value); } },
  waitFor: async (check, { timeout = 1000 } = {}) => { const start = Date.now(); for (;;) { try { return await check(); } catch (error) { if (Date.now() - start > timeout) throw error; await new Promise(r => setTimeout(r, 20)); } } },
};
Object.assign(globalThis, { describe, it, test, expect, vi, beforeEach, afterEach, beforeAll, afterAll });

// Settles an async vi.mock factory where it is registered (see run.mjs), before the test body reads it.
globalThis.__vtResolveMock = async spec => {
  const factory = globalThis.__vtMocks[spec];
  if (!('v' in factory)) factory.v = factory(async () => globalThis.__vtActual[spec]());
  if (factory.v && typeof factory.v.then === 'function') factory.v = await factory.v;
};

export async function run(filter) {
  // Async vi.mock factories (for example ones that spread vi.importActual) settle before the tests start.
  for (const [spec, factory] of Object.entries(globalThis.__vtMocks ?? {})) {
    if (!('v' in factory)) factory.v = factory(async () => globalThis.__vtActual[spec]());
    if (factory.v && typeof factory.v.then === 'function') factory.v = await factory.v;
  }
  const results = [];
  const chain = suite => { const list = []; for (let s = suite; s; s = s.parent) list.unshift(s); return list; };
  async function visit(suite, prefix) {
    for (const hook of suite.beforeAll) await hook();
    for (const t of suite.tests) {
      const name = `${prefix}${t.name}`;
      if (filter && !name.includes(filter)) continue;
      const suites = chain(suite);
      try {
        for (const s of suites) for (const hook of s.before) await hook();
        await t.body();
        results.push({ name, ok: true });
      } catch (error) {
        results.push({ name, ok: false, error: String(error?.stack ?? error).split('\n').slice(0, 12).join('\n') });
      } finally {
        for (const s of [...suites].reverse()) for (const hook of s.after) { try { await hook(); } catch (error) { results.push({ name: `${name} (afterEach)`, ok: false, error: String(error) }); } }
      }
    }
    for (const child of suite.children) await visit(child, `${prefix}${child.name} › `);
    for (const hook of suite.afterAll) await hook();
  }
  await visit(root, '');
  return results;
}
