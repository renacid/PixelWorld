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
  criticalRate: { name: '会心率＋3%', effect: { type: 'criticalRate', amount: .03 } },
  criticalMultiplier: { name: '会心ダメージ＋10%', effect: { type: 'criticalMultiplier', amount: .1 } },
};

/** HP/MP宝石のみ階層で増幅。4層以降も3層と同倍率。 */
export function gemReward(id:string,floor=1):GemReward{
 const reward=GEM_REWARDS[id],e=reward.effect;
 if(e.type!=='hp'&&e.type!=='mp')return reward;
 const amount=Math.floor(e.amount*(floor>=3?2:floor===2?1.4:1));
 return {...reward,name:'最大'+e.type.toUpperCase()+'＋'+amount,effect:{...e,amount}};
}
