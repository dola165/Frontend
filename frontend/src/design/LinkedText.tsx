import { Fragment } from 'react';
import { webLinkParts } from '../utils/webLinks';
import './linked-text.css';

/** Text with its web addresses (http(s) and bare domains) as links that open in a new tab; nothing else is a link. */
export function LinkedText({ text }: { text: string }) {
    return <>{webLinkParts(text).map((piece, index) => piece.href
        ? <a key={index} className="gk-text-link" href={piece.href} target="_blank" rel="noopener noreferrer">{piece.text}</a>
        : <Fragment key={index}>{piece.text}</Fragment>)}</>;
}
