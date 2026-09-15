import { canStand, distance, lineOfSight, occupied, same } from '../game/MapState';
import { Random } from '../game/Random';
import { VECTORS, type Actor, type MapState, type Point } from '../game/types';
export function actorDistance(a: Actor, b: Actor): number { return Math.min(...occupied(a).flatMap(c => occupied(b).map(t => distance(c, t)))); }
function sees(map: MapState, a: Actor, b: Actor): boolean { return occupied(a).some(c => occupied(b).some(t => distance(c, t) <= a.detectionRange && lineOfSight(map, c, t))); }
export function moveToward(map: MapState, a: Actor, target: Point, blockers: Actor[]): void {
  const queue: { p: Point; first: Point | null }[] = [{ p: a.position, first: null }];
  const visited = new Set([`${a.position.x},${a.position.y}`]);
  let best = distance(a.position, target), chosen: Point | null = null;
  for (let i = 0; i < queue.length && i < 450; i++) {
    const { p, first } = queue[i];
    if (distance(p, target) < best) { best = distance(p, target); chosen = first; }
    if (same(p, target)) break;
    for (const dir of a.directions) {
      const v = VECTORS[dir], next = { x: p.x + v.x, y: p.y + v.y }, k = `${next.x},${next.y}`;
      if (visited.has(k) || !canStand(map, a, next, blockers)) continue;
      visited.add(k); queue.push({ p: next, first: first ?? next });
    }
  }
  if (chosen) a.position = chosen;
}
export function actEnemy(map: MapState, enemy: Actor, targets: Actor[], blockers: Actor[], rng: Random, attack: (a: Actor, b: Actor) => void): void {
  if (enemy.hp <= 0) return;
  const visible = targets.filter(t => t.hp > 0 && sees(map, enemy, t)).sort((a, b) => actorDistance(enemy, a) - actorDistance(enemy, b));
  const target = enemy.priorityTarget === 'player' ? visible.find(t => t.kind === 'player') ?? visible[0] : visible[0];
  if (target) {
    enemy.mode = 'hostile'; enemy.lastSeen = { ...target.position }; enemy.pursuitLeft = enemy.pursuitTurns;
    const inAttackCell = occupied(enemy).some(c => enemy.attackCells.some(offset => occupied(target).some(t => same(t, { x: c.x + offset.x, y: c.y + offset.y }))));
    if (actorDistance(enemy, target) <= enemy.attackRange && inAttackCell) attack(enemy, target);
    else moveToward(map, enemy, target.position, blockers);
    return;
  }
  if (enemy.mode === 'hostile' && enemy.lastSeen && enemy.pursuitLeft > 0) {
    enemy.pursuitLeft--; moveToward(map, enemy, enemy.lastSeen, blockers);
    if (same(enemy.position, enemy.lastSeen)) enemy.pursuitLeft = 0;
  } else {
    enemy.mode = 'idle'; enemy.lastSeen = null;
    if (enemy.pattern === 'patrol' && rng.next() < .35) {
      const v = VECTORS[enemy.directions[rng.int(0, enemy.directions.length - 1)]];
      const p = { x: enemy.position.x + v.x, y: enemy.position.y + v.y };
      if (canStand(map, enemy, p, blockers)) enemy.position = p;
    }
  }
}
