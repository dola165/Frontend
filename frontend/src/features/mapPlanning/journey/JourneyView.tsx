import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react';
import { Button, FixtureRow, Section, type FixtureTone } from '../../../design/primitives';
import { dateTime, type FamilyItinerary } from '../api';
import { PlacePhoto } from '../PlacePhoto';
import { KIND_LABEL, durationLabel, kmLabel, legsOf, stopClock, stopsOf, type ItineraryStop } from '../planner/itinerary';
import './journey.css';

const toneOf = (stop: ItineraryStop): FixtureTone => stop.activityKind === 'MATCH' ? 'match' : stop.activityKind === 'TRAINING' ? 'training' : stop.kind === 'activity' && stop.activityKind !== 'TRAVEL' ? 'event' : 'neutral';

/**
 * A journey as families read it: the facts, the message, what to bring, and every stop on a
 * fixture line. "Play" walks through the stops one by one on the map.
 */
export function JourneyView({ itinerary, selected, onSelect, heading, children }: {
    itinerary: FamilyItinerary; selected: string | null; onSelect: (stop: ItineraryStop | null) => void; heading: ReactNode; children?: ReactNode;
}) {
    const stops = stopsOf(itinerary);
    const legs = legsOf(stops);
    const zone = itinerary.timezone;
    const [playing, setPlaying] = useState(false);
    const index = stops.findIndex(stop => stop.id === selected);
    const current = index >= 0 ? stops[index] : null;
    useEffect(() => {
        if (!playing) return;
        const timer = setTimeout(() => { if (index >= stops.length - 1) setPlaying(false); else onSelect(stops[index + 1]); }, index < 0 ? 0 : 3500);
        return () => clearTimeout(timer);
    }, [playing, index, stops, onSelect]);
    useEffect(() => { const stop = () => { if (document.hidden) setPlaying(false); }; document.addEventListener('visibilitychange', stop); return () => document.removeEventListener('visibilitychange', stop); }, []);
    const move = (step: number) => { setPlaying(false); onSelect(stops[Math.max(0, Math.min(stops.length - 1, index + step))]); };
    return (
        <div className="gk-plan-body gk-journey">
            {heading}
            <dl className="gk-plan-facts">
                <dt>When</dt><dd>{dateTime(itinerary.startsAt, zone)} – {dateTime(itinerary.endsAt, zone)}</dd>
                <dt>Meet</dt><dd>{itinerary.meetingPoint || 'To be confirmed'}</dd>
                <dt>Collect</dt><dd>{itinerary.collectionPoint || 'To be confirmed'}</dd>
                <dt>Contact</dt><dd>{itinerary.supervisionContact || 'To be confirmed'}</dd>
            </dl>
            {itinerary.message && <Section title="From the club"><p className="gk-journey__message">{itinerary.message}</p></Section>}
            {itinerary.bring && itinerary.bring.length > 0 && (
                <Section title="Bring"><ul className="gk-plan-bring gk-plan-bring--static">{itinerary.bring.map(item => <li key={item}><span>{item}</span></li>)}</ul></Section>
            )}
            <Section title="The day" action={<div className="gk-row">
                <Button size="sm" variant="ghost" iconOnly aria-label="Previous stop" disabled={index <= 0} onClick={() => move(-1)}><ArrowLeft aria-hidden="true" /></Button>
                <Button size="sm" aria-pressed={playing} onClick={() => { if (!playing && (index < 0 || index >= stops.length - 1)) onSelect(stops[0]); setPlaying(value => !value); }}>{playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}{playing ? 'Pause' : 'Play the journey'}</Button>
                <Button size="sm" variant="ghost" iconOnly aria-label="Next stop" disabled={index >= stops.length - 1} onClick={() => move(1)}><ArrowRight aria-hidden="true" /></Button>
            </div>}>
                <ol className="gk-plan-timeline" aria-label="Journey stops">
                    {stops.map((stop, i) => {
                        const clock = stopClock(stop.startsAt, zone), leg = legs[i];
                        return (
                            <Fragment key={stop.id}>
                                <li className="gk-plan-stop" data-current={stop.id === selected || undefined}>
                                    <ul className="gk-list">
                                        <FixtureRow tone={toneOf(stop)} time={clock.time} day={clock.day} label={`${stop.title}, ${clock.time}`} onClick={() => { setPlaying(false); onSelect(stop.id === selected ? null : stop); }}
                                            title={stop.title}
                                            meta={[stop.activityKind ? KIND_LABEL[stop.activityKind] : null, stop.place?.name ?? (stop.note || (stop.activityKind === 'TRAVEL' ? null : 'Place to be confirmed')), stop.endsAt ? `until ${stopClock(stop.endsAt, zone).time}` : null].filter(Boolean).join(' · ')} />
                                    </ul>
                                    {stop.id === selected && (stop.place?.photoUrl || stop.place?.address) && (
                                        <div className="gk-journey__stop">
                                            {stop.place?.photoUrl && <PlacePhoto url={stop.place.photoUrl} name={stop.place.name} />}
                                            {stop.place?.address && <p className="gk-muted">{stop.place.address}</p>}
                                        </div>
                                    )}
                                </li>
                                {leg && (leg.minutes != null || leg.km != null) && <li className="gk-plan-leg"><ArrowDown aria-hidden="true" />{[leg.minutes != null ? `${durationLabel(leg.minutes)} later` : null, leg.km != null ? `${kmLabel(leg.km)} apart` : null].filter(Boolean).join(' · ')}</li>}
                            </Fragment>
                        );
                    })}
                </ol>
                {current && <p className="gk-faint" role="status">Stop {index + 1} of {stops.length}: {current.title}</p>}
            </Section>
            {itinerary.arrangements && itinerary.arrangements.length > 0 && (
                <Section title="Arranged by the club"><ul className="gk-plan-mini">{itinerary.arrangements.map((item, i) => <li key={i}><span>{item.title}</span>{item.place && <span className="gk-faint">{item.place}</span>}</li>)}</ul></Section>
            )}
            {children}
        </div>
    );
}
