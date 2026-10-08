/** Resolve a wall-clock input in its published zone; reject gaps and repeated times. */
export function competitionInstant(value:string,zone:string):Date {
 const match=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);if(!match)throw new Error('Choose a valid competition date and time.');
 const [year,month,day,hour,minute,second]=match.slice(1).map(n=>Number(n||0));const wall=Date.UTC(year,month-1,day,hour,minute,second);
 const normal=new Date(wall);if(normal.getUTCFullYear()!==year||normal.getUTCMonth()!==month-1||normal.getUTCDate()!==day||normal.getUTCHours()!==hour||normal.getUTCMinutes()!==minute||normal.getUTCSeconds()!==second)throw new Error('Choose a valid competition date and time.');
 const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const asWall=(instant:number)=>{const p=Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p=>[p.type,p.value]));return Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second));};
 const candidates=new Set<number>();for(const delta of [-86400000,0,86400000]){const probe=wall+delta;const offset=asWall(probe)-probe;const candidate=wall-offset;if(asWall(candidate)===wall)candidates.add(candidate);}
 if(candidates.size!==1)throw new Error('Choose an unambiguous time outside a daylight-saving clock change.');return new Date([...candidates][0]);
}
