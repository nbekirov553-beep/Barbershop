import type { BookingView } from "@barbershop/shared";
import { useState } from "react";
import { ErrorState, Screen, Skeleton } from "./components/ui";
import { api, errorMessage } from "./lib/api";
import { getFirstName, isInTelegram } from "./lib/telegram";
import { useRemote } from "./lib/use-remote";
import { BookFlow } from "./screens/BookFlow";
import { BookingDetail } from "./screens/BookingDetail";
import { BookingDone } from "./screens/BookingDone";
import { Home } from "./screens/Home";
import { MyBookings } from "./screens/MyBookings";

type Route =
  | { name: "home" }
  | { name: "book" }
  | { name: "done"; booking: BookingView }
  | { name: "my" }
  | { name: "booking"; booking: BookingView; from: "home" | "my" };

const canAuth = isInTelegram || import.meta.env.DEV;

export function App() {
  const [route, setRoute] = useState<Route>({ name: "home" });
  const [bookingsVersion, setBookingsVersion] = useState(0);

  const catalog = useRemote("catalog", () => Promise.all([api.services(), api.barbers()]));
  const me = useRemote(canAuth ? "me" : null, api.me);
  const bookings = useRemote(canAuth ? `bookings#${bookingsVersion}` : null, api.myBookings);

  const refreshBookings = () => setBookingsVersion((value) => value + 1);
  const home = () => setRoute({ name: "home" });

  if (!canAuth) {
    return (
      <Screen title="Откройте в Telegram">
        <p className="text-hint">Это приложение работает внутри Telegram. Запишитесь через бота Usto.</p>
      </Screen>
    );
  }

  switch (route.name) {
    case "book":
      if (catalog.status === "error") {
        return (
          <Screen title="Запись" onBack={home}>
            <ErrorState message={errorMessage(catalog.error)} onRetry={catalog.reload} />
          </Screen>
        );
      }
      if (catalog.status !== "ready") {
        return (
          <Screen title="Что делаем?" onBack={home}>
            <Skeleton className="h-72" />
          </Screen>
        );
      }
      return (
        <BookFlow
          services={catalog.data[0]}
          barbers={catalog.data[1]}
          me={me.data}
          onExit={home}
          onDone={(booking) => {
            refreshBookings();
            setRoute({ name: "done", booking });
          }}
        />
      );

    case "done":
      return (
        <BookingDone booking={route.booking} onHome={home} onMyBookings={() => setRoute({ name: "my" })} />
      );

    case "my":
      return (
        <MyBookings
          bookings={bookings}
          onBack={home}
          onBook={() => setRoute({ name: "book" })}
          onOpen={(booking) => setRoute({ name: "booking", booking, from: "my" })}
        />
      );

    case "booking":
      return (
        <BookingDetail
          key={route.booking.token}
          booking={route.booking}
          onBack={() => setRoute(route.from === "my" ? { name: "my" } : { name: "home" })}
          onChanged={(booking) => {
            refreshBookings();
            setRoute({ ...route, booking });
          }}
        />
      );

    default:
      return (
        <Home
          firstName={me.data?.telegramUser.firstName ?? getFirstName()}
          bookings={bookings}
          onBook={() => setRoute({ name: "book" })}
          onMyBookings={() => setRoute({ name: "my" })}
          onOpen={(booking) => setRoute({ name: "booking", booking, from: "home" })}
        />
      );
  }
}
