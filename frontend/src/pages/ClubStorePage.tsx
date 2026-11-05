import { ct, useCommerceCopy } from '../features/store/copy';
import { useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Plus, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { CommerceDraftScope } from '../components/workspace/CommerceDraftScope';
import { Button, ButtonLink, EmptyNote, GkRoot, PageFrame } from '../design/primitives';
import { isLeadershipRole } from '../features/clubs/domain';
import { StoreProductCreate } from '../features/clubWorkspace/commerce/StoreProductCreate';
import { fetchStoreClub } from '../features/store/api';
import { Catalogue } from '../features/store/Catalogue';
import { Crest } from '../features/world/Crest';
import { useWorldData } from '../features/world/useWorldData';
import '../features/store/store.css';

/**
 * A club's store: the catalogue fixed to the club, with the club's crest over it. Inside the club page (the Get
 * involved tab) the club is already on screen, so only the catalogue shows. Staff add a product right here.
 */
export const ClubStorePage = () => {
    useCommerceCopy();
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
    const canAdd = valid && status === 'authenticated' && isLeadershipRole(club.data?.myRole);
    const frame = (children: React.ReactNode) => embedded ? <GkRoot className="gk-store gk-store--embedded" data-market="store">{children}</GkRoot> : <GkRoot className="gk-store gk-page" data-market="store"><PageFrame>{children}</PageFrame></GkRoot>;
    if (!valid) return frame(<EmptyNote title={ct("This club could not be found.")} action={<ButtonLink to="/store">{ct("Back to the store")}</ButtonLink>} />);
    if (adding && canAdd) return frame(<CommerceDraftScope clubId={clubId} feature="StoreTab"><StoreProductCreate clubId={clubId} defaultActive draftHint={ct('Supporters cannot see it. Publish it later from Store in your club workspace.')}
        onDone={product => { toast.success(product.active ? ct('Product added to your store') : ct('Product saved as a draft')); setAdding(false); setRevision(n => n + 1); }} onCancel={() => setAdding(false)} /></CommerceDraftScope>);
    const actions = <div className="gk-store-club__actions">
        {canAdd && <Button variant="primary" onClick={() => setAdding(true)}><Plus aria-hidden="true" />{ct("Add a product")}</Button>}
        {canAdd && <ButtonLink variant="ghost" style={{ minHeight: 44 }} to={`/clubs/${clubId}/office?tab=tools&tool=store`}>{ct("Manage store")}</ButtonLink>}
        {!embedded && <ButtonLink variant="ghost" to={`/clubs/${clubId}`}>{ct("Club page")}</ButtonLink>}
        <ButtonLink to="/store/cart"><ShoppingBag aria-hidden="true" />{ct("Cart")}</ButtonLink>
    </div>;
    return frame(<>
        {embedded ? <div className="gk-store-club gk-store-club--embedded">{actions}</div> : <>
            <nav className="gk-store-crumbs" aria-label={ct("Breadcrumb")}><Link to="/store">{ct("Store")}</Link><span aria-hidden="true">/</span><span>{club.data?.name ?? ct("Club")}{ct(" store")}</span></nav>
            <div className="gk-store-club">
                <Crest src={club.data?.logoUrl} name={club.data?.name ?? ct("Club")} size={56} />
                <div className="gk-store-club__text">
                    <h1>{club.data?.name ?? ct("Club")}{ct(" store")}</h1>
                    <p className="gk-store-club__line">{[club.data?.cityName, ct("Sold by the club")].filter(Boolean).join(' · ')}</p>
                </div>
                {actions}
            </div>
        </>}
        <Catalogue fixedClubId={clubId} revision={revision} empty={canAdd
            ? <EmptyNote title={ct("Your store is empty")} action={<Button variant="primary" onClick={() => setAdding(true)}><Plus aria-hidden="true" />{ct("Add your first product")}</Button>}>{ct("Kit, tickets or memberships: supporters buy them here.")}</EmptyNote>
            : <EmptyNote title={ct("Nothing for sale yet")} action={<ButtonLink to="/store">{ct("Browse the store")}</ButtonLink>} />} />
    </>);
};
