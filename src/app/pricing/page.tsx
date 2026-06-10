import Link from "next/link";
import { Metadata } from "next";
import { MarketingLegalFooter } from "@/components/MarketingLegalFooter";

const pricingExamples = [
  { staff: "1名利用", price: "4,080円" },
  { staff: "5名利用", price: "4,480円" },
  { staff: "10名利用", price: "4,980円" },
  { staff: "20名利用", price: "5,980円" },
  { staff: "50名利用", price: "8,980円" },
];

const includedFeatures = [
  "スマホ打刻",
  "スタッフ管理",
  "月次集計",
  "CSV出力",
  "給与ソフト取込用CSV（β）",
  "打刻修正依頼",
  "修正履歴",
  "勤怠ルール設定",
];

export const metadata: Metadata = {
  title: "料金 | ArcNest",
  description: "ArcNest Timecardの料金。月額3,980円の基本料金に、スタッフ1名あたり月額100円を加えた分かりやすい料金体系です。",
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
              基本料金にスタッフ利用料を足すだけの、人数に応じた分かりやすい月額料金です。無料プラン・無料トライアルはありません。決済機能は現在準備中のため、導入をご希望の場合はお問い合わせください。
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_0.85fr]">
            <section className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                創業応援価格として提供中
              </p>
              <h2 className="mt-5 text-2xl font-black tracking-normal text-slate-950">
                月額3,980円 + スタッフ1名あたり100円
              </h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-5">
                  <p className="text-sm font-bold text-slate-500">基本料金</p>
                  <p className="mt-2 text-4xl font-black tracking-normal">3,980円</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">/ 月</p>
                </div>
                <div className="rounded-2xl bg-blue-50 p-5">
                  <p className="text-sm font-bold text-blue-700">スタッフ利用料</p>
                  <p className="mt-2 text-4xl font-black tracking-normal">100円</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">1名あたり / 月</p>
                </div>
              </div>
              <p className="mt-6 text-sm font-semibold leading-7 text-slate-600">
                全機能を利用できます。人数による機能制限はありません。ArcNest Timecardは給与計算機能ではなく、勤怠管理・月次集計・CSV出力を行うサービスです。
              </p>
              <Link
                href="/contact"
                className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 sm:w-auto"
              >
                まずはお問い合わせください
              </Link>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-black tracking-normal">料金例</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                基本料金3,980円に、スタッフ人数分の利用料を加算します。
              </p>
              <div className="mt-6 grid gap-3">
                {pricingExamples.map((example) => (
                  <div
                    key={example.staff}
                    className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <span className="text-sm font-black text-slate-700">{example.staff}</span>
                    <span className="text-lg font-black text-slate-950">月額 {example.price}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-black text-blue-700">Included</p>
                <h2 className="mt-2 text-2xl font-black tracking-normal">全機能利用可能</h2>
              </div>
              <p className="text-sm font-semibold text-slate-500">人数による機能制限なし</p>
            </div>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {includedFeatures.map((feature) => (
                <li key={feature} className="flex gap-3 text-sm font-bold text-slate-700">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-blue-50 text-xs text-blue-700">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm font-semibold leading-7 text-slate-600">
              給与計算、税、社会保険、控除、給与明細作成は行いません。勤怠データを整え、給与ソフトへ渡しやすくするためのサービスです。
            </p>
          </section>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-black text-slate-500">無料プラン</p>
              <p className="mt-2 text-xl font-black">なし</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-black text-slate-500">無料トライアル</p>
              <p className="mt-2 text-xl font-black">なし</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-black text-slate-500">料金体系</p>
              <p className="mt-2 text-xl font-black">基本料金 + スタッフ人数</p>
            </div>
          </div>

          <section className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/70 p-6 shadow-sm sm:p-8">
            <p className="text-sm font-black text-blue-700">Pricing Policy</p>
            <h2 className="mt-2 text-2xl font-black tracking-normal text-slate-950">
              創業応援価格について
            </h2>
            <div className="mt-4 grid gap-3 text-sm font-semibold leading-7 text-slate-700">
              <p>現在、ArcNest Timecard は創業応援価格で提供しています。</p>
              <p>今後、機能追加やサービス拡充に伴い料金改定を行う場合があります。</p>
              <p>ただし、既存契約者については契約時の料金を維持する予定です。</p>
              <p>ArcNestは、中小企業や小規模事業者が導入しやすいサービスを目指しています。</p>
            </div>
          </section>

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

      <MarketingLegalFooter />
    </main>
  );
}
