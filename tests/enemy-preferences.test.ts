import { expect, it } from 'vitest';
import { actor } from '../src/actors/Actor';
import { GameSession } from '../src/game/GameSession';
import { tryEnemySkill } from '../src/skills/EnemySkillResolver';
import { actEnemy } from '../src/ai/EnemyAI';
import { Random } from '../src/game/Random';

function setup(skill: string) {
  const s = GameSession.create(1, 13).state;
  s.mapState.tiles.fill(0); s.mapState.objects = []; s.mapState.installations = []; s.mapState.crystals = [];
  const p = s.playerState; p.position = { x: 8, y: 8 };
  const e = actor('enemy', 'goblinMage', { x: 8, y: 9 });
  e.enemySkillIds = [skill]; e.skillChances = { [skill]: 1 }; e.mp = 20;
  const hits: number[] = [];
  const context = { action: 1, allies: [e], map: s.mapState, actors: [p, e], rng: new Random(17), events: [], damage: (_: unknown, damage: number) => { hits.push(damage); }, log: () => {} };
  return { p, e, hits, context };
}

it('uses normal melee instead of weaker stone throw when adjacent', () => {
  const { p, e, context } = setup('stoneThrow');
  let attacks = 0;
  actEnemy(context.map, e, [p], context.actors, context.rng, () => attacks++, 1,
    (caster, targets) => tryEnemySkill(caster, targets, context));
  expect(attacks).toBe(1); expect(e.mp).toBe(20);
});

it('keeps stronger ranged attacks available at melee distance', () => {
  const { p, e, context, hits } = setup('fireball');
  expect(tryEnemySkill(e, [p], context)).toBe(true);
  expect(hits).toHaveLength(1);
});

it('teleports onto a cardinal firing position within two cells of the player', () => {
  const { p, e, context } = setup('teleport');
  expect(tryEnemySkill(e, [p], context)).toBe(true);
  const dx = Math.abs(p.position.x - e.position.x), dy = Math.abs(p.position.y - e.position.y);
  expect(dx === 0 || dy === 0).toBe(true);
  expect(dx + dy).toBeGreaterThan(0); expect(dx + dy).toBeLessThanOrEqual(2);
});
