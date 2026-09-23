# ダンジョン工房

開発サーバー起動中に `http://localhost:5173/dev/dungeon-editor.html` を開きます。PC用です。

1. 左側でステージID・地域・表示番号・名前を設定します。IDは既存のものと重複させないでください。
2. 横・縦のマス数を入力して「サイズを適用」。各階9～120マスです。
3. 中央上部の地形パレットから床や壁を選び、ペン・四角塗り・塗りつぶしで描きます。
4. 開始地点、出口、敵、罠、宝箱、道具、スキル、壺、巣穴を配置します。大型敵は占有範囲を表示します。
5. 左側でクリア条件・必要数・魔導書数・宝石上限・ランダム敵／罠を設定します。
6. 階層の＋や複製で次層を作ります。各階のサイズ・地形・条件は独立しています。
7. 「配置を検査」で出口までの経路や重なりを確認し、「TypeScript出力」で保存します。

出力は `src/stages/forest/2-5.ts` など、地域フォルダ直下に配置する前提です。`src/stages/index.ts` にimportしてSTAGESの配列へ追加してください。地域一覧にないregionIdを使う場合は `src/stages/regions.ts` も追加します。設定を反映するには新規プレイを始めてください。

下書きはゲームのセーブと別のlocalStorageキーに自動保存します。「JSON出力」でバックアップし、「JSONを開く」で編集を再開できます。既存の任意のTypeScriptファイルを直接読み込む機能ではありません。コード出力の変更を再編集用JSONへ逆変換することもありません。

## 配置物の詳細

「選択・詳細」で対象をクリックし、右側のJSONを編集します。宝箱のcontentsは固定報酬です。

```json
{
  "id": "fixed-chest",
  "type": "chest",
  "chestTier": "gold",
  "position": { "x": 5, "y": 5 },
  "contents": [{ "type": "skill", "id": "fireball" }, { "type": "item", "id": "potion" }],
  "skillIds": ["fireball"]
}
```

斬撃を含む第1層の宝箱には、ゲーム共通の初期宝箱報酬の上書き処理が適用されます。

巣穴は `overrides.spawn` で出現種類の重み・上限・確率を設定できます。破壊目標にする場合は `requiredForGoal: true` を維持してください。

## 階層詳細JSON

`enemySpawns`、`trapPlacements`、`installationPlacements`、`loot`、`enemyDrops`など、既存のFloorSettingsと同じキーを使えます。明示した配列は地域の共通設定を上書きします。

```json
{
  "enemySpawns": [{ "kind": "goblin", "count": 4 }],
  "trapPlacements": [{ "count": 5, "region": { "x": 10, "y": 10, "width": 8, "height": 8 }, "pool": [{ "value": "fireMine", "weight": 1 }] }],
  "installationPlacements": [],
  "skillBooks": { "max": 1, "extraChance": 0 },
  "loot": { "skills": [{ "value": "fireball", "weight": 1 }] }
}
```

固定配置はエディタ内で検査しますが、ランダム配置用の空き床が不足する場合はゲームのマップ生成時にもエラーになります。敵の数や罠の数は床の広さに合わせてください。

## 今回の夜・反応設定

- 死神の体数・HPは `src/game/DayCycle.ts` の `reaperRules`。MPは `src/data/enemies.ts`。
- 疲労度0～5。4・8・12…日目の朝に1加算し、その睡眠から適用。回復量は最大HP×(1−疲労度×0.2)、切り捨て。現在HPに加算し、最大HPを上限とします。MPは全回復。
- 夜開始と深夜150・180・210…カウントで死神を追加します。空きマスが不足すれば置ける分のみ出現します。
- 風散はダメージと物体命中を処理した後、既存結晶の破裂を解決。結晶の破裂演出は風散より650ms遅らせています。
