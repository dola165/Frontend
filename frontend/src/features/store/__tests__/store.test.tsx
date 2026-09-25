vi.mock('../../paymentPreview/config', () => ({ paymentPreviewEnabled: () => false }));
import type { ImgHTMLAttributes } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorePage } from '../../../pages/StorePage';
import { StoreProductPage } from '../../../pages/StoreProductPage';
import { StoreCartPage } from '../../../pages/StoreCartPage';
import { StoreTab } from '../../../components/workspace/tabs/StoreTab';
import { addCartItem, readCart, saveCart } from '../cart';
import * as api from '../api';
vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), deleteStoreProduct: vi.fn(), fetchStoreLocations: vi.fn(), fetchStoreProduct: vi.fn(), fetchStoreCatalog: vi.fn(), fetchAllClubStoreProducts: vi.fn(), updateStoreProduct: vi.fn(), fetchCartQuote: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ DEPLOYMENT_URLS: {mediaBaseUrl: 'http://localhost:8080'}, apiClient: { get: vi.fn(async () => ({data: {name: 'Alpha FC'}})) } }));
const product = {id: 1, clubId: 10, clubName: 'Alpha FC', name: 'Home shirt', price: 12.34, currency: 'GEL', version: 3, active: true, variants: [{id: 7, label: 'M', stock: 5}]};
const item = {variantId:7,quantity:2,productId:1,name:'Home shirt',variant:'M',clubId:10,currency:'GEL'};
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); vi.mocked(api.fetchStoreLocations).mockResolvedValue([]); });
describe('Store safety and recovery', () => {
    it('keeps a saved cart when a different club or too many items are added', () => {
        addCartItem(item);
        expect(() => addCartItem({...item,clubId:11,variantId:8})).toThrow(/another club/);
        expect(() => addCartItem({...item,quantity:99})).toThrow(/99/);
        expect(readCart()).toEqual([item]);
    });
    it('ignores invalid persisted carts', () => {
        localStorage.setItem('gk.store.cart.v1','bad json'); expect(readCart()).toEqual([]);
        localStorage.setItem('gk.store.cart.v1',JSON.stringify([{...item,quantity:-1},{...item,clubId:-1},item]));
        expect(readCart()).toEqual([item]);
    });
    it('keeps stock edits and the original version after a failed save', async () => {
        vi.mocked(api.fetchAllClubStoreProducts).mockResolvedValue([product]);
        vi.mocked(api.updateStoreProduct).mockRejectedValue({response:{data:{error:'This product changed. Reload its latest version before saving.'}}});
        render(<MemoryRouter><StoreTab clubId={10}/></MemoryRouter>);
        fireEvent.click(await screen.findByRole('button',{name:'Edit Home shirt'}));
        fireEvent.change(screen.getByLabelText('Stock 1'),{target:{value:'4'}});
        fireEvent.click(screen.getByRole('button',{name:'Save product'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('This product changed');
        expect(screen.getByLabelText('Stock 1')).toHaveValue(4);
        expect(api.updateStoreProduct).toHaveBeenCalledWith(10,1,expect.objectContaining({version:3,variants:[{id:7,label:'M',stock:4}]}));
        expect(screen.queryByText('Product saved.')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button',{name:'Close editor'}));
        fireEvent.click(screen.getByRole('button',{name:'Keep editing'}));
        expect(screen.getByLabelText('Stock 1')).toHaveValue(4);
    });
    it('requires explicit confirmation before discarding a draft', async () => {
        vi.mocked(api.fetchAllClubStoreProducts).mockResolvedValue([]);
        render(<MemoryRouter><StoreTab clubId={10}/></MemoryRouter>);
        fireEvent.click(await screen.findByRole('button',{name:'Add product'}));
        fireEvent.change(screen.getByLabelText('Product name'),{target:{value:'Unfinished kit'}});
        expect(screen.getByLabelText('Published in the Store')).not.toBeChecked();
        fireEvent.click(screen.getByRole('button',{name:'Close editor'}));
        expect(screen.getByLabelText('Product name')).toHaveValue('Unfinished kit');
        fireEvent.click(screen.getByRole('button',{name:'Discard edits'}));
        expect(screen.queryByLabelText('Product name')).not.toBeInTheDocument();
    });
    it('uses server catalog filters, club scope and real product destinations', async () => {
        vi.mocked(api.fetchStoreCatalog).mockResolvedValue({content:[product],totalElements:13});
        render(<MemoryRouter initialEntries={['/clubs/10/store?query=shirt&currency=EUR']}><Routes><Route path="/clubs/:id/store" element={<StorePage/>}/></Routes></MemoryRouter>);
        expect(await screen.findByRole('heading',{name:'Home shirt'})).toBeInTheDocument();
        expect(api.fetchStoreCatalog).toHaveBeenCalledWith(expect.objectContaining({clubId:10,query:'shirt',currency:'EUR',size:12,page:0}),expect.any(AbortSignal));
        expect(screen.getByRole('link',{name:/Home shirt/})).toHaveAttribute('href','/store/products/1');
        expect(screen.getByRole('link',{name:'Browse all stores'})).toHaveAttribute('href','/store');
        fireEvent.click(screen.getByRole('button',{name:'Next'}));
        await waitFor(() => expect(api.fetchStoreCatalog).toHaveBeenLastCalledWith(expect.objectContaining({clubId:10,page:1}),expect.any(AbortSignal)));
    });
    it('ignores a delayed catalog result after filters change', async () => {
        let resolve!: (value: {content: typeof product[];totalElements:number}) => void;
        vi.mocked(api.fetchStoreCatalog).mockImplementationOnce(() => new Promise(r => {resolve=r;})).mockResolvedValue({content:[{...product,name:'New search'}],totalElements:1});
        render(<MemoryRouter><StorePage/></MemoryRouter>);
        fireEvent.change(screen.getByLabelText('Search'),{target:{value:'new'}});
        await screen.findByRole('heading',{name:'New search'});
        await act(async () => resolve({content:[product],totalElements:1}));
        expect(screen.queryByRole('heading',{name:'Home shirt'})).not.toBeInTheDocument();
    });
    it('uses complete location choices and clears a dependent city when country changes', async () => {
        vi.mocked(api.fetchStoreLocations).mockResolvedValue([{country:'Georgia',city:'Tbilisi'},{country:'France',city:'Paris'}]);
        vi.mocked(api.fetchStoreCatalog).mockResolvedValue({content:[],totalElements:0});
        render(<MemoryRouter initialEntries={['/store?country=Georgia&city=Tbilisi']}><StorePage/></MemoryRouter>);
        await waitFor(() => expect(screen.getByLabelText('Country')).not.toBeDisabled());
        expect(screen.getByRole('option',{name:'France'})).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Country'),{target:{value:'France'}});
        expect(screen.getByLabelText('City')).toHaveValue('');
        expect(screen.getByRole('option',{name:'Paris'})).toBeInTheDocument();
        expect(screen.queryByRole('button',{name:'Remove City filter'})).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button',{name:'Remove Country filter'}));
        expect(screen.getByLabelText('City')).toBeDisabled();
    });
    it('switches gallery photos and sizes without allowing an unavailable variant into the cart', async () => {
        vi.mocked(api.fetchStoreProduct).mockResolvedValue({...product, clubWhatsappNumber:'+995 555 123 456', clubEmail:'shop@alpha.test', images:['/uploads/first.jpg','/uploads/second.jpg'], variants:[{id:7,label:'M',stock:5},{id:8,label:'L',stock:2},{id:9,label:'XL',stock:0}]});
        render(<MemoryRouter initialEntries={['/store/products/1']}><Routes><Route path="/store/products/:id" element={<StoreProductPage/>}/></Routes></MemoryRouter>);
        await screen.findByRole('heading',{name:'Home shirt'});
        fireEvent.click(screen.getByRole('button',{name:'View photo 2'}));
        expect(screen.getByRole('img',{name:'Home shirt - photo 2'})).toHaveAttribute('src',expect.stringContaining('second.jpg'));
        expect(screen.queryByRole('img',{name:'Home shirt - photo 1'})).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Quantity'),{target:{value:'5'}});
        fireEvent.click(screen.getByRole('button',{name:'L'}));
        expect(screen.getByLabelText('Quantity')).toHaveValue(1);
        expect(screen.getByRole('button',{name:'XL - out of stock'})).toBeDisabled();
        fireEvent.click(screen.getByRole('button',{name:'Add to cart'}));
        expect(readCart()[0]).toEqual(expect.objectContaining({variantId:8,quantity:1}));
        expect(screen.getByText(/does not reserve stock, place an order, or take payment/)).toBeInTheDocument();
        expect(screen.getByRole('link',{name:'Ask via WhatsApp'})).toHaveAttribute('href',expect.stringContaining(encodeURIComponent('Home shirt · L × 1')));
        expect(screen.getByRole('link',{name:'Email product enquiry'})).toHaveAttribute('href',expect.stringContaining(encodeURIComponent('Product enquiry: Home shirt · L × 1')));
    });
    it('removes an obsolete quote on failed recheck while retaining the cart', async () => {
        saveCart([item]);
        vi.mocked(api.fetchCartQuote).mockResolvedValueOnce({clubId:10,clubName:'Alpha FC',currency:'GEL',lines:[],subtotal:2468,checkoutEnabled:false,message:'This is not a reservation or an order.'}).mockRejectedValue({response:{data:{error:'Not enough stock'}}});
        render(<MemoryRouter><StoreCartPage/></MemoryRouter>);
        expect(await screen.findByText(/Product subtotal/)).toHaveTextContent('24.68');
        fireEvent.change(screen.getByLabelText('Quantity for M'),{target:{value:'3'}});
        expect(await screen.findByRole('alert')).toHaveTextContent('Not enough stock');
        expect(screen.queryByText(/Product subtotal/)).not.toBeInTheDocument();
        expect(readCart()[0].quantity).toBe(3);
        expect(screen.getByRole('button',{name:'Checkout unavailable'})).toBeDisabled();
    });

    it('states that a cart is not a commitment and preserves line context for the club handoff', async () => {
        saveCart([item]);
        vi.mocked(api.fetchCartQuote).mockResolvedValue({clubId:10,clubName:'Alpha FC',currency:'GEL',lines:[{...item,unitAmount:1234,lineAmount:2468}],subtotal:2468,checkoutEnabled:false,message:'Unavailable'});
        render(<MemoryRouter><StoreCartPage/></MemoryRouter>);
        expect(await screen.findByText(/does not reserve this stock, place an order, or take payment/)).toBeInTheDocument();
        expect(screen.getByText('Home shirt · M × 2')).toBeInTheDocument();
        expect(screen.getByRole('link',{name:'Contact Alpha FC about this cart'})).toHaveAttribute('href','/clubs/10?tab=contact');
        expect(screen.getByRole('button',{name:'Checkout unavailable'})).toBeDisabled();
    });
});

// These suites test gallery selection; authenticated byte delivery has its own component and HTTP coverage.
vi.mock('../../../components/ui/MediaImage', () => ({ MediaImage: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} /> }));

it('rejects stale archive and requires a new confirmation after loading the newer product', async () => {
    vi.mocked(api.fetchAllClubStoreProducts).mockResolvedValue([product]);
    vi.mocked(api.deleteStoreProduct).mockRejectedValueOnce({response:{status:409,data:{error:'Product changed; it was not archived.'}}}).mockResolvedValueOnce(undefined);
    render(<MemoryRouter><StoreTab clubId={10}/></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button',{name:'Archive Home shirt'}));
    expect(api.deleteStoreProduct).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Confirm archive'}));
    await screen.findByRole('alert');
    expect(api.deleteStoreProduct).toHaveBeenLastCalledWith(10,1,3);
    expect(screen.queryByText('Product archived.')).not.toBeInTheDocument();
    expect(screen.getByRole('heading',{name:'Home shirt'})).toBeInTheDocument();
    vi.mocked(api.fetchAllClubStoreProducts).mockResolvedValue([{...product,version:4,name:'New kit'}]);
    fireEvent.click(screen.getByRole('button',{name:'Reload products'}));
    await screen.findByRole('heading',{name:'New kit'});
    expect(screen.queryByRole('button',{name:'Confirm archive'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Archive New kit'}));
    vi.mocked(api.fetchAllClubStoreProducts).mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button',{name:'Confirm archive'}));
    await screen.findByText('Product archived.');
    expect(api.deleteStoreProduct).toHaveBeenLastCalledWith(10,1,4);
    await waitFor(()=>expect(screen.queryByRole('heading',{name:'New kit'})).not.toBeInTheDocument());
});
