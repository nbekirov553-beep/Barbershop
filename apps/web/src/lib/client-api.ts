import type {
  ApiError,
  Availability,
  AvailabilityDays,
  BookingView,
  CreateBookingInput,
} from "@barbershop/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";

export class ClientApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: { method: "POST"; body: unknown }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: init?.method ?? "GET",
      headers: init ? { "content-type": "application/json" } : undefined,
      body: init ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ClientApiError(0, "NETWORK", "Нет связи с сервером");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new ClientApiError(
      response.status,
      body?.code ?? "API_ERROR",
      body?.message ?? "Что-то пошло не так",
    );
  }
  return response.json() as Promise<T>;
}

type AvailabilityParams = { serviceIds: string[]; barberId: string; excludeToken?: string };

const toQuery = ({ serviceIds, excludeToken, ...rest }: AvailabilityParams & { date?: string }) => {
  const params = new URLSearchParams({ serviceIds: serviceIds.join(","), ...rest });
  if (excludeToken) params.set("excludeToken", excludeToken);
  return params.toString();
};

export const fetchAvailabilityDays = (params: AvailabilityParams) =>
  request<AvailabilityDays>(`/api/v1/availability/days?${toQuery(params)}`);

export const fetchAvailability = (params: AvailabilityParams & { date: string }) =>
  request<Availability>(`/api/v1/availability?${toQuery(params)}`);

export const createBooking = (input: CreateBookingInput) =>
  request<BookingView>("/api/v1/bookings", { method: "POST", body: input });

export const cancelBooking = (token: string) =>
  request<BookingView>(`/api/v1/bookings/${token}/cancel`, { method: "POST", body: {} });

export const rescheduleBooking = (token: string, startsAt: string) =>
  request<BookingView>(`/api/v1/bookings/${token}/reschedule`, {
    method: "POST",
    body: { startsAt },
  });
