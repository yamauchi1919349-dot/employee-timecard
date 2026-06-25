import { Metadata } from "next";
import { ReactNode } from "react";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "ArcNest Timecard プライバシーポリシー | ArcNest",
};

const updatedAt = "2026年6月10日";
const contactEmail = "support@arcnest.jp";

function Paragraphs({ children }: { children: ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-inside list-disc space-y-2">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="ArcNest Timecard プライバシーポリシー"
      lead={`最終更新日：${updatedAt}`}
      sections={[
        {
          title: "本ポリシーについて",
          body: (
            <p>
              ArcNest（以下「当社」といいます。）は、当社が提供する勤怠管理サービス「ArcNest Timecard」（以下「本サービス」といいます。）
              における個人情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。
            </p>
          ),
        },
        {
          title: "第1条（基本方針）",
          body: <p>当社は、個人情報の保護に関する法律その他の関係法令を遵守し、本サービスを利用する利用者およびスタッフの個人情報を適切に取り扱います。</p>,
        },
        {
          title: "第2条（取得する情報）",
          body: (
            <Paragraphs>
              <p>当社は、本サービスの提供にあたり、以下の情報を取得する場合があります。</p>
              <p className="font-black text-slate-800">利用者情報:</p>
              <BulletList items={["会社名", "事業者名", "担当者氏名", "メールアドレス", "電話番号", "請求先情報", "契約情報"]} />
              <p className="font-black text-slate-800">スタッフ情報:</p>
              <BulletList items={["氏名", "メールアドレス", "社員番号", "雇用区分", "権限情報", "勤務設定情報"]} />
              <p className="font-black text-slate-800">勤怠情報:</p>
              <BulletList items={["出勤時刻", "退勤時刻", "休憩時間", "勤務日数", "打刻修正依頼", "打刻修正履歴", "通知履歴", "勤怠集計データ"]} />
              <p className="font-black text-slate-800">システム利用情報:</p>
              <BulletList items={["IPアドレス", "ブラウザ情報", "OS情報", "端末情報", "アクセスログ", "ログイン履歴", "操作履歴", "Cookie等の識別情報"]} />
              <p className="font-black text-slate-800">お問い合わせ情報:</p>
              <BulletList items={["氏名", "メールアドレス", "お問い合わせ内容", "通信記録"]} />
            </Paragraphs>
          ),
        },
        {
          title: "第3条（取得方法）",
          body: (
            <Paragraphs>
              <p>当社は以下の方法により情報を取得します。</p>
              <BulletList
                items={[
                  "利用登録時の入力",
                  "管理者によるスタッフ登録",
                  "打刻操作",
                  "修正依頼送信",
                  "CSV出力機能利用",
                  "お問い合わせフォーム送信",
                  "本サービス利用時の自動取得",
                ]}
              />
            </Paragraphs>
          ),
        },
        {
          title: "第4条（利用目的）",
          body: (
            <Paragraphs>
              <p>取得した情報は以下の目的で利用します。</p>
              <p className="font-black text-slate-800">サービス提供:</p>
              <BulletList items={["本サービスの提供", "勤怠管理機能の提供", "スタッフ管理機能の提供", "修正依頼機能の提供", "月次集計機能の提供", "CSV出力機能の提供"]} />
              <p className="font-black text-slate-800">認証・セキュリティ:</p>
              <BulletList items={["本人確認", "ログイン認証", "不正利用防止", "セキュリティ対策", "アクセス制御"]} />
              <p className="font-black text-slate-800">サポート:</p>
              <BulletList items={["お問い合わせ対応", "障害調査", "不具合修正", "利用者連絡"]} />
              <p className="font-black text-slate-800">サービス改善:</p>
              <BulletList items={["利用状況分析", "品質改善", "新機能開発", "UI改善", "セキュリティ改善"]} />
              <p className="font-black text-slate-800">法令対応:</p>
              <BulletList items={["法令上の義務履行", "規約違反調査", "不正行為対応"]} />
            </Paragraphs>
          ),
        },
        {
          title: "第5条（個人情報の第三者提供）",
          body: (
            <Paragraphs>
              <p>当社は、以下の場合を除き、個人情報を第三者へ提供しません。</p>
              <BulletList
                items={[
                  "本人の同意がある場合",
                  "法令に基づく場合",
                  "人の生命、身体または財産の保護のため必要な場合",
                  "公的機関から適法な要請を受けた場合",
                  "事業承継に伴う場合",
                ]}
              />
            </Paragraphs>
          ),
        },
        {
          title: "第6条（業務委託）",
          body: (
            <Paragraphs>
              <p>当社は、本サービスの運営に必要な範囲で業務を外部事業者へ委託する場合があります。委託先に対しては適切な監督を行います。</p>
              <p className="font-black text-slate-800">委託先の例:</p>
              <BulletList items={["クラウドサービス事業者", "メール配信事業者", "決済サービス事業者", "監視サービス事業者", "アクセス解析事業者"]} />
            </Paragraphs>
          ),
        },
        {
          title: "第7条（外部サービス）",
          body: (
            <Paragraphs>
              <p>本サービスは外部サービスを利用または連携する場合があります。</p>
              <p className="font-black text-slate-800">例:</p>
              <BulletList items={["Supabase", "Google", "Microsoft", "Stripe", "freee", "マネーフォワード", "その他連携サービス"]} />
              <p>外部サービス側で取得される情報については、各事業者の規約およびプライバシーポリシーが適用されます。</p>
            </Paragraphs>
          ),
        },
        {
          title: "第8条（Cookie等の利用）",
          body: (
            <Paragraphs>
              <p>当社は以下の目的でCookie等を利用する場合があります。</p>
              <BulletList items={["ログイン状態維持", "利便性向上", "利用状況分析", "セキュリティ向上"]} />
              <p>利用者はブラウザ設定によりCookieを無効化できます。ただし、一部機能が利用できなくなる場合があります。</p>
            </Paragraphs>
          ),
        },
        {
          title: "第9条（安全管理措置）",
          body: (
            <Paragraphs>
              <p>当社は個人情報保護のため、合理的な安全管理措置を講じます。</p>
              <p className="font-black text-slate-800">例:</p>
              <BulletList items={["アクセス権限管理", "認証機能", "通信の暗号化", "ログ監視", "不正アクセス対策", "データバックアップ"]} />
              <p>ただし、インターネット通信およびクラウドサービスの特性上、完全な安全性を保証するものではありません。</p>
            </Paragraphs>
          ),
        },
        {
          title: "第10条（勤怠データの管理）",
          body: <p>勤怠データの正確性については利用者が責任を負うものとします。当社は勤怠データの入力内容、修正内容、集計結果について利用者の確認義務を免除するものではありません。</p>,
        },
        {
          title: "第11条（CSV出力データ）",
          body: (
            <Paragraphs>
              <p>利用者はCSV出力結果を自己の責任において確認し利用するものとします。当社は以下を保証しません。</p>
              <BulletList
                items={[
                  "給与ソフトへの取込結果",
                  "会計ソフトへの取込結果",
                  "外部システム側の処理結果",
                  "外部システム仕様変更への即時対応",
                ]}
              />
            </Paragraphs>
          ),
        },
        {
          title: "第12条（国外でのデータ処理）",
          body: <p>当社または委託先事業者のシステム構成により、個人情報が日本国外のサーバーで保管または処理される場合があります。当社は適切な安全管理措置を講じた事業者を利用するよう努めます。</p>,
        },
        {
          title: "第13条（保存期間）",
          body: (
            <Paragraphs>
              <p>当社はサービス提供に必要な期間、個人情報を保存します。</p>
              <p>利用契約終了後の利用者データは原則30日間保管します。保管期間経過後は削除します。</p>
              <p>法令上保存義務がある場合はこの限りではありません。</p>
            </Paragraphs>
          ),
        },
        {
          title: "第14条（開示・訂正・削除等）",
          body: (
            <Paragraphs>
              <p>本人は法令の定めに従い以下を請求できます。</p>
              <BulletList items={["開示", "訂正", "追加", "削除", "利用停止"]} />
              <p>当社は本人確認を行ったうえで合理的な期間内に対応します。</p>
            </Paragraphs>
          ),
        },
        {
          title: "第15条（未成年者）",
          body: <p>未成年者が本サービスを利用する場合は、法定代理人の同意を得るものとします。</p>,
        },
        {
          title: "第16条（プライバシーポリシーの変更）",
          body: <p>当社は法令改正、サービス変更その他必要に応じて本ポリシーを変更する場合があります。重要な変更がある場合は、本サービス上または当社ウェブサイト上で通知します。</p>,
        },
        {
          title: "第17条（お問い合わせ窓口）",
          body: (
            <Paragraphs>
              <p>個人情報の取扱いに関するお問い合わせは以下までご連絡ください。</p>
              <p>事業者名：ArcNest</p>
              <p>所在地：東京都（正式所在地は販売開始前に記載）</p>
              <p>
                メールアドレス：
                <a className="font-bold text-blue-700 underline-offset-4 hover:underline" href={`mailto:${contactEmail}`}>
                  {contactEmail}
                </a>
              </p>
              <p>※販売開始前に正式なサポートメールアドレスへ変更予定</p>
            </Paragraphs>
          ),
        },
        {
          title: "第18条（適用法令）",
          body: (
            <Paragraphs>
              <p>本ポリシーは日本法に基づき解釈されます。</p>
              <p>個人情報の保護に関する法律その他関係法令に従って運用されます。</p>
            </Paragraphs>
          ),
        },
      ]}
    />
  );
}
