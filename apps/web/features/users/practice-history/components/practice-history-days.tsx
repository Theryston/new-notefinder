'use client';

import type { PracticeAttemptHistoryItem } from '@notefinder/contracts';
import { useFormatter } from 'next-intl';

import { groupAttemptsByDay } from '../group-attempts-by-day';
import { PracticeHistoryRow } from './practice-history-row';

/**
 * The loaded runs as one list per calendar day, each day headed by its date
 * and read in the viewer's time zone. Rendered only once that zone is known
 * (see the list), so the server and the first render never disagree.
 */
export function PracticeHistoryDays({
  attempts,
  timeZone,
}: {
  attempts: PracticeAttemptHistoryItem[];
  timeZone: string;
}) {
  const format = useFormatter();
  return (
    <div className="flex flex-col gap-6">
      {groupAttemptsByDay(attempts, timeZone).map((group) => (
        <div
          key={group.day}
          data-day={group.day}
          className="flex flex-col gap-2"
        >
          <h3 className="font-semibold text-muted-foreground text-sm">
            {format.dateTime(new Date(group.startedAt), {
              dateStyle: 'long',
              timeZone,
            })}
          </h3>
          <ul className="flex flex-col gap-1">
            {group.attempts.map((attempt) => (
              <PracticeHistoryRow
                key={attempt.id}
                attempt={attempt}
                time={format.dateTime(new Date(attempt.createdAt), {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone,
                })}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
