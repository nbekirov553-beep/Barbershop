import "server-only";
import type { ApiError, Barber, BookingView, Review, Service } from "@barbershop/shared";

const API_URL = process.env.API_URL ?? "http://localhost:4100";

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function apiGet<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  } catch {
    throw new ApiRequestError(503, "API_UNAVAILABLE", `API недоступен: ${API_URL}`);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(
      response.status,
      body?.code ?? "API_ERROR",
      body?.message ?? `API вернул ${response.status} для ${path}`,
    );
  }

  return response.json() as Promise<T>;
}

export const getServices = () => apiGet<Service[]>("/api/v1/services");
export const getBarbers = () => apiGet<Barber[]>("/api/v1/barbers");
export const getReviews = () => apiGet<Review[]>("/api/v1/reviews");
export const getBooking = (token: string) =>
  apiGet<BookingView>(`/api/v1/bookings/${encodeURIComponent(token)}`);
