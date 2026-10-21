export interface CommandIntent { key:string; requestId:string; revision:number }
export function readIntent(key:string):CommandIntent|undefined {
  try {const value:unknown=JSON.parse(sessionStorage.getItem(key)||'null');if(value&&typeof value==='object'&&'key' in value&&typeof value.key==='string'&&value.key.length<=30000&&'requestId' in value&&typeof value.requestId==='string'&&/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value.requestId)&&'revision' in value&&Number.isSafeInteger(value.revision)&&Number(value.revision)>=0)return value as CommandIntent;}catch{/* Storage may be unavailable; in-memory retries still work. */}
}
export function writeIntent(key:string,value:CommandIntent|undefined){try{if(value)sessionStorage.setItem(key,JSON.stringify(value));else sessionStorage.removeItem(key);window.dispatchEvent(new Event('competition-intent'));}catch{/* Preserve the in-memory intent if browser storage is unavailable. */}}
export function readPendingCommands(scope:string){
 const output:{path:string;body:Record<string,unknown>;revision:number;requestId:string}[]=[];
 try{for(let index=0;index<sessionStorage.length;index++){const key=sessionStorage.key(index);if(!key?.startsWith(scope+':'))continue;const intent=readIntent(key);if(!intent)continue;const submitted=JSON.parse(intent.key);if(submitted.scope===scope&&typeof submitted.path==='string'&&submitted.body&&typeof submitted.body==='object'&&!Array.isArray(submitted.body)&&key===`${scope}:${submitted.path}`)output.push({...submitted,revision:intent.revision,requestId:intent.requestId});}}catch{/* A broken or unavailable journal must never trigger a command. */}return output;
}
