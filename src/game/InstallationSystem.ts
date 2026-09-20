import { installationDefinition, type InstallationPlacement } from '../data/installations';
import { actor } from '../actors/Actor';
import { canStand, occupied, same, wall, key } from './MapState';
import { weighted } from './LootSystem';
import type { Random } from './Random';
import type { Actor, GameEvent, MapState, Point, SaveData } from './types';
const neighbors = (p:Point) => [{x:p.x+1,y:p.y},{x:p.x-1,y:p.y},{x:p.x,y:p.y+1},{x:p.x,y:p.y-1}];
const freeObject = (map:MapState,p:Point) => !map.objects.some(o=>same(o.position,p)) && !map.traps?.some(t=>!t.triggered&&same(t.position,p)) && !map.fields.some(f=>same(f.position,p)) && !map.playerTraps?.some(t=>same(t.position,p));
/** 壊すまで通れないため、配置後も全ての床への経路が残る候補だけを採用。 */
export function placeInstallations(map:MapState,rules:InstallationPlacement[],rng:Random,spawn:Point,actors:Actor[]):void {
 map.installations ??= [];
 const reachable=()=>{const seen=new Set<string>([key(spawn)]),queue=[spawn];for(let n=0;n<queue.length;n++)for(const p of neighbors(queue[n]))if(!wall(map,p)&&!map.installations!.some(i=>same(i.position,p))&&!seen.has(key(p))){seen.add(key(p));queue.push(p);}return seen.size;};
 let expected=reachable();
 for(const rule of rules){
  if(!Number.isInteger(rule.count)||rule.count<0)throw new Error('設置物の個数は非負整数にしてください');
  const pool:Point[]=[],r=rule.region??{x:0,y:0,width:map.width,height:map.height};
  for(let y=Math.max(0,r.y);y<Math.min(map.height,r.y+r.height);y++)for(let x=Math.max(0,r.x);x<Math.min(map.width,r.x+r.width);x++){
   const p={x,y};if(wall(map,p)||Math.max(Math.abs(x-spawn.x),Math.abs(y-spawn.y))<4||!freeObject(map,p)||map.installations.some(i=>same(i.position,p))||actors.some(a=>occupied(a).some(c=>same(c,p))))continue;
   if(!rule.nearWall||neighbors(p).some(c=>wall(map,c)))pool.push(p);
  }
  let placed=0;
  while(pool.length&&placed<rule.count){const position=pool.splice(rng.int(0,pool.length-1),1)[0];map.installations.push({id:'installation-'+map.installations.length,kind:rule.kind,position,spawned:0,overrides:structuredClone(rule.overrides)});
   if(reachable()!==expected-1){map.installations.pop();continue;}expected--;placed++;
  }
 }
}
type Context={rng:Random;events:GameEvent[];log:(s:string)=>void};
/** 全攻撃共通。一度取り除いてから抽選するので複数ヒットでも報酬は1回。 */
export function hitInstallation(state:SaveData,id:string,context:Context):boolean{
 const map=state.mapState,i=map.installations?.find(i=>i.id===id);if(!i)return false;
 map.installations=map.installations!.filter(o=>o.id!==id);
 const counts=state.destroyedInstallations??={};counts[i.kind]=(counts[i.kind]??0)+1;
 const def=installationDefinition(i);
 context.events.push({type:'trap',position:{...i.position},visual:'shatter',sound:i.kind==='pot'?'shatter':'rocks',delayMs:160,durationMs:500});
 context.log(def.name+'が砕け散った！');
 if(def.drop&&def.drop.pool.length&&context.rng.next()<def.drop.chance)map.objects.push({id:'drop-'+i.id,type:'item',position:{...i.position},itemId:weighted(def.drop.pool,context.rng)});
 return true;
}
/** 成功した旅人の歩行だけから呼ぶ。待機・ワープ・敵の歩行では抽選しない。 */
export function moveNearInstallations(state:SaveData,context:Context):void{
 const map=state.mapState,p=state.playerState;
 for(const i of [...map.installations??[]]){
  const rule=installationDefinition(i).spawn;if(!rule||p.hp<=0||Math.max(Math.abs(p.position.x-i.position.x),Math.abs(p.position.y-i.position.y))>rule.radius)continue;
  if(i.spawned>=rule.max){if(i.requiredForGoal)continue;map.installations=map.installations!.filter(o=>o.id!==i.id);continue;}
  const actors=[p,...state.allyStates,...state.enemyStates];
  // 種類ごとに空きを調べ、大型候補を将来追加しても占有判定を共有。
  const choices=rule.pool.filter(e=>e.weight>0).map(entry=>{const enemy=actor(i.id+'-spawn-'+i.spawned,entry.value,i.position,state.stageId,state.floorNumber),cells:Point[]=[];
   for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const c={x:i.position.x+x,y:i.position.y+y};if((x||y)&&canStand(map,enemy,c,actors)&&occupied(enemy,c).every(t=>freeObject(map,t)))cells.push(c);}return {entry,enemy,cells};}).filter(e=>e.cells.length);
  if(!choices.length||context.rng.next()>=rule.chance)continue;
  const choice=weighted(choices.map(value=>({value,weight:value.entry.weight})),context.rng);
  choice.enemy.position={...choice.cells[context.rng.int(0,choice.cells.length-1)]};state.enemyStates.push(choice.enemy);i.spawned++;
  context.events.push({type:'trap',position:{...choice.enemy.position},visual:'summonRing',sound:'rocks',durationMs:450});context.log('巣穴から'+choice.enemy.name+'が現れた！');
  if(i.spawned>=rule.max&&!i.requiredForGoal){map.installations=map.installations!.filter(o=>o.id!==i.id);context.events.push({type:'trap',position:{...i.position},visual:'shatter',sound:'rocks',durationMs:500});}
 }
}
