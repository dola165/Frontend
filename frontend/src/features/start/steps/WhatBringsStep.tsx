import type { CSSProperties } from 'react';
import { Baby, Building2, ClipboardList, Shield, UserRound, Volleyball, type LucideIcon } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { WelcomeFrame } from '../WelcomeFrame';
import { WelcomeTileArt, type TileArtKind } from '../WelcomeTileArt';
import type { Choice } from '../welcomeSteps';

/** Each tile's own soft colour: Play green, Club blue, Work amber, Business violet. */
const TONE: Record<TileArtKind, CSSProperties> = {
    play: { '--wt': 'var(--gk-accent)' } as CSSProperties, club: { '--wt': 'var(--gk-info)' } as CSSProperties,
    work: { '--wt': 'var(--gk-warning)' } as CSSProperties, business: { '--wt': 'var(--gk-violet)' } as CSSProperties,
};

function TileText({ icon: Icon, title, line, quiet }: { icon: LucideIcon; title: string; line: string; quiet?: string }) {
    return <span className="gk-wtile__text">
        <span className="gk-wtile__icon"><Icon aria-hidden="true" /></span>
        <strong>{title}</strong>
        <span className="gk-wtile__line">{line}</span>
        {quiet && <small>{quiet}</small>}
    </span>;
}
/** What happens next, in two short lines: shown on hover and focus, always on a phone. */
const Next = ({ lines }: { lines: [string, string] }) => <span className="gk-wtile__next">{lines.map(line => <span key={line}>{line}</span>)}</span>;

/**
 * Step 1, "What brings you to GrassKickZ?". Size shows weight: Play football (with For me and For my child as its
 * two halves) and A club are large, Work or volunteer and A business or organisation medium. Each tile is drawn in its
 * own colour with a football symbol (no photos, owner 27 October); hovering lifts it, dims the others and says what
 * happens next. The footer has "I'm here to follow football" and Skip (the same answer).
 */
export function WhatBringsStep({ choices, onPick, onSkip }: { choices: readonly Choice[]; onPick: (choice: Choice) => void; onSkip: () => void }) {
    const copy = useJourneyCopy();
    const has = (choice: Choice) => choices.includes(choice);
    const play = copy('Play football', 'ფეხბურთის თამაში');
    const half = (choice: Choice, Icon: LucideIcon, label: string, next: [string, string]) => has(choice) &&
        <button type="button" className="gk-wtile__half" aria-label={`${play}: ${label}`} onClick={() => onPick(choice)}>
            <span className="gk-wtile__halflabel"><Icon aria-hidden="true" />{label}</span>
            <Next lines={next} />
        </button>;
    return <WelcomeFrame position={1} title={copy('What brings you to GrassKickZ?', 'რამ მოგიყვანათ GrassKickZ-ზე?')} onClose={onSkip}
        footer={<>
            <Button variant="secondary" className="gk-welcome__follow" onClick={() => onPick('follow')}>
                <span>{copy('I’m here to follow football', 'უბრალოდ ფეხბურთს ვადევნებ თვალს')}<small>{copy('Pick a few clubs near you', 'აირჩიეთ რამდენიმე ახლომდებარე კლუბი')}</small></span>
            </Button>
            <Button variant="ghost" onClick={onSkip}>{copy('Skip', 'გამოტოვება')}</Button>
        </>}>
        <div className="gk-wtiles">
            <section className="gk-wtile gk-wtile--large gk-wtile--play" style={TONE.play} aria-label={play}>
                <WelcomeTileArt kind="play" />
                <TileText icon={Volleyball} title={play} line={copy('Find a team, trials and training near you.', 'იპოვეთ გუნდი, გასინჯვები და ვარჯიში ახლოს.')} />
                <span className="gk-wtile__halves">
                    {half('me', UserRound, copy('For me', 'ჩემთვის'), [copy('Clubs near you that take your age.', 'ახლომდებარე კლუბები თქვენი ასაკისთვის.'), copy('Trials and training in one tap.', 'გასინჯვა და ვარჯიში ერთი შეხებით.')])}
                    {half('child', Baby, copy('For my child', 'ჩემი შვილისთვის'), [copy('Pick the year they were born.', 'აირჩიეთ დაბადების წელი.'), copy('See clubs with a group for that age.', 'ნახეთ კლუბები ამ ასაკის ჯგუფით.')])}
                </span>
            </section>
            {has('club') && <button type="button" className="gk-wtile gk-wtile--large" style={TONE.club} onClick={() => onPick('club')}>
                <WelcomeTileArt kind="club" />
                <TileText icon={Shield} title={copy('A club', 'კლუბი')} line={copy('Run your club, coach its squads, or start a new one.', 'მართეთ კლუბი, ავარჯიშეთ მისი გუნდები ან დააარსეთ ახალი.')}
                    quiet={copy('Owners, coaches, managers, academy staff', 'მფლობელები, მწვრთნელები, მენეჯერები, აკადემიის თანამშრომლები')} />
                <Next lines={[copy('Start your club’s page in a minute.', 'შექმენით კლუბის გვერდი ერთ წუთში.'), copy('Invite your coaches with one link.', 'მოიწვიეთ მწვრთნელები ერთი ბმულით.')]} />
            </button>}
            {has('work') && <button type="button" className="gk-wtile gk-wtile--medium" style={TONE.work} onClick={() => onPick('work')}>
                <WelcomeTileArt kind="work" />
                <TileText icon={ClipboardList} title={copy('Work or volunteer', 'სამუშაო ან მოხალისეობა')} line={copy('Jobs and ways to help local clubs.', 'სამუშაო და მოხალისეობა ადგილობრივ კლუბებში.')}
                    quiet={copy('Coaches, referees, physios, analysts, agents, volunteers', 'მწვრთნელები, მსაჯები, ფიზიოთერაპევტები, ანალიტიკოსები, აგენტები, მოხალისეები')} />
                <Next lines={[copy('Say what you do. Clubs can find you.', 'მიუთითეთ, რას აკეთებთ. კლუბები გიპოვიან.'), copy('See jobs near you.', 'ნახეთ სამუშაო ახლოს.')]} />
            </button>}
            {has('business') && <button type="button" className="gk-wtile gk-wtile--medium" style={TONE.business} onClick={() => onPick('business')}>
                <WelcomeTileArt kind="business" />
                <TileText icon={Building2} title={copy('A business or organisation', 'ბიზნესი ან ორგანიზაცია')} line={copy('Sponsor clubs, run tournaments, sell kit, rent pitches.', 'დააფინანსეთ კლუბები, მოაწყვეთ ტურნირები, გაყიდეთ ეკიპირება, გააქირავეთ მოედნები.')}
                    quiet={copy('Sponsors, kit makers, pitch owners, organisers', 'სპონსორები, ეკიპირების მწარმოებლები, მოედნების მფლობელები, ორგანიზატორები')} />
                <Next lines={[copy('Pick what kind you are.', 'აირჩიეთ, რა ტიპის ხართ.'), copy('Your page is ready to fill in.', 'თქვენი გვერდი მზადაა შესავსებად.')]} />
            </button>}
        </div>
    </WelcomeFrame>;
}
