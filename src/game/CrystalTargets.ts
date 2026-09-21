import type { MapState, Crystal } from './types';
/** 生成行動中は破裂だけでなく、連鎖候補・射線の遮り・命中判定からも除外する。 */
export function targetableCrystals(map:MapState,action:number):Crystal[]{return (map.crystals??[]).filter(c=>c.placedAt<action);}
