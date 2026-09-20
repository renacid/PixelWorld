import { applyBuff, movementLocked } from '../game/ActorStats';
import { occupied } from '../game/MapState';
/** 精霊の帰還を最優先し、近くに敵がいなければ旅人についていく。 */
import type { Actor, GameEvent, SaveData } from '../game/types';
import type { Random } from '../game/Random';
import { canStand, same } from '../game/MapState';
import { actEnemy, moveToward } from './EnemyAI';
export function actSummon(state: SaveData, ally: Actor, rng: Random, events: GameEvent[], attack: (a: Actor, b: Actor) => void, log: (text: string) => void): void {
  const p = state.playerState.position, actors = [state.playerState, ...state.allyStates, ...state.enemyStates];
  if (!movementLocked(ally,state.playerActionCount) && Math.max(Math.abs(ally.position.x - p.x), Math.abs(ally.position.y - p.y)) > 4) {
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
  if(ally.kind==='greaterSprite'&&(ally.mp??0)>=3&&!state.enemyStates.some(e=>e.hp>0&&occupied(e).some(c=>Math.max(Math.abs(c.x-ally.position.x),Math.abs(c.y-ally.position.y))<=1))){
    const roll=rng.next(),player=state.playerState;
    if(roll<.1&&player.hp<=player.maxHp/2){const amount=Math.min(player.maxHp-player.hp,Math.max(1,Math.floor(player.maxHp*.1)));player.hp+=amount;ally.mp!-=3;events.push({type:'heal',position:{...p},amount,sound:'healing'});log(ally.name+'の癒し！ 旅人のHPが'+amount+'回復！');return;}
    if(roll>=.1&&roll<.2){ally.mp!-=3;applyBuff(player,{id:'item:powerPotion',attackBonus:5,attackMultiplier:1,detectionBonus:0,remainingTurns:10,appliedAt:state.playerActionCount});events.push({type:'heal',position:{...p},text:'攻撃力+5',sound:'healing'});log(ally.name+'の強化！ 旅人の攻撃力+5（10ターン）');return;}
  }
  ally.detectionRange = Math.max(7, ally.detectionRange); ally.pattern = 'guard';
  actEnemy(state.mapState, ally, state.enemyStates, actors, rng, attack, state.playerActionCount);
  if (ally.mode === 'idle' && Math.max(Math.abs(ally.position.x - p.x), Math.abs(ally.position.y - p.y)) > 1) moveToward(state.mapState, ally, p, actors,rng,state.playerActionCount);
}
