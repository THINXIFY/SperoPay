export type CustomerImageType = 'photo' | 'logo';

export interface Customer {
  id: string;
  name: string;
  email: string;
  avatarColor: 'mint' | 'lavender' | 'blue' | 'red';
  avatarUrl?: string;
  imageType?: CustomerImageType;
  company?: string;
  notes?: string;
  // Phase 4D: undefined until a merchant first opens Client Portal
  // controls for this customer (lazy creation -- see
  // ensure_customer_portal_token). Never generated or guessed client-side.
  portalToken?: string;
  portalTokenCreatedAt?: string;
}
