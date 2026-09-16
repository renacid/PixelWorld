/** 道具の表示名・説明。使用効果はGameSession.useItemで処理。 */
import type { ItemId } from '../game/types';
export const ITEMS: Record<ItemId, { name: string; icon: string; description: string; rarity: 'common' | 'rare'; rareRank: number; restoreHp?: number; restoreMp?: number }> = {
  healingPotion: { rarity: 'rare', rareRank: 2, restoreHp: 30, name: '回復薬', icon: '✚', description: 'HPを30回復' },
  etherMedium: { rarity: 'rare', rareRank: 2, restoreMp: 20, name: '魔力の雫（中）', icon: '♦', description: 'MPを20回復' },
  hourglass: { rarity: 'common', rareRank: 1, name: '砂時計（小）', icon: '⌛', description: '選んだスキルの残りクールタイムを10短縮' },
  potion: { rarity: 'common', rareRank: 1, restoreHp: 15, name: '薬草', icon: '✚', description: 'HPを15回復' },
  ether: { rarity: 'common', rareRank: 1, restoreMp: 10, name: '魔力の雫（小）', icon: '♦', description: 'MPを10回復' },
  scope: { rarity: 'rare', rareRank: 3, name: '千里眼薬（小）', icon: '◎', description: '取得ごとに視野+2（累積）、カメラ自由移動を解放' },
  summon: { rarity: 'rare', rareRank: 3, name: '精霊の種', icon: '✧', description: '自動で戦う精霊を召喚' },
};
