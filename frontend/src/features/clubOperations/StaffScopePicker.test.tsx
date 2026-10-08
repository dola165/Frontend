import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { StaffScopePicker, type StaffScopeSelection } from './StaffScopePicker';
import { scopePayload } from './api';
import { appointmentScope, appointmentStatus } from './api';
import type { Appointment } from './api';
afterEach(cleanup);
const teams=[{id:11,name:'Academy U12'},{id:12,name:'Academy U16'},{id:13,name:'First team'}];
function Picker(){const [value,setValue]=useState<StaffScopeSelection>({clubWide:false,squadIds:[]});return <><StaffScopePicker squads={teams} value={value} onChange={setValue}/><output>{JSON.stringify(scopePayload(value))}</output></>;}
it('requires team selection and keeps academy teams separate from the first team',()=>{
  render(<Picker/>);expect(screen.getByText('Choose at least one team.')).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Academy U16'));fireEvent.click(screen.getByLabelText('Academy U12'));
  expect(screen.getByRole('status').textContent).toBe('{"clubWide":false,"squadIds":[11,12]}');expect(screen.getByLabelText('First team')).not.toBeChecked();
});
it('requires an explicit whole-club choice and does not restore hidden selected teams',()=>{
  render(<Picker/>);fireEvent.click(screen.getByLabelText('Academy U12'));
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'club'}});expect(screen.getByRole('status').textContent).toBe('{"clubWide":true,"squadIds":[]}');
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'teams'}});expect(screen.getByLabelText('Academy U12')).not.toBeChecked();
});
it('shows every selected team and trusts the current effective invitation state',()=>{
  expect(appointmentScope({squad_id:11,squad_ids:[11,12]},teams)).toBe('Academy U12, Academy U16');
  expect(appointmentScope({squad_id:null,squad_name:'U14'})).toBe('U14');
  expect(appointmentStatus({status:'INVITED',effective_status:'UNAVAILABLE'} as Appointment)).toBe('Unavailable');
});
