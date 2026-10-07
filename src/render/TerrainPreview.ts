import { terrain } from '../data/terrain';
import { drawTerrain } from './TerrainRenderer';
/** 工房のマップは実寸、パレットは木の張り出しも含め枠内に収める。 */
export function drawTerrainPreview(...args:Parameters<typeof drawTerrain>):void {
 const overhang=terrain(args[1]).overhang??0;
 if(!args[5]&&overhang){const size=args[4]*32/(32+overhang);args[2]+=(args[4]-size)/2;args[3]+=args[4]-size;args[4]=size;}
 drawTerrain(...args);
}
