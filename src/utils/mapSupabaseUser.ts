import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { User } from '../types';

export function mapSupabaseUser(supabaseUser: SupabaseUser): User {
  return {
    id: supabaseUser.id,
    fullName: (supabaseUser.user_metadata?.full_name as string | undefined) ?? '',
    email: supabaseUser.email ?? '',
    createdAt: supabaseUser.created_at,
  };
}
