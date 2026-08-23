jest.mock('../../../lib/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

import { supabase } from '../../../lib/supabase';
import { triggerPaymentVerification } from '../verifyPayment';

const mockedSupabase = jest.mocked(supabase);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('triggerPaymentVerification', () => {
  it('invokes the verify-payment function with only the public token', async () => {
    mockedSupabase.functions.invoke.mockResolvedValue({ data: { ok: true, status: 'pending' }, error: null } as never);

    await triggerPaymentVerification('a1b2c3d4-e5f6-4789-a012-3456789abcde');

    expect(mockedSupabase.functions.invoke).toHaveBeenCalledWith('verify-payment', {
      body: { public_token: 'a1b2c3d4-e5f6-4789-a012-3456789abcde' },
    });
  });

  it('never throws when the function call rejects', async () => {
    mockedSupabase.functions.invoke.mockRejectedValue(new Error('network down'));

    await expect(triggerPaymentVerification('a1b2c3d4-e5f6-4789-a012-3456789abcde')).resolves.toBeUndefined();
  });

  it('never throws when the function call resolves with an error', async () => {
    mockedSupabase.functions.invoke.mockResolvedValue({ data: null, error: { message: 'boom' } } as never);

    await expect(triggerPaymentVerification('a1b2c3d4-e5f6-4789-a012-3456789abcde')).resolves.toBeUndefined();
  });
});
