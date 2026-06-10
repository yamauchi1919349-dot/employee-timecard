import Link from "next/link";

const legalLinks = [
  { href: "/terms", label: "利用規約" },
  { href: "/privacy", label: "プライバシーポリシー" },
  { href: "/legal", label: "特定商取引法に基づく表記" },
  { href: "/contact", label: "お問い合わせ" },
];

export function MarketingLegalFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 text-sm font-bold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>© ArcNest</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-blue-700">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
