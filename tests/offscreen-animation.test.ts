import { expect, it } from 'vitest';
import { actor } from '../src/actors/Actor';
import { TurnAnimation } from '../src/render/TurnAnimation';
import type { TurnFrame } from '../src/game/types';

it('skips offscreen repeated casts without changing the simulation frames', () => {
  const player = actor('player', 'player', { x: 2, y: 2 });
  const enemy = actor('far', 'goblin', { x: 20, y: 20 });
  const actors = [player, enemy];
  const frames: TurnFrame[] = [
    { phase: 'player', actors, events: [] },
    ...Array.from({ length: 3 }, (): TurnFrame => ({ phase: 'enemy', actors,
      events: [{ type: 'cast', actorId: enemy.id, position: enemy.position }] })),
  ];
  const original = structuredClone(frames);
  const animation = new TurnAnimation(actors, frames, a => a.id === 'player', e => e.actorId === 'player');
  expect(animation.duration).toBe(230);
  expect(animation.steps).toHaveLength(1);
  expect(frames).toEqual(original);
  const visible = new TurnAnimation(actors, frames, () => true, () => true);
  expect(visible.duration).toBe(230 + 580 * 3);
});
