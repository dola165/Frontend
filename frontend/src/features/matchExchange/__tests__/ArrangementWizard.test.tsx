import { fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArrangementEditor } from '../ArrangementEditor';
import { post } from '../api';
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user:{id:1},sessionId:'wizard-test' }) }));
vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(),post:vi.fn() }));
vi.mock('../hooks', async original => ({ ...await original<typeof import('../hooks')>(),useLoad:(path:string) => ({ data:path==='/match-exchange/squads' ? [{id:13,club_id:1,club_name:'Dinamo',name:'First team',category:'SENIOR'}] : path.includes('/clubs/') ? [{id:173,name:'Senior squad',category:'SENIOR'}] : [],reload:vi.fn(),error:'' }) }));
const close=vi.fn();
function open(){ render(<MemoryRouter><ArrangementEditor targetClubId={120} targetClubName="Riverside" onClose={close}/></MemoryRouter>); }
function plan(){fireEvent.change(screen.getByLabelText('Your squad'),{target:{value:'13'}});fireEvent.change(screen.getByLabelText('Opponent squad'),{target:{value:'173'}});fireEvent.click(screen.getByRole('button',{name:'Continue'}));}
function when(){fireEvent.change(screen.getByLabelText('Kickoff'),{target:{value:'2026-11-25T11:00'}});fireEvent.change(screen.getByLabelText('Match ends'),{target:{value:'2026-11-25T12:30'}});fireEvent.change(screen.getByLabelText('City'),{target:{value:'Tbilisi'}});fireEvent.click(screen.getByRole('button',{name:'Continue'}));}
describe('three-step challenge composer',()=>{
 beforeEach(()=>{sessionStorage.clear();vi.clearAllMocks();});afterEach(cleanup);
 it('keeps early steps small and prevents skipping required information',()=>{open();expect(screen.queryByLabelText('Kickoff')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:/Review & send/}));expect(screen.getByRole('alert')).toHaveTextContent('Choose the squad');expect(post).not.toHaveBeenCalled();plan();expect(screen.queryByLabelText('Referee arrangement')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Continue'}));expect(screen.getByRole('alert')).toHaveTextContent('Choose kickoff');});
 it('preserves teams and timing when moving back and sends only from the final step',async()=>{vi.mocked(post).mockResolvedValue({event_id:7});open();plan();when();expect(post).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Back'}));expect(screen.getByLabelText('Kickoff')).toHaveValue('2026-11-25T11:00');fireEvent.click(screen.getByRole('button',{name:'Continue'}));fireEvent.change(screen.getByLabelText('Referee arrangement'),{target:{value:'NONE'}});fireEvent.click(screen.getByRole('button',{name:'Send challenge'}));await waitFor(()=>expect(close).toHaveBeenCalledOnce());expect(post).toHaveBeenCalledWith('/match-arrangements',expect.objectContaining({targetClubId:120,targetSquadId:173,officialMode:'NONE',match:expect.objectContaining({squadId:13,startsAt:'2026-11-25T11:00'})}));});
 it('keeps the draft and review open after submission fails',async()=>{vi.mocked(post).mockRejectedValue(new Error('Unavailable'));open();plan();when();fireEvent.click(screen.getByRole('button',{name:'Send challenge'}));await screen.findByRole('alert');expect(close).not.toHaveBeenCalled();expect(screen.getByRole('region',{name:'Review match'})).toBeInTheDocument();expect(sessionStorage.length).toBe(1);});
});
