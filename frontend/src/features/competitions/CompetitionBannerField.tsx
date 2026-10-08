import {useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {apiClient} from '../../api/axiosConfig';
import {MediaImage} from '../../components/ui/MediaImage';
import {extractApiErrorMessage} from '../../utils/apiError';
export function CompetitionBannerField({value,onChange,disabled,onBusy}:{value:string;onChange:(value:string)=>void;disabled:boolean;onBusy:(value:boolean)=>void}){
 const {i18n}=useTranslation();const copy=(en:string,ka:string)=>i18n.language.startsWith('ka')?ka:en;
 useEffect(()=>()=>{serial.current++;},[]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const serial=useRef(0);
 async function upload(file:File){const attempt=++serial.current;setBusy(true);onBusy(true);setError('');const body=new FormData();body.append('file',file);try{const result=await apiClient.post<{url:string}>('/media/upload',body);if(serial.current===attempt)onChange(result.data.url);}catch(e){if(serial.current===attempt)setError(extractApiErrorMessage(e,'Could not upload the competition image.'));}finally{if(serial.current===attempt){setBusy(false);onBusy(false);}}}
 return <fieldset className="mc-rule-form" disabled={disabled||busy}><legend>{copy('Competition image','შეჯიბრების სურათი')}</legend>{value&&<MediaImage src={value} alt={copy('Competition image preview','შეჯიბრების სურათის გადახედვა')} className="mc-banner-preview"/>}<label>{copy('Upload an image you have permission to use','ატვირთეთ სურათი, რომლის გამოყენების უფლებაც გაქვთ')}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);}}/></label>{value&&<button type="button" onClick={()=>{serial.current++;onChange('');}}>{copy('Remove image','სურათის მოხსნა')}</button>}{busy&&<p role="status">{copy('Uploading image…','სურათი იტვირთება…')}</p>}{error&&<p role="alert">{error}</p>}</fieldset>;
}
