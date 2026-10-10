import { expect, it } from 'vitest';
import { actor } from '../src/actors/Actor';
import { GameSession } from '../src/game/GameSession';
import { actElder, elderPhases, tickBossHazards } from '../src/game/ElderTreant';
import { startBoss, finishBoss } from '../src/game/BossEncounter';
import { hitInstallation, tickInstallations } from '../src/game/InstallationSystem';
import { generateMap } from '../src/game/MapState';
import { Random } from '../src/game/Random';
import { validSave } from '../src/game/SaveManager';
import { STAGES } from '../src/stages';
import { projectFromJson, validateProject, exportStage } from '../src/dev/DungeonEditorModel';
import cave from '../src/stages/cave/3-5.json';
import { tryEnemySkill } from '../src/skills/EnemySkillResolver';
function game(){
 const g=GameSession.create(1,123),s=g.state;
 s.mapState={width:32,height:34,tiles:Array(32*34).fill(7),objects:[],fields:[],installations:[],traps:[],playerTraps:[]};s.exploredMap=Array(32*34).fill(true);
 s.enemyStates=[];s.allyStates=[];s.playerState.position={x:15,y:20};s.playerState.hp=s.playerState.maxHp=200;s.playerActionCount=s.turnCount=10;
 return g;
}
function context(g:GameSession){return {rng:g.rng,events:g.events,log:(m:string)=>g.log(m),hit:(a:ReturnType<typeof actor>,b:ReturnType<typeof actor>,n:number,attr:import('../src/game/types').Attribute)=>g.damage(b,n,attr,false,a)};}
function elderGame(){const g=game(),s=g.state,boss=actor('elder','elderTreant',{x:14,y:3});s.enemyStates=[boss];s.mapState.bossArena={x:2,y:2,width:27,height:29,started:true,bossId:boss.id};return {g,s,boss};}
it('3-5全4層は工房から再出力でき、出口につながり新規生成できる',()=>{
 const p=projectFromJson(cave);expect(validateProject(p)).toEqual([]);expect(exportStage(p).dungeon?.floors).toBe(4);
 const stage=STAGES.find(s=>s.code==='3-5')!;
 for(let f=1;f<=4;f++){const {map,enemies}=generateMap(stage,new Random(42),f);expect(map.width).toBeLessThan(55);expect(enemies.filter(e=>e.kind==='bombStone')).toHaveLength(f+2);if(f===4)expect(enemies.find(e=>e.kind==='elderTreant')?.hp).toBe(500);}
 for(const code of ['3-3','3-4'])for(let f=1;f<=3;f++)expect(generateMap(STAGES.find(s=>s.code===code)!,new Random(42),f).enemies.some(e=>e.kind==='bombStone')).toBe(true);
});
it('テストの別地域・二つの部屋はそれぞれ一度だけ開始し、撃破後に封鎖解除',()=>{
 const test=STAGES.find(s=>s.code==='test-1')!;expect(test.regionId).toBe('test');const g=GameSession.create(test.id,9),s=g.state;
 for(const room of s.mapState.bossRooms!){const boss=s.enemyStates.find(e=>['elderTreant','goblinKing'].includes(e.kind)&&e.position.x>=room.x&&e.position.y>=room.y&&e.position.x<room.x+room.width&&e.position.y<room.y+room.height)!;
  s.playerState.position={...boss.position};const old=s.mapState.tiles[room.sealTiles![0].y*s.mapState.width+room.sealTiles![0].x];startBoss(s,g.events);expect(s.mapState.bossArena?.bossId).toBe(boss.id);boss.hp=0;finishBoss(s);expect(s.mapState.bossArena?.completed).toBe(true);expect(s.mapState.tiles[room.sealTiles![0].y*s.mapState.width+room.sealTiles![0].x]).toBe(old);
 }
});
it('ボムは死亡時の攻撃力を保存し、1行動後に敵味方を巻き込み一度だけ爆発',()=>{
 const g=game(),s=g.state,bomb=actor('bomb','bombStone',{x:15,y:19}),other=actor('other','slime',{x:14,y:19});
 bomb.attack=8;bomb.hp=0;s.enemyStates=[bomb,other];g.reap();const remnant=s.mapState.installations![0];expect(remnant.burstDamage).toBe(12);
 const c={rng:g.rng,events:g.events,damage:g.damage,log:()=>{}};tickInstallations(s,c);expect(s.mapState.installations).toHaveLength(1);
 const hp=s.playerState.hp;s.playerActionCount++;tickInstallations(s,c);expect(s.playerState.hp).toBe(hp-12);expect(other.hp).toBeLessThan(other.maxHp);expect(hitInstallation(s,remnant.id,c)).toBe(false);
});
it('岩攻撃は斜めを除き、隣接十字だけに土属性を命中させる',()=>{
 const g=game(),s=g.state,bomb=actor('bomb','bombStone',{x:14,y:19});bomb.enemySkillIds=['earthStrike'];bomb.skillChances={earthStrike:1};s.enemyStates=[bomb];
 const c={rng:g.rng,events:g.events,log:()=>{},action:10,map:s.mapState,actors:[bomb,s.playerState],allies:[bomb],damage:(a:ReturnType<typeof actor>,n:number,attribute:import('../src/game/types').Attribute)=>g.damage(a,n,attribute,false,bomb)};
 expect(tryEnemySkill(bomb,[s.playerState],c)).toBe(false);s.playerState.position={x:14,y:20};expect(tryEnemySkill(bomb,[s.playerState],c)).toBe(true);
 expect(g.events.some(e=>e.type==='damage'&&e.attribute==='earth')).toBe(true);
});
it('暴風は予告した次の行動に命中し、障害物まで南へ押し戻す。保存再開でも残る',()=>{
 const {g,s,boss}=elderGame();g.rng.next=()=>.65;actElder(s,boss,context(g));expect(boss.mp).toBe(95);expect(s.mapState.bossHazards?.[0].kind).toBe('gust');
 expect(validSave(s)).toBe(true);tickBossHazards(s,context(g));expect(s.playerState.position.y).toBe(20);
 s.mapState.tiles[24*s.mapState.width+15]=9;s.playerActionCount++;tickBossHazards(s,context(g));expect(s.playerState.position.y).toBe(23);expect(s.playerState.hp).toBe(199);
});
it('HP段階の召喚は一度ずつ、通常召喚上限10体、触手は別枠・被ダメージ半分共有',()=>{
 const {g,s,boss}=elderGame();boss.hp=349;boss.mp=0;elderPhases(s,boss,context(g));expect(boss.mp).toBe(100);expect(s.enemyStates.filter(e=>e.kind==='treantTentacle')).toHaveLength(5);expect(s.playerState.position.y).toBeGreaterThanOrEqual(29);
 elderPhases(s,boss,context(g));expect(s.enemyStates).toHaveLength(11);
 const t=s.enemyStates.find(e=>e.kind==='treantTentacle')!;g.damage(t,10,'neutral');expect(boss.hp).toBe(344);expect(t.hp).toBe(20);
 boss.hp=149;elderPhases(s,boss,context(g));expect(s.enemyStates.filter(e=>e.kind==='treantTentacle')).toHaveLength(10);expect(s.enemyStates.filter(e=>e.summonedBy===boss.id&&e.kind!=='treantTentacle')).toHaveLength(10);
 g.rng.next=()=>.55;actElder(s,boss,context(g));expect(s.enemyStates.filter(e=>e.summonedBy===boss.id&&e.kind!=='treantTentacle')).toHaveLength(10);
});
it('大ツタは第2段階で1列、第3段階で縦横の予告。味方の通常モンスターにも命中',()=>{
 const {g,s,boss}=elderGame();boss.bossPhases=[350];g.rng.next=()=>.75;actElder(s,boss,context(g));const first=s.mapState.bossHazards![0];expect(new Set(first.cells.map(p=>p.y)).size).toBe(1);
 boss.bossPhases=[350,150];actElder(s,boss,context(g));const last=s.mapState.bossHazards![1];expect(new Set(last.cells.map(p=>p.y)).size).toBeGreaterThan(1);
 const treant=actor('tree','treant',{x:10,y:20}),tentacle=actor('tentacle','treantTentacle',{x:11,y:20});s.enemyStates.push(treant,tentacle);s.playerActionCount++;tickBossHazards(s,context(g));expect(treant.hp).toBeLessThan(treant.maxHp);expect(tentacle.hp).toBe(tentacle.maxHp);expect(boss.hp).toBe(500);
});
