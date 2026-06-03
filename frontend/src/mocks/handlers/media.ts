import { http, HttpHandler, HttpResponse } from 'msw';
import { simulateLatency } from '../utils';

const API = '*/api';

let mediaIdCounter = 300;

// Real MediaDto returns { id, url, ... }
export const mediaHandlers: HttpHandler[] = [

  http.post(`${API}/media/upload`, async ({ request }) => {
    await simulateLatency(400);
    const form = await request.formData();
    const _file = form.get('file');
    const id = mediaIdCounter++;
    const n = Math.floor(Math.random() * 1000);
    return HttpResponse.json({
      id,
      url: `https://picsum.photos/400/400?random=${n}`,
      thumbnailUrl: `https://picsum.photos/200/200?random=${n}`,
      filename: (_file as File)?.name ?? 'upload.jpg',
      size: (_file as File)?.size ?? 12345,
    });
  }),
];
