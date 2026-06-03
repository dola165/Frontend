import { http, HttpHandler, HttpResponse } from 'msw';
import { users } from '../data/store';
import { simulateLatency, paginate } from '../utils';

const API = '*/api';

export const adminHandlers: HttpHandler[] = [

  // -- GET /admin/users (params: query, page, size) --
  http.get(`${API}/admin/users`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const query = (url.searchParams.get('query') ?? '').toLowerCase();
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 20);

    let items = [...users().values()];
    if (query) {
      items = items.filter((u) =>
        (u.username ?? '').toLowerCase().includes(query) ||
        (u.fullName ?? '').toLowerCase().includes(query) ||
        (u.email ?? '').toLowerCase().includes(query));
    }

    const mapped = items.map((u) => ({
      id: u.id, username: u.username, email: u.email, fullName: u.fullName,
      role: u.role, profileComplete: u.profileComplete, createdAt: new Date().toISOString(),
    }));

    return HttpResponse.json(paginate(mapped, page, size));
  }),
];
