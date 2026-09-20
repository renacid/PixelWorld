# 地域・ステージ・階層の設定

## 編集するファイル

| ファイル | 内容 |
| --- | --- |
| regions.ts | 地域一覧、地域共通の道具・スキル・罠・敵ドロップ |
| plains/1-1.ts〜1-5.ts | 平原のステージ設定 |
| forest/2-1.ts〜2-3.ts | 森のステージ設定。2-4・2-5は未実装 |
| forest/layouts.ts | 森2-1・2-2の第1層の地形と固定配置 |
| forest/layout03.ts | 森2-3の各階層の地形と配置 |
| shared/upperFloors.ts | 個別地形を指定しない上層の共通生成 |
| cave/ | 洞窟3-1以降の追加先（未実装） |
| index.ts | 公開順の登録 |
| DungeonRules.ts | 設定の合成処理。通常は編集不要 |

## 設定の優先順位

地域の `defaults` → 個別ステージ → `floorSettings[階層番号]` の順に上書きします。
`loot` はカテゴリごと、`enemyDrops` は敵IDごとに継承し、指定した配列は置き換えます。

手作り `layout` の `objects/enemies` は固定配置です。`randomEnemies` はステージに `enemySpawns` がない場合に使います。
罠は「階層のtrapPlacements → layoutのtrapPlacements → ステージ・地域のtrapPlacements」の順に採用します。
各配置ルールの `pool` を省略すると階層・ステージ・地域の `trapPool` を使い、明示するとその配置専用の表になります。

## 地域共通・個別の抽選表

regions.tsのdefaults、または個別ステージに以下を指定できます。

```ts
loot: {
  items: [{ value: 'potion', weight: 3 }, { value: 'ether', weight: 1 }],
  rareItems: [{ value: 'healingPotion', weight: 1 }],
  skills: [{ value: 'fireball', weight: 2 }, { value: 'tornado', weight: 1 }],
},
trapPool: [{ value: 'bearTrap', weight: 3 }, { value: 'healing', weight: 1 }],
trapPlacements: [{ count: 8 }],
enemyDrops: {
  wolf: [{ loot: { type: 'item', id: 'potion' }, chance: 0.15 }],
},
```

- `weight` は候補同士の比率、`chance` は0〜1の確率です。0.15なら15%。道具には既存のレア度・浅層補正も適用します。
- `loot` は通常宝箱、宝箱トラップ、バッグ完全充填報酬に適用します。
- 敵ドロップは `enemyDrops` がなければ `src/data/enemies.ts` の定義を使います。
- 宝箱の個数・スキル入り確率・レア枠確率は `src/data/loot.ts` の `CHESTS` で調整します。
- `skillId/skillIds/itemId/contents` による固定宝箱報酬、宝石の属性スキル報酬は別枠です。
- 空配列 `[]` はそのカテゴリの抽選なし。金箱でも候補数以上の異なるスキルは出ません。

## クリア条件

```ts
clearCondition: { type: 'exit' }, // 出口へ到達
// clearCondition: { type: 'records', count: 2 }, // 古代の記録を2個拾い、出口へ
// clearCondition: { type: 'defeat', kind: 'wolf', count: 3 }, // 指定した敵を3体倒し、出口へ
floorSettings: {
  1: { clearCondition: { type: 'defeat', kind: 'wolf', count: 3 } },
  2: {
    clearCondition: { type: 'defeat', kind: 'golem', count: 1 },
    enemySpawns: [{ kind: 'golem', count: 1 }, { kind: 'goblin', count: 4 }],
    loot: { skills: [{ value: 'icestone', weight: 1 }] },
  },
},
```

`kind` はenemies.tsのキーです。判定は `clearCondition`、選択画面の案内文は `objective`。ゲーム内の必要数表示は判定から自動生成します。
討伐・回収実績は階層ごとにリセットし、睡眠では維持します。敵が復活しても達成判定は戻りません。
必要数に足りない記録・討伐対象は生成時に補充します。討伐対象の出現数にはランダム減算を適用しません。

平原1-4は狼を第1層3体・第2層4体。平原1-5は第1層が出口到達、第2層がゴーレム1体討伐です。

## 地形・固定配置

1文字が1マス。左上がx=0,y=0です。すべての行の文字数を揃え、ステージのwidth/heightと一致させます。

```ts
import type { StageLayout } from '../../game/types';
export const myMap: StageLayout = {
  rows: [
    '#########',
    '#.......#',
    '#..##...#',
    '#.......#',
    '#.......#',
    '#.......#',
    '#########',
  ],
  legend: { '#': 4, '.': 3 }, // terrain.tsのID。4=木、3=森の床
  spawn: { x: 1, y: 1 },
  objects: [
    { id: 'start', type: 'chest', chestTier: 'gold', position: { x: 2, y: 1 }, skillIds: ['attack', 'warp'] },
    { id: 'tablet', type: 'record', position: { x: 6, y: 4 } },
    { id: 'exit', type: 'exit', position: { x: 7, y: 5 } },
  ],
  enemies: [{ kind: 'goblin', position: { x: 6, y: 3 } }],
  randomEnemies: [], randomChests: 0, gemCount: 0, trapPlacements: [],
};
```

この例はwidth:9,height:7で使用します。dungeonのextraPassages:0、gemCount:0にすると地形の改変・宝石追加を止められます。
ステージの `layout: myMap` に指定するか、階層ごとに指定してください。

```ts
floorSettings: {
  1: { width: 9, height: 7, layout: myMap },
  2: { width: 25, height: 25, layout: secondMap },
},
```

`layout: (stage, floor) => ...` という生成関数も使えます。全階層で呼ばれるので初期宝箱は第1層だけに配置してください。
床・壁の絵と通行設定は `src/data/terrain.ts` で編集します。床の接続、出口、大型敵の全占有マスの空きを確認してください。

## 範囲を指定した罠

```ts
trapPlacements: [
  { count: 8 }, // 全体から配置、地域の候補を使用
  { region: { x: 5, y: 10, width: 8, height: 6 }, count: 5,
    pool: [{ value: 'bearTrap', weight: 1 }] }, // 狭い範囲に集中
],
```

固定罠は `layout.traps` にid/trapId/position/triggered:falseを指定します。

## 新規ステージを公開する

1. `forest/2-4.ts` などを作成し、既存ファイルと同じ形式でstageをexportします。
2. 保存用idは既存番号を変更せず末尾の次（現在9）を付けます。表示番号はcode:'2-4'、地域はregionId:'forest'です。
3. index.tsにimportし、一覧末尾へ追加します。同じcodeの準備中表示は自動で置き換わります。
4. 地域追加はregions.tsへ。既存の保存用idを振り直さないでください。

旧セーブ互換のため内部名 `objectiveChests` を維持していますが、現在の意味は「古代の記録の取得数」です。


## 壺・巣穴（設置物）

初期配置は森2-3だけです。新しい冒険・次の層の生成時に配置されます。
既に生成済みの中断マップには後付けしません。

- 共通設定: src/data/installations.ts の INSTALLATIONS。
- ステージ配置: src/stages/forest/2-3.ts の installationPlacements。
- 個別の層: floorSettings[層番号].installationPlacements で配列全体を上書き。
- 絵柄: src/render/InstallationSprites.ts。16×16座標で描き、2倍表示。
- 破壊演出: EffectPainter.ts の shatter。効果音: data/effects.ts の shatter。

初期設定は各層に壺8個、巣穴2個。nearWall:true は上下左右のいずれかに壁がある床です。
通路を分断する位置、キャラ・宝箱・罠・開始地点付近を避けます。安全な候補が
不足する場合は個数を減らします（通路確保を優先）。region を省略するとマップ全域です。

設定例（StageまたはFloorSettings内）:

```ts
installationPlacements: [
  { kind: 'pot', count: 8, nearWall: true },
  { kind: 'goblinNest', count: 2, nearWall: true,
    // この配置ルールの巣穴だけ共通設定を上書きする例。
    overrides: { spawn: {
      radius: 6, chance: 0.1, max: 3,
      pool: [
        { value: 'goblin', weight: 6 },
        { value: 'goblinArcher', weight: 3 },
        { value: 'goblinMage', weight: 1 },
      ],
    } },
  },
]
```

chanceは0～1の確率。weightは種類間の比率（上記は60%・30%・10%）。
壺は1ヒットで壊れ、初期35%で薬草・魔力の雫(小)・砂時計(小)のいずれかを落とします。
道具リストはdrop.pool、全体の出現率はdrop.chanceで変更できます。
設置物は歩行を遮り、直線攻撃は手前の設置物で止まります。範囲攻撃・連鎖・敵の投射攻撃・攻撃罠にも対応。
巣穴は成功したプレイヤー歩行の移動先から縦横斜め6マス以内で抽選します。
待機・壁への入力・スキル移動では抽選しません。周囲8マスの空きを使い、
累計3体で消滅（倒した敵の分も累計に残る）。出現した敵はそのターンから行動します。
中断データには設置物と累計出現数を保存します。巣穴を攻撃した場合も1ヒットで消えます。


## 開始報酬・魔導書

開始宝箱に斬撃が固定設定されていると、MapState.generateMapの共通処理で
斬撃・ワープのみ（森以降は薙ぎ払いも）の固定スキルへ統一し、隣へ魔導書を置きます。
道具の抽選は従来通りで、森以降は薬草を最低1つ保証します。新しく生成するマップに適用。
魔導書はobjectsへ { id:'book-1', type:'skillBook', position:{x:5,y:5} } で追加できます。
取得後は炎・氷・雷・風・土から選択。loot.skillsの同属性の候補をweightで抽選します。
設定がない属性は選べません。書は道具枠を使わず、×で床に戻せます。
書には宝箱・宝石の「所持最大セル数+1」制限は適用しません。
土属性の内部IDはearthです。旧保存データのnatureは読み込み時にearthへ変換します。


## 森2-4・設置物の破壊条件

2-4.tsは3層、layout04.tsは57×79の南スタート地形です。各層の形状を変え、
1マス通路・広場・迂回路・行き止まりを配置。初期敵の80%がゴブリン系です。
floorSettingsで clearCondition:{type:'destroyInstallations',kind:'goblinNest',count:2} を設定可能。
installationPlacementsには目標以上の数を配置してください。生成時に不足を検出します。
目標数分の巣穴はrequiredForGoalを持ち、累計3体出現後も攻撃で壊すまで残ります。
破壊実績はdestroyedInstallationsに保存し、階層移動時だけリセットします。
WorldSettings.tsで全ステージ解放と最大マップ幅・高さ（120×120）を設定します。
未実装のステージは解放対象外。上限は生成時とセーブ読込時の両方で検証します。

### 魔導書の階層別配置
地域内のステージ1〜3は各層1冊、4〜5は各層1冊＋30%で2冊目を配置します。初期宝箱の隣や手置きの書も上限に含みます。空き床が不足する場合は追加しません。
ステージ定義の `skillBooks: { max: 2, extraChance: 0.3 }` で変更できます。`floorSettings[階層].skillBooks` でも同じ設定を上書きできます。`max: 0` は配置なしです。既に生成済みの中断マップには遡って適用しません。

巣穴の抽選は旅人の歩行が成功した時だけです（待機・スキル・道具・壁への移動入力では抽選しません）。標準は `chance: .25, chanceDecay: .05`。巣穴ごとの出現成功数に応じて25→20→15→10→5%と低下し、失敗時は維持します。上限変更時も確率は0%未満になりません。
