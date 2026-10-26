import type { CSSProperties, ReactNode } from 'react';
import { Baby, Briefcase, Building2, Shield, Shirt, UserRound, type LucideIcon } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { WelcomeFrame } from '../WelcomeFrame';
import type { Choice } from '../welcomeSteps';

const photo = (url: string, position = 'center') => ({ '--tile-photo': `url(${url})`, '--tile-position': position }) as CSSProperties;

function TileText({ icon: Icon, title, line, quiet }: { icon: LucideIcon; title: string; line: string; quiet?: string }) {
    return <span className="gk-wtile__text">
        <span className="gk-wtile__icon"><Icon aria-hidden="true" /></span>
        <strong>{title}</strong>
        <span className="gk-wtile__line">{line}</span>
        {quiet && <small>{quiet}</small>}
    </span>;
}

/**
 * Step 1, "What brings you to GrassKickZ?". Size shows weight: Play football (with For me and For my child as its
 * two halves) and A club are large, Work or volunteer and A business or organisation medium, each with one plain line
 * and a quiet line naming the people it is for. The footer has "I'm here to follow football" and Skip (the same answer).
 */
export function WhatBringsStep({ choices, onPick, onSkip }: { choices: readonly Choice[]; onPick: (choice: Choice) => void; onSkip: () => void }) {
    const copy = useJourneyCopy();
    const has = (choice: Choice) => choices.includes(choice);
    const play = copy('Play football', 'ფეხბურთის თამაში');
    const half = (choice: Choice, Icon: LucideIcon, label: string): ReactNode => has(choice) &&
        <button type="button" className="gk-wtile__half" aria-label={`${play}: ${label}`} onClick={() => onPick(choice)}><Icon aria-hidden="true" />{label}</button>;
    return <WelcomeFrame position={1} title={copy('What brings you to GrassKickZ?', 'რამ მოგიყვანათ GrassKickZ-ზე?')} onClose={onSkip}
        footer={<>
            <Button variant="secondary" className="gk-welcome__follow" onClick={() => onPick('follow')}>
                <span>{copy('I’m here to follow football', 'უბრალოდ ფეხბურთს ვადევნებ თვალს')}<small>{copy('Pick a few clubs near you', 'აირჩიეთ რამდენიმე ახლომდებარე კლუბი')}</small></span>
            </Button>
            <Button variant="ghost" onClick={onSkip}>{copy('Skip', 'გამოტოვება')}</Button>
        </>}>
        <div className="gk-wtiles">
            <section className="gk-wtile gk-wtile--large" style={photo('/football/touchline.jpg', '30% 50%')} aria-label={play}>
                <TileText icon={Shirt} title={play} line={copy('Find a team, trials and training near you.', 'იპოვეთ გუნდი, გასინჯვები და ვარჯიში ახლოს.')} />
                <span className="gk-wtile__halves">
                    {half('me', UserRound, copy('For me', 'ჩემთვის'))}
                    {half('child', Baby, copy('For my child', 'ჩემი შვილისთვის'))}
                </span>
            </section>
            {has('club') && <button type="button" className="gk-wtile gk-wtile--large" style={photo('/football/ball-field.jpg')} onClick={() => onPick('club')}>
                <TileText icon={Shield} title={copy('A club', 'კლუბი')} line={copy('Run your club, coach its squads, or start a new one.', 'მართეთ კლუბი, ავარჯიშეთ მისი გუნდები ან დააარსეთ ახალი.')}
                    quiet={copy('Owners, coaches, managers, academy staff', 'მფლობელები, მწვრთნელები, მენეჯერები, აკადემიის თანამშრომლები')} />
            </button>}
            {has('work') && <button type="button" className="gk-wtile gk-wtile--medium" style={photo('/venue-demo/pitch-indoor.jpg')} onClick={() => onPick('work')}>
                <TileText icon={Briefcase} title={copy('Work or volunteer', 'სამუშაო ან მოხალისეობა')} line={copy('Jobs and ways to help local clubs.', 'სამუშაო და მოხალისეობა ადგილობრივ კლუბებში.')}
                    quiet={copy('Coaches, referees, physios, analysts, agents, volunteers', 'მწვრთნელები, მსაჯები, ფიზიოთერაპევტები, ანალიტიკოსები, აგენტები, მოხალისეები')} />
            </button>}
            {has('business') && <button type="button" className="gk-wtile gk-wtile--medium" style={photo('/venue-demo/pitch-aerial.jpg')} onClick={() => onPick('business')}>
                <TileText icon={Building2} title={copy('A business or organisation', 'ბიზნესი ან ორგანიზაცია')} line={copy('Sponsor clubs, run tournaments, sell kit, rent pitches.', 'დააფინანსეთ კლუბები, მოაწყვეთ ტურნირები, გაყიდეთ ეკიპირება, გააქირავეთ მოედნები.')}
                    quiet={copy('Sponsors, kit makers, pitch owners, organisers', 'სპონსორები, ეკიპირების მწარმოებლები, მოედნების მფლობელები, ორგანიზატორები')} />
            </button>}
        </div>
    </WelcomeFrame>;
}
