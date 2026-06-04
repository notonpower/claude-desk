# DEADLINE — 課題締め切りトラッカー

スマホで使う、斬新でミニマルな課題（assignment）の締め切り管理アプリ。
ビルド不要・依存ゼロのピュアな HTML / CSS / JS で動きます。

![mobile](https://img.shields.io/badge/mobile-first-8b7bff) ![PWA](https://img.shields.io/badge/PWA-installable-3fd9d4) ![offline](https://img.shields.io/badge/offline-ready-b6f24a)

## 特徴

- **カウントダウンリング** — 各課題に締め切りまでの残り時間をリングで可視化（7日でフル → 締切で空に）
- **緊急度がひと目で** — 24時間以内 / 期限切れを色とサマリーで強調
- **ミニマルなダークUI** — グレイン質感 + グロー、Space Grotesk / JetBrains Mono
- **スワイプ削除** — カードを左にスワイプで削除、タップで完了切り替え・編集
- **5色のカラータグ** で科目ごとに色分け
- **オフライン対応 PWA** — ホーム画面に追加してネイティブアプリのように使える
- **データはローカル保存** — `localStorage` に保持。サーバー不要、プライバシー安心

## 使い方

ローカルで開くだけ。サーバーがあるとPWA（オフライン/インストール）が有効になります。

```bash
# 任意の静的サーバーで
python3 -m http.server 8000
# → スマホで http://<PCのIP>:8000 を開く
```

または `index.html` をブラウザで直接開いてもトラッカーとして動作します
（Service Worker はファイル直開きでは無効）。

### スマホにインストール

1. スマホのブラウザでアプリのURLを開く
2. 「ホーム画面に追加」を選ぶ
3. フルスクリーンのアプリとして起動

## ログイン & クラウド同期（任意）

Google / Apple でログインすると、複数の端末（スマホ・PC など）で課題が
**リアルタイム同期**されます。Firebase を使います。**未設定でもアプリは
これまで通りローカル専用モードで動作**します（ログインは無効）。

### セットアップ手順

1. [Firebase コンソール](https://console.firebase.google.com) でプロジェクトを作成（無料）
2. 「ウェブアプリ」を追加し、表示される `firebaseConfig` の値を
   `firebase-config.js` に貼り付ける
3. **Authentication → Sign-in method** で「**Google**」を有効化
   （Apple を使う場合は「**Apple**」も有効化。Apple Developer Program 登録が必要）
4. **Authentication → Settings → 承認済みドメイン** に
   GitHub Pages のドメイン（例: `notonpower.github.io`）を追加
5. **Firestore Database** を作成し、セキュリティルールを以下に設定:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read, write: if request.auth != null
                            && request.auth.uid == uid;
       }
     }
   }
   ```

> `firebase-config.js` の `apiKey` 等は「公開用」設定なので、コミットしても
> 安全です（秘密鍵ではありません）。アクセス制御は上記 Firestore ルールで行います。

### 同期の挙動
- ログイン時に、端末内のデータとクラウドのデータを **id 単位でマージ**
- 以降は片方の端末での追加・完了・編集が、もう片方へ自動で反映
- Apple ログインは Apple の仕様上サーバー処理が必要なため、Firebase 経由で実現

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | 画面構造 |
| `styles.css` | デザイン全般 |
| `app.js` | 状態管理・描画・操作ロジック・認証/同期 |
| `firebase-config.js` | Firebase 設定（ログイン/同期用・任意） |
| `sw.js` | オフライン用 Service Worker |
| `manifest.webmanifest` | PWA メタデータ |
| `icon.svg` | アプリアイコン |
