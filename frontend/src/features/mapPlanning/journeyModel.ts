import type { FamilyItinerary, PlanDraft } from './api';

/** The draft as families would receive it: no staff notes, participants or costs. */
export function draftItinerary(draft:PlanDraft):FamilyItinerary {
    const publicPlace=(p:PlanDraft['places'][number])=>({name:p.name,address:p.address,latitude:p.latitude,longitude:p.longitude,photoUrl:p.photoUrl});
    return {title:draft.title,timezone:draft.timezone,startsAt:draft.startsAt,endsAt:draft.endsAt,destination:draft.destination,meetingPoint:draft.meetingPoint,collectionPoint:draft.collectionPoint,supervisionContact:draft.supervisionContact,message:draft.familyMessage,
        locations:Object.fromEntries(draft.places.filter(p=>/^plan:(meeting|destination|collection)$/.test(p.key)).map(p=>[p.key.slice(5),publicPlace(p)])),
        activities:draft.activities.map(a=>({title:a.title,kind:a.kind,startsAt:a.startsAt,endsAt:a.endsAt,place:draft.places.find(p=>p.key===a.placeKey)?publicPlace(draft.places.find(p=>p.key===a.placeKey)!):null})),
        arrangements:draft.arrangements.map(a=>({kind:a.kind,title:a.title,place:draft.places.find(p=>p.key===a.placeKey)?.name||''})),bring:draft.bring??[]};
}
