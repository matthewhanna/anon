import 'expo-sqlite/localStorage/install';

import { createSupabaseClient } from '@/lib/supabase-client';

export const supabase = createSupabaseClient();
