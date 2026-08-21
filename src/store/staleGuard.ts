// Guards a store's loadForUser() against overwriting fresher state with a
// stale response. Two races this closes:
//  1. Cross-user: User A's loadForUser is still in flight when the user
//     signs out and User B signs in. Without this, A's response can land
//     after B's session starts and get written into B's store.
//  2. Same-user optimistic-write: loadForUser's SELECT is issued, then the
//     user adds/edits/deletes a row locally before the SELECT resolves —
//     without this, the (now-stale) full-list response overwrites the
//     optimistic local change.
// Every mutating action calls next() before it runs, invalidating any
// in-flight load's captured token; the load itself calls next() at its own
// start to get a token, and only commits its result if that token is still
// current when it resolves.
export function createStaleGuard() {
  let token = 0;
  return {
    next: (): number => ++token,
    isCurrent: (captured: number): boolean => captured === token,
  };
}
