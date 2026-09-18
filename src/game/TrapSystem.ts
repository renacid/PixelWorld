import { hitInstallation } from './InstallationSystem';
import { DEFAULT_TRAP_POOL, TRAPS, type TrapPlacement } from '../data/traps';
import { CHESTS } from '../data/loot';
import { dealAttributeHit, type DamageHandler } from '../skills/AttributeSystem';
import { actor } from '../actors/Actor';
import { canStand, occupied, same, wall } from './MapState';
import { makeChest, weighted } from './LootSystem';
import type { Random } from './Random';
import type { Actor, GameEvent, MapState, Point, SaveData } from './types';

/** 範囲を列挙して抽選するため、狭いエリアでも無限リトライしません。 */
export function placeTraps(map: MapState, rules: TrapPlacement[], rng: Random, spawn: Point, actors: Actor[]): void {
  map.traps ??= [];
  if (new Set(map.traps.map(t => t.id)).size !== map.traps.length || new Set(map.traps.map(t => `${t.position.x},${t.position.y}`)).size !== map.traps.length || map.traps.some(t => !Object.hasOwn(TRAPS, t.trapId) || wall(map, t.position))) throw new Error('固定罠のID・座標・種類を確認してください');
  for (const [index, rule] of rules.entries()) {
    if (!Number.isInteger(rule.count) || rule.count < 0) throw new Error('罠の個数は非負整数で指定してください');
    const pool = rule.pool ?? DEFAULT_TRAP_POOL;
    if (pool.some(e => !Object.hasOwn(TRAPS, e.value))) throw new Error('罠の抽選表に未定義の種類があります');
    const r = rule.region ?? { x: 0, y: 0, width: map.width, height: map.height };
    if (![r.x, r.y, r.width, r.height].every(Number.isInteger) || r.width <= 0 || r.height <= 0) throw new Error('罠の配置範囲が不正です');
    const candidates: Point[] = [];
    for (let y = Math.max(0, r.y); y < Math.min(map.height, r.y + r.height); y++) for (let x = Math.max(0, r.x); x < Math.min(map.width, r.x + r.width); x++) {
      const p = { x, y };
      if (!wall(map, p) && !same(p, spawn) && !map.objects.some(o => same(o.position, p)) && !map.fields.some(f => same(f.position, p)) && !map.traps.some(t => same(t.position, p)) && !actors.some(a => occupied(a).some(c => same(c, p)))) candidates.push(p);
    }
    if (candidates.length < rule.count) throw new Error(`罠の配置ルール${index + 1}: 空き${candidates.length}マスに${rule.count}個は配置できません`);
    for (let i = 0; i < rule.count; i++) {
      const position = candidates.splice(rng.int(0, candidates.length - 1), 1)[0];
      let id = `trap-${map.traps.length}`; while (map.traps.some(t => t.id === id)) id += '-new';
      map.traps.push({ id, trapId: weighted(pool, rng), position, triggered: false });
    }
  }
}
type Context = { rng: Random; events: GameEvent[]; damage: DamageHandler; log: (text: string) => void };
/** 呼び出し元は成功したプレイヤー歩行だけ。描画・AIには罠一覧を渡しません。 */
export function triggerPlayerTraps(state: SaveData, context: Context): void {
  const p = state.playerState, map = state.mapState;
  const actors = [p, ...state.allyStates, ...state.enemyStates];
  for (const trap of map.traps ?? []) {
    if (trap.triggered || !same(trap.position, p.position) || p.hp <= 0) continue;
    trap.triggered = true;
    const def = TRAPS[trap.trapId], effect = def.effect;
    context.log(`${def.name}が発動！`);
    const emit = (path: Point[], delayMs = 250) => context.events.push({ type: 'trap', position: { ...trap.position }, path, visual: def.visual, sound: def.sound, delayMs, durationMs: 550 });
    const area = (radius: number) => {
      const cells: Point[] = [];
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) { const cell = { x: p.position.x + dx, y: p.position.y + dy }; if (!wall(map, cell)) cells.push(cell); }
      return cells;
    };
    if (effect.type === 'chest') {
      const cells = area(1).filter(c => !same(c, p.position) && !actors.some(a => a.hp > 0 && occupied(a).some(t => same(c, t))) && !map.objects.some(o => same(o.position, c)) && !map.installations?.some(i=>same(i.position,c)) && !(map.traps ?? []).some(t => !t.triggered && same(t.position, c)) && !map.fields.some(f => same(f.position, c)));
      if (cells.length) { const cell = cells[context.rng.int(0, cells.length - 1)], tier = weighted(effect.tiers, context.rng); map.objects.push(makeChest(`chest-${trap.id}`, cell, tier, context.rng, [], state.floorNumber, map.loot)); emit([cell]); context.log(`${CHESTS[tier].name}が出現した！`); }
      else { emit([p.position]); context.log('宝箱が現れる空きマスがなかった。'); }
    } else if (effect.type === 'summonPerimeter') {
      // 外周だけを抽出。キャラサイズを考慮し、同じマスへの重複召喚を防ぎます。
      const pool = area(effect.radius).filter(c => Math.max(Math.abs(c.x - p.position.x), Math.abs(c.y - p.position.y)) === effect.radius);
      const spawned: Point[] = [];
      while (pool.length && spawned.length < effect.count) {
        const cell = pool.splice(context.rng.int(0, pool.length - 1), 1)[0];
        let id = `${trap.id}-summon-${spawned.length}`;
        while (actors.some(a => a.id === id)) id += '-new';
        const enemy = actor(id, effect.enemy, cell, state.stageId, state.floorNumber);
        if (!canStand(map, enemy, cell, actors) || occupied(enemy).some(c => map.objects.some(o => same(c, o.position)))) continue;
        state.enemyStates.push(enemy); actors.push(enemy); spawned.push(cell);
      }
      emit(spawned); context.log(`森の狼が${spawned.length}体現れた！${spawned.length < effect.count ? '外周の空きマスが足りなかった。' : ''}`);
    } else if (effect.type === 'root') {
      p.movementLockedUntil = state.playerActionCount + effect.turns; emit([p.position]); context.log(`${effect.turns}行動の間、移動できない。`);
    } else if (effect.type === 'restoreMp') {
      const amount=Math.min(effect.amount,p.maxMp-p.mp);p.mp+=amount;emit([p.position]);context.events.push({type:'heal',position:{...p.position},text:'MP+'+amount,delayMs:450});context.log('MPが'+amount+'回復した。');
    } else if (effect.type === 'heal') {
      const amount = Math.min(effect.amount, p.maxHp - p.hp); p.hp += amount; emit([p.position]);
      context.events.push({ type: 'heal', position: { ...p.position }, amount, text: `+${amount}`, delayMs: 450 }); context.log(`HPが${amount}回復した。`);
    } else {
      const candidates = area(effect.radius), waves = effect.type === 'rocks' ? effect.hits : 1;
      for (let hit = 0; hit < waves; hit++) {
        const pool = [...candidates], cells: Point[] = [];
        if (effect.type === 'rocks') for (let i = 0; i < effect.tiles && pool.length; i++) cells.push(pool.splice(context.rng.int(0, pool.length - 1), 1)[0]);
        else cells.push(...pool);
        const delay = 250 + hit * 220; emit(cells, delay);
        const before = context.events.length, attribute = effect.type === 'blast' ? 'fire' : 'nature';
        for(const i of [...map.installations??[]])if(cells.some(c=>same(c,i.position)))hitInstallation(state,i.id,context);
        for (const target of actors) if (target.hp > 0 && occupied(target).some(c => cells.some(t => same(c, t)))) {
          dealAttributeHit(target, effect.damage, attribute, state.playerActionCount, actors, context.damage, context.events, () => context.rng.next());
        }
        for (const event of context.events.slice(before)) event.delayMs = delay + 130;
      }
    }
  }
}
