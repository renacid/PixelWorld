# マップ・ステージ作成

最新の手順は [地域・ステージ・階層の設定ガイド](src/stages/README.md) にまとめています。

- 平原：src/stages/plains/1-1.ts〜1-5.ts
- 森：src/stages/forest/2-1.ts〜2-3.ts
- 地域共通の抽選表：src/stages/regions.ts
- 地形の絵と通行可否：src/data/terrain.ts

古いCUSTOM_LAYOUTSへの登録とgoal/requiredChestsの指定は不要です。個別ステージのlayoutとclearConditionを使ってください。
