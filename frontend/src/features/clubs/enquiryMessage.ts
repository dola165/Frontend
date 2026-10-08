export const enquiryReasons=['Arrange a first visit','Ask about availability','Training timetable','Fees and what is included','Other question'] as const;
export function parseClubEnquiry(text:string) {
 const lines=text.split('\n');if(!lines[0]?.startsWith('Enquiry: ')||!lines[1]||!lines[2])return null;
 let url:URL;try{url=new URL(lines[2]);}catch{return null;}
 if(![window.location.origin,'https://app.grasskickz.com'].includes(url.origin)||url.username||url.password||!/^\/clubs\/[1-9]\d*$/.test(url.pathname)||url.searchParams.get('tab')!=='teams')return null;
 const programme=url.searchParams.get('programme'),squad=url.searchParams.get('squad');
 if(!/^[1-9]\d*$/.test(programme??squad??''))return null;
 let index=3,reason:string|null=null,age:string|null=null;
 if(lines[index]?.startsWith('Reason: ')){const value=lines[index].slice(8);if(!enquiryReasons.some(r=>r===value))return null;reason=value;index++;}
 if(lines[index]?.startsWith('Player age: ')){const value=lines[index].slice(12);if(!/^\d{1,2}$/.test(value)||+value<3)return null;age=value;index++;}
 if(lines[index]!=='')return null;
 const body=lines.slice(index+1).join('\n');if(!body.trim())return null;
 const query=new URLSearchParams({tab:'teams',[programme?'programme':'squad']:programme??squad!});
 return {name:lines[0].slice(9),club:lines[1],reason,age,body,path:url.pathname+'?'+query,kind:programme?'programme':'team'};
}

type EnquiryDraft = { reason:string; programme:string; club:string; path:string; player?:string; self?:boolean; contact?:string; venue?:string; note:string };
export function clubEnquiryIntro(draft:EnquiryDraft) {
 const hello=draft.contact?`Hello ${draft.contact},`:'Hello,';
 const subject=draft.player?(draft.self?` for myself (${draft.player})`:` for my child, ${draft.player}`):'';
 const request=draft.reason==='Arrange a first visit'?`I would like to arrange a first training visit${subject} with ${draft.programme} at ${draft.club}.`:`I would like to ask about ${draft.programme} at ${draft.club}${subject}.`;
 return `${hello} ${request}${draft.venue?` Our preferred venue is ${draft.venue}.`:''}`;
}
export function buildClubEnquiry(draft:EnquiryDraft) {
 const singleLine=(value:string)=>value.replace(/[\r\n]+/g,' ').trim();
 const reason=enquiryReasons.some(value=>value===draft.reason)?`Reason: ${draft.reason}\n`:'';
 return `Enquiry: ${singleLine(draft.programme)}\n${singleLine(draft.club)}\n${new URL(draft.path,window.location.origin).href}\n${reason}\n${clubEnquiryIntro(draft)}${draft.note.trim()?`\n\n${draft.note.trim()}`:''}`;
}
