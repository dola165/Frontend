import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AvatarCell} from '../../src/components/workspace/AvatarCell';
const query=new URLSearchParams(location.search),first=query.get('first')!,second=query.get('second')!;
function Fixture(){const [source,setSource]=useState(first);return <main><button onClick={()=>setSource(first)}>First</button><button onClick={()=>setSource(second)}>Second</button><button onClick={()=>setSource("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%222%22 height=%222%22/%3E")}>External</button><div data-testid="photo"><AvatarCell avatarUrl={source} fallback="Review Player"/></div></main>}
createRoot(document.getElementById('root')!).render(<Fixture/>);
