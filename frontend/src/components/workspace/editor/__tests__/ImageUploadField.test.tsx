import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { ImageUploadField } from '../ImageUploadField';
import { apiClient } from '../../../../api/axiosConfig';
vi.mock('../../../../api/axiosConfig',()=>({apiClient:{post:vi.fn()},DEPLOYMENT_URLS:{mediaBaseUrl:'http://localhost'}}));
vi.mock('../../../ui/MediaImage',()=>({MediaImage:({src,alt}:{src:string;alt:string})=><img src={src} alt={alt}/> }));
afterEach(()=>{cleanup();vi.resetAllMocks();});
const file=()=>new File(['png'],'ground.png',{type:'image/png'});
it('keeps completed uploads when a later file fails, and allows draft removal',async()=>{
 const change=vi.fn(),busy=vi.fn();
 vi.mocked(apiClient.post).mockResolvedValueOnce({data:{url:'/uploads/first.jpg'}}).mockRejectedValueOnce(new Error('offline'));
 function Form(){const [images,setImages]=useState<string[]>([]);return <ImageUploadField label="Facility photos" images={images} onChange={v=>{setImages(v);change(v);}} onBusyChange={busy}/>;}
 render(<Form/>);fireEvent.change(screen.getByLabelText('Facility photos',{selector:'input'}),{target:{files:[file(),file()]}});
 await waitFor(()=>expect(busy).toHaveBeenLastCalledWith(false));
 expect(change).toHaveBeenLastCalledWith(['/uploads/first.jpg']);expect(screen.getByRole('alert')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Remove facility photos 1'}));expect(change).toHaveBeenLastCalledWith([]);
});
it('locks edits during upload and preserves the original logo until replacement succeeds',async()=>{
 let resolve!:(value:unknown)=>void;vi.mocked(apiClient.post).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 const change=vi.fn(),busy=vi.fn();render(<ImageUploadField label="Sponsor logo" images={['/uploads/old.jpg']} max={1} context="logo" onChange={change} onBusyChange={busy}/>);
 fireEvent.change(screen.getByLabelText('Sponsor logo',{selector:'input'}),{target:{files:[file()]}});
 expect(screen.getByRole('button',{name:'Remove sponsor logo 1'})).toBeDisabled();expect(change).not.toHaveBeenCalled();
 await act(async()=>resolve({data:{url:'/uploads/new.jpg'}}));expect(change).toHaveBeenCalledWith(['/uploads/new.jpg']);expect(busy.mock.calls).toEqual([[true],[false]]);
});
it('rejects unsupported files before making an upload request',()=>{
 render(<ImageUploadField label="Facility photos" images={[]} onChange={vi.fn()} onBusyChange={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('Facility photos',{selector:'input'}),{target:{files:[new File(['svg'],'bad.svg',{type:'image/svg+xml'})]}});
 expect(apiClient.post).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toBeVisible();
});
