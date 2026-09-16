/** 行動終了時のCT・属性・MP更新。回復間隔とドロップ率はBALANCEで調整。 */
import { tickAttributes } from '../skills/AttributeSystem';
import type { SaveData, SkillId } from './types';
export const BALANCE = { mpRecoveryInterval: 5, mpRecoveryFraction: .1, dropChance: .12 };
// dropChanceは旧設定との互換用。現在のドロップ抽選はenemies.tsのdropsだけを使用します。
export function endTurn(state: SaveData, castId?: SkillId): void {
  for (const id of Object.keys(state.cooldowns) as SkillId[]) if (id !== castId) state.cooldowns[id] = Math.max(0, (state.cooldowns[id] ?? 0) - 1);
  for (const a of [state.playerState, ...state.allyStates, ...state.enemyStates]) {
    tickAttributes(a, state.playerActionCount);
    a.buffs = (a.buffs ?? []).filter(b => { if (b.appliedAt < state.playerActionCount) b.remainingTurns--; return b.remainingTurns > 0; });
  }
  state.mapState.fields = state.mapState.fields.filter(f => --f.remainingTurns > 0);
  state.mpRecoveryActions ??= 0;
  if (!castId && ++state.mpRecoveryActions >= BALANCE.mpRecoveryInterval) {
    state.mpRecoveryActions = 0;
    state.playerState.mp = Math.min(state.playerState.maxMp, state.playerState.mp + Math.floor(state.playerState.maxMp * BALANCE.mpRecoveryFraction));
  }
  // 敵は出現後の経過ターンを個別に数える。MP0の敵も安全に扱う。
  for (const enemy of state.enemyStates) {
    enemy.mpRecoveryTurns = (enemy.mpRecoveryTurns ?? 0) + 1;
    if (enemy.mpRecoveryTurns >= 10) { enemy.mpRecoveryTurns = 0; enemy.mp = Math.min(enemy.maxMp ?? 0, (enemy.mp ?? 0) + Math.ceil((enemy.maxMp ?? 0) / 10)); }
  }
  state.turnCount++;
}
