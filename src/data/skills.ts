import type { Attribute, Point, SkillId } from '../game/types';
export type SkillDefinition = { id: SkillId; name: string; short: string; attribute: Attribute; mp: number; cooldown: number; range: number; multiplier: number; hits: number; target: 'line' | 'area'; rotatable: boolean; cells: Point[]; kind: 'active' | 'passive'; description: string };
export const ATTRIBUTE_COLORS: Record<Attribute, string> = { fire: '#ef9470', thunder: '#d7b7ff', wind: '#7ed8bd', ice: '#90d7ff', earth: '#caa576', neutral: '#d7dccb', physical: '#e8d397' };
export const ATTRIBUTE_NAMES: Record<Attribute, string> = { fire: '炎', thunder: '雷', wind: '風', ice: '氷', earth: '土', neutral: '無', physical: '物理' };
export const SKILLS: Record<SkillId, SkillDefinition> = {
  attack: { id: 'attack', name: 'アタック', short: '斬撃', attribute: 'physical', mp: 1, cooldown: 0, range: 1, multiplier: .6, hits: 1, target: 'line', rotatable: true, cells: [{ x: 0, y: 0 }], kind: 'active', description: '前1マスに攻撃力の50〜70%ダメージ。' },
  fireball: { id: 'fireball', name: 'ファイアーボール', short: '火球', attribute: 'fire', mp: 3, cooldown: 1, range: 5, multiplier: 1, hits: 1, target: 'line', rotatable: true, cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }], kind: 'active', description: '直線5マス。最初の敵に100%ダメージと炎付着。' },
  thunder: { id: 'thunder', name: 'サンダーブレイク', short: '落雷', attribute: 'thunder', mp: 6, cooldown: 3, range: 4, multiplier: 1.3, hits: 1, target: 'line', rotatable: true, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], kind: 'active', description: '直線4マス。最初の敵に130%ダメージと雷付着。' },
  tornado: { id: 'tornado', name: 'トルネード', short: '旋風', attribute: 'wind', mp: 4, cooldown: 2, range: 4, multiplier: .7, hits: 1, target: 'line', rotatable: true, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], kind: 'active', description: '直線4マスに70%ダメージ。1マス押し出し、炎・氷・雷を周囲へ風散。' },
  firerain: { id: 'firerain', name: 'ファイアーレイン', short: '火雨', attribute: 'fire', mp: 10, cooldown: 10, range: 2, multiplier: .3, hits: 3, target: 'area', rotatable: true, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], kind: 'active', description: '自分を除く周囲24マスに30%ダメージ×3ヒット。炎付着。' },
};
