import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';
import { get, root } from './api';
interface Document { id:number;file_name:string;bytes:number;created_at:string }
export function RecordDocuments({club,record,canUpload}:{club:number;record:number;canUpload:boolean}) {
  const [items,setItems]=useState<Document[]>([]),[refresh,setRefresh]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');const input=useRef<HTMLInputElement>(null);
  const path=`${root(club)}/records/${record}/documents`;
  useEffect(()=>{const c=new AbortController();void get<Document[]>(path,c.signal).then(setItems).catch(()=>{if(!c.signal.aborted)setError('Could not load supporting documents.');});return()=>c.abort();},[path,refresh]);
  const upload=async(file:File)=>{setError('');if(file.size>5*1024*1024){setError('Choose a PDF or image up to 5 MB.');return;}setBusy(true);try{const body=new FormData();body.append('file',file);await apiClient.post(path,body);setRefresh(v=>v+1);if(input.current)input.current.value='';}catch(e){setError(extractApiErrorMessage(e,'Could not upload the document.'));}finally{setBusy(false);}};
  const download=async(d:Document)=>{setError('');try{const response=await apiClient.get(`${path}/${d.id}`,{responseType:'blob'});const url=URL.createObjectURL(response.data as Blob);const link=document.createElement('a');link.href=url;link.download=d.file_name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError(extractApiErrorMessage(e,'Could not download this document.'));}};
  return <details className="workspace-record-documents"><summary>Supporting documents <span>{items.length}</span></summary><p className="ops-muted">Only people with access to this record can open its documents. PDF, PNG or JPEG; up to 5 MB.</p>{error&&<p className="ops-alert" role="alert">{error}</p>}<div className="ops-list">{items.map(d=><button key={d.id} onClick={()=>{void download(d);}}><span>{d.file_name}</span><span className="ops-muted">{Math.ceil(d.bytes/1024)} KB · Download</span></button>)}</div>{canUpload&&<div className="ops-footer"><input aria-label="Supporting document" ref={input} hidden disabled={busy} type="file" accept="application/pdf,image/png,image/jpeg" onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);}}/><button type="button" disabled={busy} onClick={()=>input.current?.click()}>{busy?'Uploading…':'Add a document'}</button></div>}</details>;
}
