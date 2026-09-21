import type { Attribute, Direction, Point } from '../game/types';
import { ENEMY_SKILLS } from './enemySkills';
import type { DropEntry } from './loot';

/** 絵の種類は敵の種類から独立。新しい敵でも既存の絵を再利用できます。 */
export type SpriteId = 'reaper' | 'fighter' | 'archer' | 'mage' | 'player' | 'slime' | 'goblin' | 'wolf' | 'golem' | 'sprite' | 'greaterSprite' | 'treant';
export type ActorDefinition = {
  lifetime?: number;
  wideAttack?: boolean; skillSelection?: 'exclusive';
  experience: number;
  criticalRate: number; criticalMultiplier: number; immobile: boolean;
  skillChances: Record<string, number>; innateAttribute?: Attribute;
  name: string; hp: number; hpPerStage: number; attack: number; size: 1 | 2 | 3;
  mp: number; skills: string[]; drops: DropEntry[]; attribute: Attribute; detectionRange: number;
  pattern: 'patrol' | 'wait' | 'guard'; attackRange: number; priorityTarget: 'nearest' | 'player';
  pursuitTurns: number; chaseMoveLimit: number; chaseRecoveryChance: number;
  directions: Direction[]; attackCells: Point[];
  sprite: SpriteId; renderScale: number; renderHeight?: number; renderLift?: number; bob: boolean; idleStep: boolean;
};
/** 共通値。各敵の項目で上書きできます。sizeは一辺のマス数です。 */
function define(config: Pick<ActorDefinition, 'name' | 'hp' | 'attack' | 'sprite'> & Partial<ActorDefinition>): ActorDefinition {
  for (const id of config.skills ?? []) if (!Object.hasOwn(ENEMY_SKILLS, id)) throw new Error(`${config.name}: 未定義の敵スキル ${id}`);
  for (const drop of config.drops ?? []) if (!Number.isFinite(drop.chance) || drop.chance < 0 || drop.chance > 1 || !Number.isInteger(drop.count ?? 1) || (drop.count ?? 1) < 1) throw new Error(`${config.name}: ドロップ確率は0〜1、個数は正の整数で指定してください`);
  return {
    experience: 2, criticalRate: .05, criticalMultiplier: 1.5, immobile: false, skillChances: {},
    hpPerStage: 0, size: 1, mp: 0, skills: [], drops: [], attribute: 'physical', detectionRange: 4,
    pattern: 'guard', attackRange: 1, priorityTarget: 'nearest', pursuitTurns: 6,
    chaseMoveLimit: 12, chaseRecoveryChance: .3,
    directions: ['up', 'right', 'down', 'left'],
    attackCells: [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }],
    renderScale: 2, renderLift: 2, bob: false, idleStep: false, ...config,
  };
}

/** 敵の追加はこの一覧から。IDの型もこのキーから自動生成されます。 */
export const ENEMIES = {
  reaper:define({name:'死神',hp:4,mp:40,attack:4,detectionRange:7,experience:0,sprite:'reaper',bob:true,skills:['flowAcceleration','sweepingStrike']}),
  goblinFighter:define({name:'ゴブリン・ファイター',hp:35,mp:15,attack:5, hpPerStage: 1, detectionRange:4, experience:8, sprite:'fighter',skills:['dash','heavyStrike']}),
  goblinArcher: define({ name: 'ゴブリン・アーチャー', hp: 16, attack: 2, hpPerStage: 1, detectionRange: 4, mp: 3, experience: 3, criticalRate: .1, sprite: 'archer', skills: ['arrowShot'] }),
  goblinMage: define({ name: 'ゴブリン・メイジ', hp: 25, attack: 3, hpPerStage: 1,detectionRange: 3, mp: 15, experience: 7, sprite: 'mage', skills: ['fireball', 'teleport', 'prayer'] }),
  treant: define({ experience: 5, name: 'トレント', hp: 35, hpPerStage: 1, attack: 5, sprite: 'treant', renderHeight: 44, immobile: true, attribute: 'earth', innateAttribute: 'earth', mp: 20, detectionRange: 5, skills: ['forestBlessing', 'stoneThrow'], skillChances: { stoneThrow: .5, forestBlessing: .2 }, drops: [{ loot: { type: 'item', id: 'potion' }, chance: .7 }] }),
  slime: define({ experience: 2, name: 'スライム', hp: 12, hpPerStage: 1, attack: 2, sprite: 'slime',　detectionRange: 3, pattern: 'patrol', bob: true, drops: [{ loot: { type: 'item', id: 'potion' }, chance: .08 }, { loot: { type: 'skill', id: 'fireball' }, chance: .02 }] }),
  goblin: define({ experience: 3, name: 'ゴブリン', hp: 17, hpPerStage: 1, attack: 3, sprite: 'goblin', detectionRange: 4, mp: 5, skills: ['stoneThrow'], drops: [{ loot: { type: 'item', id: 'ether' }, chance: .07 }, { loot: { type: 'item', id: 'potion' }, chance: .03 }, { loot: { type: 'skill', id: 'thunder' }, chance: .02 }] }),
  wolf: define({ experience: 3, name: '森の狼', hp: 15, hpPerStage: 1, attack: 3, sprite: 'wolf', detectionRange: 5, mp: 5, skills: ['lunge'], drops: [{ loot: { type: 'item', id: 'potion' }, chance: .06 }, { loot: { type: 'item', id: 'ether' }, chance: .03 }, { loot: { type: 'skill', id: 'tornado' }, chance: .02 }] }),
  // 各行動を独立した20%枠として抽選。残り40%は通常の追跡・攻撃。
  golem: define({ experience: 8, name: 'ゴーレム', hp: 60, hpPerStage: 1, attack: 5, mp: 20, size: 2, sprite: 'golem', renderLift: 0, renderScale: 2, renderHeight: 80, wideAttack: true, skillSelection: 'exclusive', skills: ['quietGaze', 'rockThrow', 'heavyStrike'], drops: [{ loot: { type: 'item', id: 'summon' }, chance: .05 }, { loot: { type: 'item', id: 'potion' }, chance: .1 }] }),
};
// プレイヤーと味方も同じ生成・描画インターフェースを利用します。
const lesserSpirit = define({ lifetime:30,name:'下級精霊',hp:16,attack:4,sprite:'sprite',bob:true });
export const SUPPORT_ACTORS = {
  player: define({ name: '旅人', criticalRate: .15, criticalMultiplier: 1.5, hp: 30, attack: 10, sprite: 'player', mp: 20, idleStep: true }),
  sprite: lesserSpirit,
  greaterSprite: define({...lesserSpirit,name:'中級精霊',hp:lesserSpirit.hp*2,attack:lesserSpirit.attack*2,mp:20,sprite:'greaterSprite'}),
};
export type EnemyKind = keyof typeof ENEMIES;
export type ActorKind = EnemyKind | keyof typeof SUPPORT_ACTORS;
const ACTOR_DEFINITIONS = { ...ENEMIES, ...SUPPORT_ACTORS };
export function actorDefinition(kind: ActorKind): ActorDefinition { return ACTOR_DEFINITIONS[kind]; }
export function isActorKind(value: unknown): value is ActorKind { return typeof value === 'string' && Object.hasOwn(ACTOR_DEFINITIONS, value); }
