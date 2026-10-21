import { useEffect, useRef } from 'react';
import { fetchCartQuote, type CartQuote } from '../store/api';
import type { CartItem } from '../store/cart';
import { PaymentPreview } from './PaymentPreview';

export function CartPaymentPreview({ quote, items, onQuote }: { quote: CartQuote; items: CartItem[]; onQuote: (quote: CartQuote) => void }) {
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    return <PaymentPreview payment={{ kind: 'order', sourceId: quote.clubId, clubName: quote.clubName,
        title: `${quote.clubName} cart`, currency: quote.currency, amount: quote.subtotal,
        lines: quote.lines.map(line => `${line.name} · ${line.variant} × ${line.quantity}`),
    }} validate={async () => {
        let latest: CartQuote;
        try { latest = await fetchCartQuote(items); }
        catch { throw new Error('Prices or stock could not be confirmed. Use Retry check to refresh your cart before trying again.'); }
        if (JSON.stringify(latest.lines) !== JSON.stringify(quote.lines) || latest.subtotal !== quote.subtotal || latest.currency !== quote.currency || latest.clubId !== quote.clubId) {
            if (mounted.current) onQuote(latest);
            throw new Error('The cart changed. Review the latest prices and try again.');
        }
    }} />;
}
