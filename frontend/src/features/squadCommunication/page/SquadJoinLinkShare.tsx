import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Printer, Share2 } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { visualColors } from '../../../styles/visualColors';
import { useJourneyCopy } from '../journeyCopy';

const escape = (text: string) => text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

/**
 * The squad's one link, shared anywhere: Copy, WhatsApp, and a QR code to show on a phone or print for the training
 * ground. Print opens a plain sheet (squad, club, the code and the address) in a new window and prints it.
 */
export function SquadJoinLinkShare({ url, squad, club, onError }: { url: string; squad: string; club: string; onError: (message: string) => void }) {
    const copy = useJourneyCopy();
    const [copied, setCopied] = useState(false);
    const qr = useRef<HTMLDivElement>(null);
    const print = () => {
        const sheet = window.open('', '_blank', 'width=720,height=900');
        const code = qr.current?.querySelector('svg')?.outerHTML;
        if (!sheet || !code) { onError(copy('The print window was blocked. Allow pop-ups and try again.', 'ბეჭდვის ფანჯარა დაიბლოკა. დაუშვით pop-up და სცადეთ ხელახლა.')); return; }
        const title = copy(`Join ${squad}`, `შემოუერთდით: ${squad}`);
        sheet.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title><style>body{margin:0;font-family:system-ui,sans-serif;color:${visualColors.qrInk};background:${visualColors.paper};text-align:center}main{padding:48px 32px}h1{font-size:40px;margin:0 0 8px}p{font-size:20px;margin:0 0 32px;opacity:.75}svg{width:340px;height:340px}small{display:block;margin-top:24px;font-size:16px;word-break:break-all;opacity:.75}</style></head><body><main><h1>${escape(title)}</h1><p>${escape(club)} · ${escape(copy('Scan with your phone camera', 'დაასკანერეთ ტელეფონის კამერით'))}</p>${code}<small>${escape(url)}</small></main></body></html>`);
        sheet.document.close();
        sheet.focus();
        sheet.print();
    };
    return <div className="sp-share">
        <div className="sp-share__qr" ref={qr}><QRCodeSVG value={url} size={132} marginSize={2} bgColor={visualColors.paper} fgColor={visualColors.qrInk} title={copy(`QR code for ${squad}`, `QR კოდი: ${squad}`)} /></div>
        <div className="sp-share__actions">
            <input className="gk-input" readOnly value={url} aria-label={copy('Join link', 'გაწევრიანების ბმული')} onFocus={e => e.currentTarget.select()} />
            <div className="sp-share__buttons">
                <Button onClick={() => void navigator.clipboard.writeText(url).then(() => setCopied(true)).catch(() => onError(copy('Copy the link from the box.', 'დააკოპირეთ ბმული ველიდან.')))}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? copy('Copied', 'დაკოპირდა') : copy('Copy', 'კოპირება')}</Button>
                <a className="gk-btn gk-btn--primary" href={`https://wa.me/?text=${encodeURIComponent(`${squad} · ${club}\n${url}`)}`} target="_blank" rel="noopener noreferrer"><Share2 aria-hidden="true" />WhatsApp</a>
                <Button onClick={print}><Printer aria-hidden="true" />{copy('Print', 'ბეჭდვა')}</Button>
            </div>
        </div>
    </div>;
}
