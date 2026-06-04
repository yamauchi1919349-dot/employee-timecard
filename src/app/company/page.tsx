import { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

const serviceInfo = {
  serviceName: "ArcNest",
  business: "クラウド業務システムの企画・開発・運営",
  services: ["勤怠管理システム", "キッチンカー管理システム", "業務管理システム"],
  location: "東京都",
};

export const metadata: Metadata = {
  title: "会社情報 | ArcNest",
};

export default function CompanyPage() {
  return (
    <LegalPage
      title="会社情報"
      lead="ArcNestの運営情報です。正式な会社情報は、サービス公開時の内容に合わせて更新してください。"
      sections={[
        {
          title: "サービス名",
          body: <p>{serviceInfo.serviceName}</p>,
        },
        {
          title: "事業内容",
          body: <p>{serviceInfo.business}</p>,
        },
        {
          title: "提供サービス",
          body: (
            <ul className="list-inside list-disc space-y-2">
              {serviceInfo.services.map((service) => (
                <li key={service}>{service}</li>
              ))}
            </ul>
          ),
        },
        {
          title: "所在地",
          body: <p>{serviceInfo.location}</p>,
        },
      ]}
    />
  );
}
