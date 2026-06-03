# Sales Auth Environment

販売版ログイン運用で必要な環境変数:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=https://your-app.example.com
ENABLE_LEGACY_KEY_ACCESS=false
```

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` はブラウザ側の Supabase Auth セッション管理に使います。
- `SUPABASE_SERVICE_ROLE_KEY` は API Route などサーバー側だけで使います。ブラウザへ出さないでください。
- `ENABLE_LEGACY_KEY_ACCESS=false` にすると `/pato`、`/yamauchi`、`?k=` の legacy 個人URL方式を停止します。
- Supabase SQL Editor では `supabase/multitenant-rls.sql` を実行してから、Auth ユーザーと `profiles` を紐づけてください。
