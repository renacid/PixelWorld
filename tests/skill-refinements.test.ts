import {expect,it,vi} from 'vitest';
import {GameSession} from '../src/game/GameSession';
import {actor} from '../src/actors/Actor';
import {previewSkill,validSkillTargets} from '../src/skills/SkillResolver';
import {triggerEarthBlessing} from '../src/skills/EarthBlessing';
function game(){const g=GameSession.create(1,123);const s=g.state;s.mapState.tiles.fill(0);s.mapState.objects=[];s.mapState.traps=[];s.mapState.installations=[];s.enemyStates=[];s.allyStates=[];s.playerState.position={x:8,y:8};s.playerState.criticalRate=0;return g;}
it('落雷は両結晶を除外し壺と氷柱を対象にする',()=>{
 const g=game(),s=g.state;s.playerActionCount=2;
 s.mapState.crystals=['ice','thunder'].map((attribute,i)=>({id:'crystal'+i,attribute:attribute as 'ice'|'thunder',position:{x:9+i,y:8},source:{actorId:'player',team:'player',attack:10},damage:3,placedAt:0,remainingTurns:5}));
 s.mapState.installations=[{id:'pot',kind:'pot',position:{x:7,y:8},spawned:0},{id:'pillar',kind:'icePillar',position:{x:8,y:9},spawned:0}];
 expect(previewSkill(s,'randomThunder','down').targetIds).toEqual(['pot','pillar']);
 s.skillLevels.randomThunder=5;g.cast('randomThunder','down');expect(s.mapState.crystals).toHaveLength(2);expect(s.mapState.installations).toHaveLength(0);
});
it('ファイヤーレインLv5は周囲7×7',()=>{const g=game();g.state.skillLevels.firerain=5;expect(previewSkill(g.state,'firerain','down').cells).toHaveLength(48);});
it('アイスストーンLv5は異なる2点必須、消費は1回、重なりは2回命中',()=>{
 const g=game(),s=g.state;s.skillLevels.icestone=5;s.skillBag=[{skillId:'icestone',position:{x:0,y:0},rotation:0}];
 const a={x:9,y:8},b={x:10,y:8};expect(validSkillTargets(s,'icestone',a)).toBe(false);expect(validSkillTargets(s,'icestone',a,a)).toBe(false);expect(validSkillTargets(s,'icestone',a,b)).toBe(true);
 const e=actor('enemy','slime',a);e.hp=e.maxHp=100;s.enemyStates=[e];g.cast('icestone','right',a,b);expect(e.hp).toBe(82);expect(s.playerState.mp).toBe(12);expect(s.cooldowns.icestone).toBe(10);
});
it('大地の祝福は成長と重複なしの3効果、CT中は再発動しない',()=>{
 const g=game(),s=g.state;s.skillLevels.earthBlessing=5;s.skillBag=[{skillId:'earthBlessing',position:{x:0,y:0},rotation:0}];s.playerState.hp=1;s.playerState.maxMp=s.playerState.mp=100;
 vi.spyOn(g.rng,'int').mockImplementation((_,max)=>max);const log=vi.fn();expect(triggerEarthBlessing(s,g.rng,g.events,log)).toBe(true);
 expect(s.allyStates[0].remainingLife).toBe(50);expect(s.allyStates[0].attack).toBe(actor('base','sprite',{x:0,y:0}).attack+4);expect(s.playerState.buffs?.[0].attackBonus).toBe(7);expect(s.cooldowns.earthBlessing).toBe(5);expect(log.mock.calls.filter(c=>c[0].startsWith('大地の祝福！'))).toHaveLength(3);expect(triggerEarthBlessing(s,g.rng,g.events,log)).toBe(false);
});
it('罠への移動時に祝福が発動する',()=>{const g=game(),s=g.state;s.skillBag=[{skillId:'earthBlessing',position:{x:0,y:0},rotation:0}];s.skillLevels.earthBlessing=1;s.mapState.traps=[{id:'heal',trapId:'healing',position:{x:9,y:8},triggered:false}];expect(g.execute({type:'move',direction:'right'})).toBe(true);expect(s.cooldowns.earthBlessing).toBe(5);});
