import { Building2, Heart, Shield, Sparkles, type LucideIcon } from 'lucide-react';
import type { PageKind } from '../model/kinds';

/** The four tiles of "What are you creating?": the app's own football photos, a colour and a symbol each. */
export interface KindTile { icon: LucideIcon; color: string; photo: string; position?: string; label: string; hint: string; title: string; nameLabel: string; placeholder: string; create: string }
export const KIND_TILES: Record<Exclude<PageKind, 'VENUE'>, KindTile> = {
  CLUB: { icon: Shield, color: 'var(--gk-accent)', photo: '/football/ball-field.jpg', label: 'Club', hint: 'Squads, grounds, fees', title: 'Start your club', nameLabel: 'Club name', placeholder: 'Rustavi Lions', create: 'Create club' },
  FAN_CLUB: { icon: Heart, color: 'var(--color-pink)', photo: '/football/touchline.jpg', position: '30% 50%', label: 'Fan club', hint: 'Supporters of a club', title: 'Start a fan club', nameLabel: 'Fan club name', placeholder: 'Dinamo Rustavi fans', create: 'Create fan club' },
  BUSINESS: { icon: Building2, color: 'var(--gk-info)', photo: '/venue-demo/pitch-day.jpg', label: 'Sponsor or business', hint: 'Back a club, sell to clubs', title: 'Add your business', nameLabel: 'Business name', placeholder: 'Kartuli Bank', create: 'Create page' },
  PAGE: { icon: Sparkles, color: 'var(--gk-violet)', photo: '/venue-demo/pitch-sun.jpg', label: 'Other page', hint: 'Anything else in football', title: 'Create a page', nameLabel: 'Page name', placeholder: 'Kakheti referees', create: 'Create page' },
};
