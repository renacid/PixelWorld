import { targetableCrystals } from '../game/CrystalTargets';
/** 設置・移動スキルはこのモジュールへ集約。威力は発動時の攻撃力を保存。 */
import {SKILLS} from '../data/skills';
import {attackPower,criticalChance} from '../game/ActorStats';
import {effectiveLevel,connectionDamageMultiplier} from './SkillBag';
import {previewSkill} from './SkillResolver';
import {dealAttributeHit,type DamageHandler} from './AttributeSystem';
import {hitInstallation} from '../game/InstallationSystem';
import {occupied,same,wall} from '../game/MapState';
import {VECTORS,type SaveData,type SkillId,type Direction,type GameEvent,type Point,type FieldEffect} from '../game/types';
import type {Random} from '../game/Random';
type Context={rng:Random;events:GameEvent[];damage:DamageHandler;log:(m:string)=>void};
export function castFieldSkill(s:SaveData,id:SkillId,direction:Direction,c:Context,aim?:Point):boolean{
 if(!['meteor','iceLance','fireWall','tornadoSummon','earthquake'].includes(id))return false;
 const d=SKILLS[id],level=effectiveLevel(s.skillBag,s.skillLevels,id),power=attackPower(s.playerState)*(1+(level-1)*.05)*connectionDamageMultiplier(s.skillBag,id),preview=previewSkill(s,id,direction,aim);
 if(id==='tornadoSummon'){
  let position={...s.playerState.position};const visited=new Set([position.x+','+position.y]);
  const steps=level>=5?7:level>=3?5:4;
  for(let step=0;step<steps;step++){
   const choices=(step===0?[VECTORS[direction]]:Object.values(VECTORS)).map(v=>({x:position.x+v.x,y:position.y+v.y})).filter(p=>!visited.has(p.x+','+p.y)&&!wall(s.mapState,p));
   if(!choices.length)break;
   const next=choices[c.rng.int(0,choices.length-1)],delay=step*240;
   c.events.push({type:'trap',position:{...position},target:{...next},visual:'windVortex',sound:step===0?'magicCast':undefined,delayMs:delay,durationMs:240});
   visited.add(next.x+','+next.y);position=next;
   // 同じ大型敵の別セルに接触した場合も、その歩ごとに威力・会心を抽選する。
   const eventStart=c.events.length;
   for(const enemy of s.enemyStates)if(enemy.hp>0&&occupied(enemy).some(p=>same(p,next))){
    const multiplier=1+c.rng.next()*.3,critical=c.rng.next()<criticalChance(s.playerState,enemy,d.attribute);
    dealAttributeHit(enemy,power*multiplier*(critical?s.playerState.criticalMultiplier:1),d.attribute,s.playerActionCount,s.enemyStates,c.damage,c.events,()=>c.rng.next(),critical);
   }
   for(const installation of [...s.mapState.installations??[],...targetableCrystals(s.mapState,s.playerActionCount)])if(same(installation.position,next))hitInstallation(s,installation.id,c);
   for(const event of c.events.slice(eventStart))event.delayMs=(event.delayMs??0)+delay+120;
  }
  return true;
 }
 if(id==='meteor')c.events.push({type:'cast',actorId:s.playerState.id,position:{...s.playerState.position},target:aim,path:preview.cells,skillId:id,sound:'magicCast',durationMs:650});
 else c.events.push({type:'trap',actorId:s.playerState.id,position:{...s.playerState.position},path:preview.cells,visual:id==='earthquake'?'quake':id==='iceLance'?'iceLance':id==='fireWall'?'fireBlast':'windVortex',sound:id==='earthquake'?'rocks':id==='iceLance'?'ice':'magicCast',durationMs:650});
 let index=0;
 for(const targetId of preview.targetIds){
  if(hitInstallation(s,targetId,c))continue;
  const enemy=s.enemyStates.find(e=>e.id===targetId);if(!enemy)continue;
  const multiplier=id==='iceLance'?[.7,.9,1.2,1.5][Math.min(index++,3)]:d.multiplier;
  const critical=c.rng.next()<criticalChance(s.playerState,enemy,d.attribute);
  dealAttributeHit(enemy,power*multiplier*(critical?s.playerState.criticalMultiplier:1),d.attribute,s.playerActionCount,s.enemyStates,c.damage,c.events,()=>c.rng.next(),critical);
  if(id==='earthquake'&&enemy.hp>0&&c.rng.next()<(level>=3?.8:.5))enemy.movementLockedUntil=Math.max(enemy.movementLockedUntil??0,s.playerActionCount+1);
 }
 if(id==='earthquake')s.mapState.traps=s.mapState.traps?.filter(t=>t.triggered||!preview.cells.some(p=>same(p,t.position)));
 const fireCells=id==='fireWall'?preview.cells:id==='meteor'&&level>=3?preview.cells.filter(()=>c.rng.next()<.5):[];
 for(const [i,position] of fireCells.entries())s.mapState.fields.push({effectId:id+'-'+s.playerActionCount+'-'+i,sourceSkillId:id,skillKind:'fireWall',position:{...position},direction,placedAt:s.playerActionCount,power,attribute:d.attribute,remainingTurns:3,triggerType:'turn',damageMultiplier:.3,onceOnly:false,hitAction:s.playerActionCount,hitIds:[...preview.targetIds]});
 return true;
}
function hitField(s:SaveData,f:FieldEffect,c:Context):void{
 if(f.skillKind==='fireWall'&&f.placedAt===s.playerActionCount)return;
 if(f.hitAction!==s.playerActionCount){f.hitAction=s.playerActionCount;f.hitIds=[];}
 for(const e of s.enemyStates)if(e.hp>0&&!f.hitIds!.includes(e.id)&&occupied(e).some(p=>same(p,f.position))){for(const related of s.mapState.fields)if(related.sourceSkillId===f.sourceSkillId&&related.placedAt===f.placedAt){if(related.hitAction!==s.playerActionCount){related.hitAction=s.playerActionCount;related.hitIds=[];}related.hitIds!.push(e.id);}dealAttributeHit(e,(f.power??0)*f.damageMultiplier,f.attribute,s.playerActionCount,s.enemyStates,c.damage,c.events,()=>c.rng.next());}
 for(const i of [...s.mapState.installations??[]])if(same(i.position,f.position))hitInstallation(s,i.id,c);
}
/** 移動前・移動後の接触を拾う。1フィールドから同じ敵への命中は1行動に1度。 */
export function contactSkillFields(s:SaveData,c:Context):void{for(const f of s.mapState.fields)if(f.skillKind==='fireWall'&&f.remainingTurns>0)hitField(s,f,c);}
export function tickSkillFields(s:SaveData,c:Context):void{
 // 旧セーブの持続竜巻は撤去。新仕様ではマップ上に残さない。
 s.mapState.fields=s.mapState.fields.filter(f=>f.skillKind!=='tornadoSummon');
 for(const f of s.mapState.fields){if(!f.skillKind||f.placedAt===s.playerActionCount)continue;
  const from={...f.position};
  hitField(s,f,c);c.events.push({type:'trap',position:from,target:{...f.position},visual:f.skillKind==='fireWall'?'fireBlast':'windVortex',durationMs:400});f.remainingTurns--;
 }
 s.mapState.fields=s.mapState.fields.filter(f=>f.remainingTurns>0);
}
