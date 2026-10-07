# マップ・ステージ作成

最新の手順は [地域・ステージ・階層の設定ガイド](src/stages/README.md) にまとめています。

- 平原：src/stages/plains/1-1.ts〜1-5.ts
- 森：src/stages/forest/2-1.ts〜2-3.ts
- 地域共通の抽選表：src/stages/regions.ts
- 地形の絵と通行可否：src/data/terrain.ts
- 木・水・壁・鉄扉のドット原画：src/data/TerrainArt.ts

古いCUSTOM_LAYOUTSへの登録とgoal/requiredChestsの指定は不要です。個別ステージのlayoutとclearConditionを使ってください。

## 地形の境界とドット絵

`src/data/terrain.ts` の `boundary` で、周囲の床になじませる描画を指定できます。

- `tree`：隣接する床を下地に描いて、その上に木を重ねる。`overhang` で上方向への張り出しpxを指定（木は4px）。
- `shore`：水マスの内側に床色の水際を描く。点線状の反射光は付けない。水同士の間には縁を描かない。
- `wall`：四角い輪郭を保ち、隣接床による縁取りをしない。
- 省略：境界処理をしない。

`groundTile` は隣接8マスに床がない場合の下地IDです。これらは見た目だけの設定で、通行可否は `solid`、視線遮蔽は `blocksSight` のままです。

ドット原画は `src/data/TerrainArt.ts` の16文字×16行（木のみ18行）とパレットで編集できます。`.` は下地を残します。画像を使う場合は従来どおり `terrain.ts` の `image` に `public/` 以下の相対パスを設定してください。

`dev/terrain-preview.html` で草地・森・土床との組み合わせを比較できます。工房もゲームも `src/render/TerrainRenderer.ts` を使用し、隣接地形ごとの完成画像を上限768枚のキャッシュで再利用します。
