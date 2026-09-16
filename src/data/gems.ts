/** 宝石の選択肢一覧。効果の追加はこの表とGameSession.chooseGemを拡張。 */
import type { Attribute } from '../game/types';
export type GemReward = { name: string; effect: { type: 'hp' | 'mp' | 'criticalRate' | 'criticalMultiplier'; amount: number } | { type: 'skill'; attribute: Attribute } };
export const GEM_REWARDS: Record<string, GemReward> = {
  hp5: { name: '最大HP＋5', effect: { type: 'hp', amount: 5 } },
  hp10: { name: '最大HP＋10', effect: { type: 'hp', amount: 10 } },
  mp5: { name: '最大MP＋5', effect: { type: 'mp', amount: 5 } },
  mp10: { name: '最大MP＋10', effect: { type: 'mp', amount: 10 } },
  fire: { name: '炎属性のランダムなスキルを取得', effect: { type: 'skill', attribute: 'fire' } },
  ice: { name: '氷属性のランダムなスキルを取得', effect: { type: 'skill', attribute: 'ice' } },
  wind: { name: '風属性のランダムなスキルを取得', effect: { type: 'skill', attribute: 'wind' } },
  thunder: { name: '雷属性のランダムなスキルを取得', effect: { type: 'skill', attribute: 'thunder' } },
  criticalRate: { name: '会心率＋2%', effect: { type: 'criticalRate', amount: .02 } },
  criticalMultiplier: { name: '会心ダメージ＋10%', effect: { type: 'criticalMultiplier', amount: .1 } },
};
