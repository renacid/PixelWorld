import { targetableCrystals } from '../game/CrystalTargets';
import { canMeleeAttack } from '../ai/EnemyAI';
import { ENEMY_SKILLS, type EnemySkillDefinition } from '../data/enemySkills';
import { canStand, distance, lineOfSight, occupied, same, wall } from '../game/MapState';
import type { Random } from '../game/Random';
import { VECTORS, type Actor, type Direction, type GameEvent, type MapState, type Point } from '../game/types';
import { applyBuff, attackPower, movementLocked } from '../game/ActorStats';

type Context = { allowSkills?: boolean; hitInstallation?: (id:string)=>boolean; action: number; allies: Actor[]; map: MapState; actors: Actor[]; rng: Random; events: GameEvent[]; damage: (target: Actor, amount: number, attribute: import("../game/types").Attribute, critical?: boolean, label?: string) => void; log: (message: string) => void };
type PreparedAction = { installationId?:string; position: Point; facing: Direction; origin?: Point; impact?: Point; path?: Point[] };
/** 効果ごとの事前検証。新効果はここに分岐を追加し、抽選前に実行可能性を確定します。 */
function prepare(skill: EnemySkillDefinition, caster: Actor, target: Actor, context: Context): PreparedAction | null {
  if (skill.effect.type === 'melee') {
    const hit = occupied(target).find(p => occupied(caster).some(c => Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) <= skill.maxRange));
    if (!hit) return null;
    const dx = hit.x - caster.position.x, dy = hit.y - caster.position.y;
    return { position: { ...caster.position }, impact: hit, facing: Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up' };
  }
  if (skill.effect.type === 'projectile') {
    // 直線を1セルずつ走査。壁・最初のキャラで止まり、手前の敵仲間を貫通しません。
    const rays = caster.directions.map(facing => ({ facing, v: VECTORS[facing], range: skill.maxRange }));
    if (skill.diagonalRange) for (const x of [-1, 1]) for (const y of [-1, 1]) rays.push({ facing: x < 0 ? 'left' : 'right', v: { x, y }, range: skill.diagonalRange });
    for (const origin of occupied(caster)) for (const ray of rays) {
      const { facing, v } = ray, path: Point[] = [];
      let obstruction: {id:string;position:Point;path:Point[]} | undefined;
      for (let range = 1; range <= ray.range; range++) {
        const cell = { x: origin.x + v.x * range, y: origin.y + v.y * range };
        if (wall(context.map, cell)) break;
        path.push(cell);
        const installation=[...context.map.installations??[],...targetableCrystals(context.map,context.action)].find(i=>same(i.position,cell));
        if(installation&&!obstruction)obstruction={id:installation.id,position:cell,path:[...path]};
        const hit = context.actors.find(a => a.id !== caster.id && a.hp > 0 && occupied(a).some(p => same(p, cell)));
        if (hit) {
          if (hit.id === target.id && range >= skill.minRange) return { position: { ...caster.position }, facing, origin, impact: obstruction?.position ?? cell, path:obstruction?.path ?? path, installationId:obstruction?.id };
          break;
        }
      }
    }
    return null;
  }
  if (skill.effect.type === 'approachStrike') {
    for (const facing of caster.directions) {
      const v = VECTORS[facing]; let position = { ...caster.position }, valid = true;
      for (let step = 0; step < skill.effect.steps; step++) {
        position = { x: position.x + v.x, y: position.y + v.y };
        if (!canStand(context.map, caster, position, context.actors)) { valid = false; break; }
      }
      if (valid && occupied(caster, position).some(c => occupied(target).some(t => distance(c, t) === 1))) return { position, facing };
    }
  }
  return null;
}
/** 条件成立時だけ抽選。失敗なら通常AIを続行、成功ならその行動はスキルだけで終了。 */
export function tryEnemySkill(caster: Actor, targets: Actor[], context: Context): boolean {
  if(context.allowSkills===false)return false;
  let ids = caster.enemySkillIds ?? [];
  // 排他的抽選では各技が指定通り20%を占める。条件外・MP不足の枠は通常AIへ戻す。
  const exclusive = caster.skillSelection === 'exclusive';
  if (exclusive) {
    let roll = context.rng.next();
    ids = ids.filter(id => { const chance = caster.skillChances?.[id] ?? ENEMY_SKILLS[id]?.chance ?? 0; const selected = roll >= 0 && roll < chance; roll -= chance; return selected; });
  }
  for (const id of ids) {
    const skill = ENEMY_SKILLS[id];
    if (!skill || (caster.mp ?? 0) < skill.mpCost || (caster.enemyCooldownUntil?.[id] ?? 0) > context.action) continue;
    if(skill.effect.type==='elementArmor'){
      if(caster.mode!=='hostile'||caster.buffs?.some(b=>b.id===id&&b.remainingTurns>0)||context.rng.next()>=(caster.skillChances?.[id]??skill.chance))continue;
      caster.mp!-=skill.mpCost;
      applyBuff(caster,{id,name:skill.name,remainingTurns:skill.effect.duration,appliedAt:context.action,attackMultiplier:1,detectionBonus:0,iceFollowup:{chance:skill.effect.chance,ratio:skill.effect.ratio}});
      context.events.push({type:'trap',actorId:caster.id,position:{...caster.position},visual:'iceShield',sound:'ice'});context.log(caster.name+'の氷装！');return true;
    }
    if(skill.effect.type==='charge'){
      if(movementLocked(caster,context.action))continue;
      let hit:{target?:Actor;installationId?:string;destination:Point;impact:Point;facing:Direction}|undefined;
      for(const facing of caster.directions){const v=VECTORS[facing];
        for(let n=1;n<=skill.maxRange;n++){
          const cell={x:caster.position.x+v.x*n,y:caster.position.y+v.y*n};if(wall(context.map,cell))break;
          const object=context.map.installations?.find(o=>same(o.position,cell));
          const occupant=context.actors.find(a=>a.id!==caster.id&&a.hp>0&&occupied(a).some(p=>same(p,cell)));
          if(object||occupant){
            const enemy=occupant&&targets.some(t=>t.id===occupant.id)?occupant:undefined;
            if(n>=skill.minRange&&(enemy||object?.sourceSkillId||object?.kind==='icePillar'))hit={target:enemy,installationId:object?.id,destination:{x:cell.x-v.x,y:cell.y-v.y},impact:cell,facing};
            break;
          }
        }if(hit)break;
      }
      if(!hit)continue;
      const origin={...caster.position};caster.position=hit.destination;caster.facing=hit.facing;caster.mp!-=skill.mpCost;
      context.events.push({type:'attack',actorId:caster.id,position:origin,target:hit.impact,enemySkillId:id,visual:'strike',sound:'strike',durationMs:360});
      if(hit.target)context.damage(hit.target,attackPower(caster)*skill.effect.ratio,'physical',false,skill.name);
      if(hit.installationId)context.hitInstallation?.(hit.installationId);
      // 行動nで命中したらn+1を休み、n+2で再行動。氷柱への命中も同じ反動を受ける。
      const rest=skill.effect.selfStunTurns??0;
      if(rest>0&&caster.hp>0){
        caster.stunnedUntil=Math.max(caster.stunnedUntil??0,context.action+rest+1);
        context.log(caster.name+'は突進の反動で'+rest+'ターン行動不能！');
      }
      return true;
    }
    if(movementLocked(caster,context.action)&&['dash','teleport','approachStrike'].includes(skill.effect.type))continue;
    const consume = () => { caster.mp = (caster.mp ?? 0) - skill.mpCost; (caster.enemyCooldownUntil ??= {})[id] = context.action + (skill.cooldown ?? 0) + 1; };
    if(skill.effect.type==='extraActions')continue; // 行動開始時だけ別枠で抽選し、再帰加速を防ぐ。
    if(skill.effect.type==='sweep'){
      const facing=caster.facing??'down',f=VECTORS[facing],side={x:-f.y,y:f.x},p=caster.position;
      const cells=[[0,-1],[0,1],[1,-1],[1,0],[1,1]].map(([a,b])=>({x:p.x+f.x*a+side.x*b,y:p.y+f.y*a+side.y*b})).filter(c=>!wall(context.map,c));
      const victims=targets.filter(t=>t.hp>0&&occupied(t).some(c=>cells.some(p=>same(c,p))));
      if(!victims.length||(!exclusive&&context.rng.next()>=(caster.skillChances?.[id]??skill.chance)))continue;
      consume();context.events.push({type:'cast',actorId:caster.id,position:{...p},path:cells,target:{x:p.x+f.x,y:p.y+f.y},skillId:'sweep',sound:skill.sound});
      for(const target of victims)if(caster.hp>0)context.damage(target,attackPower(caster)*(skill.effect.damageMin+context.rng.next()*(skill.effect.damageMax-skill.effect.damageMin)),skill.effect.attribute,false,skill.name);
      for(const i of [...context.map.installations??[],...targetableCrystals(context.map,context.action)])if(cells.some(c=>same(c,i.position)))context.hitInstallation?.(i.id);
      return true;
    }
    if(skill.effect.type==='dash'){
      if(caster.mode!=='hostile'||!targets.some(t=>t.hp>0)||targets.some(t=>t.hp>0&&occupied(t).some(p=>occupied(caster).some(c=>Math.max(Math.abs(p.x-c.x),Math.abs(p.y-c.y))<=1))))continue;
      const target=targets.filter(t=>t.hp>0).sort((a,b)=>distance(caster.position,a.position)-distance(caster.position,b.position))[0];
      const moves=caster.directions.map(facing=>{const v=VECTORS[facing],path=Array.from({length:skill.effect.type==='dash'?skill.effect.steps:0},(_,i)=>({x:caster.position.x+v.x*(i+1),y:caster.position.y+v.y*(i+1)}));return {facing,path};}).filter(m=>m.path.every(p=>canStand(context.map,caster,p,context.actors))&&distance(m.path.at(-1)!,target.position)<distance(caster.position,target.position));
      moves.sort((a,b)=>distance(a.path.at(-1)!,target.position)-distance(b.path.at(-1)!,target.position));
      if(!moves.length||(!exclusive&&context.rng.next()>=(caster.skillChances?.[id]??skill.chance)))continue;
      const move=moves[0],from={...caster.position};consume();caster.position={...move.path.at(-1)!};caster.facing=move.facing;
      context.events.push({type:'attack',actorId:caster.id,position:from,target:{...caster.position},path:move.path,visual:'strike',sound:skill.sound,enemySkillId:id});context.log(caster.name+'の加速！');return true;
    }
    if (skill.effect.type === 'teleport' || skill.effect.type === 'restoreMp') {
      if (!targets.length) continue;
      let destination: Point | undefined;
      if (skill.effect.type === 'teleport') {
        const r = skill.effect.radius, cells: Point[] = [];
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
          const p = { x: caster.position.x + x, y: caster.position.y + y };
          if (Math.max(Math.abs(x), Math.abs(y)) === r && canStand(context.map, caster, p, context.actors) && !context.map.objects.some(o => same(o.position, p))) cells.push(p);
        }
        if (!cells.length) continue;
        if ((!exclusive && context.rng.next() >= (caster.skillChances?.[id] ?? skill.chance))) continue;
        // 元の転移範囲・空き判定を守り、プレイヤーへの射線を作れる場所を優先。
        const player = targets.find(t => t.kind === 'player' && t.hp > 0);
        const preferred = player ? cells.filter(cell => occupied(player).some(p =>
          (cell.x === p.x || cell.y === p.y) && distance(cell, p) >= 1 && distance(cell, p) <= 2
          && lineOfSight(context.map, cell, p))) : [];
        const pool = preferred.length ? preferred : cells;
        destination = pool[context.rng.int(0, pool.length - 1)];
      } else {
        if (!skill.effect.allowFull && (caster.mp ?? 0) >= (caster.maxMp ?? 0) || (!exclusive && context.rng.next() >= (caster.skillChances?.[id] ?? skill.chance))) continue;
      }
      consume();
      const origin = { ...caster.position };
      if (destination) caster.position = destination;
      else if (skill.effect.type === 'restoreMp') caster.mp = Math.min(caster.maxMp ?? 0, (caster.mp ?? 0) + skill.effect.amount);
      context.events.push({ type: 'trap', actorId: caster.id, position: origin, target: destination, path: [caster.position], visual: 'healingGlow', sound: skill.sound });
      context.log(caster.name + 'の' + skill.name + '！'); return true;
    }
    if (skill.effect.type === 'allyBuff') {
      const effect = skill.effect;
      const allies = context.allies.filter(a => a.id !== caster.id && a.hp > 0 && occupied(a).some(p => Math.max(Math.abs(p.x - caster.position.x), Math.abs(p.y - caster.position.y)) <= effect.radius));
      if (!allies.length || (!exclusive && context.rng.next() >= (caster.skillChances?.[id] ?? skill.chance))) continue;
      consume();
      for (const ally of allies) {
        ally.buffs = (ally.buffs ?? []).filter(b => b.id !== id);
        applyBuff(ally, { id, remainingTurns: effect.duration, appliedAt: context.action, attackMultiplier: effect.attackMultiplier, detectionBonus: effect.detectionBonus });
      }
      context.events.push({ type: 'trap', actorId: caster.id, position: { ...caster.position }, path: allies.map(a => ({ ...a.position })), visual: 'healingGlow', sound: skill.sound });
      context.log(caster.name + 'の' + skill.name + '！ 周囲の味方' + allies.length + '体を' + effect.duration + 'ターン強化！');
      return true;
    }
    const candidates = targets.filter(t => t.hp > 0 && (skill.target !== 'player' || t.kind === 'player') && occupied(caster).some(c => occupied(t).some(p => {
      const range = skill.diagonalRange ? Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) : distance(c, p);
      return range >= skill.minRange && range <= skill.maxRange && (!skill.cardinalOnly || c.x === p.x || c.y === p.y) && (!skill.requiresSight || lineOfSight(context.map, c, p));
    })));
    const prepared = candidates.map(target => ({ target, action: prepare(skill, caster, target, context) })).find(entry => entry.action !== null);
    // 通常攻撃(100%)より平均威力の低い飛び道具は、接敵中には使わない。
    // 強撃など近接スキルの抽選は維持し、通常AIへ戻れば通常攻撃する。
    if (prepared && skill.effect.type === 'projectile' && canMeleeAttack(caster, prepared.target)
      && (skill.effect.damageMin + skill.effect.damageMax) / 2 < 1) continue;
    if (!prepared || !prepared.action || (!exclusive && context.rng.next() >= (caster.skillChances?.[id] ?? skill.chance))) continue;
    const { target, action } = prepared;
    consume(); caster.position = action.position; caster.facing = action.facing;
    const multiplier = skill.effect.damageMin + context.rng.next() * (skill.effect.damageMax - skill.effect.damageMin);
    // 命中ログは呼び出し元でスキル名とダメージを1件にまとめる。
    context.events.push({ type: 'attack', actorId: caster.id, position: action.origin ?? { ...caster.position }, target: action.impact ?? { ...target.position }, attribute: skill.effect.attribute, enemySkillId: id, visual: skill.visual, sound: skill.sound, path: action.path });
    if(action.installationId){context.hitInstallation?.(action.installationId);return true;}
    context.damage(target, attackPower(caster) * multiplier, skill.effect.attribute, false, skill.name);
    return true;
  }
  return false;
}

/** 追加行動スキルは1敵・1ターンに1回だけ抽選。発動自身は行動回数に含めない。 */
export function enemyActionCount(caster:Actor,context:Pick<Context,'rng'|'events'|'log'>):number{
 for(const id of caster.enemySkillIds??[]){const skill=ENEMY_SKILLS[id];if(skill?.effect.type!=='extraActions'||(caster.mp??0)<skill.mpCost)continue;
  if(context.rng.next()>=(caster.skillChances?.[id]??skill.chance))continue;
  caster.mp!-=skill.mpCost;context.events.push({type:'trap',actorId:caster.id,position:{...caster.position},visual:'healingGlow',sound:skill.sound});context.log(caster.name+'の'+skill.name+'！ '+skill.effect.count+'回行動！');return skill.effect.count;
 }return 1;
}
