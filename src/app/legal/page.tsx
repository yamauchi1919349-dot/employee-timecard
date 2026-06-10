import { Metadata } from "next";
import { ReactNode } from "react";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | ArcNest",
};

const contactEmail = "support@example.com";

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

export default function LegalNoticePage() {
  return (
    <LegalPage
      title="特定商取引法に基づく表記"
      lead="ArcNest Timecardの販売条件、サービス提供条件、解約・返金条件等を表示しています。"
      sections={[
        {
          title: "販売事業者",
          body: <p>ArcNest</p>,
        },
        {
          title: "運営責任者",
          body: (
            <Paragraphs>
              <p>山内 良介</p>
              <p>※正式な屋号・事業形態に応じて変更する場合があります。</p>
            </Paragraphs>
          ),
        },
        {
          title: "所在地",
          body: (
            <Paragraphs>
              <p>東京都</p>
              <p>※正式な所在地は販売開始前に記載します。</p>
            </Paragraphs>
          ),
        },
        {
          title: "電話番号",
          body: (
            <Paragraphs>
              <p>請求があった場合、遅滞なく開示いたします。</p>
              <p>※販売開始前に専用番号を設置する場合があります。</p>
            </Paragraphs>
          ),
        },
        {
          title: "メールアドレス",
          body: (
            <Paragraphs>
              <p>
                <a className="font-bold text-blue-700 underline-offset-4 hover:underline" href={`mailto:${contactEmail}`}>
                  {contactEmail}
                </a>
              </p>
              <p>※販売開始前に正式なサポートメールアドレスへ変更予定です。</p>
            </Paragraphs>
          ),
        },
        {
          title: "サービス名",
          body: <p>ArcNest Timecard</p>,
        },
        {
          title: "サービス内容",
          body: (
            <Paragraphs>
              <p>クラウド型勤怠管理サービス</p>
              <p className="font-black text-slate-800">主な機能:</p>
              <BulletList items={["スマホ打刻", "勤怠管理", "スタッフ管理", "打刻修正依頼", "月次集計", "CSV出力", "通知機能"]} />
            </Paragraphs>
          ),
        },
        {
          title: "販売価格",
          body: (
            <Paragraphs>
              <p>料金ページに表示された金額</p>
              <p>詳細は料金ページをご確認ください。</p>
            </Paragraphs>
          ),
        },
        {
          title: "商品代金以外の必要料金",
          body: (
            <Paragraphs>
              <BulletList items={["インターネット接続料金", "通信料金", "利用者が契約する通信事業者の費用"]} />
              <p>これらは利用者負担となります。</p>
            </Paragraphs>
          ),
        },
        {
          title: "支払方法",
          body: (
            <Paragraphs>
              <p>当社が指定する方法</p>
              <p className="font-black text-slate-800">例:</p>
              <BulletList items={["クレジットカード決済", "その他当社が定める決済方法"]} />
              <p>※販売開始時点の提供方法によります。</p>
            </Paragraphs>
          ),
        },
        {
          title: "支払時期",
          body: <p>利用契約成立時または当社が定める課金日に課金されます。継続課金の場合は契約期間ごとに自動更新される場合があります。</p>,
        },
        {
          title: "サービス提供時期",
          body: <p>利用登録完了後、利用可能となります。システムメンテナンスその他やむを得ない事情により利用開始が遅れる場合があります。</p>,
        },
        {
          title: "契約期間",
          body: <p>契約期間は利用者が契約したプランによります。詳細は料金ページまたは申込画面に表示します。</p>,
        },
        {
          title: "解約方法",
          body: (
            <Paragraphs>
              <p>利用者は当社所定の方法により解約できます。</p>
              <p>解約手続完了後も契約済み期間の終了日までは利用できます。</p>
              <p>契約期間終了日をもって利用契約は終了します。</p>
            </Paragraphs>
          ),
        },
        {
          title: "返金・キャンセル",
          body: (
            <Paragraphs>
              <p>支払い済みの利用料金は、法令上返金が義務付けられる場合または当社の請求ミスによる場合を除き返金しません。</p>
              <p>日割り返金は行いません。</p>
            </Paragraphs>
          ),
        },
        {
          title: "動作環境",
          body: (
            <Paragraphs>
              <p>本サービスは以下の環境での利用を推奨します。</p>
              <p className="font-black text-slate-800">PC:</p>
              <BulletList items={["Google Chrome（最新版）", "Microsoft Edge（最新版）", "Safari（最新版）"]} />
              <p className="font-black text-slate-800">スマートフォン:</p>
              <BulletList items={["iOS Safari（最新版）", "Android Chrome（最新版）"]} />
              <p>推奨環境以外では正常に動作しない場合があります。</p>
            </Paragraphs>
          ),
        },
        {
          title: "サービス停止・中断",
          body: (
            <Paragraphs>
              <p>当社は以下の場合、本サービスを停止または中断する場合があります。</p>
              <BulletList items={["システム保守", "障害対応", "災害等の不可抗力", "通信事業者等の障害", "その他運営上必要な場合"]} />
            </Paragraphs>
          ),
        },
        {
          title: "データ保存期間",
          body: (
            <Paragraphs>
              <p>契約終了後、利用者データは原則30日間保管します。</p>
              <p>保管期間経過後は削除します。</p>
              <p>法令上保存義務がある場合を除き、削除後の復元は保証されません。</p>
            </Paragraphs>
          ),
        },
        {
          title: "特記事項",
          body: (
            <Paragraphs>
              <p>本サービスは勤怠管理および勤怠集計を支援するサービスです。本サービスは以下を提供するものではありません。</p>
              <BulletList
                items={[
                  "給与計算",
                  "社会保険計算",
                  "雇用保険計算",
                  "所得税計算",
                  "住民税計算",
                  "各種控除計算",
                  "給与明細作成",
                ]}
              />
              <p>給与計算その他の労務・税務処理については、利用者の責任において実施するものとします。</p>
            </Paragraphs>
          ),
        },
        {
          title: "お問い合わせ窓口",
          body: (
            <Paragraphs>
              <p>事業者名：ArcNest</p>
              <p>
                メールアドレス：
                <a className="font-bold text-blue-700 underline-offset-4 hover:underline" href={`mailto:${contactEmail}`}>
                  {contactEmail}
                </a>
              </p>
              <p>※販売開始前に正式なサポートメールアドレスへ変更予定です。</p>
            </Paragraphs>
          ),
        },
      ]}
    />
  );
}
