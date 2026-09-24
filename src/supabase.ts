import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://zwwnxgdbgmbhjbtwpzis.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_eAbFqPmCULfFF7dQrYG1CA_F0BGqLCQ'

export const configured = Boolean(url && key && !url.includes('SEU-PROJETO'))
export const supabase = configured ? createClient(url, key) : null

// Cliente descartável, sem sessão persistida: usado quando o Master cadastra
// um novo usuário. Com o cliente principal, o signUp pode trocar a sessão
// ativa para o usuário recém-criado e deslogar o Master.
export function createIsolatedAuthClient() {
  if (!configured) return null
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'lgpd-isolated-signup'
    }
  })
}
