import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MediaImage} from '../src/components/ui/MediaImage';
import {apiClient} from '../src/api/axiosConfig';
import {clearStoredAuth} from '../src/utils/authStorage';
function Fixture(){
 const [url,setUrl]=useState(new URLSearchParams(location.search).get('image') || '');
 return <main><h1>Media delivery check</h1><label>Upload image<input type="file" onChange={async event=>{const file=event.target.files?.[0];if(file){const data=new FormData();data.append('file',file);const result=await apiClient.post('/media/upload?context=profile',data);setUrl(result.data.url);}}}/></label><output>{url}</output><MediaImage src={url} alt="Uploaded photo" style={{width:200,height:200,objectFit:'contain'}}/><button onClick={clearStoredAuth}>Sign out</button></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
