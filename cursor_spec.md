# オルガモン図鑑クエスト 完成開発指示書（Cursor用）

> **このファイルを新しいCursorチャットに貼り付けて、Phase順に実装を依頼してください。**
> 教材データは `@入学前教育/pre_kiso2.pdf` と `@入学前教育/pre_kiso_kaitou.pdf` を参照してください。

---

## 0. プロジェクト概要

高校生の初学者向けに、解剖生理学を「収集・進化・バトル・図鑑コンプ」で学べる学習RPGゲーム。
ゲーム名は **オルガモン図鑑クエスト**。

### 学習体験の核
- 解く（5種類のクイズ）
- 集まる（カード収集＋仲間獲得）
- 育てる（進化＋仲間育成）
- 戦う（スキルバトル＋ボス戦）
- 埋まる（図鑑コンプ→パスワード解放）

### 学習順は教材の章構成に合わせる（8章＋最終修了レイド）
1. 細胞と組織・DNA
2. 器官系
3. 骨格
4. 体液（血液・免疫）
5. 内臓
6. 循環
7. 呼吸
8. 感覚
9. Final: 修了レイド（30問）

---

## 1. 制約条件

- **サーバーなし**: 全データはlocalStorage/IndexedDBで管理（サーバー設置コスト不可）
- **ターゲット**: 医療系進学前の高校生（**80%が女性**）
- **技術スタック**: React + TypeScript + Vite + Tailwind CSS + Zustand
- **クロスゲーム連携**: 図鑑コンプでパスワード発行。他3ゲーム+スペシャルゲームと連携（将来作成）
- **1プレイ5〜8分で完結する短時間ループ**
- **不正解でも前進**（復習クエスト・欠片救済）
- **モバイル優先レスポンシブ（360px〜）**

---

## 2. 設計方針

1. 1プレイ5〜8分で完結する短時間ループ
2. 不正解でも前進（復習クエスト・欠片救済）
3. 図鑑進捗の可視化（収集率、進化系統、未取得表示）
4. 章ごとの解放設計（前章クリアで次章開放）
5. 自動採点前提（単一正答の選択式 or 穴埋め選択式）
6. 女性80%ターゲットに合わせたパステルUI
7. サーバーレスで完結（ソーシャル要素はローカル保存＋画像シェアのみ）

---

## 3. アーキテクチャ

```
データ層（IndexedDB）
├── currentRun     ... 現在のプレイデータ（新規ゲームでリセット）
│   ├── selectedHero     ... 選択した主人公
│   ├── teamMembers[]    ... 編成中の仲間（最大2体）
│   ├── homeostasis      ... ホメオスタシスゲージ（0〜100）
│   ├── activeDebuffs[]  ... 現在の状態異常
│   └── skillCooldowns{} ... スキルCD管理
├── collection     ... 永続図鑑（プレイをまたいで蓄積、上限あり）
├── meta           ... メタ情報（パスワード、実績、通算ログイン等）
└── dailyState     ... デイリーミッション・ログインボーナス状態
```

- **currentRun**: 主人公、チーム、レベル、XP、所持カード、仲間、アイテム、章進捗、ポイント、ホメオスタシス
- **collection**: 図鑑登録済みカード（進化段階・レベル記憶）、仲間、アイテム ※各上限あり
- **meta**: 全クリア回数、パスワード解放フラグ、実績、称号、カードスキン

### 新規ゲーム開始時の挙動
1. 主人公を4人から選択（選ばなかった3人は仲間として出現可能）
2. currentRunをリセット（ゼロから再スタート）
3. collectionのカード/仲間/アイテムは閲覧のみ可（使用不可）
4. クリア時にcurrentRunの成果をcollectionへマージ（上限チェック付き）

### パスワード・クロスゲーム連携
- collection図鑑が100%になると「隠しパスワード」を表示
- 他3ゲーム（将来作成）でも同様にパスワードが手に入る
- 4つのパスワードを揃えるとスペシャルゲーム解放
- スペシャルゲーム開始時にcollectionから任意のカードを最大5枚移設可能
- パスワード入力画面をSettings内に設置（将来の拡張ポイント）

---

## 4. 主人公キャラクターシステム（コアシステム）

### 世界観
プレイヤーは医療系進学を目指す高校生。人体の中の世界「オルガモンワールド」に召喚され、各臓器の国を侵す「疾患モンスター」から人体を守る「メディカルレンジャー」として冒険する。4人の主人公はそれぞれ異なる医療職を志望しており、その専門性がスキルに反映されている。

### 共通ルール
- **1ターン = 1問解くサイクル**（クイズ中もバトル中も共通）
- **ホメオスタシスゲージ**: 0〜100（チーム全体のリソース。ボス戦のクリア条件＝終了時70以上）
- **状態異常（学習妨害）**: ボスや高難度クイズで付与される
  - **観察漏れ**: 問題文の一部がマスクされる
  - **誤情報**: 選択肢に偽のハイライトが表示される
  - **時間圧**: 制限時間が半減する
  - **機器不調**: アイテム使用不可になる
- **スキル構成**: アクティブ3個 + アルティメット1個 + パッシブ1個
- **クールダウン（CD）**: 使用後、指定ターン数は再使用不可
- **アルティメットチャージ**: 正解を重ねてチャージし、満タンで発動可能

### 主人公1: ミナト（看護師志望 / 前線ケアタイプ）

**コンセプト**: 観察力と優先順位付けに長けた頼れるリーダー。チームの安定化担当。
**テーマカラー**: コーラルピンク

**アクティブスキル**:
1. **バイタルスキャン**（CD:2）
   - 次の問題で重要キーワードを1つハイライト表示
   - 追加: 「観察漏れ」を1段階解除
2. **トリアージコール**（CD:3）
   - 4択を3択に削減（誤答1つを除外）
   - 追加: 「時間圧」を1ターン軽減
3. **ケアプラン実行**（CD:3）
   - ホメオスタシス +8（直前が正解なら +12に強化）

**アルティメット**: **コードブルー指揮**（チャージ:5問正解）
- 全チームメンバーのCD -1 + ホメオスタシス +15
- 次ターンの不正解ペナルティ半減

**パッシブ**: **観察眼**
- 2連続正解ごとに「ヒントの欠片」+1（10個でヒント1回に変換）

**進化ライン**: 見習いナース → トリアージナース → ホメオスタシス指揮官

### 主人公2: ヒカリ（視能訓練士志望 / 精密解析タイプ）

**コンセプト**: 視覚情報の精査と誤情報の見抜きに特化。問題の本質を見極める精度の鬼。
**テーマカラー**: ラベンダー

**アクティブスキル**:
1. **視野マッピング**（CD:2）
   - 問題文のノイズ（紛らわしい語句）をグレー表示して読みやすくする
   - 追加: 「誤情報」デバフを解除
2. **眼球運動トレース**（CD:3）
   - ミニ反応ゲーム（タップチャレンジ）成功で正答率バフ +15%（2ターン）
3. **焦点キャリブレーション**（CD:3）
   - 次の1問、誤答時のペナルティを0にする（安全ネット）

**アルティメット**: **ニューロビジョン**（チャージ:5問正解）
- 2ターンの間、重要語句を自動ハイライト
- 追加: 4択を2択まで絞る（1回限り）

**パッシブ**: **精密読解**
- 全問題の制限時間 +20%（常時）

**進化ライン**: ビジョンアシスト → 視機能アナリスト → ニューロビジョンマスター

### 主人公3: コトハ（歯科衛生士志望 / 予防ケアタイプ）

**コンセプト**: 状態異常の予防と継続的なケアで、チームの持久力を支える縁の下の力持ち。
**テーマカラー**: ミントグリーン

**アクティブスキル**:
1. **プラーククリーン**（CD:2）
   - チームのデバフ1種を解除
   - 追加: 次ターンのペナルティ -30%
2. **全身リンクケア**（CD:3）
   - 「関連器官ヒント」を1つ表示（例: 口腔→消化器系/循環系の関連知識）
   - 追加: 章マスタリー経験値 +10%
3. **セルフケア指導**（CD:3）
   - 次の3ターン、正解ごとにホメオスタシス +4

**アルティメット**: **オーラルバリア**（チャージ:5問正解）
- 3ターンの間、「誤情報」「時間圧」を各1回ずつ無効化

**パッシブ**: **継続ケア習慣**
- 復習クエスト達成時の報酬（欠片/XP） +25%

**進化ライン**: 予防ケア担当 → 行動変容コーチ → ライフロングケアマスター

### 主人公4: レオン（臨床工学技士志望 / システム最適化タイプ）

**コンセプト**: データとシステムの全体最適を追求。機器トラブルに強く、チーム全体を底上げ。
**テーマカラー**: スカイブルー

**アクティブスキル**:
1. **モニタ同期**（CD:2）
   - 直近2ターンの正答傾向をグラフ表示（弱点章を可視化）
   - 追加: 「観察漏れ」を解除
2. **トラブルシュート**（CD:3）
   - 「機器不調」デバフを即解除
   - 成功時、ランダムで仲間1人のCD -1
3. **流量チューニング**（CD:3）
   - ホメオスタシス +10（前ターンがデータ系問題の正解なら +14）

**アルティメット**: **フルシステム最適化**（チャージ:6問正解）
- 全チームメンバーの次スキル効果 +30%（1回限り）
- 追加: チーム全員のCD -1

**パッシブ**: **予防保守**
- 各ラウンド開始時に10%の確率で「機器不調」を無効化

**進化ライン**: モニタテック → システムエンジニア → 生命維持システムマスター

### チーム編成とコンボシステム

**編成**: 主人公1人 + 仲間最大2人（選ばなかった主人公キャラも仲間として出現）

**相性コンボ**（特定の組み合わせで自動発動）:
1. **ミナト + レオン** = 「ショック対応ライン」
   - 同ターンにスキル発動でホメオスタシス追加 +6
2. **ヒカリ + コトハ** = 「観察と予防のループ」
   - 誤情報無効 + 復習報酬 +10%
3. **4職種全員集合**（主人公 + 残り3人が仲間） = 「多職種カンファレンス」
   - 次問題を2択化 + 全員CD -1
   - ※全員を仲間にする必要がある特別コンボ

**仲間としての4主人公キャラ**:
- 選ばなかった3人はクイズクリア後にランダム出現（出現率: 各章で徐々に上昇）
- 仲間として加入後もレベルアップ・進化可能
- 仲間時はパッシブ + アクティブ1つのみ使用可能（主人公時よりスキル制限あり）

### 主人公キャラの進化条件（共通）
- Stage2: 該当章の小テスト70%以上
- Stage3: 確認テスト80%以上 + 連携ミッション成功

### バトル難易度
- **Easy**: 全スキルCD -1、不正解ペナルティ小、ホメオスタシス初期値80
- **Normal**: 標準設定、ホメオスタシス初期値60
- **Hard**: 時間圧イベント増加、状態異常頻発、ホメオスタシス初期値50
- **クリア条件**: ラウンド終了時ホメオスタシス70以上

---

## 5. スコアリング・成長ロジック

### クイズ報酬
- 正解: +10 XP
- 連続正解ボーナス: +2 XP × streak
- 全問正解（5/5）: +20 XP

### メディカルポイント（MP）
- 正解1問: +5 MP
- 全問正解: +30 MP
- ボス撃破: +100〜500 MP（章による）
- デイリーミッション達成: +20〜50 MP
- MPはショップでアイテム購入に使用

### 捕獲エネルギー
- 正解1問につき +1 エネルギー
- 5問中4問正解以上で +1 ボーナス
- エネルギー3で1回捕獲抽選

### 章マスタリー（0〜100%）
- 小テスト正答率 40%
- 確認テスト正答率 40%
- 復習達成率 20%

### レベル
- Level = floor(totalXP / 100) + 1
- レベルアップ時に演出・称号付与

### 救済: 欠片システム
- 不正解1問ごとに「知識の欠片」+1
- 欠片10個で任意カード1枚を保底獲得
- 欠片20個で進化補助（進化条件を一部緩和）

---

## 6. クイズシステム（5種類の出題形式）

### 出題形式
1. **4択クイズ** - 確認テストの問題をそのまま使用
2. **穴埋めタップ** - 小テストの語群選択形式を再現（教材PDFと同じ形式）
3. **スピードクイズ** - 制限時間5秒の4択（速度ボーナスXP）
4. **並べ替え** - 循環経路・消化順序などをドラッグ&ドロップ
5. **○×ラッシュ** - 10問連続の二択、コンボカウンター付き

### クイズフロー（スキル統合版）
1. 章選択 → チーム編成確認 → 学習カード表示（30秒）
2. クイズ5問ループ:
   - 問題表示 → **スキル使用判断**（使うならここ） → 回答
   - 正解判定 → SkillEffect適用 → 状態異常チェック
   - XP/ポイント計算 → アルティメットチャージ更新 → CD更新
3. 5問完了後:
   - アイテムランダムドロップ判定
   - 捕獲エネルギー → カード捕獲抽選
   - 仲間出現判定（主人公キャラ含む）
   - 進化判定 → 図鑑更新 → リザルト画面

---

## 7. カード・仲間・アイテムシステム

### カードシステム

**種別**: `organelle`（細胞小器官） / `organ`（器官） / `system`（器官系）
**レアリティ**: Common / Rare / Epic / Legend（章が進むほどRare以上の出現率微増）

**進化段階**:
- Stage 0: 未取得
- Stage 1: Base（初期）
- Stage 2: Advanced
- Stage 3: Master（最終）

**進化条件**:
- Stage1到達: 小テスト70%以上
- Stage2到達: 確認テスト80%以上
- Stage3到達: 連携ミッション達成（前章+当章の複合条件）

**進化例（固定実装）**:
- 細胞膜 → 受容体トレイニー → 受容体マスター
- ミトコンドリア → ATPビルダー → 好気代謝マスター
- 心臓 → 循環ドライバー → 循環キャプテン
- 肺 → 換気ナビゲーター → ガス交換マスター

**バトル属性**: 各カードに攻撃力・属性（章に対応）を持たせる

**カードスキン**: 通常 / パステル / キラキラ / ドット絵（実績解除 or ショップ購入で入手）

### 仲間システム

- クイズクリア後にランダムで仲間が出現
- **仲間の種類**:
  - 主人公キャラ（選ばなかった3人）: Epic固定、職種スキル付き
  - ナースタイプ: 回復・デバフ解除系
  - リサーチャータイプ: ヒント・解析系
  - ガーディアンタイプ: 防御・ペナルティ軽減系
- 仲間にもレベル（1〜30）・進化（3段階）あり
- 一緒にクイズを解くとEXP獲得（パーティに入れて出撃）
- **図鑑への蓄積**: クリア時に仲間のレベル・進化段階ごと保存（上限20体）

### アイテムシステム

- クイズ後にランダムドロップ（ドロップ率: 正答率に比例）
- **アイテム種別**:
  - 消費: 「知恵の薬」（ヒント1回）、「時の砂」（制限時間+3秒）、「経験の書」（XP1.5倍）
  - 強化: 「進化の石」（進化条件緩和）、「絆のかけら」（仲間EXPブースト）
  - 状態異常回復: 「クリアミスト」（デバフ1つ解除）
  - コレクション: 「レアフレーム」（カードスキン解放）、「称号の書」（称号解放）
- 図鑑への蓄積上限: 各アイテム最大10個

### ポイント＆ショップ

- クイズ正解・ボス撃破・ミッション達成で「メディカルポイント（MP）」獲得
- ショップでMP消費してアイテム購入可能
- ショップ品揃えは章解放に応じて増加
- 週替わり（ローカル日付判定）の限定アイテム
- **仲間用装備**: 仲間のステータスを強化するアクセサリ（ショップ限定）

---

## 8. バトルシステム（ホメオスタシス戦闘）

### 章ボス一覧
- Ch1 細胞の国: ミュータントウイルス（HP 300）- デバフ: 誤情報
- Ch2 器官の国: カオスオルガン（HP 350）- デバフ: 観察漏れ
- Ch3 骨格の国: フラクチャーゴーレム（HP 400）- デバフ: 時間圧
- Ch4 体液の国: アネミアドラゴン（HP 500）- デバフ: 誤情報+観察漏れ
- Ch5 内臓の国: メタボリックスネーク（HP 550）- デバフ: 機器不調
- Ch6 循環の国: 不整脈ファントム（HP 700）- デバフ: 時間圧+誤情報
- Ch7 呼吸の国: 無呼吸シャドウ（HP 650）- デバフ: 観察漏れ+機器不調
- Ch8 感覚の国: ニューロカオス（HP 800）- デバフ: 全種ランダム
- Final: パンデミックキング（HP 1500）- デバフ: 全種複合

### バトルフロー
1. チーム編成選択（主人公 + 仲間最大2人）
2. ボス登場演出 → ホメオスタシスゲージ初期化
3. 10ラウンドのクイズバトル:
   - 問題出題 → スキル使用判断 → 回答
   - 正解 → カード攻撃力でボスにダメージ（進化段階で倍率UP）
   - 不正解 → ボスから反撃（ホメオスタシス減少 + 状態異常付与）
   - コンボ判定（チーム構成による自動発動）
4. 10ラウンド終了時:
   - ホメオスタシス70以上 → クリア（ボスカード + 大量MP + レアアイテム）
   - 70未満 → 失敗（経験値のみ獲得、再挑戦可能）

---

## 9. ストーリー＆キャラクター

### ナビキャラ: 「ミコト先輩」
- 医療系専門学校の先輩。プレイヤーをオルガモンワールドに導く案内役
- 章開始時にストーリー導入、クリア時に称賛
- 不正解時は優しいフォロー（「惜しい！ こう覚えると良いよ」）
- 仲間獲得・ボス撃破時にリアクション
- **選択した主人公ごとに一部台詞が変化**

### 章ストーリー概要
- Ch1 「細胞の国：生命の始まりを守れ」
- Ch2 「器官の国：バランスの守護者」
- Ch3 「骨格の国：崩れゆく大地」
- Ch4 「体液の国：赤き流れの危機」
- Ch5 「内臓の国：消化の迷宮」
- Ch6 「循環の国：止まらぬ鼓動」
- Ch7 「呼吸の国：最後の一息」
- Ch8 「感覚の国：五感の試練」
- Final 「パンデミックの影：最終決戦」

### ストーリー分岐
- 各章冒頭: 「〇〇の国が疾患モンスターに侵された！」
- ボス前: 主人公の専門知識に関連する台詞（ミナトなら看護視点、ヒカリなら検査視点）
- 各章クリア: カットシーン（テキスト+アニメーション演出）
- 全章クリア: エンディング（主人公ごとに異なるエピローグ）

---

## 10. デイリー＆継続システム

### ログインボーナス（ローカル日付判定）
- 1日目: 50MP, 2日目: 知恵の薬×1, ..., 7日目: 確定Rareカード
- 14日連続: 確定Epic仲間
- 連続ログインストリーク表示

### デイリーミッション（1日3つ、ローカルでランダム生成）
- 例: 「クイズを1回プレイ」「3問連続正解」「スキルを2回使用」「ボスに挑戦」
- 達成報酬: MP + アイテム

### 曜日限定ドロップ率UP
- ローカル曜日判定で特定章カードのドロップ率2倍
- 日曜日は全章カードドロップ率1.5倍

---

## 11. 実績・称号・カスタマイズ

### 実績（約40種）
- 通常: 「初めてのクイズ」「図鑑10%」「ボス初撃破」「仲間5人獲得」
- キャラ別: 「ミナトで全章クリア」「4主人公で各1回クリア」
- シークレット: 「修了テスト1回目90%以上」「全仲間コンプ」「多職種カンファレンス発動」

### 称号
- 章別: 「細胞マスター」「骨格博士」「免疫の守護者」
- キャラ別: 「ナースの鑑」「精密の眼」「予防の達人」「システムの匠」
- プロフィールカードに表示

### プロフィールカード
- 選択中の主人公 + お気に入りカード3枚 + 称号 + 図鑑コンプ率
- 画像として保存・共有可能

---

## 12. 永続図鑑・パスワードシステム

### 永続図鑑
- カード図鑑（進化ツリー表示、スキン切替）
- 仲間図鑑（主人公キャラ含む。レベル・進化段階を記憶、上限20体）
- アイテム図鑑（取得済みアイテム一覧、各上限10個）
- ボス図鑑（撃破済みボス一覧、撃破タイム記録）
- 主人公図鑑（4人の使用歴・到達進化段階）
- 全体コンプ率表示

### 図鑑の蓄積ルール
- 一度クリアすると、手に入れた仲間（レベル・進化も記憶される）やアイテムを図鑑に貯められる（但し上限あり）
- 新たにゲームを始めた場合は手に入れた仲間やアイテムは使用できないが、クリアすると図鑑に貯められる
- 図鑑が全て埋まると隠しパスワードが手に入る

### パスワードシステム
- 図鑑コンプ率100%達成 → 隠しパスワード表示
- パスワードは固定文字列（ゲームごとに異なる）
- Settings画面に「パスワード入力」セクション（将来用UI）
- 4つ揃う（他3ゲーム分）とスペシャルゲーム解放フラグON
- スペシャルゲーム開始時にcollectionからカードを最大5枚選んで移設

---

## 13. UI/UXデザイン（女性80%向け）

### デザイン方針
- パステルカラー基調（各主人公のテーマカラーがアクセント）
- 角丸・柔らかいシャドウ・グラデーション多用
- キャラクターはかわいい系（2Dイラスト風、CSSアニメーション / SVG）
- カード演出: キラキラエフェクト、進化時のパーティクル
- スキル発動: 各キャラのテーマカラーで光るエフェクト
- フォント: 丸ゴシック系
- 色覚多様性に配慮（色 + アイコン + ラベル）

### 画面一覧（13画面）
1. タイトル画面
2. 主人公選択画面（4人のプロフィール+スキルプレビュー）
3. プレイヤー名入力
4. ホーム（ナビキャラ・デイリー・チーム表示）
5. 章マップ
6. チーム編成画面（主人公+仲間選択）
7. 学習カード → クイズ画面（5形式+スキルUI+状態異常表示）
8. バトル画面（ボス戦+ホメオスタシスゲージ+コンボ演出）
9. リザルト（XP/カード/仲間/アイテム獲得+進化演出）
10. 図鑑（カード/仲間/アイテム/ボス/主人公）
11. ショップ
12. プロフィール（称号・実績・プロフィールカード）
13. 設定（パスワード入力・難易度・音量）

---

## 14. データ設計

### 型定義一覧

```typescript
// キャラクター
type Hero = {
  id: string;
  name: string;
  profession: string;
  themeColor: string;
  skills: Skill[];
  passive: PassiveSkill;
  ultimate: UltimateSkill;
  evolutionLine: string[];
};

type Skill = {
  id: string;
  name: string;
  type: "active" | "ultimate" | "passive";
  cooldown: number;
  chargeRequired?: number;
  effects: SkillEffect[];
};

type SkillEffect = {
  type: "hint" | "reduce_choices" | "heal_homeostasis" | "cleanse_debuff"
    | "reduce_penalty" | "time_extend" | "xp_boost" | "reduce_cd" | string;
  value: number;
  condition?: string;
};

type Debuff = {
  type: "observation_miss" | "misinformation" | "time_pressure" | "equipment_malfunction";
  duration: number;
  severity: number;
};

type TeamCombo = {
  id: string;
  name: string;
  requiredHeroes: string[];
  effects: SkillEffect[];
};

// クイズ
type Question = {
  id: string;
  chapter: number;
  type: "mini" | "confirm" | "final";
  format: "multiple_choice" | "fill_blank" | "speed" | "sort" | "true_false";
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  blanks?: { position: number; answer: string }[];
  relatedOrgan?: string;
  keywords?: string[];
};

// カード
type Card = {
  id: string;
  name: string;
  category: "organelle" | "organ" | "system";
  rarity: "Common" | "Rare" | "Epic" | "Legend";
  chapter: number;
  evolutionLine: string[];
  skins: string[];
  attackPower: number;
  attribute: string;
};

// 仲間
type Companion = {
  id: string;
  name: string;
  heroRef?: string;          // 主人公キャラの場合のみ
  type: "nurse" | "researcher" | "guardian" | "hero";
  rarity: "Common" | "Rare" | "Epic" | "Legend";
  level: number;
  exp: number;
  baseStats: { hp: number; atk: number; def: number };
  skills: Skill[];
  evolutionLine: string[];
  evolutionStage: number;
};

// アイテム
type Item = {
  id: string;
  name: string;
  type: "consumable" | "enhance" | "cure" | "collection";
  effect: string;
  rarity: "Common" | "Rare" | "Epic";
  description: string;
  cost?: number;
};

// ボス
type Boss = {
  id: string;
  chapter: number;
  name: string;
  hp: number;
  debuffPattern: Debuff[];
  weakness: string;
  rewards: { cardId?: string; mp: number; items: string[] };
};

// 実績
type Achievement = {
  id: string;
  name: string;
  description: string;
  condition: string;
  secretFlag: boolean;
  reward: { type: string; value: string };
};

// ストーリー
type StoryScene = {
  id: string;
  chapter: number;
  timing: "intro" | "pre_boss" | "post_boss" | "ending";
  heroVariant?: string;
  dialogue: { speaker: string; text: string; emotion?: string }[];
};

// デイリーミッション
type DailyMission = {
  id: string;
  description: string;
  condition: string;
  reward: { mp: number; itemId?: string };
};

// ショップ
type ShopItem = {
  id: string;
  itemId: string;
  pointCost: number;
  stock: number;
  weeklyOnly?: boolean;
};

// ユーザーデータ
type UserCurrentRun = {
  selectedHeroId: string;
  playerName: string;
  team: Companion[];
  level: number;
  totalXP: number;
  mp: number;
  homeostasis: number;
  debuffs: Debuff[];
  skillCooldowns: Record<string, number>;
  ultimateCharge: number;
  chapterProgress: Record<number, { unlocked: boolean; mastery: number; bossDefeated: boolean }>;
  ownedCards: Record<string, { stage: number; count: number; skin: string }>;
  ownedCompanions: Companion[];
  ownedItems: Record<string, number>;
  fragments: number;
  captureEnergy: number;
  wrongAnswers: string[];
  streak: number;
};

type UserCollection = {
  cards: Record<string, { stage: number; count: number; skin: string }>;
  companions: Companion[];           // 上限20体
  items: Record<string, number>;     // 各上限10個
  bosses: Record<string, { defeated: boolean; bestTime?: number }>;
  heroes: Record<string, { used: boolean; maxStage: number }>;
  completionRate: number;
  passwordUnlocked: boolean;
  password?: string;
};

type UserMeta = {
  totalClears: number;
  achievements: Record<string, boolean>;
  titles: string[];
  activeTitle: string;
  cardSkins: string[];
  loginStreak: number;
  lastLoginDate: string;
  externalPasswords: string[];       // 他ゲームのパスワード
  specialGameUnlocked: boolean;
};
```

### JSONデータファイル
- `questions.json`: 教材PDFから抽出した約250問
- `cards.json`: 全カード定義
- `heroes.json`: 4主人公の全スキル定義
- `companions.json`: 仲間定義（主人公以外のNPC仲間）
- `items.json`: 全アイテム定義
- `bosses.json`: 各章ボスのHP・デバフパターン・弱点・報酬
- `combos.json`: チームコンボ条件と効果
- `achievements.json`: 実績定義
- `story.json`: 全章のストーリーシーン
- `shop.json`: ショップ品揃え
- `evolutions.json`: 進化条件

---

## 15. ロジック仕様（疑似コード）

### クイズ終了処理
```typescript
function onQuizFinished(result) {
  const baseXP = result.correct * 10;
  const streakBonus = result.maxStreak * 2;
  const perfectBonus = result.correct === result.total ? 20 : 0;
  const gainedXP = baseXP + streakBonus + perfectBonus;

  user.totalXP += gainedXP;
  user.level = Math.floor(user.totalXP / 100) + 1;

  const baseMP = result.correct * 5 + (result.correct === result.total ? 30 : 0);
  user.mp += baseMP;

  const energy = result.correct + (result.correct >= 4 ? 1 : 0);
  user.captureEnergy += energy;

  if (result.wrong > 0) {
    user.fragments += result.wrong;
    addWrongAnswers(result.wrongQuestionIds);
  }

  // 仲間EXP配分
  user.team.forEach(c => { c.exp += result.correct * 5; checkLevelUp(c); });

  updateChapterMastery(result.chapter, result);
  rollItemDrop(result.correct / result.total);
  rollCompanionAppear(result.chapter);
}
```

### 捕獲抽選
```typescript
function tryCapture(chapter) {
  while (user.captureEnergy >= 3) {
    user.captureEnergy -= 3;
    const card = drawCardByChapterAndRarity(chapter, user.level);
    grantCard(card);
  }
}
```

### 進化判定
```typescript
function checkEvolution(cardId, chapterStats, linkedMissionCleared) {
  const card = user.ownedCards[cardId];
  const rule = evolutionRules[cardId];

  if (card.stage === 1 && chapterStats.miniRate >= rule.toStage2.minMiniQuizRate) {
    card.stage = 2;
    return "stage2";
  }
  if (card.stage === 2 && chapterStats.checkRate >= rule.toStage3.minCheckQuizRate && linkedMissionCleared) {
    card.stage = 3;
    return "stage3";
  }
  return null;
}
```

### ボスダメージ計算
```typescript
function calcBossDamage(isCorrect, team, cards) {
  if (!isCorrect) return 0;
  const baseAtk = getTopCardAttack(cards);
  const evolutionMultiplier = getEvolutionMultiplier(cards);
  const comboBonus = checkTeamCombo(team);
  return Math.floor(baseAtk * evolutionMultiplier + comboBonus);
}
```

### スキル発動
```typescript
function useSkill(skillId, gameState) {
  const skill = getSkill(skillId);
  if (gameState.skillCooldowns[skillId] > 0) return false;

  skill.effects.forEach(effect => applyEffect(effect, gameState));
  gameState.skillCooldowns[skillId] = skill.cooldown;
  return true;
}
```

---

## 16. ディレクトリ構造

```
orgamon-quest/
├── public/
├── src/
│   ├── components/
│   │   ├── quiz/          ... クイズ形式別コンポーネント
│   │   ├── battle/        ... バトルUI
│   │   ├── skill/         ... スキル発動エフェクト
│   │   ├── card/          ... カード表示・進化演出
│   │   ├── common/        ... 共通UI部品
│   │   └── layout/        ... レイアウト
│   ├── screens/
│   │   ├── TitleScreen.tsx
│   │   ├── HeroSelectScreen.tsx
│   │   ├── PlayerNameScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── ChapterMapScreen.tsx
│   │   ├── TeamEditScreen.tsx
│   │   ├── QuizScreen.tsx
│   │   ├── BattleScreen.tsx
│   │   ├── ResultScreen.tsx
│   │   ├── ZukanScreen.tsx
│   │   ├── ShopScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── stores/
│   │   ├── gameStore.ts       ... currentRun管理
│   │   ├── collectionStore.ts ... 永続図鑑管理
│   │   └── metaStore.ts       ... メタ情報管理
│   ├── data/
│   │   ├── questions.json
│   │   ├── cards.json
│   │   ├── heroes.json
│   │   ├── companions.json
│   │   ├── items.json
│   │   ├── bosses.json
│   │   ├── combos.json
│   │   ├── achievements.json
│   │   ├── story.json
│   │   ├── shop.json
│   │   └── evolutions.json
│   ├── logic/
│   │   ├── quizLogic.ts
│   │   ├── battleLogic.ts
│   │   ├── skillLogic.ts
│   │   ├── captureLogic.ts
│   │   ├── evolutionLogic.ts
│   │   ├── comboLogic.ts
│   │   ├── companionLogic.ts
│   │   ├── itemLogic.ts
│   │   ├── dailyLogic.ts
│   │   └── passwordLogic.ts
│   ├── hooks/
│   ├── types/
│   │   └── index.ts
│   ├── assets/
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
└── index.html
```

---

## 17. 実装手順（Phase順）

1. **Phase 1**: プロジェクト雛形（Vite+React+TS+Tailwind+Zustand） + 全型定義 + 教材PDFから全問題データJSON抽出（`@入学前教育/pre_kiso2.pdf` と `@入学前教育/pre_kiso_kaitou.pdf` を参照）
2. **Phase 2**: 主人公4人のキャラ選択画面 + スキルシステム + ホメオスタシスゲージ + 状態異常システム
3. **Phase 3**: クイズコアループ（5種類の出題形式 + スキル発動 + XP/ポイント/ドロップ判定）
4. **Phase 4**: カード・仲間（4主人公含む）・アイテムシステム + ポイントショップ
5. **Phase 5**: ボス戦（ホメオスタシス戦闘 + チーム編成 + コンボ + 状態異常）
6. **Phase 6**: ストーリー・ナビキャラ（ミコト先輩）・章イントロ/エンディング + キャラ別台詞
7. **Phase 7**: デイリーミッション・ログインボーナス・曜日限定ドロップ
8. **Phase 8**: 実績・称号・カードスキン・プロフィールカード
9. **Phase 9**: 永続図鑑 + パスワードシステム + カード移設UI
10. **Phase 10**: UI/UXデザイン（パステル基調・女性向け）全13画面
11. **Phase 11**: アニメーション・SE・PWA・テスト・レスポンシブ調整

---

## 18. 受け入れ基準（Definition of Done）

- [ ] 主人公4人から選択してゲーム開始可能
- [ ] 第1章を最後までプレイ可能（クイズ→捕獲→進化→図鑑更新）
- [ ] 5種類のクイズ形式が動作する
- [ ] スキルが正しく発動し、CD管理が機能する
- [ ] ボス戦でホメオスタシスゲージが正しく動作する
- [ ] 仲間がランダム出現し、育成（レベル・進化）できる
- [ ] アイテムがランダムドロップし、ショップで購入できる
- [ ] 再読み込み後も進捗が維持される
- [ ] 新規ゲーム開始時にcurrentRunがリセットされ、collectionは保持される
- [ ] クリア時にcurrentRunの成果がcollectionにマージされる
- [ ] 図鑑コンプ100%でパスワードが表示される
- [ ] UIがスマホ幅（360px）で崩れない
- [ ] パステルカラー基調の女性向けデザイン

---

## 19. Cursorへの実装依頼文（新しいチャットに貼り付け用）

```
あなたはシニアフロントエンドエンジニアです。
この指示書（@入学前教育/cursor_spec.md）に従って「オルガモン図鑑クエスト」を実装してください。
教材データは @入学前教育/pre_kiso2.pdf と @入学前教育/pre_kiso_kaitou.pdf から抽出してください。

Phase 1から順に実装してください。各Phaseの完了後に動作確認してから次に進んでください。

必須条件：
* TypeScriptで型安全に実装
* UIは高校生女性向けにパステルカラー基調でかわいく
* データは各JSONファイルに分離
* 主要ロジック（XP計算、スキル判定、ボスダメージ計算、コンボ判定、進化判定）はテストを書いてください
* サーバーは使わず、IndexedDB/localStorageで完結
```
