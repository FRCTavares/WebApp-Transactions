import { createClient } from '@supabase/supabase-js'

const supabaseAuthEnabled = import.meta.env.VITE_SUPABASE_AUTH_ENABLED === 'true'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseAuthEnabled = supabaseAuthEnabled
export const isSupabaseAuthConfigured =
  !isSupabaseAuthEnabled || Boolean(supabaseUrl && supabaseAnonKey)

export const supabase =
  isSupabaseAuthEnabled && supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null
