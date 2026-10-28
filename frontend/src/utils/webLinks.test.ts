import { expect, it } from 'vitest';
import { webLinkParts } from './webLinks';

const links = (text: string) => webLinkParts(text).flatMap(piece => piece.href ? [[piece.text, piece.href]] : []);

it('links http(s) addresses and bare domains, opened as https, without the sentence around them', () => {
    expect(links('Fixtures on https://rustavi-lions.ge/fixtures and rustavi-lions.ge.')).toEqual([
        ['https://rustavi-lions.ge/fixtures', 'https://rustavi-lions.ge/fixtures'], ['rustavi-lions.ge', 'https://rustavi-lions.ge/']]);
    expect(links('See www.dinamo.ge/academy?x=1, or (http://old.club.ge).')).toEqual([
        ['www.dinamo.ge/academy?x=1', 'https://www.dinamo.ge/academy?x=1'], ['http://old.club.ge', 'http://old.club.ge/']]);
});

it('never links anything else, and keeps every word', () => {
    for (const text of ['Write to info@rustavi-lions.ge', 'javascript:alert(1)', 'mailto:info@club.ge', 'ftp://club.ge', 'e.g. the U14.boys train at 5.30', 'Mr.Smith coaches'])
        expect(links(text), text).toEqual([]);
    // Markup is only words: the address inside it is the one link, and nothing is lost.
    const markup = '<a href="https://club.ge">club</a>';
    expect(links(markup)).toEqual([['https://club.ge', 'https://club.ge/']]);
    expect(webLinkParts(markup).map(piece => piece.text).join('')).toBe(markup);
});
