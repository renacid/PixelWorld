/** 地形IDは保存データに残ります。既存IDを再利用せず、新しいIDを追加してください。 */
export type TerrainDefinition = {
  name: string; solid: boolean; blocksSight: boolean; color: string;
  pixels?: string[]; palette?: Record<string, string>; image?: string;
};
// pixelsは任意サイズのドット配列、imageはpublic/以下のPNGの相対パスです。
export const TERRAIN: Record<number, TerrainDefinition> = {
  11:{name:'鍵付き鉄扉',solid:true,blocksSight:true,color:'#49545f',pixels:['hhhhhhhh','hggggggh','hgaggagh','hgaggagh','hgggkkgh','hgagkagh','hgaggagh','hhhhhhhh'],palette:{h:'#a8b5ba',g:'#707d88',a:'#424c58',k:'#e8c257'}},
  7: {name:'土の床',solid:false,blocksSight:false,color:'#c6a67d',pixels:['........','..a.....','.....b..','........','.b......','......a.','...a....','........'],palette:{a:'#b39168',b:'#dcc09b'}},
  8: {name:'雑草の土床',solid:false,blocksSight:false,color:'#c6a67d',pixels:['........','..g.....','.ggg....','........','......g.','.....gg.','..a.....','........'],palette:{g:'#69804c',a:'#b39168'}},
  9: {name:'土の壁',solid:true,blocksSight:true,color:'#72523c',pixels:['.hhhhhh.','hhhhhhhh','hmmmmmmh','mmammmmm','mmmmammm','mmmmmamm','dddddddd','.dddddd.'],palette:{h:'#bc9768',m:'#987049',a:'#785237',d:'#523c30'}},
  10: {name:'石タイルの壁',solid:true,blocksSight:true,color:'#414952',pixels:['hhhhhhhh','mmmammmm','mmmammmm','aaaaaaaa','mammmmam','mammmmam','dddddddd','dddddddd'],palette:{h:'#b7bec0',m:'#838e93',a:'#525e66',d:'#38444c'}},
  6: { name: '森の外側', solid: true, blocksSight: true, color: '#294e49', pixels: ['....'], palette: {} },
  0: { name: '草', solid: false, blocksSight: false, color: '#a2db83' },
  1: { name: '遺跡の壁', solid: true, blocksSight: true, color: '#91bc8e' },
  2: { name: '花の草地', solid: false, blocksSight: false, color: '#a8df87' },
  3: { name: '森の床', solid: false, blocksSight: false, color: '#79bd79', pixels: ['........','..g.....','...g....','......g.','........','.g......','.....g..','........'], palette: { g: '#589c65' } },
  4: { name: '大木', solid: true, blocksSight: true, color: '#79bd79', pixels: ['...gg...','..gGGg..','.gGGGGg.','gGGGGGGg','.ggGGgg.','...bb...','...bb...','..bbbb..'], palette: { g: '#348763', G: '#51aa70', b: '#996e50' } },
  5: { name: '水面', solid: true, blocksSight: false, color: '#76c8df', pixels: ['........','.www....','........','.....ww.','........','..ww....','........','........'], palette: { w: '#b6e8ef' } },
};
export function terrain(id: number): TerrainDefinition { return TERRAIN[id] ?? TERRAIN[1]; }
