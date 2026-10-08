import { ListOrdered, GitFork, Network, RotateCw, Check, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Family, Structure } from './api';

const families = [
  { id: 'LEAGUE', icon: ListOrdered, title: ['Leagues', 'ლიგები'], description: ['A season of fixtures. Build your points total.', 'მატჩების სეზონი. დააგროვეთ ქულები.'], detail: ['Round-robin · Home & away · Playoffs', 'წრიული · შინ და სტუმრად · პლეიოფი'] },
  { id: 'KNOCKOUT', icon: GitFork, title: ['Knockout cups', 'თასები გამოვარდნით'], description: ['Win your tie. Take one step closer to the trophy.', 'მოიგეთ შეხვედრა და მიუახლოვდით თასს.'], detail: ['Knockout rounds · Semi-finals · Final', 'გამოვარდნა · ნახევარფინალი · ფინალი'] },
  { id: 'GROUPS_KNOCKOUT', icon: Network, title: ['Groups & finals', 'ჯგუფები და ფინალები'], description: ['Start in a group. Qualify for the knockout rounds.', 'დაიწყეთ ჯგუფში. გადით შემდეგ ეტაპზე.'], detail: ['Group tables · Qualification · Cup run', 'ჯგუფები · კვალიფიკაცია · თასი'] },
  { id: 'FESTIVAL', icon: RotateCw, title: ['Football festivals', 'საფეხბურთო ფესტივალები'], description: ['Shorter games. More time on the pitch.', 'მოკლე მატჩები. მეტი სათამაშო დრო.'], detail: ['Development games · King of the Pitch', 'განვითარება · მოედნის მეფე'] },
] as const;

export function CompetitionOverview({ family: selectedFamily, structure, onSelect }: { family: Family | null; structure: string | null; onSelect: (family: Family | '', structure: Structure | '') => void }) {
  const { i18n } = useTranslation(), locale = i18n.language.startsWith('ka') ? 1 : 0;
  return <div className="mc-format-choices" role="group" aria-label={locale ? 'შეჯიბრების ტიპი' : 'Competition family'}>
    {families.map(family => {
      const cup = family.id === 'KNOCKOUT' || family.id === 'GROUPS_KNOCKOUT';
      const selected = cup ? selectedFamily === 'CUP' && structure === family.id : selectedFamily === family.id;
      return <button className={`mc-format-choice mc-tone-${family.id.toLowerCase()}`} type="button" key={family.id} aria-pressed={selected} onClick={() => onSelect(selected ? '' : cup ? 'CUP' : family.id, selected || !cup ? '' : family.id)}>
      <span className="mc-format-top"><span className="mc-format-symbol"><family.icon size={20} aria-hidden="true"/></span>{selected ? <Check size={16} aria-hidden="true"/> : <ArrowRight size={15} aria-hidden="true"/>}</span>
      <strong>{family.title[locale]}</strong><span className="mc-format-description">{family.description[locale]}</span><small>{family.detail[locale]}</small>
    </button>;})}
  </div>;
}
