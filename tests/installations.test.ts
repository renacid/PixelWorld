import { describe,it,expect } from 'vitest';
import { GameSession } from '../src/game/GameSession';
import { generateMap,canStand,same,wall } from '../src/game/MapState';
import { STAGES } from '../src/stages';
import { Random } from '../src/game/Random';
import { hitInstallation,moveNearInstallations } from '../src/game/InstallationSystem';
import { previewSkill } from '../src/skills/SkillResolver';
import { actor } from '../src/actors/Actor';
import { tryEnemySkill } from '../src/skills/EnemySkillResolver';
import { SaveManager } from '../src/game/SaveManager';
const fixture=()=>{const s=GameSession.create(1,3);s.state.enemyStates=[];s.state.mapState.tiles.fill(0);s.state.mapState.objects=[];s.state.mapState.fields=[];s.state.mapState.traps=[];s.state.playerState.position={x:5,y:5};return s;};
const nest=(s:GameSession)=>{s.state.mapState.installations=[{id:'nest',kind:'goblinNest',position:{x:8,y:5},spawned:0,overrides:{spawn:{radius:6,chance:1,max:3,pool:[{value:'goblin',weight:1}]}}}];};
const context=(s:GameSession)=>({rng:s.rng,events:s.events,log:(m:string)=>s.log(m)});
describe('設置物',()=>{
 it('森2-3の各層だけに配置し、設置物を迂回して出口・報酬へ到達可能',()=>{
  for(const stage of STAGES)for(let floor=1;floor<=(stage.dungeon?.floors??1);floor++){
   const {map,spawn}=generateMap(stage,new Random(31),floor);
   expect(map.installations?.length??0).toBe(stage.id===8?10:0);
   if(stage.id!==8)continue;
   expect(map.installations!.filter(i=>i.kind==='pot')).toHaveLength(8);
   for(const i of map.installations!)expect([{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}].some(d=>wall(map,{x:i.position.x+d.x,y:i.position.y+d.y}))).toBe(true);
   const queue=[spawn],seen=new Set([JSON.stringify(spawn)]),body=actor('test','slime',spawn);
   for(let n=0;n<queue.length;n++)for(const d of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]){const p={x:queue[n].x+d.x,y:queue[n].y+d.y},key=JSON.stringify(p);if(!seen.has(key)&&canStand(map,body,p)){seen.add(key);queue.push(p);}}
   for(const o of map.objects)expect(seen.has(JSON.stringify(o.position))).toBe(true);
  }
 });
 it('直線攻撃を遮り、一撃で壊れてドロップは一度だけ',()=>{
  const s=fixture();s.state.mapState.installations=[{id:'pot',kind:'pot',position:{x:6,y:5},spawned:0,overrides:{drop:{chance:1,pool:[{value:'potion',weight:1}]}}}];
  const e=actor('e','goblin',{x:7,y:5});s.state.enemyStates=[e];const hp=e.hp;
  expect(previewSkill(s.state,'fireball','right').targetIds).toEqual(['pot']);
  s.cast('fireball','right');expect(e.hp).toBe(hp);expect(s.state.mapState.installations).toHaveLength(0);expect(s.state.mapState.objects).toHaveLength(1);
  expect(hitInstallation(s.state,'pot',context(s))).toBe(false);expect(s.events.some(e=>e.sound==='shatter')).toBe(true);
 });
 it('範囲・複数ヒット・連鎖も設置物を破壊する',()=>{
  for(const id of ['firerain','chainLightning'] as const){const s=fixture();s.state.mapState.installations=[{id:'pot',kind:'pot',position:{x:6,y:5},spawned:0}];s.cast(id,'right');expect(s.state.mapState.installations).toHaveLength(0);expect(s.events.filter(e=>e.sound==='shatter')).toHaveLength(1);}
 });
 it('歩行時だけ抽選し、3体で消える。待機・壁当たりは数えない',()=>{
  const s=fixture();nest(s);s.execute({type:'wait'});expect(s.state.enemyStates).toHaveLength(0);
  s.state.mapState.tiles[5*s.state.mapState.width+4]=1;s.execute({type:'move',direction:'left'});expect(s.state.enemyStates).toHaveLength(0);
  s.execute({type:'move',direction:'up'});expect(s.state.mapState.installations![0].spawned).toBe(1);
  moveNearInstallations(s.state,context(s));moveNearInstallations(s.state,context(s));expect(s.state.enemyStates).toHaveLength(3);expect(s.state.mapState.installations).toHaveLength(0);
 });
 it('範囲外・周囲に空きがない場合は出現しない',()=>{
  const s=fixture();nest(s);s.state.playerState.position={x:1,y:15};moveNearInstallations(s.state,context(s));expect(s.state.enemyStates).toHaveLength(0);
  s.state.playerState.position={x:5,y:5};for(let y=4;y<=6;y++)for(let x=7;x<=9;x++)s.state.mapState.tiles[y*s.state.mapState.width+x]=1;
  moveNearInstallations(s.state,context(s));expect(s.state.enemyStates).toHaveLength(0);expect(s.state.mapState.installations![0].spawned).toBe(0);
 });
 it('敵の投射攻撃も手前の設置物で止まる',()=>{
  const s=fixture();const e=actor('e','goblin',{x:8,y:5});e.skillChances={stoneThrow:1};s.state.enemyStates=[e];s.state.mapState.installations=[{id:'pot',kind:'pot',position:{x:7,y:5},spawned:0}];let damage=false;
  expect(tryEnemySkill(e,[s.state.playerState],{action:1,allies:[e],map:s.state.mapState,actors:[e,s.state.playerState],...context(s),hitInstallation:id=>hitInstallation(s.state,id,context(s)),damage:()=>{damage=true;}})).toBe(true);
  expect(damage).toBe(false);expect(s.state.mapState.installations).toHaveLength(0);
 });
 it('保存・再開後も出現済み数と個別設定を保持',()=>{
  const s=fixture();nest(s);s.state.mapState.installations![0].spawned=2;let raw='';const store=new SaveManager({getItem:()=>raw,setItem:(_k,v)=>{raw=v;},removeItem:()=>{raw='';}});
  expect(store.save(s.state)).toBe(true);const restored=store.load();expect(restored).not.toBeNull();expect(restored!.mapState.installations![0].spawned).toBe(2);
  moveNearInstallations(restored!,context(s));expect(restored!.mapState.installations).toHaveLength(0);expect(restored!.enemyStates).toHaveLength(1);
 });
});
