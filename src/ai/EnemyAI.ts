/** 敵と召喚味方の索敵・追跡・攻撃。追跡疲労は1行動ずつスキップし抽選で回復。 */
import { canStand, distance, lineOfSight, occupied, same } from '../game/MapState';
import { Random } from '../game/Random';
import { detection } from '../game/ActorStats';
import { VECTORS, type Actor, type Direction, type MapState, type Point } from '../game/types';
export function faceToward(a: Actor, target: Point): Direction { const dx = target.x - a.position.x, dy = target.y - a.position.y; return Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up'; }
export function actorDistance(a: Actor, b: Actor): number { return Math.min(...occupied(a).flatMap(c => occupied(b).map(t => distance(c, t)))); }
/** 占有は正方形なので、向きが変わっても占有セルは変わりません。 */
export function oriented(a: Actor, facing: Direction): Actor {
  return { ...a, facing };
}
function turn(map: MapState, a: Actor, facing: Direction, blockers: Actor[]): void {
  const rotated = oriented(a, facing);
  if (canStand(map, rotated, a.position, blockers)) { a.facing = facing; a.cells = rotated.cells; }
}
function sees(map: MapState, a: Actor, b: Actor): boolean { return occupied(a).some(c => occupied(b).some(t => Math.max(Math.abs(c.x - t.x), Math.abs(c.y - t.y)) <= detection(a) && lineOfSight(map, c, t))); }
export function moveToward(map: MapState, a: Actor, target: Point, blockers: Actor[]): void {
  if (a.immobile) return;
  const queue: { p: Point; first: Point | null; facing: Direction; firstDir: Direction }[] = [{ p: a.position, first: null, facing: a.facing, firstDir: a.facing }];
  const visited = new Set([`${a.position.x},${a.position.y}`]);
  let best = distance(a.position, target), chosen: Point | null = null, chosenDir = a.facing;
  for (let i = 0; i < queue.length && i < map.width * map.height; i++) {
    const { p, first, firstDir } = queue[i];
    if (distance(p, target) < best) { best = distance(p, target); chosen = first; chosenDir = firstDir; }
    if (same(p, target)) break;
    for (const dir of a.directions) {
      const v = VECTORS[dir], next = { x: p.x + v.x, y: p.y + v.y }, k = `${next.x},${next.y}`, rotated = oriented(a, dir);
      if (visited.has(k) || !canStand(map, rotated, p, blockers) || !canStand(map, rotated, next, blockers)) continue;
      visited.add(k); queue.push({ p: next, first: first ?? next, facing: dir, firstDir: first ? firstDir : dir });
    }
  }
  if (chosen) { a.facing = chosenDir; a.cells = oriented(a, chosenDir).cells; a.position = chosen; }
}
export function actEnemy(map: MapState, enemy: Actor, targets: Actor[], blockers: Actor[], rng: Random, attack: (a: Actor, b: Actor) => void, action = 0, skill?: (caster: Actor, targets: Actor[]) => boolean): void {
  if (enemy.hp <= 0) return;
  enemy.chaseMoveLimit ??= 12; enemy.chaseMoves ??= 0; enemy.chaseSkipLeft ??= 0; enemy.chaseRecoveryChance ??= .3;
  if (enemy.kind !== 'sprite' && enemy.mode === 'hostile' && (enemy.chaseSkipLeft > 0 || enemy.chaseMoves >= enemy.chaseMoveLimit)) {
    // この行動はスキップ。全対象が索敵距離外なら敵視解除、範囲内なら敵視を維持します。
    if (!targets.some(t => t.hp > 0 && occupied(t).some(c => occupied(enemy).some(p => Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) <= detection(enemy))))) {
      enemy.mode = 'idle'; enemy.lastSeen = null; enemy.pursuitLeft = 0; enemy.chaseMoves = 0; enemy.chaseSkipLeft = 0;
    } else if (rng.next() < enemy.chaseRecoveryChance) {
      enemy.chaseSkipLeft = 0; enemy.chaseMoves = 0;
    } else enemy.chaseSkipLeft = 1;
    return;
  }
  const visible = targets.filter(t => t.hp > 0 && sees(map, enemy, t)).sort((a, b) => actorDistance(enemy, a) - actorDistance(enemy, b));
  const target = enemy.priorityTarget === 'player' ? visible.find(t => t.kind === 'player') ?? visible[0] : visible[0];
  if (target) {
    if (enemy.mode !== 'hostile') enemy.alertedAt = action;
    turn(map, enemy, faceToward(enemy, target.position), blockers);
    enemy.mode = 'hostile'; enemy.lastSeen = { ...target.position }; enemy.pursuitLeft = enemy.pursuitTurns;
    if (skill?.(enemy, visible)) { enemy.chaseMoves = 0; return; }
    const inAttackCell = occupied(enemy).some(c => enemy.attackCells.some(offset => occupied(target).some(t => same(t, { x: c.x + offset.x, y: c.y + offset.y }))));
    if (actorDistance(enemy, target) <= enemy.attackRange && inAttackCell) { enemy.chaseMoves = 0; attack(enemy, target); }
    else { const before = enemy.position; moveToward(map, enemy, target.position, blockers); if (!same(before, enemy.position)) enemy.chaseMoves++; }
    return;
  }
  if (enemy.mode === 'hostile' && enemy.lastSeen && enemy.pursuitLeft > 0) {
    enemy.pursuitLeft--; moveToward(map, enemy, enemy.lastSeen, blockers); enemy.chaseMoves++;
    if (same(enemy.position, enemy.lastSeen)) enemy.pursuitLeft = 0;
  } else {
    enemy.mode = 'idle'; enemy.lastSeen = null; enemy.chaseMoves = 0;
    if (!enemy.immobile && enemy.pattern === 'patrol' && rng.next() < .35) {
      const v = VECTORS[enemy.directions[rng.int(0, enemy.directions.length - 1)]];
      const p = { x: enemy.position.x + v.x, y: enemy.position.y + v.y };
      const rotated = oriented(enemy, faceToward(enemy, p));
      if (canStand(map, rotated, enemy.position, blockers) && canStand(map, rotated, p, blockers)) { enemy.facing = rotated.facing; enemy.cells = rotated.cells; enemy.position = p; }
    }
  }
}
