import {attackTargets,nextChainTarget,previewSkill} from '../src/skills/SkillResolver';
import {it,expect} from 'vitest';
import {GameSession} from '../src/game/GameSession';
import {actor} from '../src/actors/Actor';
import {applyAttribute} from '../src/skills/AttributeSystem';
import {crystalSource,hitCrystal,tickCrystals} from '../src/game/CrystalSystem';
import {CRYSTAL_FLIGHT_MS,CRYSTAL_BURST_MS} from '../src/game/CrystalTiming';
import {TurnAnimation} from '../src/render/TurnAnimation';
const setup=()=>{const g=GameSession.create(1,12);g.state.mapState.tiles.fill(0);g.state.mapState.objects=[];g.state.mapState.installations=[];g.state.mapState.crystals=[];g.state.enemyStates=[];g.state.playerState.position={x:5,y:5};return g;};
const context=(g:GameSession)=>({rng:g.rng,events:g.events,damage:g.damage,log:(s:string)=>g.log(s)});
it('破裂は複数の敵へ一斉攻撃せず、抽選された1マスだけに命中する',()=>{
 for(const attribute of ['ice','thunder'] as const){
  const g=setup();g.state.playerActionCount=1;
  const a=actor('a','slime',{x:8,y:7}),b=actor('b','slime',{x:9,y:8});a.hp=b.hp=100;g.state.enemyStates=[a,b];
  g.state.mapState.crystals=[{id:'crystal-one',position:{x:8,y:8},attribute,source:crystalSource(g.state,g.state.playerState),damage:3,remainingTurns:5,placedAt:0}];
  hitCrystal(g.state,'crystal-one',context(g));
  expect([a.hp,b.hp].sort((x,y)=>x-y)).toEqual([97,100]);
  expect(g.events.filter(e=>e.type==='cast'&&e.crystalAttribute===attribute)).toHaveLength(1);
  const damage=g.events.find(e=>e.type==='damage')!,flight=g.events.find(e=>e.type==='cast')!;
  expect(damage.delayMs).toBe(CRYSTAL_FLIGHT_MS);expect(flight.delayMs).toBe(0);expect(flight.target).toEqual(damage.position);
  expect(flight.durationMs).toBe(CRYSTAL_FLIGHT_MS+CRYSTAL_BURST_MS);
  const animation=new TurnAnimation(g.actors,[{phase:'enemy',actors:g.actors,events:g.events}],()=>true);
  expect(animation.duration).toBeGreaterThanOrEqual(flight.durationMs!);
 }
});
it('壺を選んだ結晶は壺だけを破壊し、飛行後に破壊演出を開始する',()=>{
 const g=setup();g.state.playerActionCount=1;
 const enemy=actor('e','slime',{x:8,y:7});enemy.hp=100;g.state.enemyStates=[enemy];
 g.state.mapState.installations=[{id:'pot-test',kind:'pot',position:{x:9,y:8},spawned:0}];
 g.state.mapState.crystals=[{id:'crystal-pot',position:{x:8,y:8},attribute:'ice',source:crystalSource(g.state,g.state.playerState),damage:3,remainingTurns:5,placedAt:0}];
 g.rng.int=(_min,max)=>max;hitCrystal(g.state,'crystal-pot',context(g));
 expect(enemy.hp).toBe(100);expect(g.state.mapState.installations).toHaveLength(0);
 expect(g.events.find(e=>e.type==='cast')?.target).toEqual({x:9,y:8});
 expect(g.events.find(e=>e.visual==='shatter')!.delayMs).toBeGreaterThanOrEqual(CRYSTAL_FLIGHT_MS);
});
it('隣の結晶へ飛ぶ連鎖も、最初の結晶の到着後に始まる',()=>{
 const g=setup();g.state.playerActionCount=1;
 g.state.mapState.crystals=[0,1].map(n=>({id:'crystal-'+n,position:{x:8+n,y:8},attribute:'ice',source:crystalSource(g.state,g.state.playerState),damage:3,remainingTurns:5,placedAt:0}));
 hitCrystal(g.state,'crystal-0',context(g));
 const flights=g.events.filter(e=>e.type==='cast');expect(flights).toHaveLength(2);
 expect(flights[0].target).toEqual({x:9,y:8});expect(flights[1].delayMs).toBe(CRYSTAL_FLIGHT_MS);
});
it('氷→雷は氷結晶、雷→氷は雷結晶。両属性を消費し威力を固定',()=>{for(const first of ['ice','thunder'] as const){const g=setup(),enemy=actor('e','slime',{x:8,y:8});g.state.enemyStates=[enemy];g.state.playerState.attack=20;enemy.afflictions=[{attribute:first,remainingTurns:10,appliedAt:0}];applyAttribute(enemy,first==='ice'?'thunder':'ice',1,0,[enemy],g.damage,g.events,false,()=>g.rng.next(),crystalSource(g.state,g.state.playerState));expect(enemy.afflictions).toHaveLength(0);expect(g.state.mapState.crystals).toHaveLength(1);expect(g.state.mapState.crystals![0].attribute).toBe(first);expect(g.state.mapState.crystals![0].damage).toBe(6);g.state.playerState.attack=100;expect(g.state.mapState.crystals![0].damage).toBe(6);}});
it('同じマスの2個をまとめて破裂し、敵だけに命中',()=>{const g=setup(),e=actor('e','slime',{x:6,y:6});e.hp=e.maxHp=100;g.state.enemyStates=[e];g.state.mapState.crystals=[0,1].map(n=>({id:'crystal-'+n,position:{x:6,y:5},attribute:'ice',source:crystalSource(g.state,g.state.playerState),damage:3,remainingTurns:5,placedAt:0}));const hp=g.state.playerState.hp;g.state.playerActionCount=1;hitCrystal(g.state,'crystal-0',context(g));expect(e.hp).toBe(94);expect(g.state.playerState.hp).toBe(hp);expect(g.state.mapState.crystals).toHaveLength(0);});
it('敵由来は旅人を攻撃し敵を攻撃しない。5行動で破裂',()=>{const g=setup(),e=actor('e','slime',{x:6,y:6});g.state.enemyStates=[e];g.state.mapState.crystals=[{id:'crystal-e',position:{x:6,y:5},attribute:'thunder',source:crystalSource(g.state,e),damage:3,remainingTurns:5,placedAt:0}];const hp=e.hp,playerHp=g.state.playerState.hp;tickCrystals(g.state,context(g));expect(g.state.mapState.crystals![0].remainingTurns).toBe(5);for(let n=1;n<=4;n++){g.state.playerActionCount=n;tickCrystals(g.state,context(g));}expect(g.state.mapState.crystals).toHaveLength(1);g.state.playerActionCount=5;tickCrystals(g.state,context(g));expect(g.state.mapState.crystals).toHaveLength(0);expect(g.state.playerState.hp).toBe(playerHp-3);expect(e.hp).toBe(hp);});
it('周囲が壁なら生成せず、属性は消費',()=>{const g=setup(),e=actor('e','slime',{x:8,y:8});g.state.enemyStates=[e];for(let y=7;y<=9;y++)for(let x=7;x<=9;x++)g.state.mapState.tiles[y*g.state.mapState.width+x]=1;e.afflictions=[{attribute:'ice',remainingTurns:10,appliedAt:0}];applyAttribute(e,'thunder',3,0,[e],g.damage,g.events);expect(g.state.mapState.crystals).toHaveLength(0);expect(e.afflictions).toHaveLength(0);});

it('生成した行動中は攻撃でも破裂せず次の行動から破裂',()=>{const g=setup();g.state.mapState.crystals=[{id:'crystal-new',position:{x:8,y:8},attribute:'ice',source:crystalSource(g.state,g.state.playerState),damage:3,remainingTurns:5,placedAt:0}];hitCrystal(g.state,'crystal-new',context(g));expect(g.state.mapState.crystals).toHaveLength(1);expect(g.events.filter(e=>e.text?.includes('破裂'))).toHaveLength(0);g.state.playerActionCount=1;hitCrystal(g.state,'crystal-new',context(g));expect(g.state.mapState.crystals).toHaveLength(0);});
it('古い結晶の同一マス・隣接連鎖からも生成直後の結晶を保護',()=>{const g=setup();g.state.playerActionCount=1;g.state.mapState.crystals=[{id:'crystal-old',position:{x:8,y:8},attribute:'ice',source:crystalSource(g.state,g.state.playerState),damage:3,remainingTurns:4,placedAt:0},...['same','near'].map((name,n)=>({id:'crystal-'+name,position:{x:8+n,y:8},attribute:'ice' as const,source:crystalSource(g.state,g.state.playerState),damage:3,remainingTurns:5,placedAt:1}))];hitCrystal(g.state,'crystal-old',context(g));expect(g.state.mapState.crystals!.map(c=>c.id)).toEqual(['crystal-same','crystal-near']);});

it('生成行動中の結晶は連鎖候補・直線の遮りにならず、次行動から対象',()=>{
 const g=setup(),enemy=actor('enemy','slime',{x:7,y:5});g.state.enemyStates=[enemy];
 g.state.mapState.crystals=[{id:'crystal-new',position:{x:6,y:5},attribute:'ice',source:crystalSource(g.state,g.state.playerState),damage:3,remainingTurns:5,placedAt:0}];
 expect(attackTargets(g.state).some(a=>a.id==='crystal-new')).toBe(false);
 expect(previewSkill(g.state,'fireball','right').targetIds).toEqual(['enemy']);
 expect(nextChainTarget(g.state,[{x:6,y:6}],new Set(['enemy']))).toBeUndefined();
 g.state.playerActionCount=1;
 expect(attackTargets(g.state).some(a=>a.id==='crystal-new')).toBe(true);
 expect(previewSkill(g.state,'fireball','right').targetIds).toEqual(['crystal-new']);
 expect(nextChainTarget(g.state,[{x:6,y:6}],new Set())?.id).toBe('crystal-new');
});
