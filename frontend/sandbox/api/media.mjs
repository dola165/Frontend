// Generated placeholder media: portrait stand-ins for profile photos, crests and abstract pitch photos.
import { personById, clubById } from './world.mjs';
const palette = ['#1d4ed8', '#0f766e', '#b91c1c', '#7c3aed', '#ca8a04', '#0891b2', '#db2777', '#16a34a', '#ea580c', '#4f46e5'];
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export async function mediaSvg(pathname) {
  const [, , kind, rawId] = pathname.split('/');
  const id = decodeURIComponent((rawId || '').replace(/\.svg$/, ''));
  const color = palette[hash(id) % palette.length];
  if (kind === 'avatar') {
    // A head-and-shoulders portrait standing in for a profile photo: varied skin and hair; players in their club's kit.
    const p = personById(id), h = hash(id);
    const skins = ['#f3cfb3', '#e8b896', '#d9a07a', '#c4865f', '#a66a48', '#7d4a31'], hairs = ['#1c1714', '#2e211a', '#4a3324', '#6b4a2f', '#8c6a3f', '#2a2a2a'];
    const tone = h % skins.length, skin = skins[tone], shade = skins[Math.min(tone + 1, skins.length - 1)], hair = hairs[(h >> 3) % hairs.length];
    const club = p?.clubId ? clubById(p.clubId) : null, player = p?.role === 'PLAYER';
    const kit = player ? (club?.color || color) : '#2b3640', trim = player ? '#ffffff' : color, long = p?.gender === 'FEMALE';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".6"/><stop offset="1" stop-color="' + color + '" stop-opacity=".12"/></linearGradient></defs>'
      + '<rect width="96" height="96" fill="#17222b"/><rect width="96" height="96" fill="url(#g)"/>'
      + (long ? '<path d="M29 46c0-16 8-26 19-26s19 10 19 26v26H29z" fill="' + hair + '"/>' : '')
      + '<path d="M10 96c1-17 14-28 38-28s37 11 38 28z" fill="' + kit + '"/><path d="M40 64h16v8c0 5-4 8-8 8s-8-3-8-8z" fill="' + shade + '"/>'
      + '<path d="M37 70l11 10 11-10" fill="none" stroke="' + trim + '" stroke-width="3" stroke-linejoin="round"/>'
      + '<ellipse cx="32.5" cy="46" rx="3" ry="4.5" fill="' + shade + '"/><ellipse cx="63.5" cy="46" rx="3" ry="4.5" fill="' + shade + '"/><ellipse cx="48" cy="44" rx="15.5" ry="18.5" fill="' + skin + '"/>'
      + '<path d="' + (long ? 'M33 41c1-11 7-17 15-17s14 6 15 17c-4-5-9-8-15-8s-11 3-15 8z' : 'M32.5 42c-1-13 6-21 15.5-21s16.5 7 15.5 21c-2-7-7-11-15.5-11S35 35 32.5 42z') + '" fill="' + hair + '"/></svg>';
  }
  if (kind === 'crest') {
    const c = clubById(id); const short = c ? c.short : 'FC'; const fill = c?.color || color;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><path d="M48 6 86 18v30c0 22-16 36-38 42C26 84 10 70 10 48V18Z" fill="${fill}"/><path d="M48 14 78 24v24c0 17-12 28-30 33-18-5-30-16-30-33V24Z" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3"/><text x="48" y="58" font-family="Inter,Arial" font-size="22" font-weight="700" fill="#fff" text-anchor="middle">${esc(short)}</text></svg>`;
  }
  // photo / banner: an abstract pitch scene
  const h = hash(id);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b3d2e"/><stop offset="1" stop-color="${color}"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${i * 200}" y="0" width="100" height="900" fill="#fff" opacity=".035"/>`).join('')}<g fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="5"><rect x="140" y="110" width="1320" height="680"/><line x1="800" y1="110" x2="800" y2="790"/><circle cx="800" cy="450" r="${110 + (h % 40)}"/><rect x="140" y="300" width="160" height="300"/><rect x="1300" y="300" width="160" height="300"/></g><circle cx="${500 + (h % 600)}" cy="${300 + (h % 300)}" r="18" fill="#fff" opacity=".9"/></svg>`;
}
