import Link from "next/link";
import { Metadata } from "next";

const painPoints = [
  "紙のタイムカード管理が大変",
  "打刻忘れの確認に時間がかかる",
  "月末集計が面倒",
  "スタッフごとの勤務時間をすぐ確認したい",
];

const features = [
  "スマホ打刻",
  "スタッフ招待",
  "月次集計",
  "CSV出力",
  "打刻修正依頼",
  "修正履歴",
  "管理設定",
  "利用規約同意管理",
];

const flow = ["管理者が会社を登録", "スタッフを招待", "スタッフがスマホで打刻", "管理者が月次集計・CSV出力"];

const users = ["飲食店", "キッチンカー", "小売店", "小規模事業者", "個人事業主"];

export const metadata: Metadata = {
  title: "小規模事業者のための勤怠管理 | ArcNest",
  description: "スマホで打刻、PCで集計。スタッフ管理から月次CSV出力まで、日々の勤怠業務をかんたんに。",
};

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <MarketingHeader />

      <section className="relative isolate overflow-hidden bg-slate-950 px-4 py-16 text-white sm:py-20 lg:py-24">
        <HeroScene />
        <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="max-w-3xl">
            <p className="text-sm font-black text-blue-200">ArcNest Timecard</p>
            <h1 className="mt-5 text-4xl font-black leading-tight tracking-normal sm:text-5xl lg:text-6xl">
              小規模事業者のための、シンプルな勤怠管理
            </h1>
            <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-slate-200 sm:text-lg">
              スマホで打刻、PCで集計。スタッフ管理から月次CSV出力まで、日々の勤怠業務をかんたんに。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-black text-white shadow-sm transition hover:bg-blue-500">
                無料で相談する
              </Link>
              <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 bg-white px-6 text-sm font-black text-slate-950 shadow-sm transition hover:bg-blue-50">
                ログイン
              </Link>
            </div>
          </div>
          <div className="relative hidden min-h-[420px] lg:block" aria-hidden="true" />
        </div>
      </section>

      <section className="px-4 py-14 sm:py-16">
        <div className="mx-auto w-full max-w-6xl">
          <SectionHeader eyebrow="Problem" title="勤怠管理で、こんな手間が残っていませんか" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {painPoints.map((item) => (
              <article key={item} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-base font-black leading-7">{item}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-14 sm:py-16">
        <div className="mx-auto w-full max-w-6xl">
          <SectionHeader eyebrow="Features" title="日々の運用に必要な機能を、ひとつに" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <article key={feature} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-sm font-black text-blue-700">✓</div>
                <h3 className="mt-4 text-lg font-black">{feature}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:py-16">
        <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <SectionHeader eyebrow="Workflow" title="導入後の利用イメージ" />
          <div className="grid gap-4">
            {flow.map((step, index) => (
              <article key={step} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">{index + 1}</span>
                <p className="self-center text-base font-black">{step}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-14 sm:py-16">
        <div className="mx-auto w-full max-w-6xl">
          <SectionHeader eyebrow="For" title="小さなチームの勤怠管理に" />
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
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-blue-700">Next Step</p>
            <h2 className="mt-2 text-2xl font-black tracking-normal sm:text-3xl">料金と導入方法を確認する</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/pricing" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-950 px-6 text-sm font-black text-white shadow-sm transition hover:bg-blue-700">
              料金を見る
            </Link>
            <Link href="/contact" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-black text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-700">
              お問い合わせ
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
        <Link href="/lp" className="text-lg font-black text-slate-950">
          ArcNest
        </Link>
        <nav className="flex items-center gap-2 text-sm font-bold">
          <Link href="/pricing" className="rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-blue-700">
            料金
          </Link>
          <Link href="/contact" className="hidden rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-blue-700 sm:inline-flex">
            お問い合わせ
          </Link>
          <Link href="/login" className="rounded-xl bg-slate-950 px-4 py-2 text-white hover:bg-blue-700">
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
            <p className="text-xs font-bold text-blue-200">スマホ打刻</p>
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
