// Generated placeholder media: portrait stand-ins for profile photos, crests, store products and abstract pitch photos.
import { personById, clubById } from './world.mjs';
import { crestDesignFor, crestSvg } from './pages-data.mjs';
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
    // A club or page created here draws the crest its owner designed (or the one generated from its initials).
    const design = crestDesignFor(id);
    if (design) return crestSvg(design);
    const c = clubById(id); const short = c ? c.short : 'FC'; const fill = c?.color || color;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><path d="M48 6 86 18v30c0 22-16 36-38 42C26 84 10 70 10 48V18Z" fill="${fill}"/><path d="M48 14 78 24v24c0 17-12 28-30 33-18-5-30-16-30-33V24Z" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3"/><text x="48" y="58" font-family="Inter,Arial" font-size="22" font-weight="700" fill="#fff" text-anchor="middle">${esc(short)}</text></svg>`;
  }
  if (kind === 'product') return productSvg(id, color);
  // photo / banner: an abstract pitch scene
  const h = hash(id);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b3d2e"/><stop offset="1" stop-color="${color}"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${i * 200}" y="0" width="100" height="900" fill="#fff" opacity=".035"/>`).join('')}<g fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="5"><rect x="140" y="110" width="1320" height="680"/><line x1="800" y1="110" x2="800" y2="790"/><circle cx="800" cy="450" r="${110 + (h % 40)}"/><rect x="140" y="300" width="160" height="300"/><rect x="1300" y="300" width="160" height="300"/></g><circle cx="${500 + (h % 600)}" cy="${300 + (h % 300)}" r="18" fill="#fff" opacity=".9"/></svg>`;
}

// ---------------------------------------------------------------- product pictures
// A store product as a simple studio shot: one object drawn in a few shapes on a soft dark background. The slug
// before the id names the object (`ball-1201`; `shirt-1101-b` is the second picture, in another colour).
const poly = (cx, cy, r, n, rot = -90) => Array.from({ length: n }, (_, i) => { const a = (rot + i * 360 / n) * Math.PI / 180; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
const shirtBody = 'M118 118l52-28c6 18 54 18 60 0l52 28 26 62-48 22v152H140V202l-48-22z';
const art = {
  ball: c => `<circle cx="200" cy="200" r="122" fill="#f6f6f4"/><polygon points="${poly(200, 200, 42, 5)}" fill="#1a1a1a"/>${[0, 1, 2, 3, 4].map(i => { const a = (-90 + i * 72) * Math.PI / 180, x = 200 + 86 * Math.cos(a), y = 200 + 86 * Math.sin(a); return `<line x1="${(200 + 42 * Math.cos(a)).toFixed(1)}" y1="${(200 + 42 * Math.sin(a)).toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#1a1a1a" stroke-width="5"/><polygon points="${poly(x, y, 30, 5, -90 + i * 72 + 36)}" fill="#1a1a1a" opacity=".9"/>`; }).join('')}<circle cx="200" cy="200" r="122" fill="none" stroke="${c}" stroke-opacity=".4" stroke-width="6"/>`,
  cone: c => `<path d="M200 62l78 258H122z" fill="${c}"/><path d="M158 200h84M146 250h108" stroke="#fff" stroke-width="14"/><rect x="92" y="312" width="216" height="26" rx="8" fill="${c}" opacity=".7"/><ellipse cx="200" cy="320" rx="108" ry="10" fill="#000" opacity=".25"/>`,
  bib: c => `<path d="M126 96h44c0 34 60 34 60 0h44l34 50-30 20v166H122V166l-30-20z" fill="${c}"/><path d="M160 96c0 34 20 60 40 60s40-26 40-60" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="6"/><path d="M122 214h156" stroke="#fff" stroke-opacity=".4" stroke-width="8"/>`,
  shin: c => `<rect x="96" y="76" width="90" height="248" rx="44" fill="${c}"/><rect x="214" y="76" width="90" height="248" rx="44" fill="${c}" opacity=".8"/><path d="M141 110v180M259 110v180" stroke="#fff" stroke-opacity=".5" stroke-width="10" stroke-linecap="round"/>`,
  glove: c => `<rect x="130" y="150" width="140" height="170" rx="40" fill="${c}"/>${[0, 1, 2, 3].map(i => `<rect x="${134 + i * 34}" y="${72 + (i === 0 || i === 3 ? 22 : 0)}" width="30" height="130" rx="15" fill="${c}"/>`).join('')}<rect x="90" y="170" width="46" height="100" rx="23" fill="${c}" transform="rotate(-25 113 220)"/><path d="M150 260h100" stroke="#fff" stroke-opacity=".5" stroke-width="12" stroke-linecap="round"/>`,
  goal: c => `<rect x="62" y="104" width="276" height="190" fill="none" stroke="#f6f6f4" stroke-width="12"/>${[0, 1, 2, 3, 4, 5, 6].map(i => `<line x1="${86 + i * 38}" y1="110" x2="${86 + i * 38}" y2="290" stroke="#fff" stroke-opacity=".28" stroke-width="2"/>`).join('')}${[0, 1, 2, 3].map(i => `<line x1="68" y1="${134 + i * 38}" x2="332" y2="${134 + i * 38}" stroke="#fff" stroke-opacity=".28" stroke-width="2"/>`).join('')}<circle cx="250" cy="236" r="26" fill="${c}"/>`,
  top: c => `<path d="${shirtBody}" fill="${c}"/><path d="M92 180l-20 86 48 14 20-78M308 180l20 86-48 14-20-78" fill="${c}"/><path d="M200 120v70" stroke="#fff" stroke-opacity=".6" stroke-width="6"/>`,
  shirt: c => `<path d="${shirtBody}" fill="${c}"/><path d="M170 90c6 18 54 18 60 0" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="6"/><text x="200" y="236" font-family="Inter,Arial" font-size="72" font-weight="700" fill="#fff" fill-opacity=".85" text-anchor="middle">10</text>`,
  hoodie: c => `<path d="${shirtBody}" fill="${c}"/><ellipse cx="200" cy="112" rx="58" ry="40" fill="${c}"/><ellipse cx="200" cy="118" rx="34" ry="22" fill="#000" opacity=".35"/><rect x="150" y="250" width="100" height="40" rx="8" fill="#fff" fill-opacity=".25"/>`,
  shorts: c => `<path d="M120 100h160l16 170h-72l-24-90-24 90h-72z" fill="${c}"/><path d="M120 100h160" stroke="#fff" stroke-opacity=".5" stroke-width="8"/>`,
  socks: c => `<path d="M150 70h60v150c0 24 22 34 44 44 26 12 20 50-14 50h-50c-20 0-40-20-40-50z" fill="${c}"/><path d="M150 70h60v40h-60z" fill="#fff" fill-opacity=".6"/><path d="M160 180h40" stroke="#fff" stroke-opacity=".5" stroke-width="8"/>`,
  bottle: c => `<rect x="150" y="110" width="100" height="220" rx="24" fill="${c}"/><rect x="168" y="70" width="64" height="44" rx="10" fill="#f6f6f4"/><rect x="164" y="170" width="72" height="90" rx="8" fill="#fff" fill-opacity=".25"/>`,
  pump: c => `<rect x="170" y="110" width="60" height="200" rx="12" fill="${c}"/><rect x="130" y="80" width="140" height="30" rx="10" fill="#f6f6f4"/><rect x="190" y="310" width="20" height="40" fill="#f6f6f4"/><path d="M200 350v16h40" fill="none" stroke="#f6f6f4" stroke-width="8"/>`,
  armband: c => `<path d="M110 150c60-30 120-30 180 0v100c-60 30-120 30-180 0z" fill="${c}"/><text x="200" y="222" font-family="Inter,Arial" font-size="56" font-weight="800" fill="#fff" text-anchor="middle">C</text>`,
  ladder: c => `<path d="M120 60v280M280 60v280" stroke="${c}" stroke-width="12" stroke-linecap="round"/>${[0, 1, 2, 3, 4].map(i => `<rect x="112" y="${86 + i * 58}" width="176" height="16" rx="6" fill="#f6f6f4"/>`).join('')}`,
  aid: c => `<rect x="80" y="120" width="240" height="180" rx="18" fill="#f6f6f4"/><rect x="150" y="90" width="100" height="40" rx="10" fill="#f6f6f4"/><path d="M200 160v100M150 210h100" stroke="${c}" stroke-width="28" stroke-linecap="round"/>`,
  boot: c => `<path d="M90 230c40-10 70-60 90-120 30 0 60 20 70 60 10 30 60 50 80 70v30H90z" fill="${c}"/><path d="M90 270h240v16H90z" fill="#f6f6f4"/><path d="M200 150l30-20M210 180l30-20M220 210l30-20" stroke="#fff" stroke-opacity=".6" stroke-width="6" stroke-linecap="round"/>`,
  scarf: c => `<g transform="rotate(-18 200 200)"><rect x="60" y="160" width="280" height="80" rx="10" fill="${c}"/>${[0, 1, 2, 3].map(i => `<rect x="${86 + i * 70}" y="160" width="30" height="80" fill="#fff" fill-opacity=".7"/>`).join('')}</g>`,
  ticket: c => `<rect x="70" y="140" width="260" height="120" rx="14" fill="#f6f6f4"/><circle cx="70" cy="200" r="16" fill="#1b2a33"/><circle cx="330" cy="200" r="16" fill="#1b2a33"/><path d="M230 150v100" stroke="${c}" stroke-width="4" stroke-dasharray="8 8"/><rect x="96" y="170" width="100" height="14" rx="6" fill="${c}"/><rect x="96" y="200" width="70" height="10" rx="5" fill="${c}" opacity=".5"/>`,
  card: c => `<rect x="70" y="120" width="260" height="160" rx="18" fill="${c}"/><rect x="92" y="150" width="60" height="44" rx="8" fill="#fff" fill-opacity=".8"/><rect x="92" y="224" width="150" height="12" rx="6" fill="#fff" fill-opacity=".7"/><rect x="92" y="246" width="100" height="10" rx="5" fill="#fff" fill-opacity=".4"/>`,
  cap: c => `<path d="M110 220c0-60 40-100 90-100s90 40 90 100z" fill="${c}"/><path d="M80 222c60-14 180-14 250 0 12 2 12 20 0 22-70-10-190-10-250 0-12-2-12-20 0-22z" fill="${c}" opacity=".75"/><path d="M200 120v100" stroke="#fff" stroke-opacity=".4" stroke-width="4"/>`,
  pack: c => `<path d="M100 160l100-50 100 50v120l-100 50-100-50z" fill="${c}"/><path d="M100 160l100 50 100-50M200 210v120" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="6"/>`,
};
function productSvg(id, color) {
  const slug = id.split('-')[0], draw = art[slug] ?? art.pack;
  const c = id.endsWith('-b') ? palette[(hash(id) + 3) % palette.length] : color;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><radialGradient id="g" cx=".5" cy=".35" r=".75"><stop offset="0" stop-color="#2b3a44"/><stop offset="1" stop-color="#17222b"/></radialGradient></defs><rect width="400" height="400" fill="url(#g)"/><ellipse cx="200" cy="342" rx="120" ry="14" fill="#000" opacity=".3"/>${draw(c)}</svg>`;
}
