import { expect, it } from 'vitest';
import { GameSession } from '../src/game/GameSession';
import { actor } from '../src/actors/Actor';
import { previewSkill, validSkillTarget, skillCooldown } from '../src/skills/SkillResolver';
import { placeGate, gateDestinations } from '../src/skills/TransferGate';
import { movementLocked } from '../src/game/ActorStats';
import { startBoss } from '../src/game/BossEncounter';
import { bottleImpact, contactBottleFire } from '../src/game/FireBottle';
import { rollCategorizedItem } from '../src/game/LootSystem';
import { ITEMS } from '../src/data/items';
import { Random } from '../src/game/Random';
import { generateMap } from '../src/game/MapState';
import { STAGES } from '../src/stages';
import { validateProject, projectFromJson } from '../src/dev/DungeonEditorModel';
import cave from '../src/stages/cave/3-3.json';
function game(){
 const g=GameSession.create(1,123),s=g.state;
 s.mapState.tiles.fill(7);s.mapState.objects=[];s.mapState.traps=[];s.mapState.installations=[];s.mapState.fields=[];
 s.enemyStates=[];s.allyStates=[];s.playerState.position={x:8,y:8};s.playerState.mp=s.playerState.maxMp=100;
 return g;
}
it('転移の指定範囲・CTはLv3/5で変わり、未指定なら9×9のランダム',()=>{
 const s=game().state;s.skillLevels.warp=3;
 expect(skillCooldown(s,'warp')).toBe(15);expect(validSkillTarget(s,'warp',{x:11,y:11})).toBe(true);expect(validSkillTarget(s,'warp',{x:12,y:8})).toBe(false);
 expect(validSkillTarget(s,'warp')).toBe(true);expect(previewSkill(s,'warp','down').cells.some(p=>p.x===12)).toBe(true);
 s.skillLevels.warp=5;expect(skillCooldown(s,'warp')).toBe(10);expect(validSkillTarget(s,'warp',{x:12,y:8})).toBe(true);
 s.enemyStates=[actor('e','slime',{x:12,y:8})];expect(validSkillTarget(s,'warp',{x:12,y:8})).toBe(false);
});
it('影縫いLv5は12マス、壁で止まり、実ダメージ時だけ解除',()=>{
 const g=game(),s=g.state;s.skillLevels.shadowBind=5;
 expect(previewSkill(s,'shadowBind','right').cells).toHaveLength(12);
 s.mapState.tiles[8*s.mapState.width+10]=9;s.enemyStates=[actor('front','slime',{x:9,y:8}),actor('back','slime',{x:11,y:8})];
 g.cast('shadowBind','right');expect(movementLocked(s.enemyStates[0],s.playerActionCount)).toBe(true);expect(movementLocked(s.enemyStates[1],s.playerActionCount)).toBe(false);
 g.damage(s.enemyStates[0],0,'neutral');expect(movementLocked(s.enemyStates[0],s.playerActionCount)).toBe(true);
 g.damage(s.enemyStates[0],1,'neutral');expect(movementLocked(s.enemyStates[0],s.playerActionCount)).toBe(false);
});
it('門は上限で古い順に削除し、踏む移動1回でMP3を消費',()=>{
 const g=game(),s=g.state;s.skillLevels.transferGate=1;
 placeGate(s,{x:9,y:8});s.playerActionCount++;placeGate(s,{x:15,y:15});
 expect(gateDestinations(s,{x:9,y:8})).toHaveLength(1);
 expect(g.execute({type:'move',direction:'right'})).toBe(true);expect(s.playerState.position).toEqual({x:15,y:15});expect(s.playerState.mp).toBe(97);
 s.playerActionCount++;placeGate(s,{x:13,y:13});expect(s.mapState.gates).toHaveLength(2);expect(s.mapState.gates![0].position).toEqual({x:15,y:15});
});
it('Lv3の門は転移先指定が必要で、無効な選択にMPを払わない',()=>{
 const g=game(),s=g.state;s.skillLevels.transferGate=3;
 for(const p of [{x:9,y:8},{x:14,y:14},{x:16,y:16}]){s.playerActionCount++;placeGate(s,p);}
 expect(g.execute({type:'move',direction:'right'})).toBe(false);expect(s.playerState.mp).toBe(100);
 expect(g.execute({type:'move',direction:'right',gateId:s.mapState.gates![2].id})).toBe(true);expect(s.playerState.position).toEqual({x:16,y:16});
});
it('ボス対面時に全門を撤去',()=>{
 const g=game(),s=g.state;placeGate(s,{x:9,y:8});s.mapState.bossArena={x:5,y:5,width:15,height:11};s.enemyStates=[actor('king','goblinKing',{x:16,y:10})];startBoss(s,[]);expect(s.mapState.gates).toEqual([]);
});
it('火炎瓶は敵に当たり5ダメージ、3ターンの十字床を生成しターン消費なし',()=>{
 const g=game(),s=g.state;s.enemyStates=[actor('e','slime',{x:10,y:8})];s.enemyStates[0].hp=s.enemyStates[0].maxHp=30;s.itemSlots=['fireBottle'];
 expect(bottleImpact(s,{x:1,y:0})).toEqual({x:10,y:8});const action=s.playerActionCount;
 expect(g.execute({type:'item',slot:0,target:{x:1,y:0}})).toBe(true);expect(s.enemyStates[0].hp).toBe(25);expect(s.mapState.fields).toHaveLength(5);expect(s.mapState.fields.every(f=>f.remainingTurns===3)).toBe(true);expect(s.playerActionCount).toBe(action);
});
it('火炎瓶の床は移動後に敵へ固定3ダメージ',()=>{
 const g=game(),s=g.state,e=actor('e','slime',{x:11,y:8});e.hp=e.maxHp=30;s.enemyStates=[e];s.itemSlots=['fireBottle'];g.execute({type:'item',slot:0,target:{x:1,y:0}});expect(e.hp).toBe(25);e.position={x:10,y:8};contactBottleFire(s,e,g.rng,g.events,g.damage);expect(e.hp).toBe(22);
});
it('カテゴリ抽選は40/40/20で、3-3以降の火炎瓶も候補',()=>{
 const rng=new Random(432),counts={hp:0,mp:0,other:0};let bottles=0;
 for(let i=0;i<5000;i++){const id=rollCategorizedItem({itemCategories:{hp:4,mp:4,other:2}},rng,3);counts[ITEMS[id].restoreHp?'hp':ITEMS[id].restoreMp?'mp':'other']++;if(id==='fireBottle')bottles++;}
 expect(counts.hp/5000).toBeCloseTo(.4,1);expect(counts.mp/5000).toBeCloseTo(.4,1);expect(counts.other/5000).toBeCloseTo(.2,1);expect(bottles).toBeGreaterThan(0);
});
it('洞窟3-3の追加2層は工房で編集可能で出口と目標へ到達できる',()=>{
 const p=projectFromJson(cave),stage=STAGES.find(s=>s.code==='3-3')!;
 expect(p.floors).toHaveLength(3);
 for(let n=1;n<3;n++){
  const f=p.floors[n];expect(validateProject({...p,floors:[f]})).toEqual([]);
  const seen=new Set<string>(),q=[f.spawn];
  for(let i=0;i<q.length;i++){const a=q[i],k=a.x+','+a.y;if(seen.has(k)||a.x<0||a.y<0||a.x>=f.width||a.y>=f.height||![0,2,3,7,8,11].includes(f.tiles[a.y*f.width+a.x]))continue;seen.add(k);for(const [x,y]of [[1,0],[-1,0],[0,1],[0,-1]])q.push({x:a.x+x,y:a.y+y});}
  for(const o of f.objects)expect(seen.has(o.position.x+','+o.position.y)).toBe(true);
  const generated=generateMap(stage,new Random(123),n+1);expect(generated.enemies.length).toBeGreaterThan(15);expect(generated.map.loot?.itemCategories).toEqual({hp:4,mp:4,other:2});
 }
});
it('洞窟3-1～3-3の開始宝箱に転移門が入る',()=>{
 for(const code of ['3-1','3-2','3-3']){const {map,spawn}=generateMap(STAGES.find(s=>s.code===code)!,new Random(123));expect(map.objects.some(o=>o.type==='chest'&&Math.abs(o.position.x-spawn.x)+Math.abs(o.position.y-spawn.y)<=2&&o.contents?.some(l=>l.type==='skill'&&l.id==='transferGate'))).toBe(true);}
});
