import { useEffect,useRef,useState } from 'react';
import { Camera,ImagePlus,MapPin,X } from 'lucide-react';
import { MediaImage } from '../../components/ui/MediaImage';
import { apiClient } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';

export function PlacePhoto({url,name,compact=false}:{url?:string|null;name:string;compact?:boolean}) {
    const [failed,setFailed]=useState<string|null>(null);
    return <div className={`trip-photo ${compact?'trip-photo--compact':''}`}>
        {url&&failed!==url?<MediaImage src={url} alt={name} loading="lazy" onError={()=>setFailed(url)}/>:<div className="trip-photo-placeholder"><span className="trip-photo-contours" aria-hidden="true"/><MapPin size={compact?20:34}/>{!compact&&<><strong>{name}</strong><span><Camera size={12}/>{url?'Photo unavailable':'Place photo not added'}</span></>}</div>}
    </div>;
}
export function PlacePhotoEditor({url,name,onChange}:{url?:string|null;name:string;onChange:(url:string|null)=>void}) {
    const [busy,setBusy]=useState(false),[error,setError]=useState('');
    const latest=useRef(onChange),controller=useRef<AbortController|null>(null);
    useEffect(()=>{latest.current=onChange;},[onChange]);
    useEffect(()=>()=>controller.current?.abort(),[]);
    const upload=async(file:File)=>{
        if(busy)return;if(file.size>5*1024*1024){setError('Choose a place photo up to 5 MB.');return;}
        const request=new AbortController();controller.current=request;setBusy(true);setError('');
        try {const form=new FormData();form.append('file',file);form.append('context','general');const {data}=await apiClient.post<{url:string}>('/media/upload',form,{signal:request.signal});if(!request.signal.aborted)latest.current(data.url);}
        catch(e){if(!request.signal.aborted)setError(extractApiErrorMessage(e,'The photo could not upload. Please retry.'));}
        finally{if(!request.signal.aborted)setBusy(false);}
    };
    return <div className="trip-photo-editor">{url&&<PlacePhoto url={url} name={name}/>}<div className="mp-actions"><label className="mp-secondary"><ImagePlus size={15}/>{busy?'Uploading…':url?'Replace place photo':'Add place photo'}<input aria-label={`Photo for ${name}`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value='';}}/></label>{url&&<button type="button" className="mp-link" disabled={busy} onClick={()=>onChange(null)}><X size={14}/>Remove photo</button>}</div><small>Shared with this journey when you publish. Use a photo of the place.</small>{error&&<p role="alert">{error}</p>}</div>;
}
