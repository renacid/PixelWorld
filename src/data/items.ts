/** 道具の表示名・説明。使用効果はGameSession.useItemで処理。 */
import type { ItemId } from '../game/types';
export const ITEMS: Record<ItemId, { name: string; icon: string; description: string; rarity: 'common' | 'rare' }> = {
  hourglass: { rarity: 'common', name: '砂時計（小）', icon: '⌛', description: '選んだスキルの残りクールタイムを10短縮' },
  potion: { rarity: 'common', name: '回復薬', icon: '✚', description: 'HPを15回復' },
  ether: { rarity: 'common', name: '魔力の雫', icon: '♦', description: 'MPを10回復' },
  scope: { rarity: 'rare', name: '千里眼薬（小）', icon: '◎', description: '取得ごとに視野+2（累積）、カメラ自由移動を解放' },
  summon: { rarity: 'rare', name: '精霊の種', icon: '✧', description: '自動で戦う精霊を召喚' },
};
