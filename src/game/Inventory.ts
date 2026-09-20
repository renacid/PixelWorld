import type { SaveData } from './types';
/** Lv3・6・9…で1枠追加。セーブへ重複して保存しない。 */
export function itemCapacity(state:Pick<SaveData,'playerLevel'>):number{return 3+Math.floor((state.playerLevel??1)/3);}
