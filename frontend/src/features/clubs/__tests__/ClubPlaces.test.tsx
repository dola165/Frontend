import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { FacilityCard, type PublicFacility } from '../ClubPlaceCard';
vi.mock('../../../components/ui/MediaImage',()=>({MediaImage:(props:React.ImgHTMLAttributes<HTMLImageElement>)=><img {...props}/>}));
vi.mock('../FacilityDirectionsPanel',()=>({FacilityDirectionsPanel:()=> <div>Directions</div>}));
const place=(details:Record<string,string>,extra={}):PublicFacility=>({id:1,title:'Club campus',details:{address:'East gate',relationship:'OWNED',...details},...extra});
const show=(value:PublicFacility)=>render(<MemoryRouter><FacilityCard facility={value} clubId={1}/></MemoryRouter>);
it('keeps a playing venue useful without offering rentals or inventing a venue page',async()=>{
 show(place({placeType:'VENUE',arrival:'Meet at gate B'}));
 fireEvent.click(screen.getByRole('button',{name:'View venue'}));
 const dialog=screen.getByRole('dialog');
 expect(within(dialog).getByText('Meet at gate B')).toBeVisible();
 expect(within(dialog).queryByRole('link',{name:'Rental availability'})).not.toBeInTheDocument();
 expect(within(dialog).queryByRole('link',{name:/View venue page/})).not.toBeInTheDocument();
 fireEvent.click(within(dialog).getByRole('button',{name:'Close location details'}));
 await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('distinguishes supporting facilities and leaves old entries unclassified',()=>{
 const view=show(place({placeType:'FACILITY',description:'Medical room'}));
 expect(screen.getByText('Supporting facility')).toBeVisible();
 expect(screen.getByRole('button',{name:'View facility'})).toBeVisible();
 view.unmount();show(place({}));
 expect(screen.getByText('Club location')).toBeVisible();
 expect(screen.queryByText('Playing venue')).not.toBeInTheDocument();
});
it.each([true,false])('shows rental availability only when the linked operator enables it (%s)',bookable=>{
 show(place({placeType:'VENUE',relationship:'RENTED'},{linkedVenue:{id:9,name:'Municipal stadium',bookingAvailable:bookable}}));
 fireEvent.click(screen.getByRole('button',{name:'View venue'}));
 const dialog=screen.getByRole('dialog');
 expect(within(dialog).getByRole('link',{name:/View venue page/})).toHaveAttribute('href','/stadiums/9');
 expect(!!within(dialog).queryByRole('link',{name:/Rental availability/})).toBe(bookable);
});
