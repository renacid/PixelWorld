import { expect, it } from 'vitest';
import { autoPlace, placementOrigins } from '../src/skills/SkillBag';
import type { BagBlock } from '../src/game/types';
import { GameSession } from '../src/game/GameSession';
import { actor } from '../src/actors/Actor';
import { tryEnemySkill } from '../src/skills/EnemySkillResolver';
import { movementLocked } from '../src/game/ActorStats';

it('90度回転で左上が未解放でも、実ブロックが収まる位置を見つける',()=>{
 const bag:BagBlock[]=[{skillId:'thunderArmor',position:{x:3,y:3},rotation:0}];
 const available=[{x:1,y:0},{x:0,y:1},{x:3,y:3},{x:4,y:4}];
 expect(placementOrigins(bag,'thunderArmor',1,available)).toContainEqual({x:0,y:0});
 bag[0].position=null;bag[0].rotation=1;autoPlace(bag,'thunderArmor',available.slice(0,2));
 expect(bag[0]).toMatchObject({position:{x:0,y:0},rotation:1});
});

function setup(){const g=GameSession.create(1,123);g.state.mapState.tiles.fill(0);g.state.mapState.objects=[];g.state.mapState.traps=[];g.state.mapState.installations=[];g.state.playerState.position={x:8,y:8};return g;}
it('落下攻撃は命中候補のみから選び、命中候補がなければMPを消費しない',()=>{
 for(let n=0;n<12;n++){
  const g=setup(),e=actor('stone','stoneSlime',{x:8,y:10});e.enemySkillIds=['fallingStrike'];e.skillChances={fallingStrike:1};
  const hits:number[]=[];const c={rng:g.rng,action:1,map:g.state.mapState,actors:[e,g.state.playerState],allies:[e],events:g.events,damage:(_:unknown,amount:number)=>{hits.push(amount);},log:()=>{}};
  for(let i=0;i<n;i++)g.rng.next();
  expect(tryEnemySkill(e,[g.state.playerState],c)).toBe(true);expect(hits).toHaveLength(1);
  e.position={x:14,y:14};e.mp=5;hits.length=0;expect(tryEnemySkill(e,[g.state.playerState],c)).toBe(false);expect(e.mp).toBe(5);
 }
});
it('地晶花は移動後だけ翌ターン移動不可になり、攻撃や待機では期限を延長しない',()=>{
 const g=setup(),e=actor('flower','earthFlower',{x:8,y:11});e.enemySkillIds=[];e.pattern='wait';g.state.enemyStates=[e];
 g.execute({type:'wait'});expect(e.position).toEqual({x:8,y:10});expect(movementLocked(e,g.state.playerActionCount)).toBe(true);
 const until=e.movementLockedUntil;g.execute({type:'wait'});expect(e.position).toEqual({x:8,y:10});expect(e.movementLockedUntil).toBe(until);
 g.execute({type:'wait'});expect(e.position).toEqual({x:8,y:9});const afterMove=e.movementLockedUntil;
 g.execute({type:'wait'});g.execute({type:'wait'});expect(e.position).toEqual({x:8,y:9});expect(e.movementLockedUntil).toBe(afterMove);
});
