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
}
