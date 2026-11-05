import { fireEvent, render, screen } from '@testing-library/react';
import { FamilyReply } from './FamilyReply';
import type { FamilyPlan } from '../api';
import { takeBackCannotCome } from '../../travel/api';
vi.mock('../../travel/api', () => ({ takeBackCannotCome: vi.fn() }));

it('exposes correction only for an existing open Cannot come, never ordinary Coming', async () => {
    const journey={plan_id:8,club_id:3,version:2,child_id:42,child_name:'Own child',viewer:'GUARDIAN',canRespond:true,response:{status:'NOT_GOING'},permission:null,itinerary:{timezone:'Asia/Tbilisi'},travel:{status:'DRAFT'}} as FamilyPlan;
    render(<FamilyReply journey={journey} busy={false} act={async run=>{await run();}} />);
    fireEvent.click(screen.getByRole('button',{name:'Take back Can’t come'}));
    expect(takeBackCannotCome).toHaveBeenCalledWith(8,2,42);
    expect(screen.queryByRole('button',{name:'Going'})).not.toBeInTheDocument();
});

it('keeps an itinerary readable when no travel-permission record exists without inventing a decision', () => {
    const act = vi.fn();
    const journey = {
        plan_id: 8, club_id: 3, version: 2, child_id: 42, child_name: 'Own child', viewer: 'GUARDIAN', canRespond: true,
        response: { status: 'PENDING' }, permission_id: null, permission: null, acknowledged_at: null,
        itinerary: { timezone: 'Asia/Tbilisi' }, travel: { status: 'NOT_RECORDED' },
    } as FamilyPlan;
    render(<FamilyReply journey={journey} busy={false} act={act} />);
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
    expect(screen.getByText(/Reading or replying to this itinerary does not grant it/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Give travel permission' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I have read this itinerary' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Can’t come' }));
    expect(act).toHaveBeenCalledOnce();
});
