import { expect, it } from 'vitest';
import { GameSession } from '../src/game/GameSession';
import { actor } from '../src/actors/Actor';
import { enemyFloorMultiplier } from '../src/stages/DungeonRules';
import { STAGES } from '../src/stages';
import { breathCells, placeBreathPillars } from '../src/skills/BlizzardBreath';
import { tryEnemySkill } from '../src/skills/EnemySkillResolver';
import { tickDelayedRocks } from '../src/game/TrapSystem';
import { generateMap, occupied, same } from '../src/game/MapState';
import { Random } from '../src/game/Random';
import { projectFromJson, validateProject, exportStage } from '../src/dev/DungeonEditorModel';
import cave from '../src/stages/cave/3-4.json';
function game(){
 const g=GameSession.create(1,123),s=g.state;
 s.mapState.tiles.fill(7);s.mapState.objects=[];s.mapState.traps=[];s.mapState.installations=[];s.mapState.fields=[];s.mapState.crystals=[];
 s.enemyStates=[];s.allyStates=[];s.playerState.position={x:10,y:10};s.playerState.mp=s.playerState.maxMp=100;s.playerActionCount=10;
 return g;
}
it('階層ごとの総倍率は旧設定と重複せず、未指定は従来互換',()=>{
 const stage=structuredClone(STAGES.find(s=>s.code==='3-2')!);
 expect([1,2,3].map(f=>enemyFloorMultiplier(stage,f))).toEqual([1,1.25,1.55]);
 delete stage.floorSettings![3].enemyMultiplier;
 expect(enemyFloorMultiplier(stage,3)).toBe(1.2);
 const enemy=actor('e','greaterCrystalFlower',{x:2,y:2},15,3);
 expect([enemy.hp,enemy.attack,enemy.mp]).toEqual([142,11,57]);
});
it('ブレスは四方向とも16→25→36マス、壁・壺の裏を除外',()=>{
 const s=game().state;
 for(const [lv,count] of [[1,16],[3,25],[5,36]]){
  s.skillLevels.blizzardBreath=lv;
  for(const d of ['up','down','left','right'] as const)expect(breathCells(s,d)).toHaveLength(count);
 }
 s.mapState.installations=[{id:'pot',kind:'pot',spawned:0,position:{x:10,y:11}}];
 expect(breathCells(s,'down').some(p=>p.x===10&&p.y===11)).toBe(true);
 expect(breathCells(s,'down').some(p=>p.x===10&&p.y===12)).toBe(false);
 s.mapState.tiles[11*s.mapState.width+10]=9;
 expect(breathCells(s,'down')).toHaveLength(0);
});
it('ブレス後の氷柱は3→5→10本、敵や物に重ならず命中後の演出',()=>{
 for(const [lv,count] of [[1,3],[3,5],[5,10]]){
  const g=game(),s=g.state;s.skillLevels.blizzardBreath=lv;s.playerState.criticalRate=0;
  const e=actor('e','golem',{x:10,y:11});s.enemyStates=[e];
  g.cast('blizzardBreath','down');
  expect(e.hp).toBeLessThan(e.maxHp);
  expect(s.mapState.installations).toHaveLength(count);
  expect(s.mapState.installations!.every(p=>!occupied(e).some(q=>same(q,p.position)))).toBe(true);
  expect(g.events.filter(e=>e.type==='damage').every(e=>(e.delayMs??0)>=650)).toBe(true);
  expect(g.events.filter(e=>e.visual==='iceLance').every(e=>(e.delayMs??0)>=900)).toBe(true);
 }
});
function context(s:ReturnType<typeof game>['state']){
 const rng=new Random(1);rng.next=()=>0;
 return {action:s.playerActionCount,map:s.mapState,actors:[s.playerState,...s.enemyStates],allies:s.enemyStates,rng,events:[] as import('../src/game/types').GameEvent[],damage:(a:import('../src/game/types').Actor,n:number)=>{a.hp-=Math.floor(n);},log:()=>{}};
}
it('大結晶花は非敵視では召喚しない・敵視中は半分経験値で召喚',()=>{
 const s=game().state,caster=actor('flower','greaterCrystalFlower',{x:8,y:8},15,2);s.enemyStates=[caster];
 caster.enemySkillIds=['summonFlower'];const c=context(s);let multiplier=0;
 const spawn=(kind:import('../src/data/enemies').EnemyKind,p:import('../src/game/types').Point,m:number)=>{multiplier=m;return actor('summoned',kind,p,15,2);};
 expect(tryEnemySkill(caster,[s.playerState],{...c,spawn})).toBe(false);
 caster.mode='hostile';expect(tryEnemySkill(caster,[s.playerState],{...c,spawn})).toBe(true);
 expect(multiplier).toBe(.5);expect(caster.mp).toBe(37);
});
it('大落石は体の周囲3マスの8×8内に2×2で予告し次の行動に落下',()=>{
 const s=game().state,caster=actor('flower','greaterCrystalFlower',{x:8,y:8});caster.mode='hostile';caster.enemySkillIds=['delayedBoulder'];s.enemyStates=[caster];
 const c=context(s);expect(tryEnemySkill(caster,[s.playerState],c)).toBe(true);
 const rock=s.mapState.delayedRocks![0];expect(rock.position.x).toBeGreaterThanOrEqual(5);expect(rock.position.x+1).toBeLessThanOrEqual(12);
 expect(rock.damage).toBeCloseTo(7.8);
 tickDelayedRocks(s,c);expect(s.mapState.delayedRocks).toHaveLength(1);
 s.playerState.position={...rock.position};const hp=s.playerState.hp;s.playerActionCount++;
 tickDelayedRocks(s,c);expect(s.mapState.delayedRocks).toHaveLength(0);expect(s.playerState.hp).toBeLessThan(hp);
});
it('転移は大型の全占有を確保し、ツタは1行動の移動不可を付与',()=>{
 const s=game().state,caster=actor('flower','greaterCrystalFlower',{x:5,y:5});caster.mode='hostile';s.enemyStates=[caster];
 caster.enemySkillIds=['approachTeleport'];const before={...caster.position};expect(tryEnemySkill(caster,[s.playerState],context(s))).toBe(true);
 expect(caster.position).not.toEqual(before);expect(occupied(caster).some(p=>same(p,s.playerState.position))).toBe(false);
 caster.position={x:8,y:8};s.playerState.position={x:11,y:8};caster.enemySkillIds=['bindingVine'];
 expect(tryEnemySkill(caster,[s.playerState],context(s))).toBe(true);expect(s.playerState.movementLockedUntil).toBe(12);
});
it('洞窟3-4は工房で再編集・出力可能、全階で出口へ接続し2層以降に大型花',()=>{
 const project=projectFromJson(cave);
 expect(validateProject(project)).toEqual([]);
 expect(exportStage(project).floorSettings![2].enemyMultiplier).toBe(1.4);
 const stage=STAGES.find(s=>s.code==='3-4')!;
 for(let f=1;f<=3;f++){
  const generated=generateMap(stage,new Random(77),f);
  expect(generated.enemies.filter(e=>e.kind==='greaterCrystalFlower')).toHaveLength(f-1);
 }
});
