import {expect,it,vi} from 'vitest';
import {GameSession} from '../src/game/GameSession';
import {actor} from '../src/actors/Actor';
import {gemReward} from '../src/data/gems';
import {ENEMIES} from '../src/data/enemies';
import {STAGES} from '../src/stages';
import {generateMap} from '../src/game/MapState';
import {Random} from '../src/game/Random';
import {projectFromJson,validateProject} from '../src/dev/DungeonEditorModel';
import {tryEnemySkill} from '../src/skills/EnemySkillResolver';
import {triggerPlayerTraps} from '../src/game/TrapSystem';
import cave from '../src/stages/cave/3-2.json';
function game(){const g=GameSession.create(1,123),s=g.state;s.mapState.tiles.fill(7);s.mapState.objects=[];s.mapState.traps=[];s.mapState.installations=[];s.enemyStates=[];s.allyStates=[];s.playerState.position={x:8,y:8};return g;}
it('宝石の表示と取得量は2層1.4倍、3層2倍',()=>{
 expect(gemReward('hp5',2).name).toBe('最大HP＋7');expect(gemReward('mp10',3).name).toBe('最大MP＋20');const g=game();g.state.floorNumber=2;g.state.pendingGemChoices=[['hp10']];const before=g.state.playerState.maxHp;expect(g.chooseGem(0)).toBe(true);expect(g.state.playerState.maxHp-before).toBe(14);
});
it('鉄扉は鍵なしでは通れず、1本だけ消費して開く',()=>{
 const g=game(),s=g.state,idx=8*s.mapState.width+9;s.mapState.tiles[idx]=11;expect(g.execute({type:'move',direction:'right'})).toBe(false);s.itemSlots=['ironKey','ironKey'];expect(g.execute({type:'move',direction:'right'})).toBe(true);expect(s.itemSlots).toEqual(['ironKey']);expect(s.mapState.tiles[idx]).toBe(7);expect(s.playerState.position).toEqual({x:9,y:8});
});
it('洞窟3-2は工房で編集可能で、全層生成できる',()=>{
 expect(validateProject(projectFromJson(cave))).toEqual([]);const stage=STAGES.find(s=>s.code==='3-2')!;expect(stage.dungeon?.floors).toBe(3);
 for(let floor=1;floor<=3;floor++){const {map,enemies}=generateMap(stage,new Random(123),floor);expect([map.width,map.height]).toEqual([42,38]);expect(enemies.length).toBeGreaterThan(8);if(floor>1){expect(map.tiles.filter(t=>t===11)).toHaveLength(1);expect(map.objects.some(o=>o.fixedContents&&o.contents?.some(l=>l.type==='item'&&l.id==='ironKey'))).toBe(true);expect(enemies.some(e=>e.kind==='thunderButterfly')).toBe(true);}}
});
it('宝物庫の鍵は施錠側の外にあり、開錠後に宝石へ到達できる',()=>{
 const p=projectFromJson(cave);
 for(const f of p.floors.slice(1)){
 const flood=(unlock:boolean)=>{const seen=new Set<string>(),q=[f.spawn];for(let n=0;n<q.length;n++){const a=q[n],k=a.x+','+a.y;if(a.x<0||a.y<0||a.x>=f.width||a.y>=f.height||seen.has(k))continue;const t=f.tiles[a.y*f.width+a.x];if(![0,2,3,7,8,...(unlock?[11]:[])].includes(t))continue;seen.add(k);for(const [x,y]of [[1,0],[-1,0],[0,1],[0,-1]])q.push({x:a.x+x,y:a.y+y});}return seen;};
 const closed=flood(false),open=flood(true),key=f.objects.find(o=>o.contents?.some(l=>l.type==='item'&&l.id==='ironKey'))!,gem=f.objects.find(o=>o.type==='gem')!;expect(closed.has(key.position.x+','+key.position.y)).toBe(true);expect(closed.has(gem.position.x+','+gem.position.y)).toBe(false);expect(open.has(gem.position.x+','+gem.position.y)).toBe(true);
 }
});
it('スライムシャワーは1～3体を重複なしの空きマスにHP80%で召喚',()=>{
 const g=game(),s=g.state;s.mapState.traps=[{id:'shower',trapId:'stoneSlimeShower',position:{...s.playerState.position},triggered:false}];triggerPlayerTraps(s,{rng:g.rng,events:g.events,damage:()=>{},log:()=>{}});expect(s.enemyStates.length).toBeGreaterThanOrEqual(1);expect(s.enemyStates.length).toBeLessThanOrEqual(3);expect(new Set(s.enemyStates.map(e=>e.position.x+','+e.position.y)).size).toBe(s.enemyStates.length);for(const e of s.enemyStates){expect(e.hp).toBe(Math.floor(e.maxHp*.8));expect(Math.max(Math.abs(e.position.x-8),Math.abs(e.position.y-8))).toBeLessThanOrEqual(4);}
});
it('大雷蝶の雷技は強雷装中だけ使用可能、落雷は壺も対象',()=>{
 const g=game(),s=g.state,e=actor('butterfly','thunderButterfly',{x:8,y:11});e.enemySkillIds=['thunderBall'];const hits:number[]=[];vi.spyOn(g.rng,'next').mockReturnValue(0);const c={action:1,map:s.mapState,actors:[e,s.playerState],allies:[e],rng:g.rng,events:g.events,damage:(_:unknown,n:number)=>{hits.push(n);},log:()=>{},hitInstallation:vi.fn(()=>true)};
 expect(tryEnemySkill(e,[s.playerState],c)).toBe(false);e.enemySkillIds=['strongThunderArmor'];expect(tryEnemySkill(e,[s.playerState],c)).toBe(true);expect(e.buffs?.[0].remainingTurns).toBe(5);e.enemySkillIds=['thunderBall'];expect(tryEnemySkill(e,[s.playerState],c)).toBe(true);expect(hits[0]).toBeCloseTo(3*1.2);
 e.enemySkillIds=['randomBolt'];s.mapState.installations=[{id:'pot',kind:'pot',position:{x:9,y:11},spawned:0}];expect(tryEnemySkill(e,[],c)).toBe(true);expect(c.hitInstallation).toHaveBeenCalledWith('pot');
});
it('基礎HP30以上に標準10%の栞枠',()=>{expect(ENEMIES.earthFlower.bookmarkDropChance).toBe(.1);expect(ENEMIES.goblin.bookmarkDropChance).toBe(0);expect(ENEMIES.thunderButterfly.bookmarkDropChance).toBe(.1);});
