import type { PaymentRequest } from '../types';
import type { RequestFilter } from '../components/RequestFilterSheet';

// Archive Requests -- archived requests are hidden from every other view by
// default (spec: "disappears from the normal Requests list"); only the
// 'archived' filter shows them, and it shows ONLY them. Every other filter
// value (including 'all') is otherwise unaffected -- this is purely an
// additional exclusion/inclusion layered on top of the existing status
// match, never a change to what that match itself does. Pulled out of
// requests/index.tsx as a pure function so this rule is independently unit
// testable without rendering the screen.
export function filterRequestsByStatus(requests: PaymentRequest[], filter: RequestFilter): PaymentRequest[] {
  if (filter === 'archived') return requests.filter((r) => !!r.archivedAt);
  if (filter === 'all') return requests.filter((r) => !r.archivedAt);
  return requests.filter((r) => r.status === filter && !r.archivedAt);
}
