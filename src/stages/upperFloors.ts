/** 第2層は環状の部屋、第3層は蛇行する枝道。床の接続を保証した別地形。 */
import type { Point, Stage, StageLayout } from '../game/types';
export function upperFloorLayout(stage: Stage, floor: number): StageLayout {
  const { width: w, height: h } = stage, forest = stage.id >= 6;
  const grid = Array.from({ length: h }, () => Array<string>(w).fill('#'));
  const carve = (p: Point, radius: number) => {
    for (let y = Math.max(1, p.y - radius); y <= Math.min(h - 2, p.y + radius); y++)
      for (let x = Math.max(1, p.x - radius); x <= Math.min(w - 2, p.x + radius); x++) grid[y][x] = '.';
  };
  const line = (a: Point, b: Point) => {
    let { x, y } = a; carve({ x, y }, 1);
    while (x !== b.x) { x += Math.sign(b.x - x); carve({ x, y }, 1); }
    while (y !== b.y) { y += Math.sign(b.y - y); carve({ x, y }, 1); }
  };
  const xs = [5, Math.floor(w / 2), w - 6], ys = [7, Math.floor(h / 2), h - 7];
  const rooms = ys.flatMap(y => xs.map(x => ({ x, y })));
  rooms.forEach(p => carve(p, forest ? 3 : 2));
  const spawn = { x: 3, y: 2 }, exit = { x: w - 4, y: h - 3 };
  line(spawn, rooms[0]); line(rooms[8], exit);
  if (floor % 2 === 0) {
    // 外周を巡る環状路と、中央の独立した広場への枝道。
    const ring = [0, 1, 2, 5, 8, 7, 6, 3, 0];
    for (let i = 1; i < ring.length; i++) line(rooms[ring[i - 1]], rooms[ring[i]]);
    line(rooms[3], rooms[4]);
  } else {
    const snake = [0, 3, 6, 7, 4, 1, 2, 5, 8];
    for (let i = 1; i < snake.length; i++) line(rooms[snake[i - 1]], rooms[snake[i]]);
  }
  const objects: StageLayout['objects'] = [{ id: 'floor-exit', type: 'exit', position: exit }];
  const rewards = [rooms[4], rooms[6], rooms[2]];
  for (let i = 0; i < Math.max(3, stage.requiredChests); i++) objects.push({ id: 'floor-reward-' + i, type: 'chest', chestTier: i === 0 ? 'gold' : 'silver', position: { ...rewards[i % rewards.length] }, objective: i < stage.requiredChests });
  // 討伐対象は固定数。ランダム数の補正で0体にならないよう固定配置にする。
  const enemies: StageLayout['enemies'] = [];
  if (stage.goal === 'boss' || stage.goal === 'hunt') enemies.push({ kind: stage.goal === 'boss' ? 'boss' : 'golem', position: { x: rooms[8].x - 1, y: rooms[8].y - 1 } });
  return {
    rows: grid.map(row => row.join('')), legend: { '#': forest ? 4 : 1, '.': forest ? 3 : 0 }, spawn, objects, enemies,
    randomEnemies: forest ? [{ kind: 'wolf', count: 6 }, { kind: 'goblin', count: 5 }, { kind: 'treant', count: 4 }, { kind: 'slime', count: 3 }] : (stage.enemySpawns ?? []).filter(e => !e.position),
    randomChests: forest ? 8 : 3, trapPlacements: stage.trapPlacements,
  };
}
