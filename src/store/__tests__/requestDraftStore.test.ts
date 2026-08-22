import { useRequestDraftStore } from '../requestDraftStore';
import { resetAllUserData } from '../dataLifecycle';

describe('requestDraftStore', () => {
  beforeEach(() => {
    useRequestDraftStore.getState().reset();
  });

  it('resets to initial state', () => {
    useRequestDraftStore.getState().setAmount('250');
    useRequestDraftStore.getState().setCustomerId('customer-a');

    useRequestDraftStore.getState().reset();

    const state = useRequestDraftStore.getState();
    expect(state.amount).toBe('0');
    expect(state.customerId).toBeUndefined();
  });

  // Reproduces the "User A begins a request, signs out, User B signs in"
  // scenario: an unfinished draft (e.g. a customerId picked mid-flow) must
  // not survive into a different user's session, even if no screen along
  // the way happened to call reset()/startFresh()/prefillFrom() itself.
  it('is cleared by resetAllUserData (the sign-out/user-change lifecycle hook)', () => {
    useRequestDraftStore.getState().setAmount('500');
    useRequestDraftStore.getState().setCustomerId('customer-a');
    useRequestDraftStore.getState().setNote('Invoice for customer A');

    resetAllUserData();

    const state = useRequestDraftStore.getState();
    expect(state.amount).toBe('0');
    expect(state.customerId).toBeUndefined();
    expect(state.note).toBe('');
  });

  it('prefillFrom overlays only the provided fields on top of a clean slate', () => {
    useRequestDraftStore.getState().setNote('stale note');
    useRequestDraftStore.getState().setCustomerId('customer-a');

    useRequestDraftStore.getState().prefillFrom({ customerId: 'customer-b', amount: '100' });

    const state = useRequestDraftStore.getState();
    expect(state.customerId).toBe('customer-b');
    expect(state.amount).toBe('100');
    expect(state.note).toBe(''); // not carried over from the stale draft
  });
});
