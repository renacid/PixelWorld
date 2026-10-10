/** エルダー戦の確率・人数・予告攻撃。確率は一度の抽選区間で扱い、再抽選しません。 */
import { actor } from '../actors/Actor';
import { canMeleeAttack, faceToward } from '../ai/EnemyAI';
import type { EnemyKind } from '../data/enemies';
import { attackPower } from './ActorStats';
import { inArena, type BossArena } from './BossEncounter';
import { canStand, occupied, same, wall } from './MapState';
import type { Random } from './Random';
import { VECTORS, type Actor, type Attribute, type GameEvent, type Point, type SaveData } from './types';

export const ELDER_RULES = {
  chances:{rock:.3,sweep:.2,summon:.1,gust:.1,vine:.2},
  mp:{rock:3,sweep:3,summon:10,gust:5,vine:3},
  summon:{min:3,max:5,limit:10,tentacles:2},
  phases:[350,150], phaseTentacles:5, phaseTreants:3, phaseFlowers:2, pushDistance:7,
};
export type BossHazard={kind:'gust'|'vine';sourceId:string;dueAt:number;cells:Point[];power:number};
type Context={rng:Random;events:GameEvent[];log:(message:string)=>void;hit:(from:Actor,to:Actor,amount:number,attribute:Attribute,label:string)=>void};
const allActors=(s:SaveData)=>[s.playerState,...s.allyStates,...s.enemyStates];
function free(s:SaveData,a:Actor,r:BossArena):Point[]{
 const cells:Point[]=[];
 for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++){
  const p={x,y};if(canStand(s.mapState,a,p,allActors(s))&&occupied(a,p).every(q=>inArena(q,r)&&!s.mapState.objects.some(o=>same(o.position,q))))cells.push(p);
 }return cells;
}
function spawn(s:SaveData,boss:Actor,kind:EnemyKind,count:number,c:Context,nearWall=false,delay=0):void{
 const arena=s.mapState.bossArena!;
 for(let i=0;i<count;i++){
  if(kind!=='treantTentacle'&&s.enemyStates.filter(e=>e.hp>0&&e.summonedBy===boss.id&&e.kind!=='treantTentacle').length>=ELDER_RULES.summon.limit)break;
  let id=`elder-${boss.id}-${s.playerActionCount}-${s.enemyStates.length}`;
  while(s.enemyStates.some(e=>e.id===id))id+='-new';
  const enemy=actor(id,kind,boss.position,s.stageId,s.floorNumber);
  let cells=free(s,enemy,arena);if(nearWall){const edge=cells.filter(p=>occupied(enemy,p).some(q=>Object.values(VECTORS).some(v=>wall(s.mapState,{x:q.x+v.x,y:q.y+v.y})))) ;if(edge.length)cells=edge;}
  if(!cells.length)break;
  enemy.position={...cells[c.rng.int(0,cells.length-1)]};enemy.summonedBy=boss.id;enemy.mode='hostile';enemy.lastSeen={...s.playerState.position};enemy.alertedAt=s.playerActionCount;
  // そのターンの敵ループへ追加されても、召喚直後には行動しない。
  enemy.stunnedUntil=s.playerActionCount+1;s.enemyStates.push(enemy);
  c.events.push({type:'trap',actorId:enemy.id,position:{...enemy.position},visual:'summonRing',sound:'magicCast',delayMs:delay,durationMs:600});
 }
}
function southWarp(s:SaveData,boss:Actor,c:Context):void{
 const cells=free(s,s.playerState,s.mapState.bossArena!);if(!cells.length)return;
 const south=Math.max(...cells.map(p=>p.y)),pool=cells.filter(p=>p.y>=south-1),from={...s.playerState.position};
 s.playerState.position={...pool[c.rng.int(0,pool.length-1)]};
 c.events.push({type:'cast',actorId:s.playerState.id,skillId:'warp',enemySkillId:'elderTransfer',position:from,target:{...s.playerState.position},sound:'magicCast',delayMs:650,durationMs:650});
 c.events.push({type:'cast',actorId:boss.id,position:{...boss.position},attribute:'earth',castingAura:true,durationMs:1300});
}
/** HP閾値は一度ずつ。大ダメージで両方跨いだ場合も各段階の召喚を実行。 */
export function elderPhases(s:SaveData,boss:Actor,c:Context):void{
 if(boss.kind!=='elderTreant'||boss.hp<=0||!s.mapState.bossArena?.started||s.mapState.bossArena.bossId!==boss.id)return;
 boss.bossPhases??=[];
 for(const hp of ELDER_RULES.phases){
  if(boss.hp>=hp||boss.bossPhases.includes(hp))continue;
  boss.bossPhases.push(hp);boss.mp=boss.maxMp;southWarp(s,boss,c);
  spawn(s,boss,'treantTentacle',ELDER_RULES.phaseTentacles,c,false,1300);
  spawn(s,boss,'treant',ELDER_RULES.phaseTreants,c,true,1300);
  spawn(s,boss,'greaterCrystalFlower',ELDER_RULES.phaseFlowers,c,true,1300);
  c.log('エルダー・トレントが根を広げた！ 旅人は南へ押し戻され、地底の森が目を覚ます。');
 }
}
function arenaCells(r:BossArena):Point[]{return Array.from({length:r.width*r.height},(_,i)=>({x:r.x+i%r.width,y:r.y+Math.floor(i/r.width)}));}
export function actElder(s:SaveData,boss:Actor,c:Context):boolean{
 if(boss.kind!=='elderTreant')return false;
 const r=s.mapState.bossArena;if(!r?.started||r.bossId!==boss.id||c.events.some(e=>e.bossIntro&&e.actorId===boss.id))return true;
 elderPhases(s,boss,c);
 const roll=c.rng.next();let boundary=0;
 const chosen=(Object.keys(ELDER_RULES.chances) as (keyof typeof ELDER_RULES.chances)[]).find(k=>roll<(boundary+=ELDER_RULES.chances[k]));
 const targets=[s.playerState,...s.allyStates].filter(a=>a.hp>0&&occupied(a).some(p=>inArena(p,r)));
 const fallback=()=>{const t=targets.find(t=>canMeleeAttack(boss,t));if(t){faceToward(boss,t.position);c.events.push({type:'attack',actorId:boss.id,position:{...boss.position},target:{...t.position},visual:'strike'});c.hit(boss,t,attackPower(boss),boss.attribute,'攻撃');}};
 if(!chosen||(boss.mp??0)<ELDER_RULES.mp[chosen]||!targets.length||chosen==='vine'&&!boss.bossPhases?.length){fallback();return true;}
 const power=attackPower(boss),cells=arenaCells(r).filter(p=>!wall(s.mapState,p));
 let path:Point[]=[],visual:GameEvent['visual']='summonRing',name='召喚';
 if(chosen==='rock'){
  const candidates=cells.filter(p=>p.x+1<r.x+r.width&&p.y+1<r.y+r.height);if(!candidates.length){fallback();return true;}
  const position=candidates[c.rng.int(0,candidates.length-1)];
  (s.mapState.delayedRocks??=[]).push({position,dueAt:s.playerActionCount+1,damage:power*(.8+c.rng.next()*.4),owner:'enemy',sourceId:boss.id});
  path=[position];visual='largeRock';name='大落石の予兆';
 }else if(chosen==='sweep'){
  const t=targets.find(t=>occupied(t).some(p=>occupied(boss).some(q=>Math.max(Math.abs(p.x-q.x),Math.abs(p.y-q.y))===1)));
  if(!t){fallback();return true;}faceToward(boss,t.position);
  const v=VECTORS[boss.facing],side={x:-v.y,y:v.x},body=occupied(boss),front=body.filter(p=>!body.some(q=>same(q,{x:p.x+v.x,y:p.y+v.y})));
  const raw=front.flatMap(p=>[-1,0,1].map(n=>({x:p.x+v.x+side.x*n,y:p.y+v.y+side.y*n}))).concat(body.flatMap(p=>[-1,1].map(n=>({x:p.x+side.x*n,y:p.y+side.y*n}))));
  path=raw.filter((p,i)=>!body.some(q=>same(p,q))&&!wall(s.mapState,p)&&raw.findIndex(q=>same(p,q))===i);visual='strike';name='薙ぎ払い';
  for(const target of targets)if(occupied(target).some(p=>path.some(q=>same(p,q))))c.hit(boss,target,power*(.4+c.rng.next()*.2),'physical',name);
 }else if(chosen==='summon'){
  const count=c.rng.int(ELDER_RULES.summon.min,ELDER_RULES.summon.max),kinds:EnemyKind[]=['treant','earthFlower','greaterCrystalFlower'];
  for(let i=0;i<count;i++)spawn(s,boss,kinds[c.rng.int(0,kinds.length-1)],1,c);
  spawn(s,boss,'treantTentacle',ELDER_RULES.summon.tentacles,c);
 }else{
  if(chosen==='gust'){path=cells;name='暴風';c.log('草木が激しく揺れだした…次の行動で暴風が来る！');}
  else {const p=targets[c.rng.int(0,targets.length-1)].position,both=(boss.bossPhases?.length??0)>=2,vertical=c.rng.next()<.5;path=cells.filter(q=>both?q.x===p.x||q.y===p.y:vertical?q.x===p.x:q.y===p.y);name='大ツタ攻撃';c.log('地面に巨大な根の影が走る…！');}
  (s.mapState.bossHazards??=[]).push({kind:chosen,sourceId:boss.id,dueAt:s.playerActionCount+1,cells:path,power});
 }
 boss.mp=(boss.mp??0)-ELDER_RULES.mp[chosen];
 c.events.push({type:'cast',actorId:boss.id,position:{...boss.position},path:chosen==='gust'||chosen==='vine'?[]:path,attribute:chosen==='gust'?'wind':'earth',visual:chosen==='rock'?undefined:visual,castingAura:true,sound:'magicCast',durationMs:600});
 c.log(boss.name+'の「'+name+'」！');return true;
}
/** 予告した次の行動に解決。大ツタはボス・触手以外の味方モンスターも巻き込む。 */
export function tickBossHazards(s:SaveData,c:Context):void{
 const due=(s.mapState.bossHazards??[]).filter(h=>h.dueAt<=s.playerActionCount);
 s.mapState.bossHazards=s.mapState.bossHazards?.filter(h=>h.dueAt>s.playerActionCount);
 for(const h of due){
  const boss=s.enemyStates.find(a=>a.id===h.sourceId&&a.hp>0);if(!boss)continue;
  c.events.push({type:'trap',actorId:boss.id,position:{...boss.position},path:h.cells,attribute:h.kind==='gust'?'wind':'earth',visual:h.kind==='gust'?'gale':'vineStrike',castingAura:true,sound:h.kind==='gust'?'howl':'strike',durationMs:850});
  const start=c.events.length;
  const targets=h.kind==='gust'?[s.playerState,...s.allyStates]:allActors(s).filter(a=>a.kind!=='elderTreant'&&a.kind!=='treantTentacle');
  for(const t of targets)if(t.hp>0&&occupied(t).some(p=>h.cells.some(q=>same(p,q))))c.hit(boss,t,h.power*(h.kind==='gust'?.3:1),h.kind==='gust'?'wind':'earth',h.kind==='gust'?'暴風':'大ツタ攻撃');
  for(const e of c.events.slice(start))e.delayMs=(e.delayMs??0)+280;
  if(h.kind==='gust'&&s.playerState.hp>0){
   const p=s.playerState,from={...p.position};for(let i=0;i<ELDER_RULES.pushDistance;i++){const next={x:p.position.x,y:p.position.y+1};if(!canStand(s.mapState,p,next,allActors(s)))break;p.position=next;}
   c.events.push({type:'cast',actorId:p.id,position:from,target:{...p.position},enemySkillId:'elderGust',attribute:'wind',delayMs:550,durationMs:400});
  }
 }
}
