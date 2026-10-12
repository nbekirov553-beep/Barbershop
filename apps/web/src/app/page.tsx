import { BookingLab } from "@/components/BookingLab";
import { FinalCta } from "@/components/FinalCta";
import { Header } from "@/components/Header";
import { HeroScene } from "@/components/HeroScene";
import { MastersGallery } from "@/components/MastersGallery";
import { ServicesIndex } from "@/components/ServicesIndex";
import { Statement } from "@/components/Statement";
import { Voices } from "@/components/Voices";
import { getBarbers, getReviews, getServices } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [services, barbers, reviews] = await Promise.all([
    getServices(),
    getBarbers(),
    getReviews(),
  ]);

  return (
    <>
      <Header />
      <main>
        <HeroScene />
        <Statement barbers={barbers} reviews={reviews} />
        <MastersGallery barbers={barbers} />
        <ServicesIndex services={services} />
        <BookingLab barbers={barbers} services={services} />
        <Voices reviews={reviews} />
        <FinalCta />
      </main>
    </>
  );
}
