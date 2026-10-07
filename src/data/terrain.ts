/** 地形IDは保存データに残ります。既存IDを再利用せず、新しいIDを追加してください。 */
import { TERRAIN_ART } from './TerrainArt';
export type TerrainDefinition = {
  name: string; solid: boolean; blocksSight: boolean; color: string;
  /** 隣接床を取り込む描画方式。移動判定とは独立。省略時は従来の一枚絵。 */
  boundary?: 'tree'|'shore'|'wall'; groundTile?: number;
  /** マス上端からの張り出しpx。足元・通行判定はそのまま。 */
  overhang?: number;
  pixels?: string[]; palette?: Record<string, string>; image?: string;
};
// pixelsは任意サイズのドット配列、imageはpublic/以下のPNGの相対パスです。
export const TERRAIN: Record<number, TerrainDefinition> = {
  11:{name:'鍵付き鉄扉',solid:true,blocksSight:true,color:'#49545f'},
  7: {name:'土の床',solid:false,blocksSight:false,color:'#c6a67d',pixels:['........','..a.....','.....b..','........','.b......','......a.','...a....','........'],palette:{a:'#b39168',b:'#dcc09b'}},
  8: {name:'雑草の土床',solid:false,blocksSight:false,color:'#c6a67d',pixels:['........','..g.....','.ggg....','........','......g.','.....gg.','..a.....','........'],palette:{g:'#69804c',a:'#b39168'}},
  9: {name:'土の壁',solid:true,blocksSight:true,color:'#72523c',boundary:'wall',groundTile:7},
  10: {name:'石タイルの壁',solid:true,blocksSight:true,color:'#414952',boundary:'wall',groundTile:7},
  6: { name: '森の外側', solid: true, blocksSight: true, color: '#294e49', pixels: ['....'], palette: {} },
  0: { name: '草', solid: false, blocksSight: false, color: '#a2db83' },
  1: { name: '遺跡の壁', solid: true, blocksSight: true, color: '#91bc8e', boundary:'wall', groundTile:0 },
  2: { name: '花の草地', solid: false, blocksSight: false, color: '#a8df87' },
  3: { name: '森の床', solid: false, blocksSight: false, color: '#79bd79', pixels: ['........','..g.....','...g....','......g.','........','.g......','.....g..','........'], palette: { g: '#589c65' } },
  4: { name: '大木', solid: true, blocksSight: true, color: '#79bd79', boundary:'tree', groundTile:3, overhang:4 },
  5: { name: '水面', solid: true, blocksSight: false, color: '#76c8df', boundary:'shore', groundTile:3 },
};
// 新しい地形もboundaryとgroundTileを設定すれば同じ境界処理を利用できます。
for(const [id,art] of Object.entries(TERRAIN_ART))Object.assign(TERRAIN[Number(id)],art);
export function terrain(id: number): TerrainDefinition { return TERRAIN[id] ?? TERRAIN[1]; }
