import { SKILLS } from '../data/skills';
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
  progress(): number { const v = this.read(this.progressKey); return typeof v === 'number' && Number.isInteger(v) ? Math.max(0, Math.min(5, v)) : 0; }
  complete(stageId: number): void { this.write(this.progressKey, Math.max(this.progress(), stageId)); }
  settings(): Settings { const v = this.read(this.settingsKey) as Partial<Settings> | null; return { grid: v?.grid === true, motion: v?.motion !== false, sound: v?.sound !== false }; }
  saveSettings(settings: Settings): void { this.write(this.settingsKey, settings); }
}
function validSave(value: unknown): value is SaveData {
  try {
    const s = value as SaveData;
    if (s.version !== 1 || !Number.isInteger(s.stageId) || s.stageId < 1 || s.stageId > 5 || !['playing', 'cleared', 'defeated'].includes(s.status)) return false;
    const m = s.mapState;
    if (!Number.isInteger(m.width) || !Number.isInteger(m.height) || m.width < 9 || m.height < 9 || m.width > 100 || m.height > 100 || m.tiles.length !== m.width * m.height || s.exploredMap.length !== m.tiles.length) return false;
    if (!m.tiles.every(t => [0, 1, 2].includes(t)) || !s.exploredMap.every(t => typeof t === 'boolean')) return false;
    const point = (p: { x: number; y: number }) => Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < m.width && p.y < m.height;
    const attributes = ['fire', 'ice', 'thunder', 'earth', 'wind', 'neutral', 'physical'];
    if (![s.playerState, ...s.allyStates, ...s.enemyStates].every(a => point(a.position) && Number.isFinite(a.hp) && a.hp >= 0 && a.hp <= a.maxHp && a.cells.length > 0 && a.cells.length <= 9 && a.cells.every(c => Number.isInteger(c.x) && Number.isInteger(c.y)) && a.afflictions.length <= 2 && a.afflictions.every(f => attributes.includes(f.attribute) && Number.isFinite(f.remainingTurns)) && a.directions.every(d => ['up', 'right', 'down', 'left'].includes(d)) && Array.isArray(a.attackCells))) return false;
    if (!Number.isFinite(s.playerState.mp) || s.playerState.mp < 0 || s.playerState.mp > 20 || !['up', 'right', 'down', 'left'].includes(s.playerState.facing)) return false;
    if (![s.randomSeed, s.initialSeed, s.turnCount, s.playerActionCount, s.objectiveChests].every(n => Number.isInteger(n) && n >= 0) || s.turnCount !== s.playerActionCount) return false;
    if (s.itemSlots.length > 3 || !s.itemSlots.every(id => id in ITEMS) || typeof s.pendingBag !== 'boolean' || !s.log.every(l => typeof l === 'string')) return false;
    if (new Set(s.skillBag.map(b => b.skillId)).size !== s.skillBag.length || !s.skillBag.every(b => b.skillId in SKILLS && Number.isInteger(b.rotation) && b.rotation >= 0 && b.rotation < 4 && (b.position === null || validPlacement(s.skillBag, b.skillId, b.position, b.rotation)))) return false;
    if (!Object.entries(s.skillLevels).every(([id, n]) => id in SKILLS && Number.isInteger(n) && n > 0) || !s.skillBag.every(b => s.skillLevels[b.skillId])) return false;
    if (!Object.entries(s.cooldowns).every(([id, n]) => id in SKILLS && Number.isInteger(n) && n >= 0)) return false;
    if (!m.objects.every(o => point(o.position) && ['chest', 'item', 'skill', 'exit'].includes(o.type) && (!o.skillId || o.skillId in SKILLS) && (!o.itemId || o.itemId in ITEMS))) return false;
    return Array.isArray(m.fields) && m.fields.every(f => point(f.position) && attributes.includes(f.attribute) && Number.isFinite(f.remainingTurns));
  } catch { return false; }
}
