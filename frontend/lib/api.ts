const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("wa_token");
}

type FetchOptions = RequestInit & { auth?: boolean };

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { auth = true, ...rest } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(rest.headers as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...rest, headers });
  } catch (error: any) {
    throw new Error(`Network error or API is unreachable: ${error.message}`);
  }
  if (!res.ok) {
    let detail = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {}
    throw new Error(detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Auth ────────────────────────────────────────────────────────

// Login is now handled directly by Firebase via AuthContext

export async function register(data: {
  email: string;
  firebase_uid: string;
  user_type?: string;
  full_name?: string;
  gender?: string;
  org_name?: string;
  designation?: string;
  contact?: string;
  address?: string;
  location?: string;
}) {
  return apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify(data), auth: false });
}

// ── User ────────────────────────────────────────────────────────

export async function getMe(): Promise<UserProfile | null> {
  try {
    return await apiFetch<UserProfile>("/api/users/me");
  } catch (error: any) {
    if (
      error.message.includes("404") || 
      error.message.includes("User not found") ||
      error.message.includes("Email not verified") ||
      error.message.includes("403")
    ) {
      return null;
    }
    throw error;
  }
}

export async function updateProfile(data: Partial<UserProfile>) {
  return apiFetch<UserProfile>("/api/users/me", { method: "PUT", body: JSON.stringify(data) });
}

export async function requestAdminAccess(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/users/request-admin", { method: "POST" });
}

// Change password is now handled directly by Firebase SDK

// ── Projects ─────────────────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  return apiFetch<Project[]>("/api/projects");
}

export async function getProject(id: number): Promise<Project> {
  return apiFetch<Project>(`/api/projects/${id}`);
}

export async function createProject(data: ProjectCreate): Promise<Project> {
  return apiFetch<Project>("/api/projects", { method: "POST", body: JSON.stringify(data) });
}

export async function deleteProject(id: number): Promise<void> {
  return apiFetch<void>(`/api/projects/${id}`, { method: "DELETE" });
}

export async function deleteAccount(): Promise<void> {
  return apiFetch<void>("/api/users/me", { method: "DELETE" });
}

// ── Data Input ───────────────────────────────────────────────────

export async function getDataInput(projectId: number): Promise<DataInput> {
  return apiFetch<DataInput>(`/api/projects/${projectId}/data-input`);
}

export async function saveDataInput(projectId: number, data: Partial<DataInput>): Promise<DataInput> {
  return apiFetch<DataInput>(`/api/projects/${projectId}/data-input`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Admin Management ─────────────────────────────────────────────

export async function getAllUsers(): Promise<UserProfile[]> {
  return apiFetch<UserProfile[]>("/api/admin/users");
}

export async function updateAdminStatus(userId: number, admin_status: string): Promise<UserProfile> {
  return apiFetch<UserProfile>(`/api/admin/users/${userId}/status`, {
    method: "PUT",
    body: JSON.stringify({ admin_status }),
  });
}

export async function updateUserRole(userId: number, role: string): Promise<UserProfile> {
  return apiFetch<UserProfile>(`/api/admin/users/${userId}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
}

export async function updateUserAreas(userId: number, assigned_areas: string[]): Promise<UserProfile> {
  return apiFetch<UserProfile>(`/api/admin/users/${userId}/areas`, {
    method: "PUT",
    body: JSON.stringify({ assigned_areas }),
  });
}

// ── Types ────────────────────────────────────────────────────────

export interface UserProfile {
  id: number;
  email: string;
  role: string;
  admin_status: string;
  is_active: boolean;
  user_type: string;
  full_name?: string;
  gender?: string;
  org_name?: string;
  designation?: string;
  contact?: string;
  address?: string;
  location?: string;
  assigned_areas?: string[];
  created_at?: string;
}

export interface Project {
  id: number;
  owner_id: number;
  title: string;
  location?: string;
  description?: string;
  scope?: string;
  project_type?: string;
  population?: number;
  capacity?: string;
  status: string;
  lead_auditor_name?: string;
  lead_auditor_email?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectCreate {
  title: string;
  location?: string;
  description?: string;
  scope?: string;
  project_type?: string;
  population?: number;
  capacity?: string;
  lead_auditor_name?: string;
  lead_auditor_email?: string;
}

export interface DataInput {
  id: number;
  project_id: number;
  data_values: Record<string, string>;
  validation_scores: Record<string, number>;
  modal_answers: Record<string, string>;
  created_at?: string;
  updated_at?: string;
}
