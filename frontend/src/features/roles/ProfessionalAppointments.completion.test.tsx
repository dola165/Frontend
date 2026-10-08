import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClubAppointments } from './ProfessionalCareer';
import type { ClubAppointment } from './domain';
vi.mock('../../components/ui/MediaImage', () => ({ MediaImage: () => null }));
const staff: ClubAppointment = {clubId:1,clubName:'FC Dinamo Tbilisi Academy',logoUrl:null,role:'CLUB_STAFF',title:'Academy physiotherapist',coaching:false,memberSince:'2026-01-01',biography:null,qualifications:null,squads:['U16']};
it('shows a recorded physiotherapist appointment without inventing a coaching career',()=>{
    render(<MemoryRouter><ClubAppointments appointments={[staff]}/></MemoryRouter>);
    expect(screen.getByText('Academy physiotherapist')).toBeInTheDocument();
    expect(screen.getByText('Club / academy staff')).toBeInTheDocument();
    expect(screen.queryByText('Coach')).not.toBeInTheDocument();
    expect(screen.queryByText('Coaching teams')).not.toBeInTheDocument();
    expect(screen.getByText('Assigned teams')).toBeInTheDocument();
});
it('shows coaching only when a recorded appointment actually includes that responsibility',()=>{
    render(<MemoryRouter><ClubAppointments appointments={[{...staff,title:'Youth development coach',coaching:true}]}/></MemoryRouter>);
    expect(screen.getByText('Coach')).toBeInTheDocument();
    expect(screen.getByText('Coaching teams')).toBeInTheDocument();
});
it('retains management provenance and the unverified club-provided qualification boundary',()=>{
    render(<MemoryRouter><ClubAppointments appointments={[{...staff,role:'CLUB_ADMIN',title:'Academy administrator',qualifications:'Club supplied qualification'}]}/></MemoryRouter>);
    const section=screen.getByRole('region',{name:'Current club appointments'});
    expect(within(section).getByText('Club management')).toBeInTheDocument();
    expect(within(section).getByText('Credential verification has not been recorded.')).toBeInTheDocument();
    expect(within(section).queryByText('Coach')).not.toBeInTheDocument();
});
