"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { auth } from "@/lib/firebase"
import { signInWithEmailAndPassword, signOut, sendEmailVerification, User, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from "firebase/auth"
export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [unverifiedUser, setUnverifiedUser] = useState<User | null>(null)
  const router = useRouter()
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    setUnverifiedUser(null)

    const form = e.target as HTMLFormElement
    const email = (form.elements.namedItem("email") as HTMLInputElement).value
    const password = (form.elements.namedItem("password") as HTMLInputElement).value

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      if (!userCredential.user.emailVerified) {
        setUnverifiedUser(userCredential.user)
        setError("Please verify your email before logging in.")
        setIsLoading(false)
        return
      }

      const token = await userCredential.user.getIdToken()
      
      // Store token and update context
      await login(token)
      
      setSuccess("Login successful! Redirecting...")
      
      // Short delay so the user sees the success message
      setTimeout(() => {
        router.push("/dashboard")
      }, 800)
    } catch (err: any) {
      if (err.code === "auth/invalid-credential" || err.message?.includes("auth/invalid-credential")) {
        setError("Invalid email or password.")
      } else {
        let msg = err.message || "An unexpected error occurred."
        msg = msg.replace(/^Firebase:\s*(Error\s*)?/, "").replace(/\(auth\/[a-zA-Z0-9-]+\)\.?/g, "").trim()
        setError(msg || "An unexpected error occurred.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendEmail = async () => {
    if (unverifiedUser) {
      try {
        await sendEmailVerification(unverifiedUser)
        setSuccess("Verification email sent! Check your inbox.")
        setError(null)
        setUnverifiedUser(null)
        await signOut(auth)
      } catch (err: any) {
        let msg = err.message || "Failed to send email. Try again later."
        msg = msg.replace(/^Firebase:\s*(Error\s*)?/, "").replace(/\(auth\/[a-zA-Z0-9-]+\)\.?/g, "").trim()
        setError(msg || "Failed to send email. Try again later.")
      }
    }
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const provider = new GoogleAuthProvider()
      const userCredential = await signInWithPopup(auth, provider)
      const token = await userCredential.user.getIdToken()
      
      // Check if user exists in DB
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (!res.ok) {
        // Register them if they don't exist
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: userCredential.user.email,
            firebase_uid: userCredential.user.uid,
            full_name: userCredential.user.displayName,
            role: "user"
          })
        })
      }
      
      await login(token)
      setSuccess("Login successful! Redirecting...")
      setTimeout(() => router.push("/dashboard"), 800)
    } catch (err: any) {
      if (err.code === "auth/unauthorized-domain") {
        setError("Login from this domain is not authorized.")
      } else if (err.code === "auth/popup-closed-by-user") {
        setError("Google Sign-In was cancelled.")
      } else {
        let msg = err.message || "Google Sign-In failed."
        msg = msg.replace(/^Firebase:\s*(Error\s*)?/, "").replace(/\(auth\/[a-zA-Z0-9-]+\)\.?/g, "").trim()
        setError(msg || "Google Sign-In failed.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    const emailInput = document.getElementById("email") as HTMLInputElement;
    const email = emailInput?.value;
    
    if (!email) {
      setError("Please enter your email address first to reset your password.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess("Password reset email sent! Please check your inbox.");
    } catch (err: any) {
      let msg = err.message || "Failed to send reset email.";
      msg = msg.replace(/^Firebase:\s*(Error\s*)?/, "").replace(/\(auth\/[a-zA-Z0-9-]+\)\.?/g, "").trim();
      setError(msg || "Failed to send reset email.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-5"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          {unverifiedUser && (
            <button
              type="button"
              onClick={handleResendEmail}
              className="text-left underline font-medium text-red-700 dark:text-red-300 hover:text-red-800"
            >
              Click here to resend verification email
            </button>
          )}
        </motion.div>
      )}

      {/* Success Message */}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </motion.div>
      )}

      {/* Email Field */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium text-foreground">
          Email / Username
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="text"
            placeholder="Enter your email or username"
            className="pl-11 h-12 rounded-xl bg-input border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            required
            onChange={() => setError(null)}
          />
        </div>
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-medium text-foreground">
          Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            className="pl-11 pr-11 h-12 rounded-xl bg-input border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            required
            onChange={() => setError(null)}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Forgot Password Link */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleForgotPassword}
          className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
        >
          Forgot Password?
        </button>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 disabled:opacity-70"
        disabled={isLoading}
      >
        {isLoading ? (
          <motion.div
            className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          />
        ) : (
          "Login"
        )}
      </Button>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-card text-muted-foreground">Or continue with</span>
        </div>
      </div>
      
      <Button
        type="button"
        variant="outline"
        className="w-full h-12 rounded-xl border-border bg-transparent hover:bg-muted text-foreground font-semibold"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
      >
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Sign in with Google
      </Button>
    </motion.form>
  )
}
