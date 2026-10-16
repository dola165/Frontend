import { Eye } from 'lucide-react';
import { Button } from '../../design/primitives';
import { workspaceNavEn } from '../../locales/workspaceDesign';
import { useCopy } from '../../locales/useCopy';
import './club-workspace.css';

/** One quiet line above a tool the person can read but not change, with the way to ask for more. */
export function ViewOnlyNote({ onAsk }: { onAsk?: () => void }) {
    const copy = useCopy('workspaceNav', workspaceNavEn);
    return <div className="cw-viewonly" role="note">
        <Eye aria-hidden="true" /><span>{copy('viewOnlyNote')}</span>
        {onAsk && <Button size="sm" variant="ghost" onClick={onAsk}>{copy('askAccess')}</Button>}
    </div>;
}
