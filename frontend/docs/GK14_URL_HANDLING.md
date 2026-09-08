# GK-14: API, media and WebSocket URL handling

The web client resolves `VITE_API_BASE_URL` against the browser origin once and derives every backend destination from that result.

| Configuration | API | Uploaded media | WebSocket |
| --- | --- | --- | --- |
| unset or `/api` on `https://grasskickz.com` | `https://grasskickz.com/api` | `https://grasskickz.com/uploads/...` | `wss://grasskickz.com/ws-chat` |
| `http://localhost:8080/api` | `http://localhost:8080/api` | `http://localhost:8080/uploads/...` | `ws://localhost:8080/ws-chat` |
| `/gateway/api` on `https://grasskickz.com` | `https://grasskickz.com/gateway/api` | `https://grasskickz.com/gateway/uploads/...` | `wss://grasskickz.com/gateway/ws-chat` |
| `https://api.example/gateway/api` | `https://api.example/gateway/api` | `https://api.example/gateway/uploads/...` | `wss://api.example/gateway/ws-chat` |

A terminal `/api` is treated as the API namespace. Media and WebSocket paths are siblings of that namespace. This preserves an optional reverse-proxy prefix such as `/gateway`.

The canonical resolver:

- accepts absent, relative and absolute HTTP(S) API configuration;
- normalizes trailing and leading slash variations;
- selects `ws` for HTTP and `wss` for HTTPS;
- resolves backend-relative uploads without throwing during rendering;
- preserves absolute HTTP(S), `data:` and `blob:` media URLs;
- rejects unsupported API protocols and ignores unusable media schemes;
- replaces the map's separate media concatenation with the shared resolver.

The URL matrix is covered by unit tests. Type checking, the frontend test suite and the production build are the release checks. Actual reverse-proxy routing and TLS termination remain deployment checks because unit tests cannot prove that an external proxy forwards these paths.
