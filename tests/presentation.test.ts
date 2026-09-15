import { afterEach, describe, expect, it, vi } from 'vitest';
import { actor } from '../src/actors/Actor';
import { actEnemy } from '../src/ai/EnemyAI';
import { GameSession } from '../src/game/GameSession';
import { SaveManager } from '../src/game/SaveManager';
import { spritePixels } from '../src/render/SpriteAtlas';
import { interpolate, TurnAnimation } from '../src/render/TurnAnimation';
import { BALANCE } from '../src/game/TurnManager';
import { SoundManager } from '../src/audio/SoundManager';
import type { Actor, Direction } from '../src/game/types';

describe('movement and turn presentation', () => {
  it('interpolates a movement through the center instead of jumping, without changing game state', () => {
    const s = GameSession.create(1, 13); s.state.enemyStates = [];
    const before = structuredClone(s.actors); s.execute({ type: 'move', direction: 'right' });
    const animation = new TurnAnimation(before, s.frames, () => true);
    expect(animation.sample(0)!.actors[0].position.x).toBe(3);
    expect(animation.sample(115)!.actors[0].position.x).toBe(3.5);
    expect(s.state.playerState.position.x).toBe(4);
    expect(animation.sample(animation.duration)).toBeNull();
    expect(interpolate(0, 1, -1)).toBe(0); expect(interpolate(0, 1, 2)).toBe(1);
  });
  it('records ally/enemy attack events after the player phase', () => {
    const s = GameSession.create(1, 13); s.state.mapState.objects = [];
    s.state.allyStates = [actor('ally-test', 'sprite', { x: 4, y: 4 })];
    s.state.enemyStates = [actor('enemy-test', 'golem', { x: 4, y: 3 })];
    s.execute({ type: 'wait' });
    expect(s.frames.map(f => f.phase)).toEqual(['player', 'ally', 'enemy']);
    expect(s.frames[1].events.find(e => e.type === 'attack')?.actorId).toBe('ally-test');
    expect(s.frames[2].events.find(e => e.type === 'attack')?.actorId).toBe('enemy-test');
  });
  it('records a single animated projectile with path rather than simultaneous squares', () => {
    const s = GameSession.create(1, 13); s.state.enemyStates = []; s.acquireSkill('fireball'); s.state.pendingBag = false;
    s.execute({ type: 'cast', skillId: 'fireball', direction: 'right' });
    const events = s.frames[0].events.filter(e => e.type === 'cast');
    expect(events).toHaveLength(1); expect(events[0].path).toHaveLength(5); expect(events[0].skillId).toBe('fireball'); expect(events[0].position).toEqual({ x: 3, y: 3 });
  });
  it('faces its movement/attack direction and alerts only on entering hostility', () => {
    const s = GameSession.create(1, 13), e = actor('test', 'slime', { x: 4, y: 3 }), p = s.state.playerState;
    actEnemy(s.state.mapState, e, [p], [e, p], s.rng, () => {}, 1); expect(e.facing).toBe('left'); expect(e.alertedAt).toBe(1);
    actEnemy(s.state.mapState, e, [p], [e, p], s.rng, () => {}, 2); expect(e.alertedAt).toBe(1);
    e.mode = 'idle'; actEnemy(s.state.mapState, e, [p], [e, p], s.rng, () => {}, 9); expect(e.alertedAt).toBe(9);
  });
  it('has distinct 16×16 art for all 4 directions of every character', () => {
    for (const kind of ['player', 'slime', 'wolf', 'golem', 'boss', 'sprite'] as Actor['kind'][]) {
      const images = (['up', 'down', 'left', 'right'] as Direction[]).map(d => spritePixels(kind, d));
      expect(new Set(images.map(image => image.join('\n'))).size).toBe(4);
      for (const image of images) { expect(image).toHaveLength(16); expect(image.every(row => row.length === 16)).toBe(true); }
    }
  });
  it('fills new facing fields when resuming a legacy save', () => {
    const old = structuredClone(GameSession.create(1, 13).state);
    for (const a of old.enemyStates) { delete (a as Partial<Actor>).facing; delete (a as Partial<Actor>).alertedAt; }
    const resumed = new GameSession(old); expect(resumed.state.enemyStates.every(a => a.facing === 'down' && a.alertedAt === -1)).toBe(true);
  });
});
describe('scarce supplies and sound', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('starts empty and removes loose map supplies while preserving mandatory chests', () => {
    let supplies = 0;
    for (let seed = 0; seed < 100; seed++) {
      const s = GameSession.create(1, seed), objects = s.state.mapState.objects;
      expect(s.state.itemSlots).toHaveLength(0); expect(objects.filter(o => o.type === 'item')).toHaveLength(0);
      expect(objects.filter(o => o.type === 'chest').length).toBeLessThanOrEqual(5);
      expect(objects.some(o => o.skillId === 'attack')).toBe(true); expect(objects.some(o => o.skillId === 'firerain')).toBe(true);
      if (objects.some(o => o.id === 'supply-cache')) supplies++;
    }
    expect(supplies).toBeGreaterThan(10); expect(supplies).toBeLessThan(40); expect(BALANCE.dropChance).toBe(.12);
  });
  it('persists the mute setting and defaults sound on for existing settings', () => {
    const data = new Map<string, string>();
    const store = new SaveManager({ getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: k => { data.delete(k); } });
    expect(store.settings().sound).toBe(true); store.saveSettings({ grid: true, motion: true, sound: false }); expect(store.settings().sound).toBe(false);
  });
  it('synthesizes effects only after unlock and stops scheduling when muted', () => {
    const oscillators: { type: string; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
    const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() });
    class FakeAudio {
      currentTime = 1; state = 'running'; destination = {};
      createGain() { return { gain: param(), connect: vi.fn(), disconnect: vi.fn() }; }
      createOscillator() { const osc = { frequency: param(), type: 'sine', connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null }; oscillators.push(osc); return osc; }
      resume() { return Promise.resolve(); }
    }
    vi.stubGlobal('window', { AudioContext: FakeAudio });
    const sound = new SoundManager(); sound.step(); expect(oscillators).toHaveLength(0);
    sound.unlock(); sound.play({ type: 'cast', position: { x: 0, y: 0 }, skillId: 'firerain' }); expect(oscillators).toHaveLength(3);
    expect(oscillators.every(o => o.start.mock.calls.length === 1 && o.stop.mock.calls.length === 1)).toBe(true);
    sound.setEnabled(false); sound.step(); sound.play({ type: 'pickup', position: { x: 0, y: 0 } }); expect(oscillators).toHaveLength(3);
    sound.setEnabled(true); sound.step(); expect(oscillators).toHaveLength(4);
  });
});
