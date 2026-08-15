import { http, HttpResponse } from 'msw';
import { simulateLatency, paginate } from '../utils';
import { products, type StoreProduct } from '../data/store';

const API = '*/api';

// -- club store (WEB_APP_MASTER_PLAN.md §4.1, Phase 3) --
export const storeHandlers = [
  http.get(`${API}/store/products`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 12);
    const clubId = url.searchParams.get('clubId');
    let items = [...products().values()].filter((p) => p.active);
    if (clubId) items = items.filter((p) => p.clubId === Number(clubId));
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json(paginate(items, page, size));
  }),

  http.get(`${API}/clubs/:clubId/store/products`, async ({ params }) => {
    await simulateLatency();
    const clubId = Number(params.clubId);
    return HttpResponse.json(
      [...products().values()].filter((p) => p.clubId === clubId && p.active)
    );
  }),

  http.get(`${API}/clubs/:clubId/store/products/all`, async ({ params }) => {
    await simulateLatency();
    const clubId = Number(params.clubId);
    return HttpResponse.json([...products().values()].filter((p) => p.clubId === clubId));
  }),

  http.post(`${API}/clubs/:clubId/store/products`, async ({ params, request }) => {
    await simulateLatency();
    const clubId = Number(params.clubId);
    const body = (await request.json()) as Record<string, unknown>;
    if (!body.name || body.price == null) {
      return HttpResponse.json({ error: 'Name and price are required.' }, { status: 400 });
    }
    const product: StoreProduct = {
      id: Math.floor(Math.random() * 100000) + 5000,
      clubId,
      clubName: null,
      clubLogoUrl: null,
      clubWhatsappNumber: null,
      clubEmail: null,
      name: body.name as string,
      description: (body.description as string | null) ?? null,
      price: Number(body.price),
      sizes: Array.isArray(body.sizes) ? (body.sizes as string[]) : [],
      images: Array.isArray(body.images) ? (body.images as string[]) : [],
      active: true,
      createdAt: new Date().toISOString(),
      category: (body.category as string | undefined) ?? 'OTHER',
      clubCityName: null,
      clubCountryName: null,
    };
    products().set(product.id, product);
    return HttpResponse.json(product, { status: 201 });
  }),

  http.patch(`${API}/clubs/:clubId/store/products/:productId`, async ({ params, request }) => {
    await simulateLatency();
    const product = products().get(Number(params.productId));
    if (!product) return HttpResponse.json({ error: 'Store product not found.' }, { status: 404 });
    const body = (await request.json()) as Record<string, unknown>;
    if (body.name != null) product.name = body.name as string;
    if (body.description !== undefined) product.description = (body.description as string | null) ?? null;
    if (body.price != null) product.price = Number(body.price);
    if (body.sizes !== undefined) product.sizes = Array.isArray(body.sizes) ? (body.sizes as string[]) : [];
    if (body.images !== undefined) product.images = Array.isArray(body.images) ? (body.images as string[]) : [];
    if (body.active != null) product.active = Boolean(body.active);
    if (body.category != null) product.category = body.category as string;
    return HttpResponse.json(product);
  }),

  http.delete(`${API}/clubs/:clubId/store/products/:productId`, async ({ params }) => {
    await simulateLatency();
    products().delete(Number(params.productId));
    return HttpResponse.json({ message: 'Store product deleted.' });
  }),
];
