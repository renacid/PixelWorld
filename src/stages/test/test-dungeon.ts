import { SKILLS } from '../../data/skills';
import type { Stage, StageLayout } from '../../game/types';
import { stage as cave5 } from '../cave/3-5';

// 開発用テストダンジョン。初期スキルとレベルはここだけ編集すれば変更できます。
const rows = Array.from({ length: 30 }, (_, y) => {
  let row = '';
  for (let x = 0; x < 30; x++) {
    const border = x === 0 || y === 0 || x === 29 || y === 29;
    const verticalWall = x === 8 && y < 24 && y !== 5 && y !== 17;
    const horizontalWall = y === 15 && x > 8 && x < 25 && x !== 20;
    row += border || verticalWall || horizontalWall ? '#' : '.';
  }
  return row;
});

// 左入口、右中央に王を置く15×11の専用室。周囲1マスを壁で囲う。
for(let y=16;y<=28;y++)for(let x=12;x<=28;x++){
  const border=x===12||x===28||y===16||y===28;
  rows[y]=rows[y].slice(0,x)+(border&&!(x===12&&y===22)?'#':'.')+rows[y].slice(x+1);
}
const allSkillLevels = Object.fromEntries(Object.keys(SKILLS).map(id => [id, 5]));
const layout: StageLayout = {
  rows,
  bossArena: {x:13,y:17,width:15,height:11,sealTiles:[{x:12,y:22}],wallTile:1},
  legend: { '#': 1, '.': 0 },
  spawn: { x: 2, y: 2 },
  objects: [
    { id: 'test-chest-1', type: 'chest', chestTier: 'gold', position: { x: 5, y: 2 }, contents: [{ type: 'item', id: 'potion' }] },
    { id: 'test-chest-2', type: 'chest', chestTier: 'silver', position: { x: 25, y: 12 } },
    { id: 'test-record', type: 'record', position: { x: 26, y: 26 } },
    { id: 'test-exit', type: 'exit', position: { x: 27, y: 27 } },
  ],
  enemies: [
    { kind: 'slime', position: { x: 5, y: 8 } },
    { kind: 'goblin', position: { x: 12, y: 8 } },
    { kind: 'wolf', position: { x: 20, y: 8 } },
    { kind: 'goblinKing', position: { x: 26, y: 22 } },
  ],
  randomEnemies: [],
  randomChests: 0,
  gemCount: 0,
  trapPlacements: [],
};

// 上側に3-5と同じ祭壇を接続。既存の30×30検証室と王の部屋は下へ平行移動。
const shrine=cave5.floorSettings![4].layout as StageLayout;
const offset=34,width=44,height=64;
const expanded=Array.from({length:height},()=>Array(width).fill('#'));
for(let y=0;y<34;y++)for(let x=0;x<width;x++)expanded[y][x]=shrine.rows[y][x];
for(let y=0;y<30;y++)for(let x=0;x<30;x++)expanded[y+offset][x]=rows[y][x]==='#'?'X':'G';
for(let x=2;x<=22;x++)expanded[33][x]='g';
for(let y=31;y<=33;y++)expanded[y][22]='g';
for(let y=33;y<=36;y++)expanded[y][2]='g';
layout.rows=expanded.map(row=>row.join(''));layout.legend={...shrine.legend,'X':1};
layout.spawn.y+=offset;
for(const o of layout.objects)o.position.y+=offset;
for(const e of layout.enemies)e.position.y+=offset;
const kingRoom=layout.bossArena!;kingRoom.y+=offset;for(const p of kingRoom.sealTiles??[])p.y+=offset;
layout.bossRooms=[kingRoom,structuredClone(shrine.bossArena!)];
layout.enemies.push({kind:'elderTreant',position:{x:21,y:5}},{kind:'bombStone',position:{x:15,y:42}});

export const stage: Stage = {
  id: 10,
  code: 'test-1',
  name: '開発テストダンジョン',
  subtitle: '全スキル検証室',
  description: '全スキルを初期所持して動作を確認できます。',
  objective: '北の古木・南東の王を検証しよう',
  vision: 6,
  width,
  height,
  enemyCount: 0,
  regionId: 'test',
  dungeon: { floors: 1, gemCount: 1, extraPassages: 0, enemyVariance: 0, nightRevival: { min: 0, max: 0 } },
  clearCondition: { type: 'exit' },
  layout,
  initialBagSize: 9,
  // テスト中に全スキルを連続使用できるようMPを大きく設定。
  initialPlayerMp: 999,
  initialSkillLevels: allSkillLevels,
};
