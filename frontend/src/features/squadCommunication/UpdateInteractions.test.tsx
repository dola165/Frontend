import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {UpdateInteractions} from './UpdateInteractions';
import * as api from './api';
vi.mock('./api',()=>({setReaction:vi.fn(),updateComments:vi.fn(),addUpdateComment:vi.fn(),removeUpdateComment:vi.fn()}));
const space={id:171,viewer_id:10,can_manage:false} as api.SquadOverview;
const message={id:5,important:true,acknowledged_by:[{user_id:10,full_name:'Mariam Dolidze',acknowledged_at:'2026-09-17T10:00:00Z'}],reactions:[{user_id:10,full_name:'Mariam Dolidze',reaction:'HEART'}],comment_count:0} as api.SquadMessage;
beforeEach(()=>{vi.resetAllMocks();vi.mocked(api.updateComments).mockResolvedValue([]);});
it('reveals acknowledged names on hover, keyboard focus and tap, with Escape dismissal',()=>{
 render(<UpdateInteractions space={space} message={message} onChanged={vi.fn()}/>);
 const trigger=screen.getByRole('button',{name:'Acknowledged by 1 person'});
 expect(screen.queryByRole('region',{name:'People who acknowledged'})).not.toBeInTheDocument();
 fireEvent.mouseEnter(trigger.parentElement!);expect(screen.getByRole('region')).toHaveTextContent('Mariam Dolidze');
 fireEvent.mouseLeave(trigger.parentElement!);expect(screen.queryByRole('region')).not.toBeInTheDocument();
 fireEvent.focus(trigger);expect(screen.getByRole('region')).toBeVisible();fireEvent.keyDown(trigger,{key:'Escape'});expect(screen.queryByRole('region')).not.toBeInTheDocument();
 fireEvent.click(trigger);expect(screen.getByRole('region')).toBeVisible();fireEvent.click(trigger);expect(screen.queryByRole('region')).not.toBeInTheDocument();
});
it('removes only the viewer reaction and leaves acknowledgement untouched',async()=>{
 const changed=vi.fn();vi.mocked(api.setReaction).mockResolvedValue({} as never);
 render(<UpdateInteractions space={space} message={message} onChanged={changed}/>);
 const heart=screen.getByRole('button',{name:'Heart, 1 reaction'});expect(heart).toHaveAttribute('aria-pressed','true');
 expect(heart).toHaveAttribute('title','Heart: Mariam Dolidze');fireEvent.click(heart);
 await waitFor(()=>expect(changed).toHaveBeenCalledOnce());expect(api.setReaction).toHaveBeenCalledExactlyOnceWith(171,5,'HEART',false);
 expect(screen.getByRole('button',{name:'Acknowledged by 1 person'})).toBeVisible();
});
it('offers eight reactions and reports failures without changing the saved selection',async()=>{
 vi.mocked(api.setReaction).mockRejectedValue(new Error('Offline'));
 render(<UpdateInteractions space={space} message={message} onChanged={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Add a reaction'}));expect(screen.getByRole('group',{name:'Choose a reaction'}).querySelectorAll('button')).toHaveLength(8);
 fireEvent.click(screen.getByRole('button',{name:'Celebrate'}));await screen.findByRole('alert');
 expect(screen.getByRole('button',{name:'Heart, 1 reaction'})).toHaveAttribute('aria-pressed','true');
});
it('retains a comment draft across collapse and failed retry, then clears after success',async()=>{
 vi.mocked(api.addUpdateComment).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({} as never);
 render(<UpdateInteractions space={space} message={message} onChanged={vi.fn()}/>);
 const toggle=screen.getByRole('button',{name:'0 comments'});fireEvent.click(toggle);
 const draft=await screen.findByRole('textbox',{name:'Write a comment on this update'});fireEvent.change(draft,{target:{value:'Thanks coach'}});
 fireEvent.click(toggle);fireEvent.click(toggle);expect(draft).toHaveValue('Thanks coach');
 fireEvent.click(screen.getByRole('button',{name:'Comment'}));await screen.findByRole('alert');expect(draft).toHaveValue('Thanks coach');
 fireEvent.click(screen.getByRole('button',{name:'Comment'}));await waitFor(()=>expect(draft).toHaveValue(''));
 expect(vi.mocked(api.addUpdateComment).mock.calls[0]).toEqual(vi.mocked(api.addUpdateComment).mock.calls[1]);
});
