import { tickAttributes } from '../skills/AttributeSystem';
import type { SaveData, SkillId } from './types';
export const BALANCE = { mpRecoveryInterval: 5, mpRecoveryAmount: 3, dropChance: .12 };
export function endTurn(state: SaveData, castId?: SkillId): void {
  for (const id of Object.keys(state.cooldowns) as SkillId[]) if (id !== castId) state.cooldowns[id] = Math.max(0, (state.cooldowns[id] ?? 0) - 1);
  for (const a of [state.playerState, ...state.allyStates, ...state.enemyStates]) tickAttributes(a, state.playerActionCount);
  state.mapState.fields = state.mapState.fields.filter(f => --f.remainingTurns > 0);
  if (state.playerActionCount % BALANCE.mpRecoveryInterval === 0) state.playerState.mp = Math.min(state.playerState.maxMp, state.playerState.mp + BALANCE.mpRecoveryAmount);
  state.turnCount++;
}
