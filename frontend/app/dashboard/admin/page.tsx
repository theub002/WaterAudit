"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { getAllUsers, updateAdminStatus, updateUserRole, updateUserAreas, UserProfile } from "@/lib/api"
import { Shield, ShieldAlert, ShieldCheck, User as UserIcon, CheckCircle2, AlertCircle, RefreshCw, MapPin } from "lucide-react"

function Toast({ type, message, onClose }: { type: "success" | "error"; message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-4 shadow-xl animate-in slide-in-from-bottom-4 fade-in duration-300 ${type === "success" ? "bg-emerald-600" : "bg-red-600"} text-white`}>
      {type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
      <p className="text-sm font-medium">{message}</p>
    </div>
  )
}

export default function AdminDashboardPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ type: "success" | "error", message: string } | null>(null)
  const [editingAreasId, setEditingAreasId] = useState<number | null>(null)
  const [tempAreas, setTempAreas] = useState<string>("")

  useEffect(() => {
    if (!isLoading && user?.role !== "superadmin") {
      router.replace("/dashboard")
      return
    }

    if (user?.role === "superadmin") {
      fetchUsers()
    }
  }, [user, isLoading, router])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const data = await getAllUsers()
      setUsers(data)
    } catch (e: any) {
      setToast({ type: "error", message: e.message || "Failed to load users" })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await updateAdminStatus(id, status)
      setToast({ type: "success", message: `Admin status updated to ${status}` })
      fetchUsers()
    } catch (e: any) {
      setToast({ type: "error", message: e.message || "Failed to update status" })
    }
  }

  const handleUpdateRole = async (id: number, role: string) => {
    if (!confirm(`Are you sure you want to change this user's role to ${role}?`)) return
    try {
      await updateUserRole(id, role)
      setToast({ type: "success", message: `User role updated to ${role}` })
      fetchUsers()
    } catch (e: any) {
      setToast({ type: "error", message: e.message || "Failed to update role" })
    }
  }

  const handleSaveAreas = async (id: number) => {
    try {
      const areaList = tempAreas.split(",").map(a => a.trim()).filter(Boolean)
      await updateUserAreas(id, areaList)
      setToast({ type: "success", message: "Assigned areas updated successfully" })
      setEditingAreasId(null)
      fetchUsers()
    } catch (e: any) {
      setToast({ type: "error", message: e.message || "Failed to update areas" })
    }
  }

  if (isLoading || (loading && users.length === 0)) {
    return <div className="min-h-[50vh] flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-[#0284c7] border-t-transparent rounded-full" /></div>
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0f172a]">User Management</h1>
          <p className="text-slate-500 mt-0.5">Manage roles and approve new admin requests.</p>
        </div>
        <button onClick={fetchUsers} className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh List
        </button>
      </div>

      {/* Users Table */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <React.Fragment key={u.id}>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-[#0f172a]">{u.full_name || "No name"}</div>
                      <div className="text-slate-500">{u.email}</div>
                      {u.role === "admin" && (
                        <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {u.assigned_areas && u.assigned_areas.length > 0
                            ? `Areas: ${u.assigned_areas.join(", ")}`
                            : "No areas assigned"}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${u.role === 'superadmin' ? 'bg-amber-100 text-amber-700' :
                          u.role === 'admin' ? 'bg-violet-100 text-violet-700' :
                            'bg-slate-100 text-slate-700'
                        }`}>
                        {u.role === 'superadmin' ? <ShieldAlert className="h-3 w-3" /> :
                          u.role === 'admin' ? <ShieldCheck className="h-3 w-3" /> :
                            <UserIcon className="h-3 w-3" />}
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.role === "admin" && u.admin_status === "pending" ? (
                        <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">Pending Approval</span>
                      ) : u.role === "admin" && u.admin_status === "rejected" ? (
                        <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Rejected</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Active</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {u.id !== user?.id && (
                        <>
                          {/* Admin Approval Actions */}
                          {u.role === "admin" && u.admin_status === "pending" && (
                            <>
                              <button onClick={() => handleUpdateStatus(u.id, "approved")} className="text-emerald-600 hover:text-emerald-800 font-medium text-sm px-2 py-1 bg-emerald-50 rounded-lg">
                                Approve
                              </button>
                              <button onClick={() => handleUpdateStatus(u.id, "rejected")} className="text-red-600 hover:text-red-800 font-medium text-sm px-2 py-1 bg-red-50 rounded-lg">
                                Reject
                              </button>
                            </>
                          )}

                          {/* Area Assignment Action */}
                          {u.role === "admin" && (
                            <button onClick={() => {
                              setEditingAreasId(u.id);
                              setTempAreas(u.assigned_areas?.join(", ") || "");
                            }} className="text-blue-600 hover:text-blue-800 font-medium text-sm px-2 py-1 bg-blue-50 rounded-lg">
                              Assign Areas
                            </button>
                          )}

                          {/* Role Management Actions */}
                          {u.role !== "superadmin" && (
                            <button onClick={() => handleUpdateRole(u.id, "superadmin")} className="text-amber-600 hover:text-amber-800 font-medium text-sm px-2 py-1 bg-amber-50 rounded-lg">
                              Make Superadmin
                            </button>
                          )}

                          {u.role === "user" && (
                            <button onClick={() => handleUpdateRole(u.id, "admin")} className="text-violet-600 hover:text-violet-800 font-medium text-sm px-2 py-1 bg-violet-50 rounded-lg">
                              Make Admin
                            </button>
                          )}

                          {(u.role === "admin" || u.role === "superadmin") && (
                            <button onClick={() => handleUpdateRole(u.id, "user")} className="text-slate-600 hover:text-slate-800 font-medium text-sm px-2 py-1 bg-slate-100 rounded-lg">
                              Revoke Access
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                  {editingAreasId === u.id && (
                    <tr className="bg-blue-50/30">
                      <td colSpan={4} className="px-6 py-4 border-t border-blue-100/50">
                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-semibold text-blue-900">Assign Areas:</span>
                          <input
                            type="text"
                            value={tempAreas}
                            onChange={(e) => setTempAreas(e.target.value)}
                            placeholder="e.g. Mumbai, Delhi, Pune"
                            className="flex-1 h-9 rounded-lg border border-blue-200 bg-white px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                          <button onClick={() => handleSaveAreas(u.id)} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-blue-700">Save</button>
                          <button onClick={() => setEditingAreasId(null)} className="bg-white border border-slate-300 text-slate-700 px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-slate-50">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
