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
export function castFieldSkill(s:SaveData,id:SkillId,direction:Direction,c:Context):boolean{
 if(!['iceLance','fireWall','tornadoSummon','earthquake'].includes(id))return false;
 const d=SKILLS[id],level=effectiveLevel(s.skillBag,s.skillLevels,id),power=attackPower(s.playerState)*(1+(level-1)*.05)*connectionDamageMultiplier(s.skillBag,id),preview=previewSkill(s,id,direction);
 c.events.push({type:'trap',actorId:s.playerState.id,position:{...s.playerState.position},path:preview.cells,visual:id==='earthquake'?'quake':id==='iceLance'?'iceLance':id==='fireWall'?'fireBlast':'windVortex',sound:id==='earthquake'?'rocks':id==='iceLance'?'ice':'magicCast',durationMs:650});
 let index=0;
 for(const targetId of preview.targetIds){
  if(hitInstallation(s,targetId,c))continue;
  const enemy=s.enemyStates.find(e=>e.id===targetId);if(!enemy)continue;
  const multiplier=id==='iceLance'?[.7,.9,1.2,1.5][Math.min(index++,3)]:d.multiplier;
  const critical=c.rng.next()<criticalChance(s.playerState,enemy,d.attribute);
  dealAttributeHit(enemy,power*multiplier*(critical?s.playerState.criticalMultiplier:1),d.attribute,s.playerActionCount,s.enemyStates,c.damage,c.events,()=>c.rng.next(),critical);
  if(id==='earthquake'&&enemy.hp>0&&c.rng.next()<.5)enemy.movementLockedUntil=Math.max(enemy.movementLockedUntil??0,s.playerActionCount+1);
 }
 if(id==='earthquake')s.mapState.traps=s.mapState.traps?.filter(t=>t.triggered||!preview.cells.some(p=>same(p,t.position)));
 if(id==='fireWall'||id==='tornadoSummon')for(const [i,position] of preview.cells.entries())s.mapState.fields.push({effectId:id+'-'+s.playerActionCount+'-'+i,sourceSkillId:id,skillKind:id,position:{...position},direction,placedAt:s.playerActionCount,power,attribute:d.attribute,remainingTurns:id==='fireWall'?3:level>=3?5:3,triggerType:'turn',damageMultiplier:id==='fireWall'?.3:1,onceOnly:false,hitAction:s.playerActionCount,hitIds:[...preview.targetIds]});
 return true;
}
function hitField(s:SaveData,f:FieldEffect,c:Context):void{
 if(f.skillKind==='fireWall'&&f.placedAt===s.playerActionCount)return;
 if(f.hitAction!==s.playerActionCount){f.hitAction=s.playerActionCount;f.hitIds=[];}
 for(const e of s.enemyStates)if(e.hp>0&&!f.hitIds!.includes(e.id)&&occupied(e).some(p=>same(p,f.position))){for(const related of s.mapState.fields)if(related.sourceSkillId===f.sourceSkillId&&related.placedAt===f.placedAt){if(related.hitAction!==s.playerActionCount){related.hitAction=s.playerActionCount;related.hitIds=[];}related.hitIds!.push(e.id);}dealAttributeHit(e,(f.power??0)*f.damageMultiplier,f.attribute,s.playerActionCount,s.enemyStates,c.damage,c.events,()=>c.rng.next());}
 for(const i of [...s.mapState.installations??[]])if(same(i.position,f.position))hitInstallation(s,i.id,c);
}
/** 移動前・移動後の接触を拾う。1フィールドから同じ敵への命中は1行動に1度。 */
export function contactSkillFields(s:SaveData,c:Context):void{for(const f of s.mapState.fields)if(f.skillKind&&f.remainingTurns>0)hitField(s,f,c);}
export function tickSkillFields(s:SaveData,c:Context):void{
 for(const f of s.mapState.fields){if(!f.skillKind||f.placedAt===s.playerActionCount)continue;
  const from={...f.position};
  if(f.skillKind==='tornadoSummon'){const v=VECTORS[f.direction!],next={x:f.position.x+v.x,y:f.position.y+v.y};if(wall(s.mapState,next)){f.remainingTurns=0;continue;}f.position=next;}
  hitField(s,f,c);c.events.push({type:'trap',position:from,target:{...f.position},visual:f.skillKind==='fireWall'?'fireBlast':'windVortex',durationMs:400});f.remainingTurns--;
 }
 s.mapState.fields=s.mapState.fields.filter(f=>f.remainingTurns>0);
}
