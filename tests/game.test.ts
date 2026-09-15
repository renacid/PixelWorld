import { describe, expect, it } from 'vitest';
import { actor, rectangle } from '../src/actors/Actor';
import { GameSession } from '../src/game/GameSession';
import { Random } from '../src/game/Random';
import { canStand, generateMap, lineOfSight, occupied, wall } from '../src/game/MapState';
import { applyAttribute, tickAttributes } from '../src/skills/AttributeSystem';
import { connectionBonus, shape, validPlacement } from '../src/skills/SkillBag';
import { previewSkill } from '../src/skills/SkillResolver';
import { SaveManager } from '../src/game/SaveManager';
import { STAGES } from '../src/stages';
import { actEnemy } from '../src/ai/EnemyAI';
import type { BagBlock, GameEvent } from '../src/game/types';

function cleanSession() { const s = GameSession.create(1, 123); s.state.enemyStates = []; s.state.mapState.objects = []; return s; }
function equip(s: GameSession) { for (const id of ['attack', 'fireball', 'thunder', 'tornado', 'firerain'] as const) s.acquireSkill(id); s.state.pendingBag = false; }
describe('deterministic turns and MP', () => {
  it('replays the same commands and seed, including AI random movements', () => {
    const a = GameSession.create(3, 9283), b = GameSession.create(3, 9283);
    for (let i = 0; i < 35; i++) { a.execute({ type: 'wait' }); b.execute({ type: 'wait' }); }
    expect(a.state).toEqual(b.state);
  });
  it('restores the RNG cursor exactly when resuming', () => {
    const a = GameSession.create(2, 1993);
    for (let i = 0; i < 8; i++) a.execute({ type: 'wait' });
    const b = new GameSession(structuredClone(a.state));
    for (let i = 0; i < 8; i++) { a.execute({ type: 'wait' }); b.execute({ type: 'wait' }); }
    expect(a.state).toEqual(b.state);
  });
  it('regenerates 3 MP every 5 actions, capped at 20', () => {
    const s = cleanSession(); s.state.playerState.mp = 16;
    for (let i = 0; i < 4; i++) s.execute({ type: 'wait' }); expect(s.state.playerState.mp).toBe(16);
    s.execute({ type: 'wait' }); expect(s.state.playerState.mp).toBe(19);
    for (let i = 0; i < 5; i++) s.execute({ type: 'wait' }); expect(s.state.playerState.mp).toBe(20);
  });
  it('does not consume a turn or attack when walking into an enemy or wall', () => {
    const s = cleanSession(); s.state.enemyStates = [actor('test', 'slime', { x: 4, y: 3 })];
    expect(s.execute({ type: 'move', direction: 'right' })).toBe(false);
    expect(s.state.playerActionCount).toBe(0); expect(s.state.enemyStates[0].hp).toBe(14);
  });
  it('keeps cooldown on the cast turn and decrements once per subsequent player action', () => {
    const s = cleanSession(); equip(s);
    s.execute({ type: 'cast', skillId: 'thunder', direction: 'down' });
    expect(s.state.cooldowns.thunder).toBe(3);
    expect(s.execute({ type: 'cast', skillId: 'thunder', direction: 'down' })).toBe(false);
    for (let i = 0; i < 3; i++) s.execute({ type: 'wait' });
    expect(s.state.cooldowns.thunder).toBe(0); expect(s.state.playerActionCount).toBe(4);
  });
  it('allies attack before enemies act', () => {
    const s = cleanSession(), ally = actor('ally', 'sprite', { x: 4, y: 3 }), enemy = actor('enemy', 'slime', { x: 4, y: 4 });
    enemy.hp = 1; s.state.allyStates = [ally]; s.state.enemyStates = [enemy]; s.execute({ type: 'wait' });
    expect(s.state.enemyStates).toHaveLength(0); expect(ally.hp).toBe(16);
  });
});
describe('attributes and sequential hits', () => {
  it('explodes immediately on fire + thunder in either order at 120% of the triggering hit', () => {
    for (const pair of [['fire', 'thunder'], ['thunder', 'fire']] as const) {
      const s = cleanSession(), target = actor('target', 'boss', { x: 5, y: 5 });
      applyAttribute(target, pair[0], 10, 1, [target], s.damage, []);
      applyAttribute(target, pair[1], 13, 2, [target], s.damage, []);
      expect(target.afflictions).toHaveLength(0); expect(target.hp).toBeCloseTo(125 - 15.6);
    }
  });
  it('refreshes a same-element aura and expires after 10 subsequent actions', () => {
    const s = cleanSession(), target = actor('target', 'boss', { x: 5, y: 5 });
    applyAttribute(target, 'fire', 10, 1, [target], s.damage, []); tickAttributes(target, 1);
    expect(target.afflictions[0].remainingTurns).toBe(10);
    for (let n = 2; n <= 5; n++) tickAttributes(target, n);
    applyAttribute(target, 'fire', 10, 6, [target], s.damage, []); tickAttributes(target, 6);
    expect(target.afflictions[0].remainingTurns).toBe(10);
    for (let n = 7; n <= 15; n++) tickAttributes(target, n);
    expect(target.afflictions[0].remainingTurns).toBe(1); tickAttributes(target, 16); expect(target.afflictions).toHaveLength(0);
  });
  it('swirls to the adjacent diagonal at 10% damage; secondary explosions are allowed', () => {
    const s = cleanSession(), a = actor('a', 'slime', { x: 5, y: 5 }), b = actor('b', 'slime', { x: 6, y: 6 }), far = actor('far', 'slime', { x: 7, y: 5 });
    const enemies = [a, b, far], events: GameEvent[] = [];
    applyAttribute(a, 'fire', 10, 1, enemies, s.damage, events); applyAttribute(b, 'thunder', 10, 1, enemies, s.damage, events);
    applyAttribute(a, 'wind', 7, 2, enemies, s.damage, events);
    expect(b.hp).toBeCloseTo(12.5); // .7 splash + .8 rounded explosion
    expect(far.hp).toBe(14); expect(a.afflictions).toHaveLength(0); expect(b.afflictions).toHaveLength(0);
    expect(events.filter(e => e.text === '風散')).toHaveLength(1); expect(events.filter(e => e.text === '爆破')).toHaveLength(1);
  });
  it('fire rain covers 24 cells, hits a large enemy 3 times total, explodes on hit one, then reapplies fire', () => {
    const s = cleanSession(); equip(s); s.state.playerState.criticalRate = 0;
    const target = actor('target', 'golem', { x: 4, y: 3 }); s.state.enemyStates = [target];
    applyAttribute(target, 'thunder', 10, 0, [target], s.damage, []);
    expect(previewSkill(s.state, 'firerain', 'down').cells).toHaveLength(24);
    const preview = previewSkill(s.state, 'firerain', 'down'); expect(preview.targetIds).toEqual(['target']);
    s.execute({ type: 'cast', skillId: 'firerain', direction: 'down' });
    // Auto layout keeps the fire spells separate: 3 x 3 damage plus 3.6 explosion.
    expect(s.events.filter(e => e.type === 'reaction' && e.text === '爆破')).toHaveLength(1);
    expect(s.events.filter(e => e.type === 'damage' && e.position.x === 4)).toHaveLength(4);
    expect(target.afflictions.map(a => a.attribute)).toEqual(['fire']);
    expect(target.afflictions[0].remainingTurns).toBe(10); expect(s.state.cooldowns.firerain).toBe(10); expect(s.state.playerState.mp).toBe(10);
  });
  it('caps coexisting auras at 2', () => {
    const s = cleanSession(), a = actor('a', 'slime', { x: 5, y: 5 });
    for (const attr of ['earth', 'ice', 'fire'] as const) applyAttribute(a, attr, 5, 0, [a], s.damage, []);
    expect(a.afflictions.map(f => f.attribute)).toEqual(['ice', 'fire']);
  });
});
describe('skills, bag and drops', () => {
  it('grants attack from the first chest and pauses for bag placement', () => {
    const s = GameSession.create(1, 123); s.execute({ type: 'move', direction: 'down' });
    expect(s.state.skillLevels.attack).toBe(1); expect(s.state.pendingBag).toBe(true);
    expect(s.execute({ type: 'wait' })).toBe(false);
  });
  it('levels duplicates without adding a block', () => {
    const s = cleanSession(); s.acquireSkill('fireball'); s.acquireSkill('fireball');
    expect(s.state.skillBag).toHaveLength(1); expect(s.state.skillLevels.fireball).toBe(2);
  });
  it('links edges of matching attributes, excluding diagonal contacts', () => {
    const bag: BagBlock[] = [{ skillId: 'fireball', position: { x: 0, y: 0 }, rotation: 0 }, { skillId: 'firerain', position: { x: 1, y: 0 }, rotation: 0 }];
    expect(connectionBonus(bag, 'fireball')).toBe(1); expect(connectionBonus(bag, 'firerain')).toBe(1);
    bag[1].position = { x: 1, y: 2 }; expect(connectionBonus(bag, 'fireball')).toBe(0);
    expect(validPlacement(bag, 'firerain', { x: 0, y: 1 }, 0)).toBe(false);
    expect(validPlacement(bag, 'firerain', { x: 4, y: 4 }, 0)).toBe(false);
    expect(shape('tornado', 1)).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }]);
  });
  it('stops line skills at the first enemy and at walls', () => {
    const s = cleanSession(); s.state.enemyStates = [actor('a', 'slime', { x: 5, y: 3 }), actor('b', 'slime', { x: 6, y: 3 })];
    expect(previewSkill(s.state, 'fireball', 'right').targetIds).toEqual(['a']);
    s.state.mapState.tiles[3 * s.state.mapState.width + 4] = 1;
    expect(previewSkill(s.state, 'fireball', 'right')).toEqual({ cells: [], targetIds: [], blocked: { x: 4, y: 3 } });
  });
  it('attack costs 1 MP, has 0 cooldown and deals between 50–70% before crit', () => {
    const s = cleanSession(); s.acquireSkill('attack'); s.state.pendingBag = false; s.state.playerState.criticalRate = 0;
    s.state.enemyStates = [actor('target', 'boss', { x: 4, y: 3 })];
    s.execute({ type: 'cast', skillId: 'attack', direction: 'right' });
    const hit = s.events.find(e => e.type === 'damage')!;
    expect(hit.amount).toBeGreaterThanOrEqual(5); expect(hit.amount).toBeLessThanOrEqual(7); expect(s.state.playerState.mp).toBe(19); expect(s.state.cooldowns.attack).toBe(0);
  });
  it('pushes tornado targets one cell if the entire footprint fits', () => {
    const s = cleanSession(); s.acquireSkill('tornado'); s.state.pendingBag = false;
    const target = actor('target', 'golem', { x: 5, y: 3 }); s.state.enemyStates = [target];
    s.state.playerActionCount = 1; s.cast('tornado', 'right'); expect(target.position).toEqual({ x: 6, y: 3 });
  });
  it('leaves items on the floor when all 3 slots are full, picks them up after use', () => {
    const s = cleanSession(); s.state.itemSlots = ['potion', 'ether', 'scope']; s.state.playerState.hp = 10;
    s.state.mapState.objects = [{ id: 'floor', type: 'item', position: { ...s.state.playerState.position }, itemId: 'potion' }];
    s.execute({ type: 'wait' }); expect(s.state.mapState.objects).toHaveLength(1);
    s.execute({ type: 'item', slot: 0 }); expect(s.state.mapState.objects).toHaveLength(0); expect(s.state.itemSlots).toHaveLength(3); expect(s.state.playerState.hp).toBe(25);
  });
});
describe('maps, AI, stages and saves', () => {
  it('all 5 stages have reachable treasure and exits, with large guardians on stages 4 and 5', () => {
    for (const stage of STAGES) for (let seed = 0; seed < 5; seed++) {
      const { map, enemies } = generateMap(stage, new Random(seed));
      const queue = [{ x: 3, y: 3 }], seen = new Set(['3,3']);
      for (let i = 0; i < queue.length; i++) for (const v of [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }]) {
        const p = { x: queue[i].x + v.x, y: queue[i].y + v.y }, k = `${p.x},${p.y}`;
        if (seen.has(k) || wall(map, p)) continue; seen.add(k); queue.push(p);
      }
      for (const o of map.objects) expect(seen.has(`${o.position.x},${o.position.y}`)).toBe(true);
      if (stage.id === 4) expect(enemies.some(e => e.kind === 'golem')).toBe(true);
      if (stage.id === 5) expect(enemies.some(e => e.kind === 'boss')).toBe(true);
    }
  });
  it('supports footprints of 1, 2, 4, 6, 9 cells and rejects partial wall collisions', () => {
    const s = cleanSession();
    for (const [w, h] of [[1, 1], [1, 2], [2, 2], [2, 3], [3, 3]]) { const a = actor('large', 'golem', { x: 4, y: 4 }); a.cells = rectangle(w, h); expect(occupied(a)).toHaveLength(w * h); expect(canStand(s.state.mapState, a, { x: 0, y: 0 })).toBe(false); }
  });
  it('AI remembers last seen location when player moves out of sight', () => {
    const s = cleanSession(), e = actor('wolf', 'wolf', { x: 8, y: 3 }), p = s.state.playerState;
    actEnemy(s.state.mapState, e, [p], [e, p], s.rng, () => {}); expect(e.mode).toBe('hostile'); expect(e.lastSeen).toEqual({ x: 3, y: 3 });
    p.position = { x: 3, y: 17 }; actEnemy(s.state.mapState, e, [p], [e, p], s.rng, () => {}); expect(e.pursuitLeft).toBe(5); expect(e.lastSeen).toEqual({ x: 3, y: 3 });
  });
  it('hides terrain behind opaque walls and remembers explored terrain', () => {
    const s = cleanSession(); s.state.mapState.tiles[3 * 19 + 4] = 1;
    expect(lineOfSight(s.state.mapState, { x: 3, y: 3 }, { x: 5, y: 3 })).toBe(false); expect(s.visible({ x: 5, y: 3 })).toBe(false);
    s.state.playerState.position = { x: 15, y: 15 }; s.explore(); expect(s.state.exploredMap[3 * 19 + 3]).toBe(true);
  });
  it('stage 1 requires treasure before exit; stage 5 requires defeating boss', () => {
    const s = GameSession.create(1, 8); s.state.enemyStates = []; const exit = s.state.mapState.objects.find(o => o.type === 'exit')!;
    s.state.playerState.position = { ...exit.position }; s.execute({ type: 'wait' }); expect(s.state.status).toBe('playing');
    s.state.objectiveChests = 1; s.execute({ type: 'wait' }); expect(s.state.status).toBe('cleared');
    const boss = GameSession.create(5, 8); expect(boss.goalReady()).toBe(false); boss.state.enemyStates = boss.state.enemyStates.filter(e => e.kind !== 'boss'); expect(boss.goalReady()).toBe(true);
  });
  it('saves pending bag, resumes, rejects malformed saves and records stage unlocks', () => {
    const data = new Map<string, string>(), storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } };
    const saves = new SaveManager(storage), s = GameSession.create(1, 42); s.execute({ type: 'move', direction: 'down' });
    expect(saves.save(s.state)).toBe(true); expect(saves.load()).toEqual(s.state); saves.complete(1); expect(saves.progress()).toBe(1);
    storage.setItem('pixel-world.save.v1', '{broken'); expect(saves.load()).toBeNull();
    storage.setItem('pixel-world.save.v1', JSON.stringify({ version: 1 })); expect(saves.load()).toBeNull();
    const bad = structuredClone(s.state); bad.playerState.position.x = -1; saves.save(bad); expect(saves.load()).toBeNull();
  });
  it('reports denied localStorage without crashing gameplay', () => {
    const storage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => {} };
    const saves = new SaveManager(storage); expect(saves.save(cleanSession().state)).toBe(false); expect(saves.load()).toBeNull(); expect(saves.error).toBeTruthy();
  });
});
