import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ahvpigapdmizgtyyhvei.supabase.co'
const supabaseKey = 'sb_publishable_aGOBq2LB0ApG3JmzbnN-dw_tAL6jCwL'

export const supabase = createClient(supabaseUrl, supabaseKey)
