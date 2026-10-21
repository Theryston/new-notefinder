/** The schedule of a pin: `null` means open-ended on that side. */
export type PinWindow = {
  startsAt: string | null;
  endsAt: string | null;
};

/** Where a pin is in its schedule: upcoming, current or past. */
export type EditorialPinStatus = 'scheduled' | 'live' | 'ended';

/**
 * The list's state of a pin from its window: before the start it is
 * scheduled, after the end it ended, otherwise it is live (an indefinite
 * pin is always live). The start is inclusive, the end exclusive.
 */
export function pinStatus(
  pin: PinWindow,
  now: Date = new Date(),
): EditorialPinStatus {
  const time = now.getTime();
  if (pin.startsAt && Date.parse(pin.startsAt) > time) return 'scheduled';
  if (pin.endsAt && Date.parse(pin.endsAt) <= time) return 'ended';
  return 'live';
}
