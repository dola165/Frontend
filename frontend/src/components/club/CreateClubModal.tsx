import { Link } from 'react-router-dom';
interface CreateClubModalProps { isOpen: boolean; onClose: () => void; onCreated: (clubId: number) => void }
/** Legacy callers keep their props while using the complete organization setup flow. */
export const CreateClubModal = ({ isOpen, onClose }: CreateClubModalProps) => isOpen ? (
  <div role="dialog" aria-modal="true" aria-labelledby="create-club-title" className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--color-overlay)]/70 p-4">
    <section className="max-w-lg rounded-2xl border border-subtle bg-elevated p-6 text-primary">
      <h2 id="create-club-title" className="text-2xl font-bold">Create a club or academy</h2>
      <p className="my-4">Choose your club category, complete its profile and open its workspace from the organization setup flow.</p>
      <div className="flex gap-4"><Link to="/organizations/create?kind=CLUB" onClick={onClose} className="rounded-lg bg-[color:var(--color-accent)] px-4 py-3 font-semibold text-[color:var(--color-on-accent)]">Start club setup</Link><button type="button" onClick={onClose}>Cancel</button></div>
    </section>
  </div>
) : null;
