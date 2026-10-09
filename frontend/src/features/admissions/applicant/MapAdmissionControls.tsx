import './map-admissions.css';
import { useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { fetchAdmissionHome } from '../api';
import { useAdmissionData } from './useAdmissionData';
import { useAdmissionCopy } from './copy';
import { playerPath, usePlayerSelection } from '../../parents/playerSelection';
export function MapAdmissionControls({playerId,requestedPlayerId,onPlayer,includeWaitlist,onWaitlist}:{playerId:number|undefined;requestedPlayerId?:number;onPlayer:(id:number|undefined,birthYear:number|undefined,gender?:'MALE'|'FEMALE'|null,minor?:boolean)=>void;includeWaitlist:boolean;onWaitlist:(value:boolean)=>void}) {
    const {isAuthenticated,sessionId}=useAuth();const {copy}=useAdmissionCopy();
    const {requestedPlayerId:rememberedPlayer,selectPlayer}=usePlayerSelection();
    const requested=requestedPlayerId??rememberedPlayer;
    const home=useAdmissionData(useCallback(signal=>isAuthenticated?fetchAdmissionHome(sessionId,signal):Promise.resolve({participants:[],cases:[]}),[isAuthenticated,sessionId]),isAuthenticated?sessionId:undefined);
    const onPlayerRef=useRef(onPlayer);
    useEffect(()=>{onPlayerRef.current=onPlayer;},[onPlayer]);
    useEffect(()=>{
        if(requested===undefined||!isAuthenticated||home.loading)return;
        // A deep link chooses context only after the current account can read that card.
        const p=home.error?undefined:home.data?.participants.find(p=>p.id===requested&&p.dateOfBirth);
        onPlayerRef.current(p?.id,p?.dateOfBirth?Number(p.dateOfBirth.slice(0,4)):undefined,p?.gender,p?.minor);
    },[requested,isAuthenticated,home.loading,home.error,home.data]);
    return <section className="admission-map-entry"><Link to={playerPath("/clubs",playerId)}>{copy('Browse the club directory','კლუბების კატალოგის ნახვა')} →</Link>
        {isAuthenticated&&!home.error&&<label className="map-simple-label">{copy('Find a group for','ჯგუფის მოძებნა მოთამაშისთვის')}<select className="map-simple-select" value={home.data?.participants.some(p=>p.id===playerId)?playerId:''} onChange={e=>{const p=home.data?.participants.find(p=>p.id===Number(e.target.value));selectPlayer(p?.id);onPlayer(p?.id,p?.dateOfBirth?Number(p.dateOfBirth.slice(0,4)):undefined,p?.gender,p?.minor);}}><option value="">{copy('Anyone','ყველა')}</option>{home.data?.participants.filter(p=>p.dateOfBirth).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
        <label className="map-simple-check"><span>{copy('Include waiting lists','მოლოდინის სიების ჩათვლით')}</span><input type="checkbox" checked={includeWaitlist} onChange={e=>onWaitlist(e.target.checked)}/></label>
        <p>{copy('Accepting players includes places, applications, introductory sessions and assessments. Waiting-only groups need the option above. Pins use the actual training venue; a selected child stays private.','მიღება მოიცავს ადგილებს, განაცხადებს, გაცნობით სესიებსა და შეფასებებს. მოლოდინის ჯგუფებისთვის ჩართეთ ზემოთ მოცემული არჩევანი. ნიშნული რეალურ ადგილს იყენებს; არჩეული ბავშვი პირადი რჩება.')}</p>
        {home.error&&<p role="alert">{copy('Player cards could not be loaded. Use Joining football to refresh them.','მოთამაშის ბარათები ვერ ჩაიტვირთა. განაახლეთ „ფეხბურთში მონაწილეობაში“.')}</p>}
    </section>;
}
