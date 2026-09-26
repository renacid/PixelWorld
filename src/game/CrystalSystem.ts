import { targetableCrystals } from './CrystalTargets';
import type { Actor, Crystal, CrystalSource, GameEvent, Point, SaveData } from './types';
import type { Random } from './Random';
import { canStand, occupied, same } from './MapState';
import { attackPower } from './ActorStats';
import { dealReactionHit, type DamageHandler } from '../skills/AttributeSystem';
import { hitInstallation } from './InstallationSystem';
export type CrystalContext={rng:Random;events:GameEvent[];damage:DamageHandler;log:(text:string)=>void};
// 風散のダメージと物体への命中をすべて解決してから結晶を破裂させる。
const deferredBursts=new WeakMap<SaveData,Set<string>>();
export function afterSwirlCrystals(s:SaveData,c:CrystalContext,resolve:()=>void):void{
 if(deferredBursts.has(s)){resolve();return;}
 const pending=new Set<string>();deferredBursts.set(s,pending);
 try{resolve();}finally{deferredBursts.delete(s);}
 const start=c.events.length;
 for(const id of pending)hitCrystal(s,id,c);
 for(const event of c.events.slice(start))event.delayMs=(event.delayMs??0)+650;
}
export function crystalSource(s:SaveData,a:Actor):CrystalSource{return {actorId:a.id,team:s.enemyStates.some(e=>e.id===a.id)?'enemy':'player',attack:attackPower(a)};}
/** 結晶は通行を妨げず、既存の結晶だけは同じマスへの追加生成を許可する。 */
export function createCrystal(s:SaveData,target:Actor,attribute:Crystal['attribute'],source:CrystalSource,c:CrystalContext):void{
 const cells:Point[]=[],probe={...s.playerState,id:'crystal-probe',cells:[{x:0,y:0}]};
 for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){
  const p={x:target.position.x+x,y:target.position.y+y};
  if(canStand(s.mapState,probe,p,[s.playerState,...s.allyStates,...s.enemyStates])&&!s.mapState.objects.some(o=>same(o.position,p)))cells.push(p);
 }
 if(!cells.length)return;
 const position=cells[c.rng.int(0,cells.length-1)],list=s.mapState.crystals??=[];
 let id='crystal-'+s.playerActionCount+'-'+list.length;while(list.some(i=>i.id===id))id+='-new';
 list.push({id,position:{...position},attribute,source:{...source},damage:Math.floor(source.attack*.3),placedAt:s.playerActionCount,remainingTurns:5});
 c.events.push({type:'pickup',position:{...position},attribute,sound:attribute==='ice'?'ice':'magicCast'});
}
/** 生成行動中の結晶は保護。同じマスの破裂可能な結晶だけを先に除去し二重破裂を防ぐ。 */
export function hitCrystal(s:SaveData,id:string,c:CrystalContext):boolean{
 const hit=s.mapState.crystals?.find(i=>i.id===id);if(!hit)return id.startsWith('crystal-');
 const pending=deferredBursts.get(s);if(pending){if(hit.placedAt<s.playerActionCount)pending.add(id);return true;}
 const group=s.mapState.crystals!.filter(i=>same(i.position,hit.position)&&i.placedAt<s.playerActionCount);
 const ids=new Set(group.map(i=>i.id));
 s.mapState.crystals=s.mapState.crystals!.filter(i=>!ids.has(i.id));
 for(const crystal of group){
  const near=(p:Point)=>Math.max(Math.abs(p.x-crystal.position.x),Math.abs(p.y-crystal.position.y))<=1;
  const targets=(crystal.source.team==='enemy'?[s.playerState,...s.allyStates]:s.enemyStates).filter(a=>a.hp>0&&occupied(a).some(near));
  const objects=(s.mapState.installations??[]).filter(i=>near(i.position));
  const otherCrystals=targetableCrystals(s.mapState,s.playerActionCount).filter(i=>near(i.position));
  c.events.push({type:'reaction',position:{...crystal.position},attribute:crystal.attribute,text:crystal.attribute==='ice'?'氷結晶破裂':'雷結晶破裂',sound:crystal.attribute==='ice'?'ice':'magicCast'});
  for(const target of targets){
   c.events.push({type:'cast',position:{...crystal.position},target:{...target.position},crystalAttribute:crystal.attribute,attribute:crystal.attribute,durationMs:320});
   const hitStart=c.events.length;
   dealReactionHit(target,crystal.damage,crystal.attribute,s.playerActionCount,crystal.source.team==='enemy'?[s.playerState,...s.allyStates]:s.enemyStates,c.damage,c.events,()=>c.rng.next(),crystal.source);
   for(const event of c.events.slice(hitStart))event.delayMs=(event.delayMs??0)+250;
  }
  for(const object of objects){c.events.push({type:'cast',position:{...crystal.position},target:{...object.position},crystalAttribute:crystal.attribute,durationMs:320});hitInstallation(s,object.id,c);}
  for(const other of otherCrystals)hitCrystal(s,other.id,c);
 }
 return true;
}
export function hitCrystalsAt(s:SaveData,cells:Point[],c:CrystalContext):void{
 for(const crystal of targetableCrystals(s.mapState,s.playerActionCount))if(cells.some(p=>same(p,crystal.position)))hitCrystal(s,crystal.id,c);
}
export function tickCrystals(s:SaveData,c:CrystalContext):void{
 for(const crystal of [...s.mapState.crystals??[]])if(crystal.placedAt<s.playerActionCount&&--crystal.remainingTurns<=0)hitCrystal(s,crystal.id,c);
}
