import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog } from '../../../design/Dialog';
import { Button } from '../../../design/primitives';
import { deletePage, type PageView } from '../api';
import { usePagesCopy } from '../copy';

/**
 * Cancel the creation: the owner deletes a draft (and the club and teams it made) from the bar's corner, after one
 * confirmation that names it. A live page is never deleted from here.
 */
export function DeleteDraft({ page }: { page: PageView }) {
  const t = usePagesCopy();
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (page.status !== 'DRAFT' || page.viewer.role !== 'OWNER') return null;
  const remove = async () => {
    setBusy(true);
    try {
      await deletePage(page.ref);
      try { localStorage.removeItem(`gk-pet-skipped:${window.location.pathname}`); } catch { /* nothing remembered */ }
      toast(t('{name} is deleted.', { name: page.identity.name }));
      navigate('/home', { replace: true });
    } catch {
      toast.error(t('The draft could not be deleted. Try again.'));
      setBusy(false);
    }
  };
  return (
    <>
      <Button size="sm" variant="ghost" className="gk-editbar__delete" onClick={() => setAsking(true)}><Trash2 aria-hidden="true" />{t('Delete draft')}</Button>
      <Dialog open={asking} size="sm" role="alertdialog" title={t('Delete {name}?', { name: page.identity.name })} description={t('The draft and its teams are gone for good. Nobody has seen it yet.')} onClose={() => setAsking(false)} closeLabel={t('Close')}
        footer={<><Button variant="ghost" onClick={() => setAsking(false)}>{t('Keep it')}</Button><Button variant="danger" disabled={busy} onClick={() => void remove()}>{t('Delete')}</Button></>} />
    </>
  );
}
