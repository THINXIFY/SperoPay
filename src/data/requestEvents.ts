import type { RequestEvent } from '../types';

export const mockRequestEvents: RequestEvent[] = [
  // req-1: paid — full lifecycle
  { id: 'evt-r1-1', requestId: 'req-1', type: 'created', occurredAt: '2026-08-18T09:58:00.000Z' },
  { id: 'evt-r1-2', requestId: 'req-1', type: 'shared', occurredAt: '2026-08-18T09:59:00.000Z' },
  { id: 'evt-r1-3', requestId: 'req-1', type: 'payment_detected', occurredAt: '2026-08-18T10:15:00.000Z' },
  { id: 'evt-r1-4', requestId: 'req-1', type: 'payment_confirmed', occurredAt: '2026-08-18T10:16:00.000Z' },

  // req-2: pending
  { id: 'evt-r2-1', requestId: 'req-2', type: 'created', occurredAt: '2026-08-18T09:45:00.000Z' },
  { id: 'evt-r2-2', requestId: 'req-2', type: 'shared', occurredAt: '2026-08-18T09:46:00.000Z' },

  // req-3: expired
  { id: 'evt-r3-1', requestId: 'req-3', type: 'created', occurredAt: '2026-05-11T09:00:00.000Z' },
  { id: 'evt-r3-2', requestId: 'req-3', type: 'shared', occurredAt: '2026-05-11T09:05:00.000Z' },
  { id: 'evt-r3-3', requestId: 'req-3', type: 'expired', occurredAt: '2026-05-18T09:00:00.000Z' },

  // req-4: pending
  { id: 'evt-r4-1', requestId: 'req-4', type: 'created', occurredAt: '2026-08-18T08:00:00.000Z' },
  { id: 'evt-r4-2', requestId: 'req-4', type: 'shared', occurredAt: '2026-08-18T08:02:00.000Z' },

  // req-5: paid, never expiry
  { id: 'evt-r5-1', requestId: 'req-5', type: 'created', occurredAt: '2026-08-17T08:26:00.000Z' },
  { id: 'evt-r5-2', requestId: 'req-5', type: 'shared', occurredAt: '2026-08-17T08:27:00.000Z' },
  { id: 'evt-r5-3', requestId: 'req-5', type: 'payment_detected', occurredAt: '2026-08-17T09:00:00.000Z' },
  { id: 'evt-r5-4', requestId: 'req-5', type: 'payment_confirmed', occurredAt: '2026-08-17T09:01:00.000Z' },

  // req-6: paid
  { id: 'evt-r6-1', requestId: 'req-6', type: 'created', occurredAt: '2026-08-17T07:10:00.000Z' },
  { id: 'evt-r6-2', requestId: 'req-6', type: 'shared', occurredAt: '2026-08-17T07:12:00.000Z' },
  { id: 'evt-r6-3', requestId: 'req-6', type: 'payment_detected', occurredAt: '2026-08-17T07:40:00.000Z' },
  { id: 'evt-r6-4', requestId: 'req-6', type: 'payment_confirmed', occurredAt: '2026-08-17T07:41:00.000Z' },
];
