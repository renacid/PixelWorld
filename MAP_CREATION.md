# 自分で森ステージを作る手順

現在はコードの文字マップで地形を配置します。マウスで地形を塗る専用エディターはありません。「床や木の絵」と「どこに置くか」は別々に設定できます。

## 1. 編集するファイル

| ファイル | 設定する内容 |
| --- | --- |
| `src/data/terrain.ts` | 床・壁・木・水の絵、通行と視線の可否 |
| `src/stages/index.ts` | ステージ名、サイズ、クリア条件、解放順 |
| `src/stages/layouts.ts` | 地形の配置、開始地点、敵、宝箱、出口、罠 |
| `src/data/enemies.ts` | 敵のHP・MP・スキル・ドロップ |
| `src/data/traps.ts` | 罠の効果・抽選候補 |
| `src/data/loot.ts` | 木・鉄・銀・金の宝箱の中身と確率 |

## 2. 森1をステージ一覧へ登録

`src/stages/index.ts` の `STAGES` 配列の末尾、閉じる `];` の直前へ追加します。

```ts
{
  id: 6, name: '森1', subtitle: '木漏れ日の小径',
  description: '自作の森ステージ。',
  objective: '古代の宝箱を1個回収し、出口へ',
  vision: 5, width: 11, height: 11,
  enemyCount: 2, goal: 'treasure', requiredChests: 1,
},
```

IDは必ず1から連番にします。森2〜5はID7〜10として順番に追加します。森1は平原5クリア後に解放されます。

- `goal: 'treasure'`：`objective: true` の宝箱を `requiredChests` 個回収して出口へ。
- `goal: 'exit'`：出口へ到達すればクリア。`requiredChests: 0` にします。
- `goal: 'hunt'`：現在は全 `golem` の撃破が条件です。
- `goal: 'boss'`：現在は全 `boss` の撃破が条件です。

任意の敵を討伐条件にする機能はまだありません。必要なら `GameSession.goalReady()` を拡張します。

## 3. 地形と敵・宝箱・罠を配置する

`src/stages/layouts.ts` の**末尾**へ次を追加します。既存の `CUSTOM_LAYOUTS` 宣言より後に置いてください。これは既存の例とは独立した、森1の完成した設定例です。

```ts
const forest01: StageLayout = {
  // 1文字が1マス。全行を同じ文字数にします。
  rows: [
    '###########', // y=0
    '#.........#', // y=1
    '#..##.....#', // y=2
    '#..##.~~..#', // y=3
    '#.....~~..#', // y=4
    '#.##......#', // y=5
    '#.##..##..#', // y=6
    '#.....##..#', // y=7
    '#.........#', // y=8
    '#.........#', // y=9
    '###########', // y=10
  ],
  legend: { '#': 4, '.': 3, '~': 5 },
  spawn: { x: 2, y: 2 },

  objects: [
    // アタック・ワープを保証し、残りは金の通常ルールで抽選。
    { id: 'forest-start', type: 'chest', chestTier: 'gold',
      position: { x: 2, y: 3 }, skillIds: ['attack', 'warp'] },
    // 銀なのでスキルが必ず1つ。クリア条件にも数える。
    { id: 'forest-goal', type: 'chest', chestTier: 'silver',
      position: { x: 8, y: 8 }, objective: true },
    { id: 'forest-supply', type: 'chest', chestTier: 'wood',
      position: { x: 1, y: 5 } },
    { id: 'forest-exit', type: 'exit', position: { x: 9, y: 9 } },
  ],

  enemies: [
    { kind: 'wolf', position: { x: 8, y: 2 } },
    { kind: 'goblin', position: { x: 5, y: 7 } },
  ],

  // 必ずこの位置に置く、隠し罠。
  traps: [
    { id: 'forest-heal', trapId: 'healing',
      position: { x: 4, y: 4 }, triggered: false },
    { id: 'forest-wolves', trapId: 'wolfTerritory',
      position: { x: 5, y: 5 }, triggered: false },
  ],

  // 指定範囲から空き床を選び、指定個数だけ配置。
  trapPlacements: [
    { region: { x: 1, y: 7, width: 4, height: 3 }, count: 2,
      pool: [{ value: 'bearTrap', weight: 2 },
             { value: 'treasure', weight: 1 }] },
  ],
};

CUSTOM_LAYOUTS[6] = forest01;
```

### 座標の読み方

左上が `{ x: 0, y: 0 }`。右へ進むとx、下へ進むとyが増えます。`rows[y]` の左から `x+1` 番目の文字がその場所です。上の例では開始位置は左から3列目、上から3行目です。

- `width` は1行の文字数、`height` は行数です。例は11×11。保存に対応するサイズは各辺9〜100マスです。
- 地形には半角1文字を使ってください。絵文字や全角スペースは避けます。
- `legend` は文字→地形IDの対応表。3=森の床、4=大木、5=水面です。
- 開始位置・敵・宝箱・出口は通行可能な床へ置き、互いに重ねないでください。
- 4マス・9マスの敵は指定位置を左上として2×2・3×3を占有します。全体が床に入るようにします。
- 固有の `id` は同じマップ内で重複させません。
- 手作りマップが登録されると、敵配置は `layout.enemies` を使います。ステージ側の `enemyCount` / `enemySpawns` では増えません。
- 出口までの到達可能性は自動保証されません。通路をつなげ、実際に確認してください。

## 4. 床や木のドット絵を自作する

### PNGを使う方法

16×16か32×32のPNGを用意し、たとえば `public/tiles/forest-floor.png` に置きます。`src/data/terrain.ts` の `TERRAIN` に、未使用の数値IDを追加します。

```ts
6: {
  name: '自作の森の床',
  solid: false, blocksSight: false,
  color: '#70a76a', image: 'tiles/forest-floor.png',
},
```

地形は1枚を32×32の1マスへ拡大して描きます。1画像に複数地形を詰めたスプライトシートの切り出し指定には未対応です。`image` の先頭に `/` や `public/` は付けません。ミニマップでは `color` を使います。

マップの `legend` を `{ '#': 4, '.': 6, '~': 5 }` にすれば、`.` の床がすべて自作の絵になります。

### コードでドットを描く方法

```ts
7: {
  name: '低木', solid: true, blocksSight: true, color: '#70a76a',
  pixels: ['........', '..gggg..', '.gGGGGg.', '.gGGGGg.',
           '..gggg..', '...bb...', '...bb...', '........'],
  palette: { g: '#276747', G: '#56a95e', b: '#946344' },
},
```

`pixels` の1文字が1ドット、`palette` が色です。パレットにない文字は背景色のままになります。各行の長さをそろえます。既存の地形IDはセーブに残るため、別用途へ使い回さず新しいIDを足してください。

`solid` は移動を遮るか、`blocksSight` は視線を遮るかです。現在の直線攻撃は `solid` の地形で止まるため、水も通過しません。

## 5. 宝箱の中身を調整する

`chestTier` は `wood` / `iron` / `silver` / `gold`。中身は冒険開始時に抽選され、保存されます。

特定のスキルを保証し、それ以外は箱の通常ルールで抽選する場合：

```ts
{ id: 'ice-chest', type: 'chest', chestTier: 'silver',
  position: { x: 5, y: 2 }, skillId: 'icestone' },
```

中身を完全固定したい場合は `contents` を指定します。この場合は箱の通常抽選を行いません。

```ts
{ id: 'fixed-chest', type: 'chest', chestTier: 'iron',
  position: { x: 5, y: 2 },
  contents: [{ type: 'item', id: 'potion' },
             { type: 'skill', id: 'fireball' }] },
```

道具IDは `potion` / `ether` / `scope` / `summon`。スキルIDは `src/data/skills.ts` のキーを使います。箱ごとの抽選確率の変更は `src/data/loot.ts` です。

## 6. 罠を固定・ランダム配置する

| trapId | 効果 |
| --- | --- |
| `treasure` | 周囲に宝箱が出現 |
| `bearTrap` | 一時的に移動不可 |
| `fireMine` | 周囲3×3に炎ダメージ |
| `rockfall` | 周囲5×5のランダム5マスへ3回落石 |
| `healing` | HP回復 |
| `wolfTerritory` | 周囲9×9外周へ森の狼を3体召喚 |

- 固定位置は `traps`、ランダム配置は `trapPlacements` です。両方を使えます。
- ランダム配置の `region` を省略するとマップ全体が候補になります。
- `count` は配置する罠の総数。`pool` の `weight` は種類を選ぶ重みです。2と1ならおよそ2:1で抽選され、種類ごとの個数は保証されません。
- 異なる範囲のルールを複数書けば、一部に罠を密集させられます。
- ランダム配置は開始地点・敵・宝箱・設置効果・別の罠を避けます。指定数の空き床が足りない場合はエラーになります。
- `trapPlacements: []` でランダム配置を無効にできます。省略した場合はステージ側の `trapPlacements` を引き継ぎます。
- 罠は見えず、プレイヤーが歩いて踏んだときだけ発動します。敵・味方の移動やワープでは起動しません。

## 7. 変更を確認する

`npm run dev` で開き、**新しい冒険**を開始します。「続きから」は保存済みの地形・敵・宝箱・罠を復元するため、配置コードの変更は反映されません。

森1は平原5のクリアで解放されます。開発中だけ早く確認する場合は、`src/dev/preview.ts` の `GameSession.create(1, 7707)` を `GameSession.create(6, 7707)` に変更し、その後の位置・敵・床・宝箱を上書きする確認用処理を外してください。`s.explore(); saves.save(s.state);` は残します。`/dev/preview.html?fixture=1` の「続きから」で、専用セーブを使って新しい配置を開けます。通常セーブには影響しません。

森2以降も、ステージ一覧への追加と `CUSTOM_LAYOUTS[7]` などへの登録を同じ手順で行います。

## 固定階層と別マップ

総階層数は `src/stages/index.ts` の `dungeon.floors` に整数で設定します。第2層以降の地形・配置は `src/stages/upperFloors.ts` で編集できます。第1層の宝箱は引き継がず、討伐対象・宝箱回収条件は各層に用意します。敵倍率の設定例と計算方法は `EXTENDING.md` の「階層ごとの地形と敵の強化」を参照してください。
