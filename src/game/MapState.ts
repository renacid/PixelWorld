import { actor } from '../actors/Actor';
import { Random } from './Random';
import type { Actor, MapState, Point, Stage } from './types';
export const key = (p: Point) => `${p.x},${p.y}`;
export const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export function occupied(a: Actor, position = a.position): Point[] { return a.cells.map(c => ({ x: position.x + c.x, y: position.y + c.y })); }
export function wall(map: MapState, p: Point): boolean { return p.x < 0 || p.y < 0 || p.x >= map.width || p.y >= map.height || map.tiles[p.y * map.width + p.x] === 1; }
export function canStand(map: MapState, a: Actor, p: Point, actors: Actor[] = []): boolean {
  const cells = occupied(a, p);
  return cells.every(c => !wall(map, c)) && !actors.some(other => other.id !== a.id && other.hp > 0 && occupied(other).some(c => cells.some(t => same(c, t))));
}
export function lineOfSight(map: MapState, from: Point, to: Point): boolean {
  let x = from.x, y = from.y;
  const dx = Math.abs(to.x - x), dy = Math.abs(to.y - y), sx = x < to.x ? 1 : -1, sy = y < to.y ? 1 : -1;
  let error = dx - dy;
  while (x !== to.x || y !== to.y) {
    const e2 = error * 2;
    if (e2 > -dy) { error -= dy; x += sx; }
    if (e2 < dx) { error += dx; y += sy; }
    if (x === to.x && y === to.y) return true;
    if (wall(map, { x, y })) return false;
  }
  return true;
}
export function generateMap(stage: Stage, rng: Random): { map: MapState; enemies: Actor[] } {
  const { width, height } = stage;
  const map: MapState = { width, height, tiles: new Array(width * height).fill(0), objects: [], fields: [] };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    // Islands of ruins leave a connected network of wide horizontal/vertical lanes.
    const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const ruin = x > 6 && y > 6 && x < width - 5 && y < height - 5 && x % 7 >= 3 && x % 7 <= 4 && y % 7 >= 3 && y % 7 <= 4;
    map.tiles[y * width + x] = border || ruin ? 1 : rng.next() < .1 ? 2 : 0;
  }
  map.objects.push(
    { id: 'start-attack', type: 'chest', position: { x: 3, y: 4 }, skillId: 'attack' },
    { id: 'start-fire', type: 'chest', position: { x: 5, y: 4 }, skillId: 'fireball' },
    { id: 'start-thunder', type: 'chest', position: { x: 5, y: 6 }, skillId: 'thunder' },
    { id: 'start-wind', type: 'chest', position: { x: 3, y: 7 }, skillId: 'tornado' },
    { id: 'rain', type: 'chest', position: { x: width - 4, y: 4 }, skillId: 'firerain' },
    { id: 'relic-1', type: 'chest', position: { x: width - 4, y: height - 4 }, objective: true, itemId: 'ether' },
    { id: 'exit', type: 'exit', position: { x: width - 3, y: height - 3 } },
    { id: 'lens', type: 'item', position: { x: 7, y: 3 }, itemId: 'scope' },
    { id: 'seed', type: 'item', position: { x: 3, y: 9 }, itemId: 'summon' },
    { id: 'potion-1', type: 'item', position: { x: 7, y: 6 }, itemId: 'potion' },
    { id: 'ether-1', type: 'item', position: { x: 8, y: 6 }, itemId: 'ether' },
  );
  if (stage.requiredChests > 1) map.objects.push({ id: 'relic-2', type: 'chest', position: { x: 3, y: height - 4 }, objective: true, itemId: 'potion' });
  const enemies: Actor[] = [];
  for (let i = 0; i < stage.enemyCount; i++) {
    const kind = i === 0 && stage.id === 5 ? 'boss' : i === 0 && stage.id === 4 ? 'golem' : stage.id > 1 && i % 3 === 1 ? 'wolf' : 'slime';
    const enemy = actor(`enemy-${i}`, kind, { x: 0, y: 0 }, stage.id);
    if (i === 0 && stage.id >= 4) for (const c of occupied(enemy, { x: width - 7, y: height - 7 })) map.tiles[c.y * width + c.x] = 0;
    for (let tries = 0; tries < 300; tries++) {
      const p = i === 0 && stage.id >= 4 ? { x: width - 7, y: height - 7 } : { x: rng.int(2, width - 4), y: rng.int(9, height - 4) };
      if (canStand(map, enemy, p, enemies) && !occupied(enemy, p).some(c => map.objects.some(o => same(c, o.position)))) { enemy.position = p; enemies.push(enemy); break; }
    }
  }
  if (stage.id >= 4) for (const p of [{ x: 8, y: 9 }, { x: 9, y: 9 }, { x: width - 5, y: height - 8 }]) {
    map.fields.push({ effectId: `ember-${key(p)}`, position: p, attribute: 'fire', remainingTurns: 999, triggerType: 'enter', damageMultiplier: .3, onceOnly: false });
  }
  return { map, enemies };
}
