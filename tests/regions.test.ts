import { describe, expect, it } from 'vitest';
import { STAGES, REGIONS } from '../src/stages';
import { generateMap, wall, occupied, canStand } from '../src/game/MapState';
import { stageForFloor } from '../src/stages/DungeonRules';
import { Random } from '../src/game/Random';
import { GameSession } from '../src/game/GameSession';
import { actor } from '../src/actors/Actor';
import { rollChest } from '../src/game/LootSystem';
import { tryEnemySkill } from '../src/skills/EnemySkillResolver';
import { actEnemy } from '../src/ai/EnemyAI';

describe('地域・階層設定とゴーレム', () => {
 it('全公開ステージ・全階層で目標が配置され、石板と出口へ到達できる', () => {
  expect(REGIONS.map(r => r.id)).toEqual(['plains', 'forest', 'cave']);
  for (const base of STAGES) for(let floor=1;floor<=(base.dungeon?.floors??1);floor++) for(const seed of [3, 29]) {
   const stage=stageForFloor(base,floor), {map,enemies,spawn}=generateMap(base,new Random(seed),floor);
   const queue=[spawn], seen=new Set([spawn.x+','+spawn.y]);
   for(let i=0;i<queue.length;i++) for(const d of [{x:0,y:1},{x:1,y:0},{x:0,y:-1},{x:-1,y:0}]) {
    const p={x:queue[i].x+d.x,y:queue[i].y+d.y}, key=p.x+','+p.y;
    if(!seen.has(key)&&!wall(map,p)){seen.add(key);queue.push(p);}
   }
   for(const o of map.objects) expect(seen.has(o.position.x+','+o.position.y), base.code+' floor '+floor+' '+o.id).toBe(true);
   for(const e of enemies) expect(canStand(map,e,e.position,enemies)).toBe(true);
   const goal=stage.clearCondition;
   if(goal?.type==='records') expect(map.objects.filter(o=>o.type==='record').length).toBeGreaterThanOrEqual(goal.count);
   if(goal?.type==='defeat') expect(enemies.filter(e=>e.kind===goal.kind).length).toBeGreaterThanOrEqual(goal.count);
   if(base.id===4) expect(enemies.some(e=>e.kind==='golem')).toBe(false);
   if(base.id===5) expect(enemies.filter(e=>e.kind==='golem').length).toBe(floor===2?1:0);
  }
 });
 it('討伐実績で階層の目標達成を判定し、単なる敵の削除では達成しない',()=>{
  const s=GameSession.create(4,2);s.state.enemyStates=[];expect(s.goalReady()).toBe(false);
  s.state.floorKills={wolf:3};expect(s.goalReady()).toBe(true);s.state.floorNumber=2;expect(s.goalReady()).toBe(false);
  s.state.floorKills.wolf=4;expect(s.goalReady()).toBe(true);
 });
 it('石板は道具枠を使用せず、独自の取得音を発生する',()=>{
  const s=GameSession.create(1,3), record=s.state.mapState.objects.find(o=>o.type==='record')!;
  s.state.itemSlots=['potion','potion','potion'];s.state.playerState.position={...record.position};s.collect();
  expect(s.state.objectiveChests).toBe(1);expect(s.state.itemSlots).toHaveLength(3);
  expect(s.events.some(e=>e.sound==='ancientRecord')).toBe(true);expect(s.state.mapState.objects.includes(record)).toBe(false);
 });
 it('階層の抽選表がカテゴリ単位で上書きされ、金箱でも指定プールを使う',()=>{
  const base={...STAGES[0],loot:{items:[{value:'potion' as const,weight:1}],rareItems:[],skills:[{value:'tornado' as const,weight:1}]},floorSettings:{2:{loot:{skills:[{value:'icestone' as const,weight:1}]}}}};
  const s=stageForFloor(base,2);expect(s.loot!.items).toEqual(base.loot.items);
  for(let seed=0;seed<5;seed++){const loot=rollChest('gold',new Random(seed),[],2,s.loot);expect(loot.filter(e=>e.type==='skill').map(e=>e.id)).toEqual(['icestone']);}
 });
 it('ゴーレムの周囲12マスへの強打撃、射程外不発、MP消費',()=>{
  const s=GameSession.create(1,4);s.state.mapState.tiles.fill(0);
  const e=actor('g','golem',{x:5,y:5}), p=s.state.playerState;p.position={x:4,y:4};
  e.skillChances={quietGaze:0,rockThrow:0,heavyStrike:1}; const hits:number[]=[];
  const context={action:1,allies:[e],map:s.state.mapState,actors:[e,p],rng:new Random(2),events:[],damage:(_t:unknown,n:number)=>{hits.push(n)},log:()=>{}};
  expect(occupied(e)).toHaveLength(4);expect(e.hp).toBe(50);expect(tryEnemySkill(e,[p],context)).toBe(true);expect(e.mp).toBe(14);expect(hits[0]).toBeGreaterThanOrEqual(6);expect(hits[0]).toBeLessThanOrEqual(7.5);
  p.position={x:3,y:3};expect(tryEnemySkill(e,[p],{...context,action:2})).toBe(false);
 });
 it('通常攻撃は前方の幅2マスに命中する',()=>{
  const s=GameSession.create(1,4);s.state.mapState.tiles.fill(0);
  const e=actor('g','golem',{x:5,y:5}), p=s.state.playerState, ally=actor('a','sprite',{x:6,y:7});p.position={x:5,y:7};
  const victims:string[]=[];actEnemy(s.state.mapState,e,[p,ally],[e,p,ally],new Random(2),(_e,t)=>victims.push(t.id));
  expect(victims).toEqual([p.id,ally.id]);expect(e.facing).toBe('down');
 });
});
