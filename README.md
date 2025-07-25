# tsuzuke

[![CI](https://github.com/miruky/tsuzuke/actions/workflows/ci.yml/badge.svg)](https://github.com/miruky/tsuzuke/actions/workflows/ci.yml)
[![Deploy](https://github.com/miruky/tsuzuke/actions/workflows/deploy.yml/badge.svg)](https://github.com/miruky/tsuzuke/actions/workflows/deploy.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Test](https://img.shields.io/badge/Test-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**「今日やった」を1タップ押すだけの習慣トラッカー。続いた日が直近1年のSVGヒートマップになって積み上がる。**

## 概要

続けたいこと(朝の散歩、読書、筋トレ)を登録すると、習慣ごとに大きなチェックボタンと、GitHubの草のような53週ぶんのヒートマップが並びます。押した日はその場でマップに刻まれ、連続日数・最長記録・合計日数が更新されます。先頭には全習慣をまとめた達成度マップと、続けている習慣数・きょうの達成・いちばんの連続・のべ日数・直近30日の活動率がまとまり、その日にどれだけやれたかが濃淡で見えます。7日・30日・100日・365日の節目に届くと、その習慣に小さな達成の印が灯ります。

データはすべてlocalStorageに保存され、アカウントも通信もありません。バックアップと引っ越しはJSONのエクスポート・インポートで行います。

試す: https://miruky.github.io/tsuzuke/

### なぜ作ったのか

習慣化アプリはリマインダー・目標設定・ソーシャル機能で重くなりがちですが、続けるために本当に効くのは「途切れたら目に見えて悔しい記録」だけだと思っています。GitHubの草が緑を絶やしたくない気持ちにさせるのと同じ仕組みを、コードを書かない習慣にも使えるようにしました。機能はチェックとヒートマップ、それだけです。

## 使い方

- フォームに名前を入れて「増やす」。習慣は20個まで、それぞれ違う色が割り当てられます
- 大きなチェックボタンで今日の分を記録します。もう一度押せば取り消せます
- 付け忘れた日は、ヒートマップのその日のマスを直接押して付け外しできます
- 連続日数は「今日まだ押していない」だけでは途切れません。昨日まで続いていれば継続中です
- 各習慣は上下の並べ替え、色の変更、名前の変更ができます。色は一覧の丸ボタンを押すと循環します
- キーボードの数字キー(1〜9)でその習慣の今日を記録、`n` で入力欄に移れます
- 画面右上の「テーマ」で自動・明るい・暗いを切り替えます(選択は保存され、次回は描画前に反映されます)
- 「エクスポート」「インポート」でJSONとして持ち出し・取り込みができます(重複は読み飛ばし)
- 達成度マップは今日のマスを細い輪郭で示し、各マスにカーソルを合わせるとその日の達成数が出ます
- 印刷(ブラウザのPDF保存)では操作系を畳み、ヒートマップと数値だけを1枚に残します

## アーキテクチャ

![tsuzukeのアーキテクチャ](docs/architecture.svg)

`habits.ts` が習慣と「やった日」の集合を持つ台帳で、連続日数の計算までを担います。`heatmap.ts` は日付から濃さを返す関数を受け取って53週グリッドのSVG文字列を返す純粋関数で、週の組み立て(月曜はじまり・未来は描かない・今日が最終セル)を単体テストで固めています。色はCSSクラスに任せているため、同じ生成器が全体ビュー(4段階の濃淡)と習慣ビュー(習慣色)の両方で使われ、ライト・ダークにも追従します。

## 技術スタック

| カテゴリ     | 技術                 |
| :----------- | :------------------- |
| 言語         | TypeScript 5(strict) |
| ヒートマップ | 自前のSVG生成        |
| ビルド       | Vite 8               |
| テスト       | Vitest(49テスト)     |
| リンタ       | ESLint + Prettier    |
| CI / CD      | GitHub Actions       |
| 配信         | GitHub Pages         |

## プロジェクト構成

- `src/lib/habits.ts` — 習慣と印の台帳。連続日数・検証・エクスポート/インポート
- `src/lib/heatmap.ts` — 53週グリッドのSVG生成
- `src/lib/stats.ts` — 要約値(達成数・最長連続・のべ日数・直近の活動率)と継続の節目を導く純粋関数
- `src/lib/theme.ts` — テーマ(自動・明るい・暗い)の解決と適用
- `src/lib/motion.ts` — 入場・カウントアップ・押下フィードバックの控えめなモーション
- `src/app.ts` — チェックボタン・ヒートマップ・追加削除のUI
- `docs/architecture.svg` — アーキテクチャ図

## はじめ方

### 前提条件

- Node.js 22 以上

### セットアップ

```bash
git clone https://github.com/miruky/tsuzuke.git
cd tsuzuke
npm ci
npm run dev
```

### テストとlint

```bash
npm test
npm run lint
```

### ビルド

```bash
npm run build
```

GitHub Pagesへは `main` へのpushで自動デプロイされます。サブパス配信のため、ワークフローでは環境変数 `TSUZUKE_BASE=/tsuzuke/` を渡してViteの `base` を切り替えています。

## 設計方針

- **記録の摩擦を一点に集める**: 画面を開いてボタンを1回。それ以上の操作を要求しないことを最優先にしています。リマインダーも目標値もありません。
- **付け忘れに寛容、改ざんに無頓着**: 過去のマスを押せば後から付けられます。自分のための記録なので、不正防止より修正のしやすさを取りました。
- **生成器は色を知らない**: ヒートマップのSVGは構造(マスと日付)だけを作り、色はCSSに任せます。テーマ対応と習慣色の塗り分けが1つの生成器で済んでいるのはこの分離のおかげです。
- **ローカルファースト**: 習慣の記録は私的なログなので、端末の外に出しません。

## ライセンス

[MIT](LICENSE)
