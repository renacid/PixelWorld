/** 地形IDは保存データに残ります。既存IDを再利用せず、新しいIDを追加してください。 */
export type TerrainDefinition = {
  name: string; solid: boolean; blocksSight: boolean; color: string;
  pixels?: string[]; palette?: Record<string, string>; image?: string;
};
// pixelsは任意サイズのドット配列、imageはpublic/以下のPNGの相対パスです。
export const TERRAIN: Record<number, TerrainDefinition> = {
  6: { name: '森の外側', solid: true, blocksSight: true, color: '#294e49', pixels: ['....'], palette: {} },
  0: { name: '草', solid: false, blocksSight: false, color: '#a2db83' },
  1: { name: '遺跡の壁', solid: true, blocksSight: true, color: '#91bc8e' },
  2: { name: '花の草地', solid: false, blocksSight: false, color: '#a8df87' },
  3: { name: '森の床', solid: false, blocksSight: false, color: '#79bd79', pixels: ['........','..g.....','...g....','......g.','........','.g......','.....g..','........'], palette: { g: '#589c65' } },
  4: { name: '大木', solid: true, blocksSight: true, color: '#79bd79', pixels: ['...gg...','..gGGg..','.gGGGGg.','gGGGGGGg','.ggGGgg.','...bb...','...bb...','..bbbb..'], palette: { g: '#348763', G: '#51aa70', b: '#996e50' } },
  5: { name: '水面', solid: true, blocksSight: false, color: '#76c8df', pixels: ['........','.www....','........','.....ww.','........','..ww....','........','........'], palette: { w: '#b6e8ef' } },
};
export function terrain(id: number): TerrainDefinition { return TERRAIN[id] ?? TERRAIN[1]; }
