import { targetableCrystals } from '../game/CrystalTargets';
import type { SaveData, GameEvent, Point, ThunderPrison } from '../game/types';
import type { Random } from '../game/Random';
import { attackPower } from '../game/ActorStats';
import { occupied, same, wall } from '../game/MapState';
import { crystalSource } from '../game/CrystalSystem';
import { hitInstallation } from '../game/InstallationSystem';
import { dealAttributeHit, type DamageHandler } from './AttributeSystem';
import { effectiveLevel, connectionDamageMultiplier } from './SkillBag';
type Context={rng:Random;events:GameEvent[];damage:DamageHandler;log:(message:string)=>void};
/** 予告を作る時だけ現在地を参照。表示済みの影は着弾まで固定。 */
function chooseCells(s:SaveData,c:Context):Point[]{
 const p=s.playerState.position,pool:Point[]=[];
 for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++){const cell={x:p.x+x,y:p.y+y};if(!wall(s.mapState,cell))pool.push(cell);}
 const cells:Point[]=[];while(cells.length<9&&pool.length)cells.push(pool.splice(c.rng.int(0,pool.length-1),1)[0]);return cells;
}
export function startThunderPrison(s:SaveData,c:Context):void{
 const level=effectiveLevel(s.skillBag,s.skillLevels,'thunderPrison');
 const list=s.mapState.thunderPrisons??=[];let id='storm-'+s.playerActionCount;while(list.some(t=>t.id===id))id+='-new';
 list.push({id,startedAt:s.playerActionCount,lastProcessedAt:s.playerActionCount,cells:chooseCells(s,c),power:attackPower(s.playerState)*(1+(level-1)*.05)*connectionDamageMultiplier(s.skillBag,'thunderPrison'),source:crystalSource(s,s.playerState),criticalRate:s.playerState.criticalRate,criticalMultiplier:s.playerState.criticalMultiplier});
 c.events.push({type:'cast',skillId:'thunderPrison',position:{...s.playerState.position},sound:'magicCast'});c.log('雷雲獄！ 落雷の影が現れた。');
}
/** 発動=0として1/3/5行動後に落雷、2/4行動後に予告。道具使用では呼ばない。 */
export function tickThunderPrisons(s:SaveData,c:Context):void{
 for(const storm of s.mapState.thunderPrisons??[]){
  if(storm.lastProcessedAt>=s.playerActionCount)continue;
  storm.lastProcessedAt=s.playerActionCount;const age=s.playerActionCount-storm.startedAt;
  if(age>=6)continue;
  if(age%2===0){storm.cells=chooseCells(s,c);c.log('雷雲獄！ 新たな落雷の影が現れた。');continue;}
  const sums=new Map<string,{name:string;amount:number}>();
  for(const cell of storm.cells){
   const targets=s.enemyStates.filter(e=>e.hp>0&&occupied(e).some(p=>same(p,cell)));
   for(let hit=0;hit<2;hit++){
    const delay=hit*210;
    c.events.push({type:'cast',skillId:'thunderPrison',position:{...cell},target:{...cell},path:[{...cell}],attribute:'thunder',sound:hit===0?'magicCast':undefined,delayMs:delay,durationMs:300});
    for(const target of targets)if(target.hp>0){
     const critical=c.rng.next()<storm.criticalRate,raw=storm.power*(.7+c.rng.next()*.3)*(critical?storm.criticalMultiplier:1),start=c.events.length;
     dealAttributeHit(target,raw,'thunder',s.playerActionCount,s.enemyStates,c.damage,c.events,()=>c.rng.next(),critical,true,storm.source);
     for(const event of c.events.slice(start)){event.delayMs=delay+120;if(event.type==='damage'){const a=s.enemyStates.find(e=>e.id===event.actorId),key=event.actorId??'';const sum=sums.get(key)??{name:a?.name??'対象',amount:0};sum.amount+=event.amount??0;sums.set(key,sum);}}
    }
    for(const object of [...s.mapState.installations??[],...targetableCrystals(s.mapState,s.playerActionCount)])if(same(object.position,cell))hitInstallation(s,object.id,c);
   }
  }
  c.log('雷雲獄！ '+(sums.size?[...sums.values()].map(t=>t.name+'に合計'+t.amount+'ダメージ！').join(' '):'雷が降り注いだ。'));
  storm.cells=[];
 }
 s.mapState.thunderPrisons=s.mapState.thunderPrisons?.filter(t=>s.playerActionCount-t.startedAt<5);
}
