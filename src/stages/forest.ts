/** 森の地形は固定、敵・箱・罠は冒険のシードで配置。枝道の奥に固定報酬。 */
import type { Point, StageLayout } from '../game/types';
export function forestLayout(deep: boolean): StageLayout {
  const width = deep ? 39 : 35, height = deep ? 60 : 54, center = Math.floor(width / 2);
  const left = 9, right = width - 10;
  const grid = Array.from({ length: height }, () => Array<string>(width).fill(' '));
  for (let y = 1; y < height - 1; y++) {
    const inset = y < 5 || y > height - 6 ? center - 2 : 2 + Math.floor((1 + Math.sin(y * .65)) * 1.5);
    for (let x = inset; x < width - inset; x++) grid[y][x] = '#';
  }
  const carve = (p: Point, radius = 1) => {
    for (let y = p.y - radius; y <= p.y + radius; y++) for (let x = p.x - radius; x <= p.x + radius; x++) if (grid[y]?.[x] === '#') grid[y][x] = '.';
  };
  const line = (a: Point, b: Point, radius = 1) => {
    let { x, y } = a; carve({ x, y }, radius);
    while (x !== b.x || y !== b.y) { x += Math.sign(b.x - x); y += Math.sign(b.y - y); carve({ x, y }, radius); }
  };
  const path: Point[] = [{ x: center, y: 2 }, { x: center, y: 8 }, { x: left, y: 8 }, { x: left, y: 19 }, { x: right, y: 19 }, { x: right, y: 31 }, { x: left, y: 31 }, { x: left, y: height - 11 }, { x: center, y: height - 11 }, { x: center, y: height - 3 }];
  for (let i = 1; i < path.length; i++) line(path[i - 1], path[i]);
  for (const p of path.slice(1, -1)) carve(p, 2);
  const ends: Point[] = [{ x: 5, y: 12 }, { x: width - 6, y: 24 }, { x: 5, y: height - 16 }];
  line({ x: left, y: 12 }, ends[0], 0); line({ x: right, y: 24 }, ends[1], 0); line({ x: left, y: height - 16 }, ends[2], 0);
  const gates = [{ x: left, y: 15 }, { x: right, y: 27 }, { x: left, y: height - 14 }];
  for (const p of gates) { grid[p.y][p.x - 1] = '#'; grid[p.y][p.x + 1] = '#'; }
  return {
    rows: grid.map(row => row.join('')), legend: { ' ': 6, '#': 4, '.': 3 }, spawn: { x: center, y: 2 },
    objects: [
      { id: 'forest-start', type: 'chest', chestTier: 'gold', position: { x: center, y: 3 }, skillIds: ['attack', 'warp'] },
      { id: 'forest-element', type: 'chest', chestTier: 'silver', position: { x: center, y: 6 }, skillId: deep ? 'groundbreak' : 'fireball' },
      ...ends.map((position, i) => ({ id: 'deadend-' + i, type: 'chest' as const, chestTier: i === 2 ? 'gold' as const : 'silver' as const, position })),
      { id: 'forest-exit', type: 'exit', position: { x: center, y: height - 3 } },
    ],
    enemies: gates.map(position => ({ kind: 'treant', position })),
    randomEnemies: [{ kind: 'wolf', count: deep ? 7 : 5 }, { kind: 'goblin', count: deep ? 6 : 4 }, { kind: 'slime', count: 3 }, { kind: 'treant', count: deep ? 4 : 2 }],
    randomChests: deep ? 9 : 7, gemCount: 1,
    trapPlacements: [{ region: { x: 4, y: 8, width: width - 8, height: height - 14 }, count: deep ? 22 : 16, pool: [{ value: 'healing', weight: 3 }, { value: 'manaHealing', weight: 2 }, { value: 'treasure', weight: 2 }, { value: 'bearTrap', weight: 2 }, { value: 'rockfall', weight: 1 }, { value: 'fireMine', weight: 1 }, { value: 'wolfTerritory', weight: 1 }] }],
  };
}
