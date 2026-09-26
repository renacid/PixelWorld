import {expect,it} from 'vitest';
import {GameSession} from '../src/game/GameSession';
import {actor} from '../src/actors/Actor';
import {canStand,generateMap} from '../src/game/MapState';
import {startBoss} from '../src/game/BossEncounter';
import {actEnemy} from '../src/ai/EnemyAI';
import {Random} from '../src/game/Random';
import {STAGES} from '../src/stages';
import {projectFromJson,validateProject} from '../src/dev/DungeonEditorModel';
import cave from '../src/stages/cave/3-1.json';
import forest from '../src/stages/forest/2-5.json';
import {exportSave,importSave} from '../src/game/PortableSave';
import {hitCrystal,crystalSource} from '../src/game/CrystalSystem';
import {triggerPlayerTraps,tickDelayedRocks} from '../src/game/TrapSystem';
import {tryEnemySkill} from '../src/skills/EnemySkillResolver';
function clean(){const g=GameSession.create(1,12),s=g.state;s.mapState.tiles.fill(0);s.mapState.objects=[];s.mapState.installations=[];s.mapState.traps=[];s.mapState.fields=[];s.enemyStates=[];s.playerState.position={x:5,y:5};s.playerState.mp=s.playerState.maxMp=999;return g;}
const context=(g:GameSession)=>({rng:g.rng,events:g.events,damage:g.damage,log:(text:string)=>g.log(text)});
it('ボス開始で死神と封鎖セルの内容が消え、ワープ候補も領域外を拒否',()=>{
 const g=clean(),s=g.state;s.mapState.bossArena={x:5,y:5,width:8,height:8,sealTiles:[{x:4,y:5}]};
 s.enemyStates=[actor('king','goblinKing',{x:11,y:10}),actor('reaper','reaper',{x:15,y:15}),actor('guard','goblin',{x:7,y:7})];
 s.mapState.objects=[{id:'remove',type:'item',itemId:'ether',position:{x:4,y:5}}];startBoss(s,g.events);
 expect(s.enemyStates.some(e=>e.kind==='reaper')).toBe(false);expect(s.mapState.objects).toHaveLength(0);expect(s.mapState.tiles[5*s.mapState.width+4]).toBe(1);
 expect(canStand(s.mapState,s.playerState,{x:3,y:5})).toBe(false);expect(s.enemyStates.every(e=>e.mode==='hostile')).toBe(true);
});
it('戦闘開始前のボスエリアでは敵視を固定せず、開始後は見失っても維持',()=>{
 const g=clean(),s=g.state,e=actor('g','goblin',{x:11,y:11});e.detectionRange=1;e.pattern='wait';s.mapState.bossArena={x:5,y:5,width:10,height:10};
 actEnemy(s.mapState,e,[s.playerState],[s.playerState,e],g.rng,()=>{},1);expect(e.mode).toBe('idle');
 s.mapState.bossArena.started=true;actEnemy(s.mapState,e,[s.playerState],[s.playerState,e],g.rng,()=>{},2);expect(e.mode).toBe('hostile');
});
it('新しい2マップは工房で読み書きでき、全階層に到達可能な出口がある',()=>{
 for(const data of [cave,forest])expect(validateProject(projectFromJson(data))).toEqual([]);
 for(const id of [11,12]){const stage=STAGES.find(s=>s.id===id)!;for(let floor=1;floor<=stage.dungeon!.floors;floor++)expect(generateMap(stage,new Random(57),floor).enemies.length).toBeGreaterThan(0);}
});
it('文字列セーブは結晶・大落石予告・初日の死神記録も保持し、欠損を拒否',()=>{
 const g=GameSession.create(12,13);g.state.lastReaperDay=1;g.state.mapState.delayedRocks=[{position:{x:5,y:5},dueAt:1,damage:5}];
 g.state.mapState.crystals=[{id:'crystal-save',position:{x:5,y:5},attribute:'thunder',source:crystalSource(g.state,g.state.playerState),damage:3,placedAt:0,remainingTurns:5}];
 const code=exportSave(g.state);expect(importSave(code)).toEqual(g.state);expect(()=>importSave(code.slice(0,-2))).toThrow();
});
it('雷結晶も氷結晶と同じ対象へ飛翔して同ダメージ',()=>{
 for(const attribute of ['ice','thunder'] as const){const g=clean(),e=actor('e','slime',{x:7,y:5});g.state.enemyStates=[e];const hp=e.hp;g.state.playerActionCount=1;g.state.mapState.crystals=[{id:'crystal-test',position:{x:6,y:5},attribute,source:crystalSource(g.state,g.state.playerState),damage:3,placedAt:0,remainingTurns:5}];hitCrystal(g.state,'crystal-test',context(g));expect(e.hp).toBe(hp-3);expect(g.events.some(e=>e.crystalAttribute===attribute&&e.target?.x===7)).toBe(true);}
});
it('大落石は踏んだ行動に落ちず次の行動で1度だけ命中',()=>{
 const g=clean(),s=g.state;s.mapState.traps=[{id:'rock',trapId:'largeRock',position:{...s.playerState.position},triggered:false}];const hp=s.playerState.hp;
 triggerPlayerTraps(s,context(g));tickDelayedRocks(s,context(g));expect(s.playerState.hp).toBe(hp);s.playerActionCount++;tickDelayedRocks(s,context(g));expect(s.playerState.hp).toBe(hp-5);tickDelayedRocks(s,context(g));expect(s.playerState.hp).toBe(hp-5);
});
it('落雷Lv5は4対象を重複なく攻撃し、乱れ突きは壁の向こうへ届かない',()=>{
 const g=clean(),s=g.state;s.enemyStates=[0,1,2,3,4].map(i=>actor('e'+i,'slime',{x:3+i,y:7}));s.skillLevels.randomThunder=5;
 g.cast('randomThunder','up');const hits=g.events.filter(e=>e.type==='damage');expect(hits).toHaveLength(4);expect(new Set(hits.map(e=>e.actorId)).size).toBe(4);
 const h=clean();h.state.enemyStates=[actor('behind','slime',{x:5,y:3})];h.state.mapState.tiles[4*h.state.mapState.width+5]=1;h.cast('flurry','up');expect(h.events.filter(e=>e.type==='damage')).toHaveLength(0);
});
it('ファイヤーボールLv5は十字5マスに炎上床、トレントは炎+1',()=>{
 const g=clean(),s=g.state;s.skillLevels.fireball=5;g.cast('fireball','right');expect(s.mapState.fields).toHaveLength(5);expect(s.mapState.fields.every(f=>f.remainingTurns===3)).toBe(true);
 const e=actor('t','treant',{x:5,y:8}),hp=e.hp;g.damage(e,5,'fire');expect(e.hp).toBe(hp-6);
});
it('花粉は土を消費し、無属性の追加攻撃と開花を発生',()=>{
 const g=clean(),s=g.state,e=actor('flower','earthFlower',{x:5,y:7});e.facing='up';e.enemySkillIds=['earthPollen'];e.skillChances={earthPollen:1};s.playerState.afflictions=[{attribute:'earth',remainingTurns:10,appliedAt:0}];
 const hits:number[]=[];expect(tryEnemySkill(e,[s.playerState],{...context(g),action:1,allies:[e],map:s.mapState,actors:[e,s.playerState],damage:(_,n)=>{hits.push(n);}})).toBe(true);
 expect(hits[0]).toBeGreaterThanOrEqual(.9-1e-10);expect(hits[0]).toBeLessThanOrEqual(1.5);expect(hits[1]).toBe(3);expect(s.playerState.afflictions).toHaveLength(0);expect(g.events.some(e=>e.visual==='blueBloom')).toBe(true);
});
