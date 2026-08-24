import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://zwwnxgdbgmbhjbtwpzis.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_eAbFqPmCULfFF7dQrYG1CA_F0BGqLCQ'

export const configured = Boolean(url && key && !url.includes('SEU-PROJETO'))
export const supabase = configured ? createClient(url, key) : null

