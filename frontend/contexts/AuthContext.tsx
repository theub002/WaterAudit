"use client"

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react"
import { getMe, UserProfile } from "@/lib/api"
import { auth } from "@/lib/firebase"
import { onIdTokenChanged, signOut } from "firebase/auth"

interface AuthContextType {
  user: UserProfile | null
  token: string | null
  isLoading: boolean
  login: (token: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  logout: () => {},
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const me = await getMe()
      setUser(me)
    } catch {
      setUser(null)
      setToken(null)
      localStorage.removeItem("wa_token")
      window.location.href = "/login"
    }
  }, [])

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const currentToken = await firebaseUser.getIdToken()
        localStorage.setItem("wa_token", currentToken)
        setToken(currentToken)
        try {
          const me = await getMe()
          setUser(me)
        } catch (e) {
          console.error("Failed to fetch user profile:", e)
          setUser(null)
        }
      } else {
        localStorage.removeItem("wa_token")
        setToken(null)
        setUser(null)
      }
      setIsLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const login = async (newToken: string) => {
    // newToken is passed from Firebase login, or we just rely on onIdTokenChanged
    localStorage.setItem("wa_token", newToken)
    setToken(newToken)
    try {
      const me = await getMe()
      setUser(me)
    } catch (e) {
      console.error("Failed to fetch user profile:", e)
    }
  }

  const logout = async () => {
    await signOut(auth)
    localStorage.removeItem("wa_token")
    setToken(null)
    setUser(null)
    window.location.href = "/login"
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
