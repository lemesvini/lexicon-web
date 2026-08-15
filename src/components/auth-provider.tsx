import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AuthContext } from '@/lib/auth-context'
import { clearProfileCache, getCurrentProfile, type Profile } from '@/lib/profile'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    // The profile comes from the same cache the route guards use, so this is
    // usually free — the guard has already fetched it by the time we get here.
    const sync = async (nextSession: Session | null) => {
      setSession(nextSession)
      if (!nextSession) {
        setProfile(null)
        setIsLoading(false)
        return
      }
      const nextProfile = await getCurrentProfile().catch(() => null)
      if (cancelled) return
      setProfile(nextProfile)
      setIsLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => {
      void sync(data.session)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        // Deferred to a macrotask on purpose: supabase-js holds its auth lock
        // while it emits this event, and `sync` calls back into Supabase to load
        // the profile. Doing that inline can deadlock.
        setTimeout(() => void sync(newSession), 0)
      },
    )

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        isLoading,
        signOut: async () => {
          await supabase.auth.signOut()
          clearProfileCache()
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
