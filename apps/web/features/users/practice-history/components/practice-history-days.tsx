'use client';

import type { PracticeAttemptHistoryItem } from '@notefinder/contracts';
import { useFormatter } from 'next-intl';

import { groupAttemptsByDay } from '../group-attempts-by-day';
import { PracticeHistoryRow } from './practice-history-row';

/**
 * The loaded runs as one list per day, each day headed by its date in the
 * viewer's time zone. Without a time zone (server render, hydration) the runs
 * form one plain list: no headings or times the server cannot know.
 */
export function PracticeHistoryDays({
  attempts,
  timeZone,
}: {
  attempts: PracticeAttemptHistoryItem[];
  timeZone: string | undefined;
}) {
  const format = useFormatter();
  if (timeZone === undefined) {
    return <DayList attempts={attempts} heading={null} time={() => null} />;
  }
  return (
    <div className="flex flex-col gap-6">
      {groupAttemptsByDay(attempts, timeZone).map((group) => {
        const [first] = group.attempts;
        return (
          <DayList
            key={group.day}
            attempts={group.attempts}
            heading={
              first
                ? format.dateTime(new Date(first.createdAt), {
                    dateStyle: 'long',
                    timeZone,
                  })
                : null
            }
            time={(attempt) =>
              format.dateTime(new Date(attempt.createdAt), {
                hour: '2-digit',
                minute: '2-digit',
                timeZone,
              })
            }
          />
        );
      })}
    </div>
  );
}

function DayList({
  attempts,
  heading,
  time,
}: {
  attempts: PracticeAttemptHistoryItem[];
  heading: string | null;
  time: (attempt: PracticeAttemptHistoryItem) => string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      {heading === null ? null : (
        <h3 className="font-semibold text-muted-foreground text-sm">
          {heading}
        </h3>
      )}
      <ul className="flex flex-col gap-1">
        {attempts.map((attempt) => (
          <PracticeHistoryRow
            key={attempt.id}
            attempt={attempt}
            time={time(attempt)}
          />
        ))}
      </ul>
    </div>
  );
}
