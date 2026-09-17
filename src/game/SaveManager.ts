/** localStorage保存・形式検証・設定と解放進捗の管理。テスト用名前空間にも対応。 */
import { GEM_REWARDS } from '../data/gems';
import { SKILLS } from '../data/skills';
import { isSquareFootprint } from '../actors/Actor';
import { TERRAIN } from '../data/terrain';
import { ENEMY_SKILLS, canonicalEnemySkillId } from '../data/enemySkills';
import { CHESTS } from '../data/loot';
import { TRAPS } from '../data/traps';
import { isActorKind } from '../data/enemies';
import { STAGES } from '../stages';
import { ITEMS } from '../data/items';
import { validPlacement } from '../skills/SkillBag';
import type { SaveData } from './types';
export type Settings = { grid: boolean; motion: boolean; sound: boolean };
export class SaveManager {
  error = '';
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = { getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value), removeItem: key => window.localStorage.removeItem(key) }, private namespace = 'pixel-world') {}
  private get saveKey() { return `${this.namespace}.save.v1`; }
  private get progressKey() { return `${this.namespace}.progress.v1`; }
  private get settingsKey() { return `${this.namespace}.settings.v1`; }
  private read(key: string): unknown { try { const raw = this.storage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { this.error = '保存データを読み込めませんでした。'; return null; } }
  private write(key: string, value: unknown): boolean { try { this.storage.setItem(key, JSON.stringify(value)); this.error = ''; return true; } catch { this.error = '保存できません。ブラウザの空き容量・保存設定を確認してください。'; return false; } }
  load(): SaveData | null {
    const value = this.read(this.saveKey);
    if (!value) return null;
    if (!validSave(value)) { this.error = '中断データの形式が不正です。新しい冒険を開始できます。'; return null; }
    return value;
  }
  save(state: SaveData): boolean { return this.write(this.saveKey, state); }
  clear(): void { try { this.storage.removeItem(this.saveKey); } catch { this.error = '中断データを消去できませんでした。'; } }
  progress(): number { const v = this.read(this.progressKey); return typeof v === 'number' && Number.isInteger(v) ? Math.max(0, Math.min(STAGES.length, v)) : 0; }
  complete(stageId: number): void { this.write(this.progressKey, Math.max(this.progress(), stageId)); }
  settings(): Settings { const v = this.read(this.settingsKey) as Partial<Settings> | null; return { grid: v?.grid === true, motion: v?.motion !== false, sound: v?.sound !== false }; }
  saveSettings(settings: Settings): void { this.write(this.settingsKey, settings); }
}
function validSave(value: unknown): value is SaveData {
  try {
    const s = value as SaveData;
    if (s.version !== 1 || !Number.isInteger(s.stageId) || s.stageId < 1 || !STAGES.some(stage => stage.id === s.stageId) || !['playing', 'cleared', 'defeated'].includes(s.status)) return false;
    const m = s.mapState;
    if (s.floorNumber !== undefined && (!Number.isInteger(s.floorNumber) || s.floorNumber < 1 || s.floorNumber > (s.floorCount ?? 1))) return false;
    if (s.floorCount !== undefined && (!Number.isInteger(s.floorCount) || s.floorCount < 1 || s.floorCount > 99)) return false;
    if (s.nightRevived !== undefined && (!Number.isInteger(s.nightRevived) || s.nightRevived < 0)) return false;
    if (s.skillWear !== undefined && !Object.entries(s.skillWear).every(([id, w]) => id in SKILLS && w && Number.isInteger(w.uses) && w.uses >= 0 && Number.isInteger(w.extraMp) && w.extraMp >= 0)) return false;
    if (s.pendingGemChoices !== undefined && (!Array.isArray(s.pendingGemChoices) || !s.pendingGemChoices.every(options => Array.isArray(options) && options.length === 3 && new Set(options).size === 3 && options.every(id => id in GEM_REWARDS)))) return false;
    if (s.playerState.visionBonus !== undefined && (!Number.isInteger(s.playerState.visionBonus) || s.playerState.visionBonus < 0)) return false;
    for (const a of s.enemyStates) {
      if (a.mpRecoveryTurns !== undefined && (!Number.isInteger(a.mpRecoveryTurns) || a.mpRecoveryTurns < 0 || a.mpRecoveryTurns > 9)) return false;
      if (a.enemyCooldownUntil !== undefined && !Object.values(a.enemyCooldownUntil).every(n => Number.isInteger(n) && n >= 0)) return false;
    }
    if (s.fullBagRewardClaimed !== undefined && typeof s.fullBagRewardClaimed !== 'boolean') return false;
    if (s.allyStates.some(a=>a.remainingLife!==undefined&&(!Number.isInteger(a.remainingLife)||a.remainingLife<1))) return false;
    if (s.reinforcementKinds!==undefined&&(!Array.isArray(s.reinforcementKinds)||!s.reinforcementKinds.every(k=>isActorKind(k)&&!['player','sprite'].includes(k)))) return false;
    if (s.nightWave !== undefined && (!Number.isInteger(s.nightWave) || s.nightWave < 0)) return false;
    if (s.nightTarget !== undefined && (!Number.isInteger(s.nightTarget) || s.nightTarget < 0)) return false;
    if ([s.playerState, ...s.allyStates, ...s.enemyStates].some(a => a.experienceMultiplier !== undefined && (!Number.isFinite(a.experienceMultiplier) || a.experienceMultiplier < 0))) return false;
    if (s.playerLevel !== undefined && (!Number.isInteger(s.playerLevel) || s.playerLevel < 1 || s.playerLevel > 20)) return false;
    if (s.experience !== undefined && (!Number.isFinite(s.experience) || s.experience < 0)) return false;
    if (s.bagCells !== undefined && (!Array.isArray(s.bagCells) || s.bagCells.length < 16 || s.bagCells.length > 48 || !s.bagCells.every(p => Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < 30 && p.y < 30) || new Set(s.bagCells.map(p => p.x + ',' + p.y)).size !== s.bagCells.length)) return false;
    if (s.daylightCount !== undefined && (!Number.isInteger(s.daylightCount) || s.daylightCount < 0)) return false;
    if (s.defeatedEnemies !== undefined && (!Array.isArray(s.defeatedEnemies) || !s.defeatedEnemies.every(a => isActorKind(a.kind) && typeof a.id === 'string' && Number.isInteger(a.position.x) && Number.isInteger(a.position.y)))) return false;
    for (const a of [s.playerState, ...s.allyStates, ...s.enemyStates]) {
      if (a.criticalRate !== undefined && (!Number.isFinite(a.criticalRate) || a.criticalRate < 0 || a.criticalRate > 1)) return false;
      if (a.criticalMultiplier !== undefined && (!Number.isFinite(a.criticalMultiplier) || a.criticalMultiplier < 1)) return false;
      if (a.buffs !== undefined && (!Array.isArray(a.buffs) || !a.buffs.every(b => typeof b.id === 'string' && (b.attackBonus === undefined || Number.isFinite(b.attackBonus)) && Number.isInteger(b.remainingTurns) && b.remainingTurns > 0 && Number.isInteger(b.appliedAt) && Number.isFinite(b.attackMultiplier) && b.attackMultiplier >= 1 && Number.isInteger(b.detectionBonus) && b.detectionBonus >= 0))) return false;
    }
    if (s.mpRecoveryActions !== undefined && (!Number.isInteger(s.mpRecoveryActions) || s.mpRecoveryActions < 0)) return false;
    if (!Number.isInteger(m.width) || !Number.isInteger(m.height) || m.width < 9 || m.height < 9 || m.width > 100 || m.height > 100 || m.tiles.length !== m.width * m.height || s.exploredMap.length !== m.tiles.length) return false;
    if (!m.tiles.every(t => t in TERRAIN) || !s.exploredMap.every(t => typeof t === 'boolean')) return false;
    const point = (p: { x: number; y: number }) => Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < m.width && p.y < m.height;
    if (m.playerTraps !== undefined && (!Array.isArray(m.playerTraps) || m.playerTraps.length > 2 || !m.playerTraps.every(t => typeof t.id === 'string' && point(t.position) && Number.isFinite(t.damage) && t.damage > 0 && (t.placedAt === undefined || Number.isInteger(t.placedAt) && t.placedAt >= 0 && t.placedAt <= s.playerActionCount) && (t.sourceSkillId === undefined || t.sourceSkillId in SKILLS)))) return false;
    if (s.playerState.movementLockedUntil !== undefined && (!Number.isInteger(s.playerState.movementLockedUntil) || s.playerState.movementLockedUntil < 0)) return false;
    if (m.traps !== undefined && (!Array.isArray(m.traps) || !m.traps.every(t => typeof t.id === 'string' && t.trapId in TRAPS && point(t.position) && typeof t.triggered === 'boolean') || new Set(m.traps.map(t => t.id)).size !== m.traps.length)) return false;
    const attributes = ['fire', 'ice', 'thunder', 'earth', 'wind', 'neutral', 'physical', 'nature'];
    if (![s.playerState, ...s.allyStates, ...s.enemyStates].every(a => isActorKind(a.kind))) return false;
    if (![s.playerState, ...s.allyStates, ...s.enemyStates].every(a => point(a.position) && Number.isFinite(a.hp) && a.hp >= 0 && a.hp <= a.maxHp && (isSquareFootprint(a.cells) || a.kind === 'wolf' && a.cells.length === 2 && a.cells.every(c => Number.isInteger(c.x) && Number.isInteger(c.y))) && a.afflictions.length <= 2 && a.afflictions.every(f => attributes.includes(f.attribute) && Number.isFinite(f.remainingTurns)) && a.directions.every(d => ['up', 'right', 'down', 'left'].includes(d)) && Array.isArray(a.attackCells))) return false;
    if (!Number.isInteger(s.playerState.maxMp) || s.playerState.maxMp <= 0 || !Number.isFinite(s.playerState.mp) || s.playerState.mp < 0 || s.playerState.mp > s.playerState.maxMp || !['up', 'right', 'down', 'left'].includes(s.playerState.facing)) return false;
    // MP未導入の旧セーブは受理し、GameSessionで補完します。
    if (![...s.enemyStates, ...s.allyStates].every(a => (a.mp === undefined || Number.isInteger(a.mp) && a.mp >= 0 && a.maxMp !== undefined && a.mp <= a.maxMp) && (a.maxMp === undefined || Number.isInteger(a.maxMp) && a.maxMp >= 0) && (a.enemySkillIds === undefined || Array.isArray(a.enemySkillIds) && a.enemySkillIds.every(id => canonicalEnemySkillId(id) in ENEMY_SKILLS)))) return false;
    if (![s.randomSeed, s.initialSeed, s.turnCount, s.playerActionCount, s.objectiveChests].every(n => Number.isInteger(n) && n >= 0) || s.turnCount !== s.playerActionCount) return false;
    if (s.itemSlots.length > 3 || !s.itemSlots.every(id => id in ITEMS) || typeof s.pendingBag !== 'boolean' || !s.log.every(l => typeof l === 'string')) return false;
    if (new Set(s.skillBag.map(b => b.skillId)).size !== s.skillBag.length || !s.skillBag.every(b => b.skillId in SKILLS && Number.isInteger(b.rotation) && b.rotation >= 0 && b.rotation < 4 && (b.position === null || validPlacement(s.skillBag, b.skillId, b.position, b.rotation, s.bagCells)))) return false;
    if (!Object.entries(s.skillLevels).every(([id, n]) => id in SKILLS && Number.isInteger(n) && n > 0) || !s.skillBag.every(b => s.skillLevels[b.skillId])) return false;
    if (!Object.entries(s.cooldowns).every(([id, n]) => id in SKILLS && Number.isInteger(n) && n >= 0)) return false;
    if (!m.objects.every(o => point(o.position) && ['chest', 'item', 'skill', 'exit', 'gem'].includes(o.type) && (!o.skillId || o.skillId in SKILLS) && (!o.skillIds || o.skillIds.every(id => id in SKILLS)) && (!o.itemId || o.itemId in ITEMS) && (!o.chestTier || o.chestTier in CHESTS) && (o.contents === undefined || Array.isArray(o.contents) && o.contents.every(l => l.type === 'item' ? l.id in ITEMS : l.type === 'skill' && l.id in SKILLS)))) return false;
    return Array.isArray(m.fields) && m.fields.every(f => point(f.position) && attributes.includes(f.attribute) && Number.isFinite(f.remainingTurns));
  } catch { return false; }
}
