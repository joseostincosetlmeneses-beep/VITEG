export type Role = "ADMIN" | "DRIVER";
export type UserStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "INACTIVE";
export type RouteStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED";
export type StopStatus =
  | "PENDING"
  | "EN_ROUTE"
  | "ARRIVED"
  | "DELIVERED"
  | "PARTIALLY_DELIVERED"
  | "FAILED"
  | "SKIPPED";
export type DeliveryStatus = "PENDING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED";
export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface DashboardSummary {
  routesToday: number;
  activeDrivers: number;
  completedDeliveries: number;
  totalDeliveries: number;
  pendingDeliveries: number;
  failedDeliveries: number;
  pendingRequests: number;
}

export const ROUTE_TRANSITIONS: Record<RouteStatus, readonly RouteStatus[]> = {
  DRAFT: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["ASSIGNED", "DRAFT", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "SCHEDULED", "CANCELLED"],
  IN_PROGRESS: ["PAUSED", "COMPLETED", "CANCELLED"],
  PAUSED: ["IN_PROGRESS", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: []
};

export function canTransitionRoute(from: RouteStatus, to: RouteStatus): boolean {
  return ROUTE_TRANSITIONS[from].includes(to);
}
