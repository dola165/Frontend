export interface ExistingTravelLink { label: string; href: string }
export function existingTravelLinks(error: unknown): ExistingTravelLink[] {
    const links = (error as { response?: { data?: { links?: unknown } } })?.response?.data?.links;
    return Array.isArray(links) ? links.filter((l): l is ExistingTravelLink => Boolean(l && typeof l.label === 'string' && typeof l.href === 'string'
        && (/^\/world\/map\?plans=staff&/.test(l.href) || /^\/clubs\/[1-9]\d*\/office\?/.test(l.href)))) : [];
}
