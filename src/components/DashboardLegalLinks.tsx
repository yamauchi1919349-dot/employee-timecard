import Link from "next/link";

const legalLinks = [
  { href: "/terms", label: "利用規約" },
  { href: "/privacy", label: "プライバシーポリシー" },
  { href: "/legal", label: "特定商取引法に基づく表記" },
  { href: "/contact", label: "お問い合わせ" },
];

export function DashboardLegalLinks({
  showContact = true,
  onSignOut,
}: {
  showContact?: boolean;
  onSignOut?: () => void;
}) {
  const visibleLinks = showContact ? legalLinks : legalLinks.filter((link) => link.href !== "/contact");
  const itemCount = visibleLinks.length + (onSignOut ? 1 : 0);

  return (
    <nav className="flex flex-wrap justify-center gap-x-3 gap-y-2 text-center text-xs font-semibold leading-6 text-slate-500 sm:text-sm">
      {visibleLinks.map((link, index) => (
        <span key={link.href} className="inline-flex items-center gap-3">
          <Link href={link.href} className="underline-offset-4 transition hover:text-blue-700 hover:underline">
            {link.label}
          </Link>
          {index < itemCount - 1 ? <span className="text-slate-300">|</span> : null}
        </span>
      ))}
      {onSignOut ? (
        <span className="inline-flex items-center gap-3">
          <button type="button" onClick={onSignOut} className="bg-transparent p-0 text-inherit underline-offset-4 transition hover:text-blue-700 hover:underline">
            ログアウト
          </button>
        </span>
      ) : null}
    </nav>
  );
}
