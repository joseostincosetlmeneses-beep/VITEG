import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import type { ApiResponse, DashboardSummary, Role, SessionUser } from "@viteg/shared";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api";
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? API_URL.replace(/\/api$/, "");
const TOKEN_KEY = "viteg.session.token";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers
      }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message ?? "No fue posible completar la operación");
    return body.data as T;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("El servidor tardó demasiado en responder. Verifica la red e inténtalo nuevamente.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  sessionToken: () => AsyncStorage.getItem(TOKEN_KEY),
  async login(email: string, password: string, role: Role): Promise<SessionUser> {
    const result = await request<{ token: string; user: SessionUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, role })
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
  createRoute: (value: unknown) => request<any>("/distribution/routes", { method: "POST", body: JSON.stringify(value) }),
  updateRoute: (routeId: string, value: unknown) => request<any>(`/distribution/routes/${routeId}`, { method: "PATCH", body: JSON.stringify(value) }),
  deleteRoute: (routeId: string) => request<{ id: string }>(`/distribution/routes/${routeId}`, { method: "DELETE" }),
  drivers: () => request<any[]>("/users?role=DRIVER"),
  addresses: () => request<any[]>("/addresses"),
  latestDriverLocations: () => request<any[]>("/tracking/locations/latest"),
  chatWorkers: () => request<any[]>("/messaging/workers"),
  conversations: () => request<any[]>("/messaging/conversations"),
  conversationMessages: (conversationId: string) => request<any[]>(`/messaging/conversations/${conversationId}/messages`),
  openConversation: (participantId: string) => request<any>("/messaging/conversations", {
    method: "POST",
    body: JSON.stringify({ participantId })
  }),
  sendMessage: (conversationId: string, value: unknown) => request<any>(`/messaging/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify(value)
  }),
  async uploadChatMedia(asset: { uri: string }) {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    const response = await FileSystem.uploadAsync(`${API_URL}/messaging/media`, asset.uri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    let body: any = {};
    try {
      body = JSON.parse(response.body);
    } catch {
      // The status below still provides a useful error if the server returns non-JSON content.
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(body.message ?? "No se pudo subir el archivo");
    }
    return body.data as any;
  },
  trackLocation: (value: unknown) => request<any>("/tracking/locations", { method: "POST", body: JSON.stringify(value) }),
  updateRouteStatus: (routeId: string, status: string) =>
    request<any>(`/distribution/routes/${routeId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  list: (path: string) => request<any[]>(path),
  create: (path: string, value: unknown) => request<any>(path, { method: "POST", body: JSON.stringify(value) }),
  update: (path: string, value: unknown) => request<any>(path, { method: "PATCH", body: JSON.stringify(value) })
};

