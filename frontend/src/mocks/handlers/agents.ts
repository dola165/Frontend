import { http, HttpHandler, HttpResponse } from 'msw';
import { simulateLatency } from '../utils';

const API = '*/api';

// 16-17 self-consent for agent representation (WEB_APP_MASTER_PLAN.md §2.1)
export const agentHandlers: HttpHandler[] = [
  http.post(`${API}/agents/representations/:representationId/consent`, async () => {
    await simulateLatency();
    return new HttpResponse(null, { status: 204 });
  }),
];
