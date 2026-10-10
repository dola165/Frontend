import { useState, type FormEvent } from 'react';
import { Button, Field, PageHeader, Panel } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { label, moduleNames, moduleGroups, put, root, type Bootstrap } from './api';
import { operationDescriptions } from './workspaceNavigation';
import './records/records.css';
import '../clubWorkspace/club-workspace.css';

const SETTINGS = ['UNSPECIFIED', 'SCHOOL', 'COMMUNITY', 'INDEPENDENT_ACADEMY', 'CLUB_ACADEMY', 'CLUB', 'OTHER'];
const LEVELS = ['UNSPECIFIED', 'RECREATIONAL', 'AMATEUR', 'SEMI_PROFESSIONAL', 'PROFESSIONAL', 'MIXED'];

/** Workspace setup: what kind of club this is, its region, and which tools the whole club uses. */
export function OperationsSettings({ boot, onSaved }: { boot: Bootstrap; onSaved: () => Promise<void> }) {
  const [settings, setSettings] = useState(boot.settings), [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const set = (value: Partial<typeof settings>) => { setSettings(current => ({ ...current, ...value })); setSaved(false); };
  const dirty = JSON.stringify(settings) !== JSON.stringify(boot.settings);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(''); setSaved(false);
    try {
      await put(`${root(boot.clubId)}/settings`, { setting: settings.setting, playingLevel: settings.playing_level, currency: settings.currency || null, countryCode: settings.country_code || null, timezone: settings.timezone || null, legalName: settings.legal_name || null, registrationReference: settings.registration_reference || null, enabledModules: settings.enabled_modules, revision: settings.revision });
      await onSaved(); setSaved(true);
    } catch (failure) { setError(extractApiErrorMessage(failure, 'Could not save club settings.')); }
    finally { setBusy(false); }
  };
  const toggle = (module: string, on: boolean) => set({ enabled_modules: on ? [...settings.enabled_modules, module] : settings.enabled_modules.filter(value => value !== module) });
  return <form className="rec-page" onSubmit={e => { void submit(e); }}>
    <PageHeader title="Workspace settings" subtitle="Club details and the tools your club uses. Each person’s responsibilities decide what they see first." />
    <fieldset disabled={busy} className="rec-form rec-form--wide">
      {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
      {saved && <div className="gk-notice cw-notices__success" role="status">Settings saved.</div>}
      <div className="gk-grid gk-grid--split">
        <Panel flush title="Club tools" action={<span className="gk-faint">{settings.enabled_modules.length} on</span>}>
          <p className="rec-form__intro gk-muted">Turning a tool off affects the whole club: new records stop, while history stays available to the people allowed to see it.</p>
          {moduleGroups.map(group => <section key={group.name} className="rec-form__group">
            <div className="rec-form__group-head"><h3>{group.name}</h3></div>
            <ul className="rec-switches">{group.ids.map(module => <li key={module}><label className="rec-switch">
              <span><strong>{moduleNames[module]}</strong><span>{operationDescriptions[module]}</span></span>
              <input type="checkbox" role="switch" className="gk-switch" checked={settings.enabled_modules.includes(module)} onChange={e => toggle(module, e.target.checked)} />
            </label></li>)}</ul>
          </section>)}
        </Panel>
        <Panel flush title="About the club">
          <div className="rec-form__group"><div className="rec-fields">
            <Field label="Organisation" htmlFor="ws-setting"><select id="ws-setting" className="gk-input" value={settings.setting} onChange={e => set({ setting: e.target.value })}>{SETTINGS.map(v => <option key={v} value={v}>{label(v)}</option>)}</select></Field>
            <Field label="Playing level" htmlFor="ws-level"><select id="ws-level" className="gk-input" value={settings.playing_level} onChange={e => set({ playing_level: e.target.value })}>{LEVELS.map(v => <option key={v} value={v}>{label(v)}</option>)}</select></Field>
            <Field label={<>Default currency <span className="rec-optional">(optional)</span></>} htmlFor="ws-currency" hint="Three letters, for example GEL."><input id="ws-currency" className="gk-input" maxLength={3} pattern="[A-Z]{3}" value={settings.currency ?? ''} onChange={e => set({ currency: e.target.value.toUpperCase() })} /></Field>
            <Field label={<>Operating country <span className="rec-optional">(optional)</span></>} htmlFor="ws-country" hint="Two letters, for example GE."><input id="ws-country" className="gk-input" maxLength={2} pattern="[A-Z]{2}" value={settings.country_code ?? ''} onChange={e => set({ country_code: e.target.value.toUpperCase() })} /></Field>
            <Field label={<>Timezone <span className="rec-optional">(optional)</span></>} htmlFor="ws-timezone" hint="For example Asia/Tbilisi."><input id="ws-timezone" className="gk-input" value={settings.timezone ?? ''} onChange={e => set({ timezone: e.target.value })} /></Field>
          </div></div>
          <div className="rec-form__group"><div className="rec-form__group-head"><h3>Company details</h3><p>Leave blank until confirmed.</p></div><div className="rec-fields">
            <Field label={<>Registered legal name <span className="rec-optional">(optional)</span></>} htmlFor="ws-legal"><input id="ws-legal" className="gk-input" maxLength={255} value={settings.legal_name ?? ''} onChange={e => set({ legal_name: e.target.value })} /></Field>
            <Field label={<>Registration reference <span className="rec-optional">(optional)</span></>} htmlFor="ws-reg"><input id="ws-reg" className="gk-input" maxLength={160} value={settings.registration_reference ?? ''} onChange={e => set({ registration_reference: e.target.value })} /></Field>
          </div></div>
        </Panel>
      </div>
      <div className="rec-actions"><Button type="submit" variant="primary" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save settings'}</Button><p className="rec-actions__note">{dirty ? 'You have unsaved changes.' : 'Everything is saved.'}</p></div>
    </fieldset>
  </form>;
}
