import { describe, expect, it } from 'vitest';
import { GameSession } from '../src/game/GameSession';
import { actor } from '../src/actors/Actor';
import { actEnemy, oriented, moveToward } from '../src/ai/EnemyAI';
import { canStand, generateMap, lineOfSight, occupied, same, wall } from '../src/game/MapState';
import { previewSkill } from '../src/skills/SkillResolver';
import { Random } from '../src/game/Random';
import type { StageLayout } from '../src/game/types';
import { STAGES } from '../src/stages';
import { TurnAnimation } from '../src/render/TurnAnimation';

function arena() { const s = GameSession.create(1, 442); s.state.mapState.tiles.fill(0); s.state.mapState.objects = []; s.state.enemyStates = []; s.state.playerState.position = { x: 8, y: 8 }; return s; }
describe('追加仕様の回帰確認', () => {
  it('初期宝箱からアタックとワープを一緒に取得', () => { const s = GameSession.create(1, 4); s.execute({ type: 'move', direction: 'down' }); expect(s.state.skillLevels.attack).toBe(1); expect(s.state.skillLevels.warp).toBe(1); expect(s.state.skillBag).toHaveLength(2); });
  it('ワープ先は9×9内で隣接・壁・敵・道具を除く。乱数再現とMP/CDを保持', () => {
    const s = arena(); s.acquireSkill('warp'); s.state.pendingBag = false;
    s.state.enemyStates = [actor('blocker', 'golem', { x: 10, y: 8 })];
    s.state.mapState.objects = [{ id: 'item', type: 'item', itemId: 'potion', position: { x: 6, y: 6 } }]; s.state.mapState.tiles[5 * 19 + 5] = 1;
    const cells = previewSkill(s.state, 'warp', 'down').cells;
    expect(cells.every(c => Math.max(Math.abs(c.x - 8), Math.abs(c.y - 8)) > 1 && Math.max(Math.abs(c.x - 8), Math.abs(c.y - 8)) <= 4)).toBe(true);
    expect(cells.some(c => same(c, { x: 6, y: 6 }) || same(c, { x: 5, y: 5 }) || occupied(s.state.enemyStates[0]).some(p => same(p, c)))).toBe(false);
    const resumed = new GameSession(structuredClone(s.state)), before = structuredClone(s.actors);
    s.execute({ type: 'cast', skillId: 'warp', direction: 'down' }); resumed.execute({ type: 'cast', skillId: 'warp', direction: 'down' });
    expect(s.state.playerState.position).toEqual(resumed.state.playerState.position); expect(cells).toContainEqual(s.state.playerState.position); expect(s.state.playerState.mp).toBe(13); expect(s.state.cooldowns.warp).toBe(30);
    const animation = new TurnAnimation(before, s.frames, () => true); expect(animation.sample(100)!.actors[0].position).toEqual({ x: 8, y: 8 }); expect(animation.sample(400)!.actors[0].position).toEqual(s.state.playerState.position);
  });
  it('ワープ先がない場合はMP・ターンを消費しない', () => { const s = arena(); s.acquireSkill('warp'); s.state.pendingBag = false; s.state.mapState.tiles.fill(1); expect(s.execute({ type: 'cast', skillId: 'warp', direction: 'down' })).toBe(false); expect(s.state.playerState.mp).toBe(20); expect(s.state.playerActionCount).toBe(0); });
  it('全ダメージを切り捨て、ログを100件に制限', () => { const s = arena(); for (const value of [3.9, .9, 15.6]) s.damage(s.state.playerState, value, 'fire'); expect(s.events.map(e => e.amount)).toEqual([3, 0, 15]); expect(s.state.playerState.hp).toBe(12); for (let n = 0; n < 120; n++) s.log(String(n)); expect(s.state.log).toHaveLength(100); expect(s.state.log[0]).toBe('20'); });
  it('ウルフは向きに関係なく1マス', () => { const s = arena(), wolf = actor('wolf', 'wolf', { x: 5, y: 5 }); expect(wolf.cells).toEqual([{ x: 0, y: 0 }]); const right = oriented(wolf, 'right'); expect(right.cells).toEqual(wolf.cells); s.state.mapState.tiles[5 * 19 + 6] = 1; expect(canStand(s.state.mapState, right, wolf.position)).toBe(true); s.state.mapState.tiles.fill(0); moveToward(s.state.mapState, wolf, { x: 10, y: 5 }, [wolf]); expect(wolf.facing).toBe('right'); expect(wolf.position.x).toBe(6); });
  it('スキップ抽選失敗で残り1を維持、成功で回復、距離外で敵視解除', () => { const s = arena(), e = actor('e', 'slime', { x: 3, y: 8 }); e.mode = 'hostile'; e.detectionRange = 30; e.chaseMoves = 12; e.chaseRecoveryChance = 0; const step = () => actEnemy(s.state.mapState, e, [s.state.playerState], [e, s.state.playerState], s.rng, () => {}); const position = { ...e.position }; step(); step(); expect(e.chaseSkipLeft).toBe(1); expect(e.mode).toBe('hostile'); expect(e.position).toEqual(position); e.chaseRecoveryChance = 1; step(); expect(e.chaseSkipLeft).toBe(0); expect(e.chaseMoves).toBe(0); e.chaseSkipLeft = 1; e.detectionRange = 1; step(); expect(e.mode).toBe('idle'); });
  it('手作り森マップと、水面の通行不可・視線通過を検証', () => { const layout: StageLayout = { rows: ['###########', '#.........#', '#..##.....#', '#..##.~~..#', '#.....~~..#', '#.........#', '#.........#', '#.........#', '#.........#', '#.........#', '###########'], legend: { '#': 4, '.': 3, '~': 5 }, spawn: { x: 2, y: 2 }, objects: [], enemies: [], trapPlacements: [] }; { const { map } = generateMap({ ...STAGES[0], enemySpawns: [], layout, clearCondition: { type: 'exit' }, id: 99, width: 11, height: 11 }, new Random(1)); expect(wall(map, { x: 6, y: 3 })).toBe(true); expect(lineOfSight(map, { x: 5, y: 3 }, { x: 8, y: 3 })).toBe(true); expect(lineOfSight(map, { x: 2, y: 2 }, { x: 5, y: 2 })).toBe(false); } });
});
