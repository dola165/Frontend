import { useState } from 'react';
import { Dialog } from '../../design/Dialog';
import { Button, GkRoot } from '../../design/primitives';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import { AddMyParent } from './AddMyParent';

/** One button where a screen asks a teen for a parent; the link and its QR open in a dialog so the screen stays the screen. */
export function AddMyParentButton() {
    const copy = useJourneyCopy();
    const [open, setOpen] = useState(false);
    const title = copy('Add your parent', 'დაამატეთ მშობელი');
    return <GkRoot>
        <Button variant="primary" onClick={() => setOpen(true)}>{title}</Button>
        {open && <Dialog open size="sm" title={title} onClose={() => setOpen(false)}><AddMyParent waiting={false} /></Dialog>}
    </GkRoot>;
}
