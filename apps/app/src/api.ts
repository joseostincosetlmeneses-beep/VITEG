import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ApiResponse, DashboardSummary, SessionUser } from "@viteg/shared";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api";
const TOKEN_KEY = "viteg.session.token";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? "No fue posible completar la operación");
  return body.data as T;
}

export const api = {
  async login(email: string, password: string): Promise<SessionUser> {
    const result = await request<{ token: string; user: SessionUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    await AsyncStorage.setItem(TOKEN_KEY, result.token);
    return result.user;
  },
  async register(input: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<{ email: string; status: "PENDING" }> {
    return request<{ email: string; status: "PENDING" }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  async restore(): Promise<SessionUser | null> {
    if (!(await AsyncStorage.getItem(TOKEN_KEY))) return null;
    try {
      return await request<SessionUser>("/auth/me");
    } catch {
      await AsyncStorage.removeItem(TOKEN_KEY);
      return null;
    }
  },
  async logout(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
  },
  dashboard: () => request<DashboardSummary>("/dashboard/summary"),
  routes: () => request<any[]>("/distribution/routes"),
  routeStops: (routeId: string) => request<any[]>(`/distribution/routes/${routeId}/stops`),
  updateRouteStatus: (routeId: string, status: string) =>
    request<any>(`/distribution/routes/${routeId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  list: (path: string) => request<any[]>(path),
  create: (path: string, value: unknown) => request<any>(path, { method: "POST", body: JSON.stringify(value) }),
  update: (path: string, value: unknown) => request<any>(path, { method: "PATCH", body: JSON.stringify(value) })
};

