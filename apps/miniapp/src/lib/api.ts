import type {
  ApiError,
  Availability,
  AvailabilityDays,
  Barber,
  BookingView,
  CreateBookingInput,
  Me,
  MyBookings,
  Service,
} from "@barbershop/shared";
import { getAuthHeader } from "./telegram";

/** Пусто — запросы идут на тот же origin, в dev их проксирует Vite. */
const API_URL = import.meta.env.VITE_API_URL ?? "";

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const auth = getAuthHeader();
  if (auth) headers.Authorization = auth;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError(0, "NETWORK", "Нет связи с сервером");
  }

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(response.status, error?.code ?? "API_ERROR", error?.message ?? "Что-то пошло не так");
  }
  return response.json() as Promise<T>;
}

type AvailabilityQuery = { serviceIds: string[]; barberId: string; excludeToken?: string };

const query = ({ serviceIds, excludeToken, ...rest }: AvailabilityQuery & { date?: string }) => {
  const params = new URLSearchParams({ serviceIds: serviceIds.join(","), ...rest });
  if (excludeToken) params.set("excludeToken", excludeToken);
  return params.toString();
};

export const api = {
  services: () => request<Service[]>("/services"),
  barbers: () => request<Barber[]>("/barbers"),
  me: () => request<Me>("/me"),
  myBookings: () => request<MyBookings>("/me/bookings"),
  days: (params: AvailabilityQuery) => request<AvailabilityDays>(`/availability/days?${query(params)}`),
  slots: (params: AvailabilityQuery & { date: string }) => request<Availability>(`/availability?${query(params)}`),
  createBooking: (input: CreateBookingInput) => request<BookingView>("/bookings", input),
  cancel: (token: string) => request<BookingView>(`/bookings/${token}/cancel`, {}),
  reschedule: (token: string, startsAt: string) =>
    request<BookingView>(`/bookings/${token}/reschedule`, { startsAt }),
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) return error.message;
  return "Не получилось связаться с сервером. Попробуйте ещё раз.";
}
