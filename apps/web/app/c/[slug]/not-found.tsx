import Link from "next/link";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";

export default function CategoryNotFound() {
  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-20 text-center lg:px-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-brand-ink">
          Category not found
        </h1>
        <p className="mt-3 text-brand-mute">
          That category doesn&rsquo;t exist (or has been unpublished). Try
          browsing everything on Vilo.
        </p>
        <Link
          href="/explore"
          className="mt-6 inline-flex h-10 items-center rounded-pill bg-brand-primary px-5 text-sm font-semibold text-white hover:bg-brand-secondary"
        >
          Explore all stays →
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
