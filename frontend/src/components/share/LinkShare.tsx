import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Printer, Share2 } from 'lucide-react';
import { Button } from '../../design/primitives';
import { visualColors } from '../../styles/visualColors';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import './link-share.css';

const escape = (text: string) => text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

/**
 * One link to share anywhere: a QR code to show on a phone or print, Copy, WhatsApp and Print. Print opens a plain
 * sheet (title, subtitle, the code and the address) in a new window. Used by the squad join link and the staff link.
 */
export function LinkShare({ url, title, subtitle, message, label, onError }: {
    url: string; title: string; subtitle: string; message: string; label: string; onError: (message: string) => void;
}) {
    const copy = useJourneyCopy();
    const [copied, setCopied] = useState(false);
    const qr = useRef<HTMLDivElement>(null);
    const print = () => {
        const sheet = window.open('', '_blank', 'width=720,height=900');
        const code = qr.current?.querySelector('svg')?.outerHTML;
        if (!sheet || !code) { onError(copy('The print window was blocked. Allow pop-ups and try again.', 'ბეჭდვის ფანჯარა დაიბლოკა. დაუშვით pop-up და სცადეთ ხელახლა.')); return; }
        sheet.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title><style>body{margin:0;font-family:system-ui,sans-serif;color:${visualColors.qrInk};background:${visualColors.paper};text-align:center}main{padding:48px 32px}h1{font-size:40px;margin:0 0 8px}p{font-size:20px;margin:0 0 32px;opacity:.75}svg{width:340px;height:340px}small{display:block;margin-top:24px;font-size:16px;word-break:break-all;opacity:.75}</style></head><body><main><h1>${escape(title)}</h1><p>${escape(subtitle)} · ${escape(copy('Scan with your phone camera', 'დაასკანერეთ ტელეფონის კამერით'))}</p>${code}<small>${escape(url)}</small></main></body></html>`);
        sheet.document.close();
        sheet.focus();
        sheet.print();
    };
    return <div className="gk-share">
        <div className="gk-share__qr" ref={qr}><QRCodeSVG value={url} size={132} marginSize={2} bgColor={visualColors.paper} fgColor={visualColors.qrInk} title={copy(`QR code: ${title}`, `QR კოდი: ${title}`)} /></div>
        <div className="gk-share__actions">
            <input className="gk-input" readOnly value={url} aria-label={label} onFocus={e => e.currentTarget.select()} />
            <div className="gk-share__buttons">
                <Button onClick={() => void navigator.clipboard.writeText(url).then(() => setCopied(true)).catch(() => onError(copy('Copy the link from the box.', 'დააკოპირეთ ბმული ველიდან.')))}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? copy('Copied', 'დაკოპირდა') : copy('Copy', 'კოპირება')}</Button>
                <a className="gk-btn gk-btn--primary" href={`https://wa.me/?text=${encodeURIComponent(`${message}\n${url}`)}`} target="_blank" rel="noopener noreferrer"><Share2 aria-hidden="true" />WhatsApp</a>
                <Button onClick={print}><Printer aria-hidden="true" />{copy('Print', 'ბეჭდვა')}</Button>
            </div>
        </div>
    </div>;
}
