import {it,expect} from 'vitest';
import {GameSession} from '../src/game/GameSession';
import {actor} from '../src/actors/Actor';
import {dealAttributeHit,applyAttribute,tickAttributes} from '../src/skills/AttributeSystem';
import {previewSkill,validSkillTarget} from '../src/skills/SkillResolver';
import {tickSkillFields,contactSkillFields} from '../src/skills/FieldSkills';
import {movementLocked} from '../src/game/ActorStats';
import {TurnAnimation} from '../src/render/TurnAnimation';
import {VECTORS,type GameEvent} from '../src/game/types';
const setup=()=>{const s=GameSession.create(1,1);s.state.playerState.position={x:5,y:5};s.state.playerState.criticalRate=0;s.state.enemyStates=[];s.state.mapState.tiles.fill(0);s.state.mapState.fields=[];s.state.mapState.objects=[];s.state.mapState.traps=[];s.state.mapState.installations=[];return s;};
const context=(s:GameSession)=>({rng:s.rng,events:s.events,damage:s.damage,log:(m:string)=>s.log(m)});
it('睡眠は夜の翌行動から',()=>{const s=setup();s.state.daylightCount=100;expect(s.canSleep()).toBe(false);s.state.daylightCount=101;expect(s.canSleep()).toBe(true);});
it('チェインの初撃は選択した隣接対象',()=>{const s=setup();s.state.enemyStates=[actor('a','slime',{x:6,y:5}),actor('b','slime',{x:5,y:6})];expect(validSkillTarget(s.state,'chainLightning')).toBe(false);expect(previewSkill(s.state,'chainLightning','right',{x:5,y:6}).targetIds[0]).toBe('b');});
it('氷槍は距離ではなく命中順、Lv3で4体目まで',()=>{const s=setup();s.state.skillLevels.iceLance=3;s.state.enemyStates=[1,2,3,4].map(n=>({...actor('e'+n,'slime',{x:5+n,y:5}),hp:100,maxHp:100}));s.cast('iceLance','right');expect(s.state.enemyStates.map(e=>100-e.hp)).toEqual([7,9,13,16]);});
it('炎の壁は3ターンで消え、大型敵に1回分ずつ命中',()=>{const s=setup();s.state.enemyStates=[{...actor('e','golem',{x:6,y:5}),hp:100,maxHp:100}];s.cast('fireWall','right');expect(s.state.enemyStates[0].hp).toBe(95);for(let n=1;n<=3;n++){s.state.playerActionCount=n;contactSkillFields(s.state,context(s));tickSkillFields(s.state,context(s));}expect(s.state.enemyStates[0].hp).toBe(86);expect(s.state.mapState.fields).toHaveLength(0);});
it('竜巻は発動内に4歩進み、再訪せず設置物を残さない',()=>{const s=setup();s.cast('tornadoSummon','right');const moves=s.events.filter(e=>e.visual==='windVortex');expect(moves).toHaveLength(4);const visited=new Set(['5,5']);for(const move of moves){expect(Math.abs(move.target!.x-move.position.x)+Math.abs(move.target!.y-move.position.y)).toBe(1);const key=move.target!.x+','+move.target!.y;expect(visited.has(key)).toBe(false);visited.add(key);}expect(s.state.mapState.fields).toHaveLength(0);});
it('竜巻の吹き飛ばしは各歩の進行方向に1マス',()=>{
 for(const [direction,v] of Object.entries(VECTORS)){
  const s=setup();s.rng.next=()=>0;
  s.state.enemyStates=[{...actor('e','slime',{x:5+v.x,y:5+v.y}),hp:1000,maxHp:1000}];
  s.cast('tornadoSummon',direction as keyof typeof VECTORS);
  const push=s.events.find(e=>e.displacement)!;
  expect(push.position).toEqual({x:5+v.x,y:5+v.y});expect(push.target).toEqual({x:5+v.x*2,y:5+v.y*2});
 }
});
it('竜巻は壁・キャラ・設置物を越えて押さず、大型・固定敵を押さない',()=>{
 for(const obstacle of ['wall','actor','installation','large','immobile']){
  const s=setup();s.rng.next=()=>0;
  const enemy={...actor('e',obstacle==='large'?'golem':obstacle==='immobile'?'treant':'slime',{x:6,y:5}),hp:1000,maxHp:1000};s.state.enemyStates=[enemy];
  if(obstacle==='wall')s.state.mapState.tiles[5*s.state.mapState.width+7]=1;
  if(obstacle==='actor')s.state.allyStates=[actor('ally','sprite',{x:7,y:5})];
  if(obstacle==='installation')s.state.mapState.installations=[{id:'pot',kind:'pot',position:{x:7,y:5},spawned:0}];
  s.cast('tornadoSummon','right');expect(enemy.position).toEqual({x:6,y:5});expect(s.events.some(e=>e.displacement)).toBe(false);
 }
});
it('吹き飛ばしは竜巻の到着後に補間され、ゲーム状態は変わらない',()=>{
 const s=setup();s.rng.next=()=>0;s.state.enemyStates=[{...actor('e','slime',{x:6,y:5}),hp:100,maxHp:100}];
 const before=structuredClone(s.actors);s.cast('tornadoSummon','right');
 const animation=new TurnAnimation(before,[{phase:'player',actors:structuredClone(s.actors),events:s.events}],()=>true);
 const x=(time:number)=>animation.sample(time)!.actors.find(a=>a.id==='e')!.position.x;
 expect(x(100)).toBe(6);expect(x(180)).toBe(6.5);expect(x(240)).toBe(7);expect(s.state.enemyStates[0].position).toEqual({x:7,y:5});
});
it('霜蝕は属性を維持、融激ダメージを1回追加して解除',()=>{const e={...actor('e','slime',{x:1,y:1}),hp:100,maxHp:100},events:GameEvent[]=[];const damage=(t:typeof e,n:number)=>{t.hp-=Math.floor(n);};applyAttribute(e,'ice',1,1,[e],damage,events);applyAttribute(e,'earth',1,1,[e],damage,events);expect(e.afflictions).toHaveLength(2);expect(movementLocked(e,1)).toBe(true);expect(movementLocked(e,2)).toBe(false);dealAttributeHit(e,10,'fire',2,[e],damage,events,()=>0);expect(e.hp).toBe(70);expect(e.frostErosion).toBeUndefined();});
it('大地震は範囲内の未発見罠だけを除去',()=>{const s=setup();s.state.mapState.traps=[{id:'near',trapId:'fireMine',position:{x:6,y:5},triggered:false},{id:'far',trapId:'bearTrap',position:{x:10,y:5},triggered:false},{id:'known',trapId:'fireMine',position:{x:4,y:5},triggered:true}];s.state.mapState.playerTraps=[{id:'own',position:{x:5,y:5},damage:10}];s.cast('earthquake','up');expect(s.state.mapState.traps.map(t=>t.id)).toEqual(['far','known']);expect(s.state.mapState.playerTraps).toHaveLength(1);});
