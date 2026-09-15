import type { ItemId } from '../game/types';
export const ITEMS: Record<ItemId, { name: string; icon: string; description: string }> = {
  potion: { name: '回復薬', icon: '✚', description: 'HPを15回復' },
  ether: { name: '魔力の雫', icon: '♦', description: 'MPを10回復' },
  scope: { name: '遠見のレンズ', icon: '◎', description: '視野+2、地図の自由移動を解放' },
  summon: { name: '精霊の種', icon: '✧', description: '自動で戦う精霊を召喚' },
};
