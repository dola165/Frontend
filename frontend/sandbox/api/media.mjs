// Generated placeholder media: initials avatars, crests and abstract pitch photos.
import { personById, clubById } from './world.mjs';
const palette = ['#1d4ed8', '#0f766e', '#b91c1c', '#7c3aed', '#ca8a04', '#0891b2', '#db2777', '#16a34a', '#ea580c', '#4f46e5'];
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export async function mediaSvg(pathname) {
  const [, , kind, rawId] = pathname.split('/');
  const id = decodeURIComponent((rawId || '').replace(/\.svg$/, ''));
  const color = palette[hash(id) % palette.length];
  if (kind === 'avatar') {
    const p = personById(id); const initials = p ? (p.firstName[0] + p.lastName[0]) : '?';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="${color}"/><text x="48" y="58" font-family="Inter,Arial" font-size="34" font-weight="600" fill="#fff" text-anchor="middle">${esc(initials)}</text></svg>`;
  }
  if (kind === 'crest') {
    const c = clubById(id); const short = c ? c.short : 'FC'; const fill = c?.color || color;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><path d="M48 6 86 18v30c0 22-16 36-38 42C26 84 10 70 10 48V18Z" fill="${fill}"/><path d="M48 14 78 24v24c0 17-12 28-30 33-18-5-30-16-30-33V24Z" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3"/><text x="48" y="58" font-family="Inter,Arial" font-size="22" font-weight="700" fill="#fff" text-anchor="middle">${esc(short)}</text></svg>`;
  }
  // photo / banner: an abstract pitch scene
  const h = hash(id);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b3d2e"/><stop offset="1" stop-color="${color}"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${i * 200}" y="0" width="100" height="900" fill="#fff" opacity=".035"/>`).join('')}<g fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="5"><rect x="140" y="110" width="1320" height="680"/><line x1="800" y1="110" x2="800" y2="790"/><circle cx="800" cy="450" r="${110 + (h % 40)}"/><rect x="140" y="300" width="160" height="300"/><rect x="1300" y="300" width="160" height="300"/></g><circle cx="${500 + (h % 600)}" cy="${300 + (h % 300)}" r="18" fill="#fff" opacity=".9"/></svg>`;
}
