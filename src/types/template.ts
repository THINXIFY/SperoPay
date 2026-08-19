import type { ExpiryOption } from './payment';

export interface Template {
  id: string;
  name: string;
  amount: number;
  description?: string;
  expiryOption: ExpiryOption;
}
