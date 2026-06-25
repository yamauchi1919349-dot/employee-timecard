import { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

const contactEmail = "support@arcnest.jp";

export const metadata: Metadata = {
  title: "お問い合わせ | ArcNest",
};

export default function ContactPage() {
  return (
    <LegalPage
      title="お問い合わせ"
      lead="サービスに関するご質問、不具合のご連絡、個人情報に関するお問い合わせは、下記メールアドレスまでご連絡ください。"
      backHref="/lp"
      backLabel="← サービス紹介へ戻る"
      sections={[
        {
          title: "メールでのお問い合わせ",
          body: (
            <p>
              <a className="font-bold text-blue-700 underline-offset-4 hover:underline" href={`mailto:${contactEmail}`}>
                {contactEmail}
              </a>
            </p>
          ),
        },
        {
          title: "今後のフォーム化について",
          body: <p>お問い合わせフォーム、種別選択、返信先入力、送信履歴などを追加しやすい構成にしています。</p>,
        },
      ]}
    />
  );
}
