"use client"

import { useState, useEffect } from "react"
import {
  User, Mail, Phone, MapPin, Building2, Briefcase, Shield,
  Lock, Eye, EyeOff, Save, ArrowLeft, CheckCircle2, AlertCircle, Camera
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { updateProfile, requestAdminAccess } from "@/lib/api"
import { auth } from "@/lib/firebase"
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth"

function Toast({ type, message, onClose }: { type: "success" | "error"; message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-4 shadow-xl animate-in slide-in-from-bottom-4 fade-in duration-300 ${type === "success" ? "bg-emerald-600" : "bg-red-600"} text-white`}>
      {type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
      <p className="text-sm font-medium">{message}</p>
    </div>
  )
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false })

  const [form, setForm] = useState({
    full_name: "", gender: "", org_name: "", designation: "",
    contact: "", address: "", location: "",
  })
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" })

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || "", gender: user.gender || "",
        org_name: user.org_name || "", designation: user.designation || "",
        contact: user.contact || "", address: user.address || "", location: user.location || "",
      })
    }
  }, [user])

  const handleSaveProfile = async () => {
    setProfileSaving(true)
    try {
      await updateProfile(form)
      await refreshUser()
      setToast({ type: "success", message: "Profile updated successfully!" })
    } catch (e: any) {
      let msg = e.message || "Failed to update profile"
      msg = msg.replace(/^Firebase:\s*(Error\s*)?/, "").replace(/\(auth\/[a-zA-Z0-9-]+\)\.?/g, "").trim()
      setToast({ type: "error", message: msg || "Failed to update profile" })
    } finally { setProfileSaving(false) }
  }

  const handleChangePassword = async () => {
    if (!pwForm.current || !pwForm.next || !pwForm.confirm)
      return setToast({ type: "error", message: "Please fill all password fields" })
    if (pwForm.next !== pwForm.confirm)
      return setToast({ type: "error", message: "New passwords do not match" })
    if (pwForm.next.length < 8)
      return setToast({ type: "error", message: "New password must be at least 8 characters" })
    setPwSaving(true)
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) throw new Error("Not authenticated");
      const credential = EmailAuthProvider.credential(currentUser.email, pwForm.current);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, pwForm.next);
      setPwForm({ current: "", next: "", confirm: "" })
      setToast({ type: "success", message: "Password changed successfully!" })
    } catch (e: any) {
      let msg = e.message || "Failed to change password"
      msg = msg.replace(/^Firebase:\s*(Error\s*)?/, "").replace(/\(auth\/[a-zA-Z0-9-]+\)\.?/g, "").trim()
      setToast({ type: "error", message: msg || "Failed to change password" })
    } finally { setPwSaving(false) }
  }

  const initials = (user?.full_name || user?.email || "U")
    .split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)

  const inputCls = "w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-[#0284c7] focus:ring-1 focus:ring-[#0284c7] focus:bg-white hover:bg-white transition-all"
  const pwStrength = [pwForm.next.length >= 8, /[A-Z]/.test(pwForm.next), /[0-9]/.test(pwForm.next), /[^A-Za-z0-9]/.test(pwForm.next)]

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-20">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-[#0284c7] transition-colors shadow-sm">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0f172a]">My Profile</h1>
          <p className="text-slate-500 mt-0.5">Manage your personal information and security</p>
        </div>
      </div>

      {/* Avatar Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col sm:flex-row items-center gap-6">
        <div className="relative">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#0284c7] to-[#0ea5e9] text-white text-3xl font-bold shadow-lg shadow-sky-200">
            {initials}
          </div>
          <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white border-2 border-slate-200 cursor-pointer shadow-sm hover:text-[#0284c7] transition-colors">
            <Camera className="h-4 w-4 text-slate-500" />
          </div>
        </div>
        <div className="text-center sm:text-left">
          <h2 className="text-xl font-bold text-[#0f172a]">{user?.full_name || "No name set"}</h2>
          <p className="text-slate-500 text-sm">{user?.email}</p>
          <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${user?.role === "superadmin" ? "bg-amber-100 text-amber-700" : user?.role === "admin" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"}`}>
            <Shield className="h-3 w-3" />
            {user?.role === "superadmin" ? "Superadmin" : user?.role === "admin" ? "Admin" : "User"}
          </span>
          {user?.role === "user" && (
            <div className="mt-3">
              <button 
                onClick={async () => {
                  if (confirm("Request admin access? Your account will be locked pending superadmin approval.")) {
                    try {
                      await requestAdminAccess();
                      window.location.reload();
                    } catch (e: any) {
                      setToast({ type: "error", message: e.message || "Failed to request admin access" });
                    }
                  }
                }}
                className="text-xs font-semibold text-[#0284c7] hover:text-[#0369a1] bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg transition-colors border border-sky-100 shadow-sm"
              >
                Request Admin Access
              </button>
            </div>
          )}
        </div>
        <div className="sm:ml-auto text-sm text-slate-400 text-center sm:text-right">
          <p>Member since</p>
          <p className="font-medium text-slate-600">
            {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "—"}
          </p>
        </div>
      </div>

      {/* Personal Information */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-[#0284c7]">
            <User className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-[#0f172a]">Personal Information</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold text-[#0f172a] mb-1.5">Full Name</label>
            <div className="relative"><User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Your full name" className={inputCls} />
            </div>
          </div>
          {/* Gender */}
          <div>
            <label className="block text-sm font-semibold text-[#0f172a] mb-1.5">Gender</label>
            <select value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm outline-none focus:border-[#0284c7] focus:ring-1 focus:ring-[#0284c7] focus:bg-white hover:bg-white transition-all">
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
          {/* Email - read-only */}
          <div>
            <label className="block text-sm font-semibold text-[#0f172a] mb-1.5">Email Address</label>
            <div className="relative"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <input type="email" value={user?.email || ""} disabled placeholder="your@email.com" className={`${inputCls} opacity-60 cursor-not-allowed`} />
            </div>
          </div>
          {/* Contact */}
          <div>
            <label className="block text-sm font-semibold text-[#0f172a] mb-1.5">Phone / Contact</label>
            <div className="relative"><Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))} placeholder="+91 98765 43210" className={inputCls} />
            </div>
          </div>
          {/* Organisation */}
          <div>
            <label className="block text-sm font-semibold text-[#0f172a] mb-1.5">Organisation</label>
            <div className="relative"><Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" value={form.org_name} onChange={e => setForm(p => ({ ...p, org_name: e.target.value }))} placeholder="Your organisation" className={inputCls} />
            </div>
          </div>
          {/* Designation */}
          <div>
            <label className="block text-sm font-semibold text-[#0f172a] mb-1.5">Designation</label>
            <div className="relative"><Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" value={form.designation} onChange={e => setForm(p => ({ ...p, designation: e.target.value }))} placeholder="e.g., Lead Auditor" className={inputCls} />
            </div>
          </div>
          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-[#0f172a] mb-1.5">City / Location</label>
            <div className="relative"><MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Mumbai, India" className={inputCls} />
            </div>
          </div>
          {/* Address */}
          <div>
            <label className="block text-sm font-semibold text-[#0f172a] mb-1.5">Address</label>
            <div className="relative"><MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Street address" className={inputCls} />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button onClick={handleSaveProfile} disabled={profileSaving}
            className="flex items-center gap-2 rounded-xl bg-[#0284c7] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0369a1] transition-all active:scale-95 disabled:opacity-60">
            {profileSaving ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Saving…</> : <><Save className="h-4 w-4" />Save Changes</>}
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><Lock className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-bold text-[#0f172a]">Change Password</h2>
            <p className="text-sm text-slate-500">Use at least 8 characters with letters and numbers</p>
          </div>
        </div>

        <div className="space-y-4">
          {(["current", "next", "confirm"] as const).map((field) => (
            <div key={field}>
              <label className="block text-sm font-semibold text-[#0f172a] mb-1.5">
                {field === "current" ? "Current Password" : field === "next" ? "New Password" : "Confirm New Password"}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type={showPw[field] ? "text" : "password"} value={pwForm[field]}
                  onChange={e => setPwForm(p => ({ ...p, [field]: e.target.value }))}
                  placeholder={field === "current" ? "Current password" : field === "next" ? "Min. 8 characters" : "Repeat new password"}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-12 text-sm outline-none focus:border-[#0284c7] focus:ring-1 focus:ring-[#0284c7] focus:bg-white hover:bg-white transition-all" />
                <button type="button" onClick={() => setShowPw(p => ({ ...p, [field]: !p[field] }))}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
          {pwForm.next && (
            <div className="space-y-1.5">
              <div className="flex gap-1">
                {pwStrength.map((ok, i) => <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${ok ? "bg-emerald-500" : "bg-slate-200"}`} />)}
              </div>
              <p className="text-xs text-slate-400">
                {pwStrength.filter(Boolean).length === 4 ? "Strong password ✓" :
                 pwStrength.filter(Boolean).length >= 2 ? "Medium strength" : "Weak — add uppercase, numbers, symbols"}
              </p>
            </div>
          )}
        </div>

        <div className="pt-2 flex justify-end">
          <button onClick={handleChangePassword} disabled={pwSaving}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition-all active:scale-95 disabled:opacity-60">
            {pwSaving ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Updating…</> : <><Lock className="h-4 w-4" />Update Password</>}
          </button>
        </div>
      </div>
    </div>
  )
}
