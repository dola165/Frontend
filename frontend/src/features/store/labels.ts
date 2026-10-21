import { ct } from './copy';
import { Backpack, CalendarDays, CreditCard, Dumbbell, Footprints, Package, Shirt, Ticket, Volleyball, type LucideIcon } from 'lucide-react';
import type { StoreCollection, StoreProductCategory, StoreSort } from './api';

/** Football words for the catalogue's categories, with the symbol each shows on the storefront. */
export const CATEGORIES: Array<{ id: StoreProductCategory; label: string; icon: LucideIcon }> = [
    { id: 'EQUIPMENT', label: 'Equipment', icon: Volleyball },
    { id: 'SHIRT', label: 'Shirts', icon: Shirt },
    { id: 'TRAINING', label: 'Training wear', icon: Dumbbell },
    { id: 'FOOTWEAR', label: 'Footwear', icon: Footprints },
    { id: 'ACCESSORIES', label: 'Accessories', icon: Backpack },
    { id: 'TICKETS', label: 'Tickets', icon: Ticket },
    { id: 'MEMBERSHIP', label: 'Membership', icon: CreditCard },
    { id: 'EVENT', label: 'Events', icon: CalendarDays },
    { id: 'OTHER', label: 'Other', icon: Package },
];
export const categoryLabel = (value?: string | null) => ct(CATEGORIES.find(category => category.id === value)?.label) ?? ct("Other");

/** GrassKickZ's own equipment, as the storefront groups it. */
export const COLLECTIONS: Array<{ id: StoreCollection; label: string; line: string }> = [
    { id: 'BALLS', label: 'Balls', line: 'Match and training, sizes 4 and 5' },
    { id: 'CONES', label: 'Cones & markers', line: 'Cones, flat markers, ladders' },
    { id: 'BIBS', label: 'Bibs', line: 'Sets of 10, junior and senior' },
    { id: 'SHIN_GUARDS', label: 'Shin guards', line: 'XS to L' },
    { id: 'GLOVES', label: 'Goalkeeper gloves', line: 'Sizes 6 to 10' },
    { id: 'GOALS', label: 'Goals', line: 'Pop-up, for small-sided games' },
    { id: 'TRAINING_WEAR', label: 'Training wear', line: 'Tops and shorts' },
    { id: 'ACCESSORIES', label: 'Accessories', line: 'Pumps, bottles, armbands, first aid' },
];
export const collectionLabel = (value?: string | null) => ct(COLLECTIONS.find(collection => collection.id === value)?.label) ?? null;

export const SORTS: Array<{ value: StoreSort; label: string }> = [
    { value: 'RELEVANCE', label: 'Relevance' }, { value: 'NEWEST', label: 'Newest' }, { value: 'PRICE_LOW', label: 'Price: low to high' }, { value: 'PRICE_HIGH', label: 'Price: high to low' },
];
export const CURRENCIES = ['GEL', 'EUR', 'GBP', 'USD'];
