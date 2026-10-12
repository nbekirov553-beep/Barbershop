import type {
  AdminBarber,
  AdminBarberInput,
  AdminBarberServices,
  AdminBooking,
  AdminBookingStatus,
  AdminCreateBookingInput,
  AdminMe,
  AdminReview,
  AdminSchedule,
  AdminService,
  AdminServiceInput,
  AdminSettings,
  AdminSettingsInput,
  AdminTimeOff,
  AdminTimeOffInput,
  AnalyticsCancellations,
  AnalyticsHeatmap,
  AnalyticsLoad,
  AnalyticsQuery,
  AnalyticsRetention,
  AnalyticsRevenue,
  AnalyticsServices,
  ApiError,
} from "@barbershop/shared";

export type AnalyticsResponses = {
  revenue: AnalyticsRevenue;
  services: AnalyticsServices;
  load: AnalyticsLoad;
  heatmap: AnalyticsHeatmap;
  cancellations: AnalyticsCancellations;
  retention: AnalyticsRetention;
};

export class AdminApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const BASE = "/api/v1/admin";

type RequestInit = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; form?: FormData };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    });
  } catch {
    throw new AdminApiError(0, "NETWORK", "Нет связи с сервером");
  }

  if (response.status === 401 && path !== "/login" && typeof window !== "undefined") {
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.assign(new URL(`/admin/login?next=${next}`, window.location.origin).href);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new AdminApiError(response.status, body?.code ?? "API_ERROR", body?.message ?? "Что-то пошло не так");
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const errorMessage = (error: unknown) =>
  error instanceof AdminApiError ? error.message : "Не получилось выполнить действие";

const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  return search.toString();
};

export const adminApi = {
  login: (login: string, password: string) =>
    request<AdminMe>("/login", { method: "POST", body: { login, password } }),
  logout: () => request<void>("/logout", { method: "POST", body: {} }),
  me: () => request<AdminMe>("/me"),

  bookings: (params: { from: string; to: string; barberId?: string; status?: AdminBookingStatus }) =>
    request<AdminBooking[]>(`/bookings?${query(params)}`),
  availability: (params: { serviceIds: string[]; barberId: string; date: string; excludeId?: string }) =>
    request<{ slots: string[]; durationMin: number; price: number; timezone: string }>(
      `/availability?${query({ ...params, serviceIds: params.serviceIds.join(",") })}`,
    ),
  createBooking: (input: AdminCreateBookingInput) =>
    request<AdminBooking>("/bookings", { method: "POST", body: input }),
  updateBooking: (id: string, body: { status: "completed" | "cancelled" | "no_show" } | { startsAt: string }) =>
    request<AdminBooking>(`/bookings/${id}`, { method: "PATCH", body }),

  services: () => request<AdminService[]>("/services"),
  createService: (input: AdminServiceInput) => request<AdminService>("/services", { method: "POST", body: input }),
  updateService: (id: string, input: Partial<AdminServiceInput> & { sortOrder?: number }) =>
    request<AdminService>(`/services/${id}`, { method: "PATCH", body: input }),
  deleteService: (id: string) => request<void>(`/services/${id}`, { method: "DELETE" }),

  barbers: () => request<AdminBarber[]>("/barbers"),
  barber: (id: string) => request<AdminBarber>(`/barbers/${id}`),
  createBarber: (input: AdminBarberInput) => request<AdminBarber>("/barbers", { method: "POST", body: input }),
  updateBarber: (id: string, input: Partial<AdminBarberInput> & { sortOrder?: number }) =>
    request<AdminBarber>(`/barbers/${id}`, { method: "PATCH", body: input }),
  deleteBarber: (id: string) => request<void>(`/barbers/${id}`, { method: "DELETE" }),
  updateBarberServices: (id: string, items: AdminBarberServices) =>
    request<AdminBarber>(`/barbers/${id}/services`, { method: "PUT", body: items }),
  updateSchedule: (id: string, schedule: AdminSchedule) =>
    request<AdminBarber>(`/barbers/${id}/schedule`, { method: "PUT", body: schedule }),
  addPortfolio: (id: string, imageUrl: string) =>
    request<AdminBarber>(`/barbers/${id}/portfolio`, { method: "POST", body: { imageUrl } }),
  deletePortfolio: (id: string) => request<void>(`/portfolio/${id}`, { method: "DELETE" }),
  telegramLink: (id: string) =>
    request<{ url: string; expiresAt: string }>(`/barbers/${id}/telegram-link`, { method: "POST", body: {} }),

  upload: (file: File, folder: "barbers" | "portfolio") => {
    const form = new FormData();
    form.append("file", file);
    return request<{ url: string }>(`/uploads?folder=${folder}`, { method: "POST", form });
  },

  timeOff: () => request<AdminTimeOff[]>("/time-off"),
  createTimeOff: (input: AdminTimeOffInput) => request<AdminTimeOff>("/time-off", { method: "POST", body: input }),
  updateTimeOff: (id: string, input: AdminTimeOffInput) =>
    request<AdminTimeOff>(`/time-off/${id}`, { method: "PUT", body: input }),
  deleteTimeOff: (id: string) => request<void>(`/time-off/${id}`, { method: "DELETE" }),

  reviews: () => request<AdminReview[]>("/reviews"),
  updateReview: (id: string, isPublic: boolean) =>
    request<{ id: string; isPublic: boolean }>(`/reviews/${id}`, { method: "PATCH", body: { isPublic } }),

  analytics: <K extends keyof AnalyticsResponses>(kind: K, params: AnalyticsQuery) =>
    request<AnalyticsResponses[K]>(`/analytics/${kind}?${query(params)}`),

  settings: () => request<AdminSettings>("/settings"),
  updateSettings: (input: AdminSettingsInput) => request<AdminSettings>("/settings", { method: "PUT", body: input }),
};
