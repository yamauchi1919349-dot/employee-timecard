import Link from "next/link";
import { ReactNode } from "react";
import { LegalBackButton } from "@/components/LegalBackButton";

type LegalSection = {
  title: string;
  body: ReactNode;
};

const legalLinks = [
  { href: "/terms", label: "利用規約" },
  { href: "/privacy", label: "プライバシーポリシー" },
  { href: "/legal", label: "特定商取引法に基づく表記" },
  { href: "/contact", label: "お問い合わせ" },
];

export function LegalPage({
  title,
  lead,
  sections,
  backHref,
  backLabel,
}: {
  title: string;
  lead: string;
  sections: LegalSection[];
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:py-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div>
          <LegalBackButton href={backHref} label={backLabel} />
        </div>

        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-bold text-blue-700">ArcNest</p>
          <h1 className="mt-3 text-3xl font-black tracking-normal sm:text-4xl">{title}</h1>
          <p className="mt-4 text-sm font-semibold leading-7 text-slate-600 sm:text-base">{lead}</p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-8">
            {sections.map((section) => (
              <article key={section.title}>
                <h2 className="text-xl font-black text-slate-950">{section.title}</h2>
                <div className="mt-3 text-sm font-medium leading-7 text-slate-600 sm:text-base">{section.body}</div>
              </article>
            ))}
          </div>
        </section>

        <footer className="flex flex-wrap gap-3 text-sm font-bold text-slate-500">
          {legalLinks.map((link) => (
            <Link key={link.href} className="rounded-xl bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200 hover:text-blue-700" href={link.href}>
              {link.label}
            </Link>
          ))}
        </footer>
      </div>
    </main>
  );
}
