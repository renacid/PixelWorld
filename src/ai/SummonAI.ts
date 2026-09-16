/** 精霊の帰還を最優先し、近くに敵がいなければ旅人についていく。 */
import type { Actor, GameEvent, SaveData } from '../game/types';
import type { Random } from '../game/Random';
import { canStand, same } from '../game/MapState';
import { actEnemy, moveToward } from './EnemyAI';
export function actSummon(state: SaveData, ally: Actor, rng: Random, events: GameEvent[], attack: (a: Actor, b: Actor) => void, log: (text: string) => void): void {
  const p = state.playerState.position, actors = [state.playerState, ...state.allyStates, ...state.enemyStates];
  if (Math.max(Math.abs(ally.position.x - p.x), Math.abs(ally.position.y - p.y)) > 4) {
    const cells = [];
    for (let y = p.y - 4; y <= p.y + 4; y++) for (let x = p.x - 4; x <= p.x + 4; x++) {
      const point = { x, y };
      if (canStand(state.mapState, ally, point, actors) && !state.mapState.objects.some(o => same(o.position, point))) cells.push(point);
    }
    if (cells.length) {
      const target = cells[rng.int(0, cells.length - 1)];
      events.push({ type: 'cast', skillId: 'warp', actorId: ally.id, position: { ...ally.position }, target });
      ally.position = target; ally.mode = 'idle'; ally.lastSeen = null; ally.chaseMoves = 0; ally.chaseSkipLeft = 0;
      log(ally.name + 'が旅人の近くへワープ！'); return;
    }
  }
  ally.detectionRange = Math.max(7, ally.detectionRange); ally.pattern = 'guard';
  actEnemy(state.mapState, ally, state.enemyStates, actors, rng, attack, state.playerActionCount);
  if (ally.mode === 'idle' && Math.max(Math.abs(ally.position.x - p.x), Math.abs(ally.position.y - p.y)) > 1) moveToward(state.mapState, ally, p, actors);
}
