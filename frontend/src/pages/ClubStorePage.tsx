import { useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Plus, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { CommerceDraftScope } from '../components/workspace/CommerceDraftScope';
import { useClearCommerceForm } from '../components/workspace/commerceDraftState';
import { Button, ButtonLink, EmptyNote, GkRoot, PageFrame } from '../design/primitives';
import { canManageClubOperations } from '../features/clubs/domain';
import { StoreProductForm } from '../features/clubWorkspace/commerce/StoreProductForm';
import { createStoreProduct, fetchStoreClub } from '../features/store/api';
import { Catalogue } from '../features/store/Catalogue';
import { Crest } from '../features/world/Crest';
import { useWorldData } from '../features/world/useWorldData';
import { extractApiErrorMessage } from '../utils/apiError';
import '../features/store/store.css';

/** Adding a product right on the club's store: the workspace's editor, saved to the club's catalogue. */
function AddProduct({ clubId, onDone, onCancel }: { clubId: number; onDone: () => void; onCancel: () => void }) {
    const clearForm = useClearCommerceForm();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    return <StoreProductForm key="new" product={null} saving={saving} formError={error} defaultActive draftHint="Supporters cannot see it. Publish it later from Store in your club workspace."
        onCancel={() => { clearForm(); onCancel(); }}
        onSubmit={async payload => {
            setSaving(true); setError('');
            try { await createStoreProduct(clubId, payload); clearForm(); toast.success(payload.active ? 'Product added to your store' : 'Product saved as a draft'); onDone(); }
            catch (failure) { setError(extractApiErrorMessage(failure, 'Could not save. Your changes are still here.')); }
            finally { setSaving(false); }
        }} />;
}

/**
 * A club's store: the catalogue fixed to the club, with the club's crest over it. Inside the club page (the Get
 * involved tab) the club is already on screen, so only the catalogue shows. Staff add a product right here.
 */
export const ClubStorePage = () => {
    const { id } = useParams();
    const location = useLocation();
    const [params, setParams] = useSearchParams();
    const [revision, setRevision] = useState(0);
    const clubId = Number(id);
    const valid = Number.isSafeInteger(clubId) && clubId > 0;
    const embedded = !/\/store$/.test(location.pathname);
    const club = useWorldData(valid ? `store-club:${clubId}` : null, signal => fetchStoreClub(clubId, signal));
    const adding = params.get('add') === '1';
    const setAdding = (on: boolean) => setParams(current => { const next = new URLSearchParams(current); if (on) next.set('add', '1'); else next.delete('add'); return next; }, { replace: true, preventScrollReset: true });
    const { status } = useAuth();
    const canAdd = valid && status === 'authenticated' && canManageClubOperations(club.data?.myRole);
    const frame = (children: React.ReactNode) => embedded ? <GkRoot className="gk-store gk-store--embedded" data-market="store">{children}</GkRoot> : <GkRoot className="gk-store gk-page" data-market="store"><PageFrame>{children}</PageFrame></GkRoot>;
    if (!valid) return frame(<EmptyNote title="This club could not be found." action={<ButtonLink to="/store">Back to the store</ButtonLink>} />);
    if (adding && canAdd) return frame(<CommerceDraftScope clubId={clubId} feature="StoreTab"><AddProduct clubId={clubId} onDone={() => { setAdding(false); setRevision(n => n + 1); }} onCancel={() => setAdding(false)} /></CommerceDraftScope>);
    const actions = <div className="gk-store-club__actions">
        {canAdd && <Button variant="primary" onClick={() => setAdding(true)}><Plus aria-hidden="true" />Add a product</Button>}
        {!embedded && <ButtonLink variant="ghost" to={`/clubs/${clubId}`}>Club page</ButtonLink>}
        <ButtonLink to="/store/cart"><ShoppingBag aria-hidden="true" />Cart</ButtonLink>
    </div>;
    return frame(<>
        {embedded ? <div className="gk-store-club gk-store-club--embedded">{actions}</div> : <>
            <nav className="gk-store-crumbs" aria-label="Breadcrumb"><Link to="/store">Store</Link><span aria-hidden="true">/</span><span>{club.data?.name ?? 'Club'} store</span></nav>
            <div className="gk-store-club">
                <Crest src={club.data?.logoUrl} name={club.data?.name ?? 'Club'} size={56} />
                <div className="gk-store-club__text">
                    <h1>{club.data?.name ?? 'Club'} store</h1>
                    <p className="gk-store-club__line">{[club.data?.cityName, 'Sold by the club'].filter(Boolean).join(' · ')}</p>
                </div>
                {actions}
            </div>
        </>}
        <Catalogue fixedClubId={clubId} revision={revision} empty={canAdd
            ? <EmptyNote title="Your store is empty" action={<Button variant="primary" onClick={() => setAdding(true)}><Plus aria-hidden="true" />Add your first product</Button>}>Kit, tickets or memberships: supporters buy them here.</EmptyNote>
            : <EmptyNote title="Nothing for sale yet" action={<ButtonLink to="/store">Browse the store</ButtonLink>} />} />
    </>);
};
