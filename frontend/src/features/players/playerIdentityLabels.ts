import { PLAYER_POSITIONS } from '../joining-contract/types';
const labels: Record<typeof PLAYER_POSITIONS[number], readonly [string, string]> = {
    GK: ['Goalkeeper', 'მეკარე'], CB: ['Centre back', 'ცენტრალური მცველი'],
    LB: ['Left back', 'მარცხენა მცველი'], RB: ['Right back', 'მარჯვენა მცველი'],
    LWB: ['Left wing back', 'მარცხენა შემტევი მცველი'], RWB: ['Right wing back', 'მარჯვენა შემტევი მცველი'],
    DM: ['Defensive midfielder', 'საყრდენი ნახევარმცველი'], CM: ['Central midfielder', 'ცენტრალური ნახევარმცველი'],
    AM: ['Attacking midfielder', 'შემტევი ნახევარმცველი'], LM: ['Left midfielder', 'მარცხენა ნახევარმცველი'],
    RM: ['Right midfielder', 'მარჯვენა ნახევარმცველი'], LW: ['Left winger', 'მარცხენა ვინგერი'],
    RW: ['Right winger', 'მარჯვენა ვინგერი'], ST: ['Striker', 'თავდამსხმელი'], CF: ['Centre forward', 'ცენტრალური თავდამსხმელი'],
};
export const playerPositionChoices = PLAYER_POSITIONS.map(code => [code, ...labels[code]] as const);
export const playerPositionLabel = (code: string, copy: (en: string, ka: string) => string) => {
    const label = labels[code as keyof typeof labels];
    return label ? copy(...label) : code.replaceAll('_', ' ').toLowerCase();
};
