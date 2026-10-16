import type { ReactNode } from 'react';
import { Dialog } from '../../../design/Dialog';
import { usePagesCopy } from '../copy';
import './edit.css';

/**
 * Where choosing needs room: the choices on the left and the live result on the right (split screen on a desktop,
 * one column on a phone, where the Dialog is already a bottom sheet). Focus moves in and returns when it closes.
 */
export function SplitPanel({ title, description, onClose, footer, preview, wide, children }: { title: ReactNode; description?: ReactNode; onClose: () => void; footer?: ReactNode; preview?: ReactNode; /** One wide column, without a preview (the grounds map across the top). */ wide?: boolean; children: ReactNode }) {
  const t = usePagesCopy();
  return (
    <Dialog open size={preview || wide ? 'lg' : 'md'} title={title} description={description} onClose={onClose} closeLabel={t('Close')} footer={footer}>
      {preview ? <div className="gk-split"><div className="gk-split__choices">{children}</div><div className="gk-split__preview">{preview}</div></div> : children}
    </Dialog>
  );
}
