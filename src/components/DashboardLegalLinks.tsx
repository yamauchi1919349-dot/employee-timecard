import Link from "next/link";

const legalLinks = [
  { href: "/terms", label: "利用規約" },
  { href: "/privacy", label: "プライバシーポリシー" },
  { href: "/legal", label: "特定商取引法に基づく表記" },
  { href: "/company", label: "会社情報" },
  { href: "/contact", label: "お問い合わせ" },
];

export function DashboardLegalLinks() {
  return (
    <nav className="flex flex-wrap justify-center gap-x-3 gap-y-2 text-center text-xs font-semibold leading-6 text-slate-500 sm:text-sm">
      {legalLinks.map((link, index) => (
        <span key={link.href} className="inline-flex items-center gap-3">
          <Link href={link.href} className="underline-offset-4 transition hover:text-blue-700 hover:underline">
            {link.label}
          </Link>
          {index < legalLinks.length - 1 ? <span className="text-slate-300">|</span> : null}
        </span>
      ))}
    </nav>
  );
}
