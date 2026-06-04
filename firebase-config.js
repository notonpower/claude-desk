// ─────────────────────────────────────────────────────────────
//  Firebase 設定 — クラウド同期 / Google・Apple ログイン用
// ─────────────────────────────────────────────────────────────
//
//  ここに値を入れるまでは「ローカル専用モード」で動きます
//  （ログイン/同期は無効、データは端末内だけ）。
//
//  設定手順:
//   1. https://console.firebase.google.com でプロジェクトを作成（無料）
//   2. 「ウェブアプリ」を追加 → 表示される firebaseConfig をここに貼る
//   3. Authentication → Sign-in method で「Google」を有効化
//      Apple を使う場合は「Apple」も有効化（Apple Developer 登録が必要）
//   4. Authentication → Settings → 承認済みドメインに
//      `notonpower.github.io` を追加
//   5. Firestore Database を作成し、ルールを下記に設定:
//        rules_version = '2';
//        service cloud.firestore {
//          match /databases/{db}/documents {
//            match /users/{uid} {
//              allow read, write: if request.auth != null
//                                 && request.auth.uid == uid;
//            }
//          }
//        }
//
//  ※ ここの値（apiKey 等）は公開しても安全な「公開用」設定です。
//
window.FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};
