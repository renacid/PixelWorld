import { occupied, same, wall } from './MapState';
import { VECTORS, type Point, type SaveData, type GameEvent } from './types';
import { dealAttributeHit, type DamageHandler } from '../skills/AttributeSystem';
import { hitInstallation } from './InstallationSystem';
import type { Random } from './Random';
export const FIRE_BOTTLE={straightRange:3,diagonalRange:2,damage:5,floorDamage:3,turns:3};
/** 移動直後だけ判定。大型敵が複数の炎上マスを踏んでも1回分。 */
export function contactBottleFire(s:SaveData,enemy:import('./types').Actor,rng:Random,events:GameEvent[],damage:DamageHandler):void{
 const field=s.mapState.fields.find(f=>f.effectId.startsWith('bottle-')&&f.remainingTurns>0&&occupied(enemy).some(p=>same(p,f.position)));
 if(field&&enemy.hp>0)dealAttributeHit(enemy,(field.power??FIRE_BOTTLE.floorDamage)*field.damageMultiplier,'fire',s.playerActionCount,s.enemyStates,damage,events,()=>rng.next());
}
export function bottleImpact(s:SaveData,direction:Point):Point|null{
 if(!Number.isInteger(direction.x)||!Number.isInteger(direction.y)||Math.max(Math.abs(direction.x),Math.abs(direction.y))!==1)return null;
 let end:Point|null=null;
 for(let n=1;n<=(direction.x&&direction.y?FIRE_BOTTLE.diagonalRange:FIRE_BOTTLE.straightRange);n++){
  const p={x:s.playerState.position.x+direction.x*n,y:s.playerState.position.y+direction.y*n};
  if(wall(s.mapState,p))break;end=p;
  if(s.enemyStates.some(e=>e.hp>0&&occupied(e).some(c=>same(c,p)))||s.mapState.installations?.some(i=>same(i.position,p)))break;
 }
 return end;
}
export function throwBottle(s:SaveData,direction:Point,rng:Random,events:GameEvent[],damage:DamageHandler,log:(m:string)=>void):boolean{
 const impact=bottleImpact(s,direction);if(!impact)return false;
 const ctx={rng,events,damage,log};
 events.push({type:'cast',actorId:s.playerState.id,position:{...s.playerState.position},target:impact,skillId:'fireball',attribute:'fire',sound:'magicCast',durationMs:350});
 for(const e of s.enemyStates)if(e.hp>0&&occupied(e).some(p=>same(p,impact)))dealAttributeHit(e,FIRE_BOTTLE.damage,'fire',s.playerActionCount,s.enemyStates,damage,events,()=>rng.next());
 for(const i of [...s.mapState.installations??[]])if(same(i.position,impact))hitInstallation(s,i.id,ctx);
 const cells=[impact,...Object.values(VECTORS).map(v=>({x:impact.x+v.x,y:impact.y+v.y}))].filter(p=>!wall(s.mapState,p));
 for(const position of cells){s.mapState.fields=s.mapState.fields.filter(f=>!(f.effectId.startsWith('bottle-')&&same(f.position,position)));s.mapState.fields.push({effectId:'bottle-'+s.playerActionCount+'-'+position.x+'-'+position.y,position,attribute:'fire',remainingTurns:FIRE_BOTTLE.turns,triggerType:'enter',power:FIRE_BOTTLE.floorDamage,damageMultiplier:1,onceOnly:false});}
 events.push({type:'trap',position:impact,path:cells,visual:'fireBlast',sound:'shatter',delayMs:300,durationMs:450});return true;
}
