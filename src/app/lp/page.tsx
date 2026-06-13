import Image from "next/image";
import Link from "next/link";
import { Metadata } from "next";
import { MarketingLegalFooter } from "@/components/MarketingLegalFooter";

const painPoints = [
  {
    title: "紙や表計算での集計に時間がかかる",
    body: "出勤簿の確認、勤務時間の集計、CSV作成までを月末にまとめて行う負担を減らします。",
  },
  {
    title: "スタッフごとの打刻状況が見えにくい",
    body: "出勤中、退勤済み、未打刻などを管理画面で確認し、現場の状況を把握しやすくします。",
  },
  {
    title: "打刻忘れや時刻修正のやり取りが残らない",
    body: "スタッフは修正依頼を送り、管理者が承認・却下できます。修正履歴も残せます。",
  },
  {
    title: "給与ソフトへ渡す勤怠データを整えたい",
    body: "勤怠記録と月次集計をCSVで出力し、給与計算ソフトへ渡す前の準備をしやすくします。",
  },
];

const features = [
  {
    title: "スマホ打刻",
    body: "スタッフはスマホから出勤・退勤を記録できます。",
  },
  {
    title: "スタッフ管理",
    body: "スタッフ情報、雇用区分、有効・無効状態を管理できます。",
  },
  {
    title: "月次集計",
    body: "勤務日数、労働時間、残業時間を月単位で確認できます。",
  },
  {
    title: "CSV出力",
    body: "選択した月とスタッフ条件で、勤怠集計CSVを出力できます。",
  },
  {
    title: "打刻修正依頼",
    body: "スタッフが修正依頼を送り、管理者が承認できます。",
  },
  {
    title: "修正履歴",
    body: "承認・直接修正の履歴を残し、あとから確認できます。",
  },
  {
    title: "管理設定",
    body: "丸め設定や残業開始時間など、会社単位の運用ルールを設定できます。",
  },
  {
    title: "概算人件費表示",
    body: "必要な場合のみ、勤怠データに基づく目安を表示できます。",
  },
];

const users = [
  "飲食店",
  "キッチンカー",
  "小売店",
  "美容・サロン",
  "小規模オフィス",
  "個人事業主",
];

const philosophy = [
  "現場の人が迷わず使えること",
  "管理者が月末に困らないこと",
  "既存の給与ソフトと役割を分けること",
];

export const metadata: Metadata = {
  title: "小規模事業者向け勤怠管理システム | ArcNest Timecard",
  description:
    "現場を支える、シンプルな業務システム。スマホ打刻、スタッフ管理、月次集計、CSV出力までをまとめたArcNestの勤怠管理システムです。",
};

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <MarketingHeader />

      <section className="lp-hero-section relative isolate overflow-hidden bg-slate-950 px-4 py-16 text-white sm:py-20 lg:py-24">
        <HeroScene />
        <div className="relative z-10 mx-auto grid w-full max-w-6xl translate-y-12 gap-10 sm:translate-y-12 lg:translate-y-0 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="max-w-3xl">
            <p className="text-sm font-black text-blue-200">ArcNest Timecard</p>
            <h1 className="mt-5 text-4xl font-black leading-tight tracking-normal sm:text-5xl lg:text-6xl">
              小規模事業者向け勤怠管理システム
            </h1>
            <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-slate-200 sm:text-lg">
              現場を支える、シンプルな業務システム。スマホで打刻、PCで集計。スタッフ管理から月次CSV出力まで、日々の勤怠業務をまとめて扱えます。
            </p>
            <p className="mt-4 max-w-2xl rounded-xl border border-blue-300/20 bg-blue-300/10 px-4 py-3 text-sm font-bold leading-6 text-blue-100">
              ArcNest Timecardは給与計算ソフトではありません。勤怠記録・勤怠集計・CSV出力までを担当し、正式な給与計算は既存の給与ソフトに委ねます。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-black text-white shadow-sm transition hover:bg-blue-500">
                導入について相談する
              </Link>
              <Link href="/pricing" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 bg-white px-6 text-sm font-black text-slate-950 shadow-sm transition hover:bg-blue-50">
                料金を見る
              </Link>
            </div>
          </div>
          <div className="relative hidden min-h-[420px] lg:block" aria-hidden="true" />
        </div>
      </section>

      <section className="px-4 py-14 sm:py-16">
        <div className="mx-auto w-full max-w-6xl">
          <SectionHeader eyebrow="Problem" title="よくある課題" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {painPoints.map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-black leading-7">{item.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-14 sm:py-16">
        <div className="mx-auto w-full max-w-6xl">
          <SectionHeader eyebrow="Features" title="主な機能紹介" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <article key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-sm font-black text-blue-700">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-4 text-lg font-black">{feature.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:py-16">
        <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <SectionHeader eyebrow="Philosophy" title="ArcNestの考え方" />
          <div className="grid gap-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-black text-blue-700">現場を支える、シンプルな業務システム。</p>
              <h3 className="mt-3 text-2xl font-black tracking-normal text-slate-950">
                日々の記録を整え、月末の確認を軽くする
              </h3>
              <p className="mt-4 text-sm font-semibold leading-7 text-slate-600">
                ArcNestは、小さなチームが無理なく使える業務システムを目指しています。勤怠管理では、現場の打刻と管理者の集計をつなぎ、給与ソフトへ渡す前の勤怠データを整えることに集中します。
              </p>
            </article>
            <div className="grid gap-3 sm:grid-cols-3">
              {philosophy.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-black leading-6 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-14 sm:py-16">
        <div className="mx-auto w-full max-w-6xl">
          <SectionHeader eyebrow="For" title="対象ユーザー" />
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-slate-600">
            複雑な給与計算機能よりも、まずは打刻・確認・月次集計・CSV出力を整えたい小規模事業者向けです。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {users.map((user) => (
              <span key={user} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm">
                {user}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:py-16">
        <div className="mx-auto w-full max-w-6xl">
          <article className="rounded-2xl border border-blue-100 bg-blue-50/70 p-6 shadow-sm sm:p-8">
            <p className="text-sm font-black text-blue-700">Pricing</p>
            <h2 className="mt-2 text-2xl font-black tracking-normal text-slate-950 sm:text-3xl">
              創業応援価格について
            </h2>
            <div className="mt-4 grid gap-3 text-sm font-semibold leading-7 text-slate-700">
              <p>現在、ArcNest Timecard は創業応援価格で提供しています。</p>
              <p>料金は月額3,980円の基本料金に、スタッフ1名あたり月額100円を加えた形です。</p>
              <p>お申し込み後は7日間無料でお試しいただけます。無料トライアル終了後、8日目から自動課金に移行します。</p>
              <p>今後、機能追加やサービス拡充に伴い料金改定を行う場合があります。</p>
              <p>ただし、既存契約者については契約時の料金を維持する予定です。</p>
              <p>ArcNestは、中小企業や小規模事業者が導入しやすいサービスを目指しています。</p>
            </div>
            <Link
              href="/pricing"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-950 px-6 text-sm font-black text-white shadow-sm transition hover:bg-blue-700"
            >
              料金プランを見る
            </Link>
          </article>
        </div>
      </section>

      <section className="px-4 py-14 sm:py-16">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-blue-700">Contact</p>
            <h2 className="mt-2 text-2xl font-black tracking-normal sm:text-3xl">自社の運用に合うか相談する</h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-600">
              現在の勤怠管理方法、スタッフ人数、月次集計の流れを伺いながら、導入イメージをご案内します。
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/contact" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-950 px-6 text-sm font-black text-white shadow-sm transition hover:bg-blue-700">
              お問い合わせ
            </Link>
            <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-black text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-700">
              ログイン
            </Link>
          </div>
        </div>
      </section>

      <MarketingLegalFooter />
    </main>
  );
}

function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
        <Link href="/lp" className="flex items-center gap-2 text-lg font-black text-slate-950">
          <Image src="/arcnest-logo.png" alt="ArcNest Logo" width={28} height={28} className="rounded-lg object-contain" />
          ArcNest
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-1 text-xs font-bold sm:gap-2 sm:text-sm">
          <Link href="/signup" className="rounded-xl bg-blue-600 px-3 py-2 text-white shadow-sm transition hover:bg-blue-700">
            新規登録
          </Link>
          <Link href="/pricing" className="rounded-xl px-2 py-2 text-slate-600 hover:bg-slate-50 hover:text-blue-700 sm:px-3">
            料金
          </Link>
          <Link href="/contact" className="rounded-xl px-2 py-2 text-slate-600 hover:bg-slate-50 hover:text-blue-700 sm:px-3">
            お問い合わせ
          </Link>
          <Link href="/login" className="rounded-xl bg-slate-950 px-3 py-2 text-white hover:bg-blue-700 sm:px-4">
            ログイン
          </Link>
        </nav>
      </div>
    </header>
  );
}

function HeroScene() {
  return (
    <div className="absolute inset-0 z-0" aria-hidden="true">
      <div className="absolute inset-y-8 right-[max(2rem,calc((100vw-72rem)/2))] hidden w-[420px] lg:block">
        <div className="absolute right-0 top-2 w-80 rounded-2xl border border-white/10 bg-white p-4 text-slate-950 shadow-2xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-black">月次集計</p>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">CSV</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {["勤務日数", "総労働", "残業"].map((label, index) => (
              <div key={label} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500">{label}</p>
                <p className="mt-2 text-lg font-black">{["18日", "142h", "6h"][index]}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            {["山田 花子", "佐藤 健", "田中 美咲"].map((name) => (
              <div key={name} className="grid grid-cols-[1fr_auto] rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold">
                <span>{name}</span>
                <span className="text-blue-700">確認済</span>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-56 rounded-[28px] border border-white/10 bg-white p-3 text-slate-950 shadow-2xl">
          <div className="rounded-2xl bg-slate-950 p-4 text-white">
            <div className="flex items-center gap-2">
              <Image src="/icons/timecard-icon-192.png" alt="" width={28} height={28} className="rounded-lg" />
              <p className="text-xs font-bold text-blue-200">スマホ打刻</p>
            </div>
            <p className="mt-4 text-3xl font-black">09:28</p>
            <button className="mt-6 h-12 w-full rounded-xl bg-blue-600 text-sm font-black text-white">出勤する</button>
          </div>
          <div className="mt-3 rounded-2xl bg-slate-50 p-3">
            <p className="text-xs font-bold text-slate-500">今日の状態</p>
            <p className="mt-1 text-sm font-black">出勤中</p>
          </div>
        </div>
      </div>
      <div className="absolute inset-0 bg-slate-950/75" />
    </div>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-sm font-black text-blue-700">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">{title}</h2>
    </div>
  );
}
