export interface Customer {
  id: string;
  name: string;
  email: string;
  avatarColor: 'mint' | 'lavender' | 'blue' | 'red';
  totalRequests: number;
  totalAmount: number;
}
