import { initializeBooks } from './SkillBooks';
import { WORLD_SETTINGS } from './WorldSettings';
import { placeInstallations } from './InstallationSystem';
/** 占有・通行・視線判定とマップ生成。手作り地形は地域別ステージのlayoutへ指定します。 */
import { floorRules, stageForFloor } from '../stages/DungeonRules';
import { actor } from '../actors/Actor';
import { terrain, TERRAIN } from '../data/terrain';
import { upperFloorLayout } from '../stages/shared/upperFloors';
import { Random } from './Random';
import { initializeChests, weighted } from './LootSystem';
import { placeTraps } from './TrapSystem';
import type { Actor, EnemySpawn, ItemId, MapState, Point, SkillId, Stage } from './types';
export const key = (p: Point) => `${p.x},${p.y}`;
export const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export function occupied(a: Actor, position = a.position): Point[] { return a.cells.map(c => ({ x: position.x + c.x, y: position.y + c.y })); }
export function wall(map: MapState, p: Point): boolean { return p.x < 0 || p.y < 0 || p.x >= map.width || p.y >= map.height || terrain(map.tiles[p.y * map.width + p.x]).solid; }
export function canStand(map: MapState, a: Actor, p: Point, actors: Actor[] = []): boolean {
  const cells = occupied(a, p);
  return cells.every(c => !wall(map, c) && !map.installations?.some(i => same(i.position, c))) && !actors.some(other => other.id !== a.id && other.hp > 0 && occupied(other).some(c => cells.some(t => same(c, t))));
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
    if (terrain(map.tiles[y * map.width + x]).blocksSight) return false;
  }
  return true;
}
function generateBaseMap(stage: Stage, rng: Random, floor = 1): { map: MapState; enemies: Actor[]; spawn: Point } {
  const { width, height } = stage;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>WORLD_SETTINGS.maxMapWidth||height>WORLD_SETTINGS.maxMapHeight)throw new Error('マップサイズは最大120×120です。');
  const rules = floorRules(stage, floor);
  const varyCount = (count: number) => Math.max(0, count + rng.int(-rules.enemyVariance, rules.enemyVariance));
  // 既存の床に接した壁だけを開くので、通路の接続と固定配置を壊さず形が変わる。
  const varyShape = (map: MapState, floorTile: number) => {
    for (let n = 0; n < rules.extraPassages; n++) {
      const cells: Point[] = [];
      for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
        const p = { x, y };
        if (wall(map, p) && [{ x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 }].some(c => !wall(map, c))) cells.push(p);
      }
      if (!cells.length) break; const p = cells[rng.int(0, cells.length - 1)]; map.tiles[p.y * width + p.x] = floorTile;
    }
  };
  const layout = stage.layout ? (typeof stage.layout === 'function' ? stage.layout(stage, floor) : stage.layout) : floor > 1 ? upperFloorLayout(stage, floor) : undefined;
  if (layout) {
    if (layout.rows.length !== height || layout.rows.some(row => row.length !== width)) throw new Error(`${stage.name}: 地形の行数・列数がステージサイズと一致しません`);
    const tiles = layout.rows.flatMap(row => [...row].map(char => { const id = layout.legend[char]; if (!(id in TERRAIN)) throw new Error(`未定義の地形文字: ${char}`); return id; }));
    const map: MapState = { bossArena: structuredClone(layout.bossArena), loot: stage.loot, width, height, tiles, objects: structuredClone(layout.objects), fields: structuredClone(layout.fields ?? []), traps: structuredClone(layout.traps ?? []), installations: structuredClone(layout.installations ?? []) };
    // ステージ側で skillId / skillIds / itemId / contents を書いた箱は固定報酬として扱う。
    // とくに開始地点の隣の箱をカスタマイズした場合、後段の共通初期報酬で上書きしない。
    for (const object of map.objects) if (object.type === 'chest' && (object.contents !== undefined || object.skillId !== undefined || object.skillIds !== undefined || object.itemId !== undefined)) object.fixedContents = true;
    varyShape(map, layout.legend['.'] ?? 0);
    const enemies = layout.enemies.map((entry, i) => actor(`enemy-${i}`, entry.kind, { ...entry.position }, stage.id, floor));
    if (wall(map, layout.spawn) || enemies.some(e => !canStand(map, e, e.position, enemies)) || map.objects.some(o => wall(map, o.position))) throw new Error(`${stage.name}: 配置が壁または他のキャラクターと重なっています`);
    // 手作り地形にもシード付きのランダム配置を追加。全候補から選ぶため配置失敗が隠れない。
    const freeCell = (body: Actor) => {
      const candidates: Point[] = [];
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const p = { x, y };
        if (distance(p, layout.spawn) < 6 || !canStand(map, body, p, enemies)) continue;
        if (occupied(body, p).some(c => map.objects.some(o => same(c, o.position)) || map.fields.some(f => same(c, f.position)) || map.traps?.some(t => same(c, t.position)))) continue;
        candidates.push(p);
      }
      if (!candidates.length) throw new Error(`${stage.name}: ランダム配置用の空き床が不足しています`);
      return candidates[rng.int(0, candidates.length - 1)];
    };
    for (const entry of (stage.enemySpawns ?? layout.randomEnemies ?? []).map(e => ({ ...e, count: stage.clearCondition?.type === 'defeat' && e.kind === stage.clearCondition.kind ? e.count : varyCount(e.count) }))) for (let i = 0; i < entry.count; i++) {
      const enemy = actor(`enemy-${enemies.length}`, entry.kind, { x: 0, y: 0 }, stage.id, floor);
      enemy.position = freeCell(enemy); enemies.push(enemy);
    }
    const gemLimit = Math.min(1, Math.max(0, stage.dungeon?.overrides?.[floor]?.gemCount ?? layout.gemCount ?? rules.gemCount));
    let fixedGems = 0; map.objects = map.objects.filter(o => o.type !== 'gem' || fixedGems++ < gemLimit);
    const token = actor('placement-token', 'slime', { x: 0, y: 0 });
    for (let i = 0; i < (layout.randomChests ?? 0); i++) map.objects.push({ id: `random-chest-${i}`, type: 'chest', position: freeCell(token), chestTier: weighted([{ value: 'wood' as const, weight: 4 }, { value: 'iron' as const, weight: 3 }, { value: 'silver' as const, weight: 2 }, { value: 'gold' as const, weight: 1 }], rng) });
    const missingGems = gemLimit - map.objects.filter(o => o.type === 'gem').length;
    for (let i = 0; i < missingGems; i++) map.objects.push({ id: `gem-${i}`, type: 'gem', position: freeCell(token) });
    initializeChests(map, rng, floor);
    placeTraps(map, (stage.floorSettings?.[floor]?.trapPlacements ?? layout.trapPlacements ?? stage.trapPlacements ?? []).map(p => ({ ...p, pool: p.pool ?? stage.trapPool })), rng, layout.spawn, enemies);
    return { map, enemies, spawn: { ...layout.spawn } };
  }
  const map: MapState = { loot: stage.loot, width, height, tiles: new Array(width * height).fill(0), objects: [], fields: [] };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    // Islands of ruins leave a connected network of wide horizontal/vertical lanes.
    const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const ruin = x > 6 && y > 6 && x < width - 5 && y < height - 5 && x % 7 >= 3 && x % 7 <= 4 && y % 7 >= 3 && y % 7 <= 4;
    map.tiles[y * width + x] = border || ruin ? 1 : rng.next() < .1 ? 2 : 0;
  }
  varyShape(map, 0);
  map.objects.push(
    { id: 'start-attack', type: 'chest', chestTier: 'gold', position: { x: 3, y: 4 }, skillId: 'attack', skillIds: ['warp'] },
    { id: 'rain', type: 'chest', chestTier: 'silver', position: { x: width - 4, y: 4 }, skillId: 'firerain' },
    { id: 'relic-1', type: 'record', position: { x: width - 4, y: height - 4 } },
    { id: 'exit', type: 'exit', position: { x: width - 3, y: height - 3 } },
  );
  // One rare elemental chest replaces the three clustered tutorial chests.
  const element = (['fireball', 'thunder', 'tornado'] as SkillId[])[rng.int(0, 2)];
  map.objects.push({ id: 'element-cache', type: 'chest', chestTier: 'silver', position: { x: 3, y: height - 7 }, skillId: element });
  // No loose starting supplies. A supply cache appears in only 25% of expeditions.
  if (rng.next() < .25) map.objects.push({ id: 'supply-cache', type: 'chest', chestTier: 'wood', position: { x: width - 7, y: 3 } });
  if (stage.clearCondition?.type === 'records' && stage.clearCondition.count > 1) map.objects.push({ id: 'relic-2', type: 'record', position: { x: 3, y: height - 4 } });
  const enemies: Actor[] = [];
  // 出現表は型付きの敵IDを参照。種類別の分岐をここへ追加する必要はありません。
  const entries: EnemySpawn[] = stage.enemySpawns ?? [{ kind: 'slime', count: stage.enemyCount }];
  if (entries.some(e => !Number.isInteger(e.count) || e.count < 0 || e.position && e.count > 1)) throw new Error(`${stage.name}: 敵の個数は非負整数、固定座標には1体だけ指定してください`);
  const spawns = entries.map(e => ({ ...e, count: e.position ? e.count : varyCount(e.count) })).flatMap(entry => Array.from({ length: entry.count }, () => entry));
  for (const [i, spawn] of spawns.entries()) {
    const kind = spawn.kind;
    const enemy = actor(`enemy-${i}`, kind, { x: 0, y: 0 }, stage.id, floor);
    if (spawn.position) for (const c of occupied(enemy, spawn.position)) {
      if (c.x <= 0 || c.y <= 0 || c.x >= width - 1 || c.y >= height - 1) throw new Error(`${stage.name}: 固定敵の配置がマップ境界外です`);
      map.tiles[c.y * width + c.x] = 0;
    }
    for (let tries = 0; tries < 300; tries++) {
      const p = spawn.position ? { ...spawn.position } : { x: rng.int(2, width - 4), y: rng.int(9, height - 4) };
      if (canStand(map, enemy, p, enemies) && !occupied(enemy, p).some(c => map.objects.some(o => same(c, o.position)))) { enemy.position = p; enemies.push(enemy); break; }
    }
    if (!enemies.includes(enemy)) throw new Error(`${stage.name}: ${enemy.name}の配置場所がありません`);
  }
  if (stage.id >= 4) for (const p of [{ x: 8, y: 9 }, { x: 9, y: 9 }, { x: width - 5, y: height - 8 }]) {
    map.fields.push({ effectId: `ember-${key(p)}`, position: p, attribute: 'fire', remainingTurns: 999, triggerType: 'enter', damageMultiplier: .3, onceOnly: false });
  }
  if (rules.gemCount) {
    const cells: Point[] = [];
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) { const p = { x, y }; if (!wall(map, p) && distance(p, { x: 3, y: 3 }) > 5 && !map.objects.some(o => same(o.position, p)) && !enemies.some(a => occupied(a).some(c => same(c, p))) && !map.fields.some(f => same(f.position, p))) cells.push(p); }
    if (cells.length) map.objects.push({ id: 'gem-floor', type: 'gem', position: cells[rng.int(0, cells.length - 1)] });
  }
  initializeChests(map, rng, floor);
  placeTraps(map, (stage.trapPlacements ?? []).map(p => ({ ...p, pool: p.pool ?? stage.trapPool })), rng, { x: 3, y: 3 }, enemies);
  return { map, enemies, spawn: { x: 3, y: 3 } };
}

/** 目標数を満たす記録・討伐対象を必ず初期配置し、乱数によるクリア不能を防ぐ。 */
export function generateMap(base: Stage, rng: Random, floor = 1): { map: MapState; enemies: Actor[]; spawn: Point } {
 const stage = stageForFloor(base, floor), result = generateBaseMap(stage, rng, floor);
 const { map, enemies, spawn } = result, goal = stage.clearCondition;
 // 旧形式の目標宝箱も独立した記録に置き換える。
 map.objects = map.objects.map(o => o.objective ? { id: o.id, type: 'record' as const, position: o.position } : o);
 const place = (body: Actor): Point => {
   const candidates: Point[] = [];
   for (let y = 1; y < map.height - 1; y++) for (let x = 1; x < map.width - 1; x++) {
     const p = { x, y };
     if (distance(p, spawn) < 5 || !canStand(map, body, p, enemies)) continue;
     if (occupied(body, p).some(c => map.objects.some(o => same(o.position, c)) || map.traps?.some(t => same(t.position, c)) || map.fields.some(f => same(f.position, c)))) continue;
     candidates.push(p);
   }
   if (!candidates.length) throw new Error(stage.name + ': クリア目標の配置場所がありません');
   return candidates[rng.int(0, candidates.length - 1)];
 };
 if (goal?.type === 'records') {
   for (let n = map.objects.filter(o => o.type === 'record').length; n < goal.count; n++) map.objects.push({ id: 'record-' + n, type: 'record', position: place(actor('record-token', 'slime', spawn)) });
 }
 if (goal?.type === 'defeat') {
   for (let n = enemies.filter(e => e.kind === goal.kind).length; n < goal.count; n++) {
     const enemy = actor('goal-enemy-' + n, goal.kind, spawn, stage.id, floor); enemy.position = place(enemy); enemies.push(enemy);
   }
 }
 if(floor===1){
  // 開始地点の隣の箱を初期宝箱として扱う。固定中身を指定した箱はそのまま保持する。
  const chest=map.objects.find(o=>o.type==='chest'&&!o.opened&&!o.fixedContents&&(o.skillId==='attack'||o.skillIds?.includes('attack') || distance(o.position,spawn)<=2));
  if(chest&&!chest.fixedContents){const forest=(Number(stage.code?.split('-')[0])||1)>=2||stage.regionId==='forest';
    chest.skillId=undefined;chest.skillIds=forest?['attack','warp','sweep']:['attack','warp','icePillar'];chest.itemId=forest?'potion':undefined;
    const supplies=(chest.contents??[]).filter(e=>e.type==='item');if(forest&&!supplies.some(e=>e.id==='potion'))supplies.push({type:'item',id:'potion'});
    chest.contents=[...chest.skillIds.map(id=>({type:'skill' as const,id})),...supplies];chest.randomSkillsResolved=true;
    const cells:Point[]=[];for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const p={x:chest.position.x+x,y:chest.position.y+y};if((x||y)&&!same(p,spawn)&&canStand(map,actor('book','slime',p),p,enemies)&&!map.objects.some(o=>same(o.position,p))&&!map.traps?.some(t=>same(t.position,p))&&!map.fields.some(f=>same(f.position,p)))cells.push(p);}
    if(!cells.length)throw new Error(stage.name+': 初期宝箱の隣に魔導書の空きマスがありません');
    map.objects.push({id:'starting-skill-book',type:'skillBook',position:cells[0]});
  }
 }
 placeInstallations(map, stage.installationPlacements ?? [], rng, spawn, enemies);
 // 手置き・開始地点の書も合算。追加の書は空き床へ配置し、階層単位の上限を守る。
 const bookRules = stage.skillBooks ?? { max: Number(stage.code?.split('-')[1]) >= 4 ? 2 : 1, extraChance: .3 };
 const bookMax = Math.max(0, Math.floor(bookRules.max));
 let bookCount = 0;
 map.objects = map.objects.filter(o => o.type !== 'skillBook' || ++bookCount <= bookMax);
 bookCount = Math.min(bookCount, bookMax);
 let desiredBooks = Math.min(1, bookMax);
 for (let i = 1; i < bookMax; i++) if (rng.next() < bookRules.extraChance) desiredBooks++;
 const bookCells: Point[] = [];
 for (let y = 1; y < map.height - 1; y++) for (let x = 1; x < map.width - 1; x++) {
   const p = { x, y };
   if (same(p, spawn) || !canStand(map, actor('book-token', 'slime', p), p, enemies)) continue;
   if (map.objects.some(o => same(o.position, p)) || map.traps?.some(t => same(t.position, p)) || map.fields.some(f => same(f.position, p))) continue;
   bookCells.push(p);
 }
 while (bookCount < desiredBooks && bookCells.length) {
   const position = bookCells.splice(rng.int(0, bookCells.length - 1), 1)[0];
   let id = 'floor-skill-book-' + bookCount;
   while (map.objects.some(o => o.id === id)) id += '-new';
   map.objects.push({ id, type: 'skillBook', position }); bookCount++;
 }

 if(goal?.type==='destroyInstallations'){
   let targets=map.installations!.filter(i=>i.kind===goal.kind);
   if(targets.length<goal.count)throw new Error(stage.name+': 破壊目標の設置物が不足しています');
   // 目標数分は出現枯渇後も残す。自然消滅で破壊目標が不足しないため。
   targets.slice(0,goal.count).forEach(i=>i.requiredForGoal=true);
 }
 initializeBooks(map,rng);
 return result;
}
