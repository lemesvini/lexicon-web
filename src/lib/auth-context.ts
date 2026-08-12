import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthContextState = {
  session: Session | null
  isLoading: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextState>({
  session: null,
  isLoading: true,
  signOut: async () => {},
})
