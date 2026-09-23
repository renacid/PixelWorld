import { expect, it } from 'vitest';
import { GameSession } from '../src/game/GameSession';
import { actor } from '../src/actors/Actor';
import { dealAttributeHit } from '../src/skills/AttributeSystem';
import { reaperRules } from '../src/game/DayCycle';
import { TurnAnimation } from '../src/render/TurnAnimation';
import { newFloor, newProject, exportStage, validateProject } from '../src/dev/DungeonEditorModel';
import { generateMap } from '../src/game/MapState';
import { Random } from '../src/game/Random';

function session(){
 const g=GameSession.create(1,32),s=g.state;
 s.mapState.tiles.fill(0);s.mapState.objects=[];s.mapState.traps=[];s.mapState.fields=[];s.mapState.installations=[];s.mapState.crystals=[];
 s.enemyStates=[];s.playerState.position={x:3,y:3};s.playerActionCount=2;s.turnCount=2;return g;
}
it('wind spreads to objects, then existing crystals burst with a delayed effect; new crystals stay protected',()=>{
 const g=session(),s=g.state,e=actor('victim','slime',{x:5,y:5});e.hp=e.maxHp=100;e.afflictions=[{attribute:'fire',remainingTurns:8,appliedAt:1}];s.enemyStates=[e];
 s.mapState.installations=[{id:'pot',kind:'pot',position:{x:6,y:5},spawned:0},{id:'nest',kind:'goblinNest',position:{x:5,y:6},spawned:0}];
 s.mapState.crystals=[{id:'crystal-old',position:{x:4,y:5},placedAt:1,remainingTurns:4,attribute:'ice',damage:3,source:{actorId:'player',team:'player',attack:10}},{id:'crystal-new',position:{x:4,y:5},placedAt:2,remainingTurns:5,attribute:'ice',damage:3,source:{actorId:'player',team:'player',attack:10}}];
 dealAttributeHit(e,10,'wind',2,s.enemyStates,g.damage,g.events,()=>0);
 expect(s.mapState.installations).toHaveLength(0);expect(s.mapState.crystals.some(c=>c.id==='crystal-old')).toBe(false);expect(s.mapState.crystals.some(c=>c.id==='crystal-new')).toBe(true);
 const swirl=g.events.findIndex(e=>e.visual==='elementalSwirl'),burst=g.events.findIndex(e=>e.text==='氷結晶破裂');expect(burst).toBeGreaterThan(swirl);expect(g.events[burst].delayMs).toBeGreaterThanOrEqual(650);
});
it('melt is labeled, frost pursuit is combined in log and popup',()=>{
 const g=session(),s=g.state,e=actor('victim','slime',{x:5,y:5});e.hp=e.maxHp=100;e.afflictions=[{attribute:'ice',remainingTurns:10,appliedAt:1},{attribute:'earth',remainingTurns:10,appliedAt:1}];e.frostErosion={spent:false,rootUntil:2};s.enemyStates=[e];
 dealAttributeHit(e,10,'fire',2,s.enemyStates,g.damage,g.events,()=>0);
 expect(g.events.filter(e=>e.type==='damage').map(e=>e.reaction)).toEqual(['融撃','霜蝕撃']);expect(s.log.at(-1)).toContain('合計30のダメージ');expect(g.events.some(e=>e.text==='霜蝕撃')).toBe(true);
 const animation=new TurnAnimation([e],[{phase:'enemy',actors:[e],events:g.events}],()=>true);
 expect(animation.events().filter(e=>e.event.type==='damage').map(e=>e.event.text)).toEqual(['合計30のダメージ']);
 e.afflictions=[{attribute:'ice',remainingTurns:10,appliedAt:1}];delete e.frostErosion;
 dealAttributeHit(e,10,'fire',2,s.enemyStates,g.damage,g.events,()=>0);expect(s.log.at(-1)).toContain('15の融撃ダメージ');
});
it('night and midnight reapers scale by day and sleep fatigue affects only HP recovery',()=>{
 expect([1,3,4,7,8,11,12,15].map(d=>reaperRules(d))).toEqual([1,1,2,2,4,4,8,8].map((count,i)=>({count,hp:13+4*Math.floor(i/2),attack:4})));
 const g=session(),s=g.state;s.daylightCount=99;g.execute({type:'wait'});expect(s.enemyStates.filter(e=>e.kind==='reaper')).toHaveLength(1);expect(s.enemyStates[0].hp).toBe(13);
 s.enemyStates=[];s.daylightCount=149;g.execute({type:'wait'});expect(s.enemyStates.filter(e=>e.kind==='reaper')).toHaveLength(1);
 s.enemyStates=[];s.dayCount=3;s.playerState.maxHp=100;s.playerState.hp=1;s.playerState.mp=0;g.execute({type:'sleep'});
 expect(s.dayCount).toBe(4);expect(s.fatigue).toBe(1);expect(s.playerState.hp).toBe(81);expect(s.playerState.mp).toBe(s.playerState.maxMp);
 s.daylightCount=101;s.fatigue=5;s.playerState.hp=12;g.execute({type:'sleep'});expect(s.playerState.hp).toBe(12);
});
it('idle enemies outside double detection spend no MP on skills',()=>{
 const g=session(),s=g.state,e=actor('treant','treant',{x:15,y:15}),ally=actor('other','goblin',{x:15,y:16});
 e.skillChances={forestBlessing:1};s.enemyStates=[e,ally];const mp=e.mp;g.execute({type:'wait'});expect(e.mp).toBe(mp);expect(ally.buffs).toHaveLength(0);
});
it('editor exports multiple floors and keeps hand placed installations and dimensions',()=>{
 const p=newProject();p.floors.push(newFloor(20,25));
 for(const f of p.floors){f.objects.push({id:'exit',type:'exit',position:{x:4,y:4}});f.installations.push({id:'pot',kind:'pot',position:{x:6,y:6},spawned:0});}
 expect(validateProject(p)).toEqual([]);const stage=exportStage(p);
 const result=generateMap(stage,new Random(1),2);expect(result.map.width).toBe(20);expect(result.map.height).toBe(25);expect(result.map.installations?.[0].position).toEqual({x:6,y:6});
});
