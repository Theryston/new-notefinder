import type { RecordEventsBody } from '@notefinder/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  buildClickEvent,
  type EventsTransport,
  eventsUrl,
  sendEventsBatch,
} from './events-sender';

const transport = () => ({
  sendBeacon: vi.fn<(url: string, data: BodyInit) => boolean>(),
  fetchKeepalive: vi.fn<(url: string, body: RecordEventsBody) => void>(),
});

describe('buildClickEvent', () => {
  it('carries the card, its row and where it was shown', () => {
    expect(
      buildClickEvent({
        rowId: 'row-0',
        feedVersion: 'a1b2c3d4e5f60718',
        algorithmVersion: 1,
        itemId: 'track-2',
        position: 2,
      }),
    ).toEqual({
      type: 'home.item_click',
      rowId: 'row-0',
      feedVersion: 'a1b2c3d4e5f60718',
      algorithmVersion: 1,
      itemId: 'track-2',
      position: 2,
    });
  });
});

describe('eventsUrl', () => {
  it('points at the ingestion endpoint whatever the trailing slash', () => {
    expect(eventsUrl('https://api.example.com')).toBe(
      'https://api.example.com/v1/events',
    );
    expect(eventsUrl('https://api.example.com/')).toBe(
      'https://api.example.com/v1/events',
    );
  });
});

describe('sendEventsBatch', () => {
  const events = [
    buildClickEvent({
      rowId: 'row-0',
      feedVersion: 'a1b2c3d4e5f60718',
      algorithmVersion: 1,
      itemId: 'track-2',
    }),
  ];

  it('sends nothing for an empty batch', () => {
    const sender = transport();

    sendEventsBatch('https://api.example.com', 'visitor-1', [], sender);

    expect(sender.sendBeacon).not.toHaveBeenCalled();
    expect(sender.fetchKeepalive).not.toHaveBeenCalled();
  });

  it('beacons the batch and returns at once, without awaiting anything', () => {
    const sender = transport();
    sender.sendBeacon.mockReturnValue(true);

    const returned = sendEventsBatch(
      'https://api.example.com',
      'visitor-1',
      events,
      sender,
    );

    expect(returned).toBeUndefined();
    expect(sender.sendBeacon).toHaveBeenCalledTimes(1);
    expect(sender.fetchKeepalive).not.toHaveBeenCalled();
    const [url, payload] = sender.sendBeacon.mock.calls[0] as [string, Blob];
    expect(url).toBe('https://api.example.com/v1/events');
    expect(payload).toBeInstanceOf(Blob);
  });

  it('falls back to a keepalive fetch when the beacon is refused', async () => {
    const sender = transport();
    sender.sendBeacon.mockReturnValue(false);

    sendEventsBatch('https://api.example.com', 'visitor-1', events, sender);

    expect(sender.fetchKeepalive).toHaveBeenCalledWith(
      'https://api.example.com/v1/events',
      { visitorId: 'visitor-1', events },
    );
    const [, payload] = sender.sendBeacon.mock.calls[0] as [string, Blob];
    expect(JSON.parse(await payload.text())).toEqual({
      visitorId: 'visitor-1',
      events,
    });
  });

  it('falls back to a keepalive fetch without a beacon', () => {
    const sender: EventsTransport = {
      sendBeacon: undefined,
      fetchKeepalive: vi.fn<(url: string, body: RecordEventsBody) => void>(),
    };

    sendEventsBatch('https://api.example.com', 'visitor-1', events, sender);

    expect(sender.fetchKeepalive).toHaveBeenCalledTimes(1);
  });

  it('never throws, so events can never break the page', () => {
    const sender: EventsTransport = {
      sendBeacon: () => {
        throw new Error('beacon down');
      },
      fetchKeepalive: () => {
        throw new Error('fetch down');
      },
    };

    expect(() =>
      sendEventsBatch('https://api.example.com', 'visitor-1', events, sender),
    ).not.toThrow();
  });
});
