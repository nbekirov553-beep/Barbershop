import Link from "next/link";
import { Magnetic } from "@/components/Magnetic";

type CircleCtaProps = {
  href: string;
  label: string;
  size?: "md" | "lg";
};

const sizes = {
  md: "size-28 text-xs sm:size-32",
  lg: "size-40 text-sm sm:size-48",
};

export function CircleCta({ href, label, size = "md" }: CircleCtaProps) {
  return (
    <Magnetic>
      <Link
        href={href}
        className={`group relative grid place-items-center overflow-hidden rounded-full border border-bone/30 font-medium tracking-wide text-bone transition-colors duration-500 hover:border-tungsten hover:text-graphite active:scale-[0.97] ${sizes[size]}`}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 translate-y-full rounded-full bg-tungsten transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:translate-y-0 group-focus-visible:translate-y-0"
        />
        <span className="relative">{label}</span>
      </Link>
    </Magnetic>
  );
}
