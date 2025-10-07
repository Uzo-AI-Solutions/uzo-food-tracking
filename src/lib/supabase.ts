import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Auto-sign in for bypass auth mode
const bypassAuth = import.meta.env.VITE_BYPASS_AUTH === 'true'
const DEV_USER_EMAIL = 'kosiuzodinma@gmail.com'
const DEV_USER_PASSWORD = 'dev-password-123'

if (bypassAuth) {
  // Check if already signed in
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
      // Not signed in, attempt auto sign-in
      supabase.auth.signInWithPassword({
        email: DEV_USER_EMAIL,
        password: DEV_USER_PASSWORD,
      }).then(({ error }) => {
        if (error) {
          console.warn('⚠️ Auto sign-in failed:', error.message)
          console.log('💡 RLS requires authentication. Pages may fall back to mock data.')
        } else {
          console.log('✅ Auto-signed in for bypass auth mode')
        }
      })
    } else {
      console.log('✅ Already signed in (bypass auth mode)')
    }
  })
}