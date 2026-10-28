import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { JobPicker } from './JobPicker';
import { useJobWords } from './jobWords';
import { invitePerson, type JobDraft, type PeopleView } from './api';

const state = vi.hoisted(() => ({ language: 'en', post: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { resolvedLanguage: state.language }, t: (s: string) => s }) }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { post: state.post } }));
const choice = (key: string, title: string, family: string, titles: string[] = []) => ({ key, title, family, titles, description: '', tools: [], home: 'MY_SQUADS', views: [] });
const view: PeopleView = {
 viewer: { userId: 1, leader: true, owner: false, headCoachSquads: [5] }, people: [], nameChecks: [], tools: [],
 squads: [{id: 5, name: 'U12'}, {id: 6, name: 'U14'}],
 jobs: [choice('HEAD_COACH', 'Head coach', 'COACHING')],
 moreJobs: [choice('MEDIA_OFFICER','Media officer','CLUB'),choice('HEAD_OF_COACHING','Head of coaching','COACHING'),
 choice('SPECIALIST_COACH','Specialist coach','COACHING',['Goalkeeper coach','Conditioning coach','Tactical coach']),
 choice('ANALYST','Analyst','PERFORMANCE',['Performance analyst','Opposition analyst','Video analyst'])]
};
function Harness() {
 const [draft,setDraft]=useState<JobDraft>({job:'HEAD_COACH',title:'',tools:[],clubWide:false,squadIds:[5]});
 const {jobLabel}=useJobWords([...view.jobs,...view.moreJobs]);
 return <><JobPicker view={view} draft={draft} onChange={setDraft} choices={['HEAD_COACH']} extras /><output>{jobLabel(draft)}</output>
 <button onClick={() => void invitePerson(1,{userId:2},draft)}>Send</button></>;
}
afterEach(() => { cleanup(); state.language='en'; vi.clearAllMocks(); });
it('groups More jobs, keeps head of coaching first, and saves suggested or typed titles', async () => {
 state.post.mockResolvedValue({ data: {} }); render(<Harness />);
 fireEvent.click(screen.getByRole('button',{name:'More jobs'}));
 const select=screen.getByRole('combobox');
 expect([...select.querySelectorAll('optgroup')].map(g=>g.label)).toEqual(['Running the club','Coaching','Performance and health']);
 expect(within(screen.getByRole('group',{name:'Coaching'})).getAllByRole('option')[0]).toHaveTextContent('Head of coaching');
 fireEvent.change(select,{target:{value:'SPECIALIST_COACH'}});
 expect(screen.getByLabelText('Name of the job')).toHaveValue('Goalkeeper coach');
 expect(screen.getByRole('button',{name:'U12'})).toHaveAttribute('aria-pressed','true');
 fireEvent.click(screen.getByRole('button',{name:'Tactical coach'}));
 fireEvent.click(screen.getByRole('button',{name:'Send'}));
 expect(state.post).toHaveBeenLastCalledWith('/clubs/1/people/invites',expect.objectContaining({job:'SPECIALIST_COACH',title:'Tactical coach',clubWide:false,squadIds:[5]}));
 fireEvent.change(screen.getByLabelText('Name of the job'),{target:{value:'Individual left-foot training'}});
 expect(screen.getByRole('status')).toHaveTextContent('Individual left-foot training');
 fireEvent.change(select,{target:{value:'HEAD_OF_COACHING'}});
 fireEvent.click(screen.getByRole('button',{name:'Send'}));
 expect(state.post).toHaveBeenLastCalledWith('/clubs/1/people/invites',expect.objectContaining({job:'HEAD_OF_COACHING',clubWide:true,squadIds:[]}));
 fireEvent.change(select,{target:{value:'ANALYST'}});
 expect(screen.getByLabelText('Name of the job')).toHaveValue('Performance analyst');
});
it('localizes suggested titles while saving English and leaves typed names intact', () => {
 state.language='ka'; state.post.mockResolvedValue({data:{}}); render(<Harness />);
 fireEvent.click(screen.getByRole('button',{name:'სხვა სამუშაოები'}));
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'SPECIALIST_COACH'}});
 expect(screen.getByLabelText('სამუშაოს სახელი')).toHaveValue('მეკარეების მწვრთნელი');
 fireEvent.click(screen.getByRole('button',{name:'Send'}));
 expect(state.post).toHaveBeenLastCalledWith('/clubs/1/people/invites',expect.objectContaining({title:'Goalkeeper coach'}));
 fireEvent.change(screen.getByLabelText('სამუშაოს სახელი'),{target:{value:'ჩემი სახელწოდება'}});
 expect(screen.getByRole('status')).toHaveTextContent('ჩემი სახელწოდება');
});
