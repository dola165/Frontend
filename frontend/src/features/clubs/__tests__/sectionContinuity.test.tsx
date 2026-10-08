import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ClubSectionPanels } from '../ClubSectionPanels';
import { useClubProfileSearchParams } from '../clubProfilePreviewContext';
import type { ClubTab } from '../../../pages/ClubProfilePage';

it('keeps visited sections mounted with their own query and control state', () => {
 const mounted=vi.fn();
 function Panel(){const [params]=useClubProfileSearchParams();const [text,setText]=useState('');useEffect(()=>{mounted();},[]);return <><p>Squad {params.get('squad')}</p><input aria-label="Section search" value={text} onChange={e=>setText(e.target.value)}/></>;}
 function Page(){const [params,setParams]=useSearchParams();return <><button onClick={()=>setParams('tab=teams&squad=9')}>Teams</button><button onClick={()=>setParams('tab=people&squad=3')}>People</button><ClubSectionPanels activeTab={(params.get('tab')??'teams') as ClubTab}>{()=> <Panel/>}</ClubSectionPanels></>;}
 render(<MemoryRouter initialEntries={['/?tab=teams&squad=9']}><Page/></MemoryRouter>);
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'Remember this'}});
 fireEvent.click(screen.getByRole('button',{name:'People'}));expect(screen.getByText('Squad 3')).toBeVisible();expect(screen.getByText('Squad 9')).not.toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Teams'}));expect(screen.getByRole('textbox')).toHaveValue('Remember this');expect(mounted).toHaveBeenCalledTimes(2);
});
