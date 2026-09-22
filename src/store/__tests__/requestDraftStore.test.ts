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

  it('prefillFrom falls back to the default expiryOption when not provided', () => {
    useRequestDraftStore.getState().setExpiryOption('24h');

    useRequestDraftStore.getState().prefillFrom({ amount: '100' });

    expect(useRequestDraftStore.getState().expiryOption).toBe('7d');
  });

  it('prefillFrom carries sourceTemplateId when a draft originates from Use Template', () => {
    useRequestDraftStore.getState().prefillFrom({ amount: '100', sourceTemplateId: 'template-1' });

    expect(useRequestDraftStore.getState().sourceTemplateId).toBe('template-1');
  });

  it('sourceTemplateId is absent for a draft not started from a template', () => {
    useRequestDraftStore.getState().prefillFrom({ amount: '100' });

    expect(useRequestDraftStore.getState().sourceTemplateId).toBeUndefined();
  });

  it('reset clears sourceTemplateId', () => {
    useRequestDraftStore.getState().prefillFrom({ amount: '100', sourceTemplateId: 'template-1' });

    useRequestDraftStore.getState().reset();

    expect(useRequestDraftStore.getState().sourceTemplateId).toBeUndefined();
  });

  // Phase 7 -----------------------------------------------------------------

  it('defaults to USDC', () => {
    expect(useRequestDraftStore.getState().currency).toBe('USDC');
  });

  it('startFresh seeds the business default currency when given', () => {
    useRequestDraftStore.getState().setCurrency('EURC');

    useRequestDraftStore.getState().startFresh('7d', 'EURC');

    expect(useRequestDraftStore.getState().currency).toBe('EURC');
  });

  it('startFresh falls back to USDC when no default currency is passed', () => {
    useRequestDraftStore.getState().setCurrency('EURC');

    useRequestDraftStore.getState().startFresh('7d');

    expect(useRequestDraftStore.getState().currency).toBe('USDC');
  });

  // "Creating a request from that template must preserve EURC" (spec
  // section 8) -- prefillFrom is what Use Template calls.
  it('prefillFrom preserves an explicit EURC currency (Use Template)', () => {
    useRequestDraftStore.getState().setCurrency('USDC');

    useRequestDraftStore.getState().prefillFrom({ amount: '1000', currency: 'EURC', sourceTemplateId: 'template-1' });

    expect(useRequestDraftStore.getState().currency).toBe('EURC');
  });

  it('prefillFrom falls back to USDC when the source has no currency of its own', () => {
    useRequestDraftStore.getState().setCurrency('EURC');

    useRequestDraftStore.getState().prefillFrom({ amount: '100' });

    expect(useRequestDraftStore.getState().currency).toBe('USDC');
  });
});
