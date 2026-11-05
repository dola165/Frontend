import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useSearchParams } from 'react-router-dom';
import '../src/i18n';
import '../src/index.css';
import { applyDocumentTheme } from '../src/theme';
import { WorldLayout } from '../src/features/world/WorldLayout';
import { WorldSessionProvider } from '../src/features/world/WorldSessionProvider';
import ClubsDirectory from '../src/features/world/directories/ClubsDirectory';
import OpportunitiesDirectory from '../src/features/world/directories/OpportunitiesDirectory';
import TournamentsDirectory from '../src/features/world/directories/TournamentsDirectory';
import MatchesDirectory from '../src/features/world/directories/MatchesDirectory';
import PeopleDirectory from '../src/features/world/directories/PeopleDirectory';
import ClubFinder from '../src/features/world/finder/ClubFinder';
import { GkRoot, ButtonLink } from '../src/design/primitives';
import type { JoiningChild } from '../src/features/joining-contract/types';
import { fetchNotifications } from '../src/api/notifications';
import { buildNotificationDestination } from '../src/utils/notifications';
import type { NotificationItem } from '../src/types/notifications';
const families=[{playerId:9,identity:{fullName:'Synthetic Child',dateOfBirth:'2018-12-30',gender:'FEMALE'},clubs:[],currentAffiliation:null}] as unknown as JoiningChild[];
function Parent(){const [p]=useSearchParams();return <GkRoot><h1>Synthetic family fixture</h1><ButtonLink to="/parent?find=club&player=9&near=Tbilisi">Find a club</ButtonLink>{p.get('find')==='club'&&<ClubFinder families={families} onChanged={()=>{}}/>}</GkRoot>;}
function Inbox(){const [items,setItems]=useState<NotificationItem[]>([]);useEffect(()=>{void fetchNotifications().then(page=>setItems(page.content));},[]);return <GkRoot><h1>Synthetic notification fixture</h1>{items.map(item=><Link key={item.id} to={buildNotificationDestination(item)}>Open World search notice</Link>)}</GkRoot>;}
applyDocumentTheme(localStorage.getItem('world-fixture-theme')==='dark'?'dark':'light');
createRoot(document.getElementById('root')!).render(<BrowserRouter><WorldSessionProvider>
    <Routes><Route path="/world" element={<WorldLayout/>}><Route path="clubs" element={<ClubsDirectory/>}/><Route path="opportunities" element={<OpportunitiesDirectory/>}/><Route path="tournaments" element={<TournamentsDirectory/>}/><Route path="matches" element={<MatchesDirectory/>}/><Route path="people" element={<PeopleDirectory/>}/></Route>
        <Route path="/parent" element={<Parent/>}/><Route path="/fixture-inbox" element={<Inbox/>}/><Route path="*" element={<Link to="/world/clubs?near=Tbilisi">World fixture</Link>}/></Routes>
</WorldSessionProvider></BrowserRouter>);
