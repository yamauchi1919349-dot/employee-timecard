# employee-timecard

Google Apps Script + HTMLで運用していた社員勤怠管理タイムカードを、Next.js + TypeScript + Supabase + Vercel前提で移植したアプリです。

## 構成

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase
- Server API Routes
- pdf-libと日本語フォント埋め込みによる月別PDF生成

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` に設定する項目:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
APP_TIME_ZONE=Asia/Tokyo
```

Supabase SQL Editorで以下を順に実行してください。

1. `supabase/schema.sql`
2. `supabase/seed.sql`

## 確認URL

- 従業員画面: `http://localhost:3000/?k=demo-taro`
- 簡易管理画面: `http://localhost:3000/admin`

## 実装済み機能

- URLパラメータ `?k=employee-key` による従業員識別
- 従業員ごとのタイムカード画面
- 出勤打刻
- 退勤打刻
- 勤務区分: 通常勤務 / キッチンカー
- 休憩あり / 休憩なし
- 退勤前確認モーダル
- 退勤時の出勤・退勤時刻修正と備考追記
- 営業日切替 5:00
- 過去3日の打刻記録表示
- 利用可能月一覧
- 月別PDF出力
- 簡易管理画面

## API

- `GET /api/timecard?k=employee-key`
- `POST /api/clock-in`
- `POST /api/clock-out`
- `GET /api/status?k=employee-key`
- `GET /api/logs/recent?k=employee-key`
- `GET /api/months?k=employee-key`
- `GET /api/pdf?k=employee-key&month=YYYY-MM`

## 業務ロジック

- 5:00より前の打刻は前営業日扱い
- 同一従業員・同一営業日は1レコードのみ
- 出勤済みの日は再出勤不可
- 退勤済みの日は再退勤不可
- 出勤前の退勤不可
- 休憩ありは60分控除
- 基本労働時間は8時間
- 残業は `workMinutes - 480` の正の値
- PDF計算では出勤15分切り上げ、退勤15分切り下げ
- 画面表示では実打刻時刻を表示

## GAS CSV移行

既存GAS版のGoogleスプレッドシートからCSVを書き出し、次の場所に置きます。

- `import/members.csv`
- `import/logs.csv`

CSVヘッダー:

```csv
key,name,active
```

```csv
date,name,key,workType,breakFlag,clockIn,clockOut,workMinutes,overtimeMinutes,note
```

実行前に `.env.local` を設定し、`supabase/schema.sql` をSupabaseに適用しておいてください。

```bash
npm run import:gas-csv -- --dry-run
npm run import:gas-csv
```

`--dry-run` はDBに書き込まず、CSV件数・変換件数・失敗行だけを確認します。

会社名はデフォルトで `Default Company` です。変更する場合は `.env.local` に追加してください。

```bash
GAS_IMPORT_COMPANY_NAME=Your Company Name
```

移行仕様:

- `companies` は会社名で既存取得し、なければ1件作成
- `members` は `company_id + key` でupsert
- `attendance_logs` は `member_id + date` でupsert
- `workType` は `normal / 通常勤務` を `normal`、`kitchen_car / キッチンカー` を `kitchen_car` に変換
- `breakFlag` と `active` は `TRUE/FALSE`、`true/false`、`1/0` に対応
- `clockIn / clockOut` は日時として保存
- `clockOut` が空の場合は `null`
- `workMinutes / overtimeMinutes` は数値に変換
- `note` が空の場合は空文字

## PDFの日本語フォント

月別PDFは `pdf-lib` と `@pdf-lib/fontkit` でサーバー側生成し、Noto Sans JPをPDFに埋め込んでいます。Vercel本番でも外部フォント取得に依存しないよう、フォントファイルは次の場所に配置しています。

- `public/fonts/noto-sans-jp-japanese-400-normal.woff`
- `public/fonts/noto-sans-jp-japanese-700-normal.woff`

フォントの取得元は `@fontsource/noto-sans-jp` です。フォントを差し替える場合は、同じパスのファイルを置き換えるか、`src/app/api/pdf/route.ts` の `FONT_REGULAR_PATH` と `FONT_BOLD_PATH` を変更してください。

## 今後の改善候補

- Supabase Authによるログイン
- 管理者ロールと会社単位の権限制御
- 管理画面でのメンバー追加・編集
- 打刻修正申請と承認フロー
- PDFの日本語フォント埋め込み
- Vercelの環境変数と本番SupabaseのRLS設計
