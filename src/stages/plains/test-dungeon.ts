import { SKILLS } from '../../data/skills';
import type { Stage, StageLayout } from '../../game/types';

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
  bossArena: {x:13,y:17,width:15,height:11},
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

export const stage: Stage = {
  id: 10,
  code: 'test-1',
  name: '開発テストダンジョン',
  subtitle: '全スキル検証室',
  description: '全スキルを初期所持して動作を確認できます。',
  objective: 'ゴブリン・キングを倒して出口へ',
  vision: 6,
  width: 30,
  height: 30,
  enemyCount: 0,
  regionId: 'plains',
  dungeon: { floors: 1, gemCount: 1, extraPassages: 0, enemyVariance: 0, nightRevival: { min: 0, max: 0 } },
  clearCondition: { type: 'defeat', kind: 'goblinKing', count: 1 },
  layout,
  initialBagSize: 9,
  // テスト中に全スキルを連続使用できるようMPを大きく設定。
  initialPlayerMp: 999,
  initialSkillLevels: allSkillLevels,
};
