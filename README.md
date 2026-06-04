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

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | 画面構造 |
| `styles.css` | デザイン全般 |
| `app.js` | 状態管理・描画・操作ロジック |
| `sw.js` | オフライン用 Service Worker |
| `manifest.webmanifest` | PWA メタデータ |
| `icon.svg` | アプリアイコン |
