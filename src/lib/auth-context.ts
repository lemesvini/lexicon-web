import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '@/lib/profile'

export type AuthContextState = {
  session: Session | null
  /** The signed-in user's row in `profiles`; carries their admin/student role. */
  profile: Profile | null
  isLoading: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextState>({
  session: null,
  profile: null,
  isLoading: true,
  signOut: async () => {},
})
