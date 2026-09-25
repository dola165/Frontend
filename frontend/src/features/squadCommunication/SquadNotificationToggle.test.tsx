import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, expect, it, vi} from 'vitest';
import {SquadNotificationToggle} from './SquadNotificationToggle';
import {setChatNotifications} from './api';

vi.mock('./api',()=>({setChatNotifications:vi.fn()}));
beforeEach(()=>vi.resetAllMocks());

it('responds immediately, prevents duplicate saves, and refreshes after success',async()=>{
    let finish!:()=>void;
    vi.mocked(setChatNotifications).mockReturnValue(new Promise(resolve=>{finish=()=>resolve({} as never);}));
    const saved=vi.fn();render(<SquadNotificationToggle id={171} enabled onSaved={saved}/>);
    const toggle=screen.getByRole('switch',{name:'Squad chat notifications'});
    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();expect(toggle).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Saving');
    expect(setChatNotifications).toHaveBeenCalledExactlyOnceWith(171,false);
    finish();await waitFor(()=>expect(saved).toHaveBeenCalledOnce());
    expect(toggle).not.toBeDisabled();expect(screen.getByRole('status')).toHaveTextContent('off');
});
it('rolls back a failed preference change and explains that it was not saved',async()=>{
    vi.mocked(setChatNotifications).mockRejectedValue(new Error('Offline'));
    const saved=vi.fn();render(<SquadNotificationToggle id={171} enabled onSaved={saved}/>);
    fireEvent.click(screen.getByRole('switch'));
    await screen.findByRole('alert');
    expect(screen.getByRole('switch')).toBeChecked();expect(saved).not.toHaveBeenCalled();
});
