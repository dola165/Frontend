import { useState } from 'react';
import { ButtonLink, FixtureRow, List, Skeleton } from '../../../design/primitives';
import { SideBlock } from '../../../design/profile/ProfileLayout';
import { dayLabel, kindOf, timeLabel } from '../../clubWorkspace/fixtures';
import { useOverviewSource } from '../../clubs/useOverviewSource';
import type { ScheduleEventOccurrence } from '../../schedule/api';
import { activityColors, activityIcons } from '../../schedule/activityIcons';
import { usePagesCopy } from '../copy';
import type { BoxProps } from '../edit/boxRegistry';

/**
 * "Coming up": a club's next three sessions and matches from the one calendar, each with its activity's symbol and
 * colour. Planning happens in the calendar (My squads, the workspace), never here: the box only shows and links.
 */
export function EventsBox({ page, editing }: BoxProps) {
  const t = usePagesCopy();
  const [window] = useState(() => {
    const start = new Date(), end = new Date(start); end.setDate(end.getDate() + 30);
    const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
    return `from=${local(start)}&to=${local(end)}`;
  });
  // Read again whenever the teams change: their days and times are the training sessions shown here.
  const schedule = useOverviewSource<{ events: ScheduleEventOccurrence[] }>(`/schedule/clubs/${page.clubId ?? 0}/events?${window}&teams=${page.boxes.squads.version}`);
  const events = [...(schedule.data?.events ?? [])].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 3);
  // Visitors never see an empty box; the owner sees where the calendar's entries will show.
  if (!editing && !schedule.loading && events.length === 0) return null;
  const calendar = page.clubId ? `/clubs/${page.clubId}/office?tab=calendar` : undefined;
  return (
    <SideBlock title={t('Coming up')} hint={t('The next sessions and matches')} action={editing && calendar ? <ButtonLink size="sm" variant="ghost" to={calendar}>{t('Plan')}</ButtonLink> : undefined}>
      {schedule.loading ? <Skeleton height={44} /> : events.length === 0 ? <p className="gk-muted">{t('Nothing planned in the next 30 days.')}</p>
        : <List label={t('Coming up')}>{events.map(event => {
          const kind = kindOf(event);
          return <FixtureRow key={`${event.occurrenceId}:${event.startsAt}`} time={timeLabel(event.startsAt)} day={dayLabel(event.startsAt)} title={event.title}
            meta={event.opponentClubName ? `v ${event.opponentClubName}` : event.locationName ?? undefined} tone={kind.tone} icon={activityIcons[event.eventType]} iconColor={activityColors[event.eventType]} to={calendar} />;
        })}</List>}
    </SideBlock>
  );
}
