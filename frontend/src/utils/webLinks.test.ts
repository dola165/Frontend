import { expect, it } from 'vitest';
import { webLinkParts } from './webLinks';

const links = (text: string) => webLinkParts(text).flatMap(piece => piece.href ? [[piece.text, piece.href]] : []);

it('links http(s) addresses and bare domains, opened as https, without the sentence around them', () => {
    expect(links('Fixtures on https://rustavi-lions.ge/fixtures and rustavi-lions.ge.')).toEqual([
        ['https://rustavi-lions.ge/fixtures', 'https://rustavi-lions.ge/fixtures'], ['rustavi-lions.ge', 'https://rustavi-lions.ge/']]);
    expect(links('See www.dinamo.ge/fixtures?x=1, or (http://old.club.ge).')).toEqual([
        ['www.dinamo.ge/fixtures?x=1', 'https://www.dinamo.ge/fixtures?x=1'], ['http://old.club.ge', 'http://old.club.ge/']]);
});

it('never links part of an email address or of a longer word', () => {
    // A public club story must not send parents to domains the club doesn't own.
    expect(links('Write to dinamo.academy@gmail.com')).toEqual([]);
    expect(links('nino.ge@mail.ru')).toEqual([]);
    expect(links('dіnamo.ge')).toEqual([]); // a Cyrillic і
    expect(links('e.g. the U14.boys train at 5.30, Mr.Smith coaches')).toEqual([]);
});

it('ends a link at closing quotes and at a dot before a closing bracket', () => {
    expect(links('„https://club.ge“ and «dinamo.ge» and ‘https://club.ge/a’ and “https://club.ge/b”.')).toEqual([
        ['https://club.ge', 'https://club.ge/'], ['dinamo.ge', 'https://dinamo.ge/'], ['https://club.ge/a', 'https://club.ge/a'], ['https://club.ge/b', 'https://club.ge/b']]);
    expect(links('(see https://club.ge.)')).toEqual([['https://club.ge', 'https://club.ge/']]);
});

it('never links another scheme, an address with a user name, or markup, and keeps every word', () => {
    for (const text of ['javascript:alert(1)', 'mailto:info@club.ge', 'ftp://club.ge', 'https://google.com@evil.com/login'])
        expect(links(text), text).toEqual([]);
    const markup = '<a href="https://club.ge">club</a>';
    expect(links(markup)).toEqual([['https://club.ge', 'https://club.ge/']]);
    expect(webLinkParts(markup).map(piece => piece.text).join('')).toBe(markup);
});
