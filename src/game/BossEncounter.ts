/** ボス専用の数値と行動。配置エリアはStageLayout.bossArenaで指定する。 */
import { actor } from '../actors/Actor';
import { canMeleeAttack, faceToward, moveToward } from '../ai/EnemyAI';
import { applyBuff, attackPower, movementLocked } from './ActorStats';
import { canStand, occupied, same, wall } from './MapState';
import type { Actor, Attribute, GameEvent, Point, SaveData } from './types';
import type { Random } from './Random';
import { dealAttributeHit, type DamageHandler } from '../skills/AttributeSystem';
export type BossArena = { x:number; y:number; width:number; height:number; started?:boolean };
export const KING_RULES = { linkTurns:100, linkDamage:5, thresholds:[200,100], bannerCount:2, nestCount:2, phaseMp:40,
  rock:{chance:.2,mp:3,radius:2,hits:15,ratio:.3}, bottle:{chance:.2,mp:3,ratio:.5,floorRatio:.3,turns:3},
  summon:{chance:.1,mp:30,count:5,limit:7,radius:4} };
type Context = { rng:Random; events:GameEvent[]; log:(s:string)=>void; hit:(a:Actor,b:Actor,n:number,attribute:Attribute,label:string)=>void };
export const isGoblin = (a:Actor) => a.kind.startsWith('goblin') && a.kind!=='goblinKing';
const near=(a:Point,b:Point,r:number)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))<=r;
export const inArena=(p:Point,r:BossArena)=>p.x>=r.x&&p.y>=r.y&&p.x<r.x+r.width&&p.y<r.y+r.height;
/** 火炎瓶の床は移動直後にだけ命中。待機や着火した瞬間には重複命中しない。 */
export function contactBossFire(s:SaveData,target:Actor,damage:DamageHandler,events:GameEvent[],rng:Random):void {
 for(const f of s.mapState.fields)if(f.effectId.startsWith('king-fire-')&&f.remainingTurns>0&&target.hp>0&&occupied(target).some(p=>same(p,f.position)))
  dealAttributeHit(target,(f.power??6)*f.damageMultiplier,'fire',s.playerActionCount,[s.playerState,...s.allyStates],damage,events,()=>rng.next());
}
export function startBoss(s:SaveData,events:GameEvent[]):void {
 const arena=s.mapState.bossArena,king=s.enemyStates.find(e=>e.kind==='goblinKing'&&e.hp>0);
 if(!arena||arena.started||!king||!inArena(s.playerState.position,arena))return;
 arena.started=true;for(const enemy of s.enemyStates)if(enemy.hp>0&&inArena(enemy.position,arena)){enemy.mode='hostile';enemy.lastSeen={...s.playerState.position};}king.bossLinkUntil=s.playerActionCount+KING_RULES.linkTurns;
 king.mode='hostile';king.lastSeen={...s.playerState.position};
 events.push({type:'trap',position:{...king.position},bossIntro:true,actorId:king.id,sound:'magicCast'});
}
function freeCells(s:SaveData,king:Actor,region:BossArena):Point[]{
 const result:Point[]=[],actors=[s.playerState,...s.allyStates,...s.enemyStates];
 for(let y=region.y;y<region.y+region.height;y++)for(let x=region.x;x<region.x+region.width;x++){
  const p={x,y};if(canStand(s.mapState,king,p,actors)&&!same(p,king.position)&&!s.mapState.objects.some(o=>same(o.position,p))&&!s.mapState.traps?.some(t=>!t.triggered&&same(t.position,p))&&!s.mapState.fields.some(f=>same(f.position,p)))result.push(p);
 }return result;
}
/** 戦旗の同IDバフは毎ターン更新。同じ効果を重ねて加算しない。 */
export function tickBanners(s:SaveData):void {
 for(const flag of s.mapState.installations??[])if(flag.kind==='goblinBanner')for(const a of s.enemyStates)
  if(a.hp>0&&(isGoblin(a)||a.kind==='goblinKing')&&near(a.position,flag.position,2))applyBuff(a,{id:'goblinWarBanner',name:'戦旗の鼓舞',remainingTurns:2,appliedAt:s.playerActionCount,attackBonus:1,attackMultiplier:1,detectionBonus:0});
}
/** 閾値を一撃で複数跨いだ場合もそれぞれ一度ずつ発生。撃破後は発生しない。 */
export function kingPhases(s:SaveData,king:Actor,c:Context):void {
 const arena=s.mapState.bossArena;if(!arena?.started||king.hp<=0)return;
 king.bossPhases??=[];
 for(const threshold of KING_RULES.thresholds){
  if(king.hp>threshold||king.bossPhases.includes(threshold))continue;
  king.bossPhases.push(threshold);const cells=freeCells(s,king,arena),from={...king.position};
  if(cells.length)king.position=cells.splice(c.rng.int(0,cells.length-1),1)[0];
  c.events.push({type:'attack',actorId:king.id,position:from,target:{...king.position},bossJump:true,visual:'strike',sound:'rocks',delayMs:1000,durationMs:750});
  king.mp=Math.min(king.maxMp??50,(king.mp??0)+KING_RULES.phaseMp);
  for(const kind of [...Array(KING_RULES.bannerCount).fill('goblinBanner'),...Array(threshold===100?KING_RULES.nestCount:0).fill('goblinNest')] as ('goblinBanner'|'goblinNest')[]){
   const available=freeCells(s,king,arena);if(!available.length)break;
   const position=available[c.rng.int(0,available.length-1)];
   (s.mapState.installations??=[]).push({id:`king-${king.id}-${threshold}-${kind}-${s.mapState.installations!.length}`,kind,position,spawned:0});
   c.events.push({type:'trap',position,visual:'summonRing',sound:'rocks',delayMs:1750});
  }
  c.log(king.name+'が大ジャンプ！ 戦旗を掲げ、MPを回復した！');
 }
}
/** trueならボスが行動を担当済み。隣接攻撃を必ず優先する。 */
export function actKing(s:SaveData,king:Actor,c:Context):boolean {
 if(king.kind!=='goblinKing')return false;
 const arena=s.mapState.bossArena;if(!arena?.started)return true;
 if(c.events.some(e=>e.bossIntro&&e.actorId===king.id))return true;
 kingPhases(s,king,c);
 const targets=[s.playerState,...s.allyStates].filter(t=>t.hp>0);
 const melee=targets.find(t=>canMeleeAttack(king,t));
 if(melee){king.facing=faceToward(king,melee.position);c.events.push({type:'attack',actorId:king.id,position:{...king.position},target:{...melee.position}});c.hit(king,melee,attackPower(king),'physical','攻撃');return true;}
 const roll=c.rng.next(),rock=KING_RULES.rock,bottle=KING_RULES.bottle,summon=KING_RULES.summon;
 if(roll<rock.chance&&(king.mp??0)>=rock.mp&&targets.some(t=>occupied(t).some(p=>near(p,king.position,rock.radius)))){
  c.events.push({type:'cast',actorId:king.id,position:{...king.position},attribute:'earth',castingAura:true,durationMs:(rock.hits-1)*110+300});king.mp!-=rock.mp;const cells:Point[]=[];for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++){const p={x:king.position.x+x,y:king.position.y+y};if(!wall(s.mapState,p))cells.push(p);}
  for(let i=0;i<rock.hits&&cells.length&&king.hp>0;i++){const p=cells[c.rng.int(0,cells.length-1)],start=c.events.length;
   c.events.push({type:'trap',position:p,path:[p],visual:'fallingRocks',sound:'rocks',durationMs:300});
   for(const t of targets)if(t.hp>0&&occupied(t).some(q=>same(p,q)))c.hit(king,t,attackPower(king)*rock.ratio,'earth','落石');
   for(const event of c.events.slice(start))event.delayMs=(event.delayMs??0)+i*110;
  }c.log(king.name+'の落石！');return true;
 }
 const bottleTarget=targets.find(t=>occupied(t).some(p=>{const x=Math.abs(p.x-king.position.x),y=Math.abs(p.y-king.position.y);return (x===0||y===0)&&Math.max(x,y)<=3||x===y&&x<=2;}));
 if(roll>=.2&&roll<.4&&bottleTarget&&(king.mp??0)>=bottle.mp){
  king.mp!-=bottle.mp;const p={...bottleTarget.position};c.events.push({type:'cast',actorId:king.id,position:{...king.position},target:p,skillId:'fireball',attribute:'fire',castingAura:true,sound:'magicCast'});
  c.hit(king,bottleTarget,attackPower(king)*bottle.ratio,'fire','火炎瓶');
  for(const [x,y] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const position={x:p.x+x,y:p.y+y};if(!wall(s.mapState,position))s.mapState.fields.push({effectId:`king-fire-${s.playerActionCount}-${x}-${y}`,position,attribute:'fire',remainingTurns:bottle.turns+1,triggerType:'enter',damageMultiplier:bottle.floorRatio,power:attackPower(king),onceOnly:false});}
  return true;
 }
 if(roll>=.4&&roll<.5&&(king.mp??0)>=summon.mp){
  const alive=s.enemyStates.filter(a=>a.hp>0&&a.summonedBy===king.id).length;
  const cells=freeCells(s,king,{x:king.position.x-4,y:king.position.y-4,width:9,height:9}).filter(p=>inArena(p,arena));
  const count=Math.min(summon.count,summon.limit-alive,cells.length);
  if(count>0){king.mp!-=summon.mp;for(let i=0;i<count;i++){const position=cells.splice(c.rng.int(0,cells.length-1),1)[0],a=actor(`king-summon-${s.playerActionCount}-${i}`,c.rng.next()<.5?'goblin':'goblinArcher',position,s.stageId,s.floorNumber);a.summonedBy=king.id;a.mode='hostile';a.lastSeen={...s.playerState.position};s.enemyStates.push(a);c.events.push({type:'trap',position,visual:'summonRing',sound:'rocks'});}c.log(king.name+'の突撃号令！ '+count+'体を召喚！');return true;}
 }
 if(!movementLocked(king,s.playerActionCount)&&targets.length){const blockers=[s.playerState,...s.allyStates,...s.enemyStates],before={...king.position};moveToward(s.mapState,king,targets[0].position,blockers,c.rng,s.playerActionCount);if(!inArena(king.position,arena))king.position=before;}
 return true;
}
