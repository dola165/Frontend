vi.mock('../../features/venues/VenueCalendar',()=>({VenueCalendar:()=>null}));
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { StadiumProfilePage } from '../StadiumProfilePage';
import { fetchVenue, type Venue } from '../../features/venues/api';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

vi.mock('../../context/AuthContext', () => ({useAuth: () => ({sessionId:'owner'})}));
vi.mock('../../features/venues/api', async () => ({...await vi.importActual('../../features/venues/api'),fetchVenue:vi.fn()}));
vi.mock('../../features/venues/VenueMap', () => ({VenueMap: () => null}));
vi.mock('../../components/ui/MediaImage', () => ({MediaImage: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props}/>}));
const venue: Venue = {id:22,revision:1,displayName:'Riverside Football',description:'A place for teams',city:'Tbilisi',addressText:'Main entrance',latitude:41,longitude:44,timezone:'Asia/Tbilisi',currency:'GEL',publicPhone:'555000111',publicEmail:'',website:'',bookingMode:'REQUEST',published:false,cancellationHours:24,minBookingMinutes:60,maxBookingMinutes:180,slotMinutes:30,amenities:[],photos:[],openingHours:[],canManage:true,verificationStatus:'UNVERIFIED',pitches:[{id:9,revision:1,name:'Main pitch',photoUrl:'/uploads/pitch.jpg',format:'5_A_SIDE',surface:'ARTIFICIAL_GRASS',covered:false,pricePerHour:80,active:true,resourceGroup:'main',resourceUnits:['all']},{id:10,revision:1,name:'Maintenance pitch',format:'5_A_SIDE',surface:'ARTIFICIAL_GRASS',covered:false,pricePerHour:80,active:false,resourceGroup:'other',resourceUnits:['all']}]};
beforeEach(() => {vi.clearAllMocks(); vi.mocked(fetchVenue).mockResolvedValue(venue); vi.spyOn(window,'scrollTo').mockImplementation(() => {});});
function open(){return render(<MemoryRouter initialEntries={['/stadiums/22#pitch-9']}><Routes><Route path="/stadiums/:organizationId" element={<StadiumProfilePage/>}/></Routes></MemoryRouter>);}
it('shows a saved pitch photo at its linked section and keeps private availability closed', async () => {
  open();
  expect(await screen.findByRole('heading',{name:'Main pitch'})).toBeVisible();
  expect(screen.getByAltText('Main pitch')).toHaveAttribute('src',resolveMediaUrl('/uploads/pitch.jpg'));
  expect(document.getElementById('pitch-9')).toHaveTextContent('Main pitch');
  expect(screen.queryByRole('link',{name:'See times for this pitch'})).not.toBeInTheDocument();
  expect(screen.queryByRole('heading',{name:'Maintenance pitch'})).not.toBeInTheDocument();
  expect(screen.getByText(/Private preview/)).toBeVisible();
});
it('keeps workspace and draft controls off the published visitor page', async () => {
  vi.mocked(fetchVenue).mockResolvedValue({...venue,published:true,canManage:false});
  open();
  await screen.findByRole('heading',{name:'Main pitch'});
  expect(screen.queryByRole('link',{name:'Manage stadium'})).not.toBeInTheDocument();
  expect(screen.queryByText(/Private preview/)).not.toBeInTheDocument();
});

it('passes the selected published pitch to availability only with the venue activity enabled',async()=>{
  vi.mocked(fetchVenue).mockResolvedValue({...venue,published:true,capabilities:{enabledActivities:['PROFILE','VENUE'],revision:1,venueAvailable:true,canConfigureActivities:false,canEditProfile:false,canConfigureVenue:false,canManageVenueBookings:false,canCreateTournament:false,canInviteVenueOperator:false}});
  open();await screen.findByRole('heading',{name:'Main pitch'});
  expect(screen.getByRole('link',{name:'See times for this pitch'})).toHaveAttribute('href','/stadiums/22?book=1&pitch=9');
});
