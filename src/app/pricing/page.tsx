import Link from "next/link";
import { Metadata } from "next";

const plans = [
  {
    name: "スターター",
    price: "980円",
    range: "1〜5名",
    description: "小さなチームで、まず勤怠管理を整えたい方向け。",
    features: ["スマホ打刻", "月次集計", "CSV出力", "打刻修正依頼"],
  },
  {
    name: "スタンダード",
    price: "1,980円",
    range: "6〜20名",
    description: "スタッフ管理や通知まで含めて運用したい方向け。",
    highlighted: true,
    features: ["スターターの全機能", "スタッフ管理", "勤怠ルール設定", "修正履歴", "通知"],
  },
  {
    name: "ビジネス",
    price: "3,980円",
    range: "21〜50名",
    description: "複数拠点や導入相談を見据えた事業者向け。",
    features: ["スタンダードの全機能", "複数拠点想定", "優先サポート", "導入相談"],
  },
];

export const metadata: Metadata = {
  title: "料金 | ArcNest",
  description: "ArcNest勤怠管理の料金プラン。スターター、スタンダード、ビジネスの3プラン。",
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <Link href="/lp" className="text-lg font-black">
            ArcNest
          </Link>
          <nav className="flex items-center gap-2 text-sm font-bold">
            <Link href="/lp" className="rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-blue-700">
              サービス紹介
            </Link>
            <Link href="/login" className="rounded-xl bg-slate-950 px-4 py-2 text-white hover:bg-blue-700">
              ログイン
            </Link>
          </nav>
        </div>
      </header>

      <section className="px-4 py-14 sm:py-16">
        <div className="mx-auto w-full max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black text-blue-700">Pricing</p>
            <h1 className="mt-3 text-4xl font-black tracking-normal sm:text-5xl">料金プラン</h1>
            <p className="mt-5 text-base font-semibold leading-8 text-slate-600">
              事業規模に合わせて選びやすい、シンプルな月額プランです。決済機能は現在準備中のため、導入をご希望の場合はお問い合わせください。
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-2xl border bg-white p-6 shadow-sm ${
                  plan.highlighted ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200"
                }`}
              >
                {plan.highlighted ? (
                  <p className="mb-4 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">おすすめ</p>
                ) : null}
                <h2 className="text-2xl font-black">{plan.name}</h2>
                <p className="mt-2 text-sm font-bold text-slate-500">{plan.range}</p>
                <div className="mt-5 flex items-end gap-1">
                  <span className="text-4xl font-black tracking-normal">{plan.price}</span>
                  <span className="pb-1 text-sm font-bold text-slate-500">/ 月</span>
                </div>
                <p className="mt-4 min-h-12 text-sm font-semibold leading-6 text-slate-600">{plan.description}</p>
                <ul className="mt-6 grid gap-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm font-bold text-slate-700">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-blue-50 text-xs text-blue-700">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/contact"
                  className={`mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl px-5 text-sm font-black shadow-sm transition ${
                    plan.highlighted ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-950 text-white hover:bg-blue-700"
                  }`}
                >
                  まずはお問い合わせください
                </Link>
              </article>
            ))}
          </div>

          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-black text-blue-700">Contact</p>
                <h2 className="mt-2 text-2xl font-black">導入前の確認や相談もできます</h2>
                <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
                  人数、運用方法、必要な機能に合わせて、最適な始め方を一緒に確認します。
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/contact" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-950 px-6 text-sm font-black text-white shadow-sm hover:bg-blue-700">
                  お問い合わせ
                </Link>
                <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-black text-slate-700 shadow-sm hover:bg-blue-50 hover:text-blue-700">
                  ログイン
                </Link>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
