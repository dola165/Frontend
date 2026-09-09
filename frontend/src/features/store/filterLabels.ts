export const filterLabels: Record<string, string> = {
    query: 'Search', category: 'Category', country: 'Country', city: 'City',
    variant: 'Size / variant', minPrice: 'Minimum price', maxPrice: 'Maximum price', currency: 'Currency',
};
export const categoryLabel = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ');
