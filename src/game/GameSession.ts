import { PROGRESSION, requiredExperience, expandBag } from './Progression';
import { initialBagCells } from '../skills/SkillBag';
/** 1プレイの進行役。コマンドを処理し、描画用イベントと保存可能な状態を生成します。 */
import { actor, createPlayer } from '../actors/Actor';
import { actSummon } from '../ai/SummonAI';
import { attackPower, criticalChance } from './ActorStats';
import { DAY_CYCLE, timeOfDay } from './DayCycle';
import { actEnemy } from '../ai/EnemyAI';
import { actorDefinition } from '../data/enemies';
import { ENEMY_SKILLS, canonicalEnemySkillId } from '../data/enemySkills';
import { CHESTS } from '../data/loot';
import { floorLoot, legacyLoot, rollDrops } from './LootSystem';
import { triggerPlayerTraps } from './TrapSystem';
import { tryEnemySkill } from '../skills/EnemySkillResolver';
import { ITEMS } from '../data/items';
import { GEM_REWARDS } from '../data/gems';
import { skillMp, wearSkill } from '../skills/SkillWear';
import { SKILLS } from '../data/skills';
import { dealAttributeHit } from '../skills/AttributeSystem';
import { autoPlace, effectiveLevel } from '../skills/SkillBag';
import { previewSkill, validSkillTarget } from '../skills/SkillResolver';
import { floorRules } from '../stages/DungeonRules';
import { STAGES } from '../stages';
import type { Command } from './Command';
import { canStand, generateMap, occupied, same, wall } from './MapState';
import { Random } from './Random';
import { endTurn } from './TurnManager';
import { VECTORS, type Actor, type Attribute, type GameEvent, type ItemId, type Point, type SaveData, type SkillId, type TurnFrame } from './types';
export class GameSession {
  events: GameEvent[] = [];
  frames: TurnFrame[] = [];
  private frameEventStart = 0;
  rng: Random;
  private groupingDamage = false;
  constructor(public state: SaveData) {
    this.rng = new Random(state.randomSeed);
    state.playerLevel ??= 1; state.experience ??= 0; state.bagCells ??= initialBagCells(5);
    state.floorNumber ??= 1; state.floorCount = Math.max(state.floorNumber, this.stage.dungeon?.floors ?? 1); state.nightRevived ??= (state.daylightCount ?? 0) >= 100 ? floorRules(this.stage).nightRevival.min : 0;
    // 旧セーブは過去のスキル使用回数を復元できないため回復カウントを0から開始。
    state.mpRecoveryActions ??= 0; state.daylightCount ??= 0; state.defeatedEnemies ??= []; state.skillWear ??= {}; state.pendingGemChoices ??= []; state.mapState.playerTraps ??= []; state.playerState.visionBonus ??= state.playerState.freeCamera ? 2 : 0;
    // Older saves remain playable; existing hostile enemies do not alert again.
    for (const a of this.actors) {
      a.facing ??= 'down'; a.alertedAt ??= -1; a.hp = Math.floor(a.hp);
      if (a.kind === 'wolf') a.cells = [{ x: 0, y: 0 }];
      // 旧セーブにMPがない場合のみ初期値を補完。消費済みの0は維持します。
      const loadout = actorDefinition(a.kind);
      a.mp ??= loadout.mp; a.maxMp ??= loadout.mp; a.enemySkillIds ??= [...loadout.skills];
      a.enemySkillIds = a.enemySkillIds.map(canonicalEnemySkillId);
      a.criticalRate ??= loadout.criticalRate; a.criticalMultiplier ??= loadout.criticalMultiplier;
      a.immobile ??= loadout.immobile; a.skillChances ??= { ...loadout.skillChances }; a.buffs ??= [];
      if (a.attribute === 'earth') a.attribute = 'nature';
      for (const f of a.afflictions) if (f.attribute === 'earth') f.attribute = 'nature';
      // 旧セーブの連続停止タイマーは破棄し、新しいスキップ状態だけを利用。
      const legacy = a as typeof a & { disengageTurns?: number; disengageLeft?: number };
      delete legacy.disengageTurns; delete legacy.disengageLeft;
    }
    const startChest = state.mapState.objects.find(o => o.id === 'start-attack' && !o.opened);
    if (startChest && !startChest.contents) startChest.skillIds = [...new Set([...(startChest.skillIds ?? []), 'warp' as const])];
    state.mapState.traps ??= [];
    for (const chest of state.mapState.objects.filter(o => o.type === 'chest')) {
      chest.contents ??= legacyLoot(chest);
      chest.chestTier ??= chest.contents.filter(e => e.type === 'skill').length >= 2 ? 'gold' : chest.contents.some(e => e.type === 'skill') ? 'silver' : 'wood';
    }
    for (const f of state.mapState.fields) if (f.attribute === 'earth') f.attribute = 'nature';
    state.log = state.log.slice(-100);
  }
  private capture(phase: TurnFrame['phase']): void {
    this.frames.push({ phase, actors: structuredClone(this.actors), events: structuredClone(this.events.slice(this.frameEventStart)) });
    this.frameEventStart = this.events.length;
  }
  static create(stageId: number, seed: number): GameSession {
    const stage = STAGES.find(s => s.id === stageId)!;
    const rng = new Random(seed); const floorCount = stage.dungeon?.floors ?? 1; const { map, enemies, spawn } = generateMap(stage, rng);
    const session = new GameSession({ version: 1, stageId, playerLevel: 1, experience: 0, bagCells: initialBagCells(), floorNumber: 1, floorCount, nightRevived: 0, initialSeed: seed, randomSeed: rng.seed, mapState: map, playerState: createPlayer(), enemyStates: enemies, allyStates: [], skillBag: [], skillLevels: {}, cooldowns: {}, itemSlots: [], exploredMap: new Array(map.width * map.height).fill(false), turnCount: 0, playerActionCount: 0, status: 'playing', objectiveChests: 0, pendingBag: false, log: ['目の前の宝箱へ進み、アタックを手に入れよう。'] });
    session.state.playerState.position = { ...spawn };
    session.state.log = []; session.explore(); return session;
  }
  get stage() { return STAGES[this.state.stageId - 1]; }
  get actors() { return [this.state.playerState, ...this.state.allyStates, ...this.state.enemyStates]; }
  get vision() { return (timeOfDay(this.state) === 'night' ? Math.min(4, this.stage.vision) : this.stage.vision) + (this.state.playerState.visionBonus ?? 0); }
  visible(p: Point): boolean {
    const pos = this.state.playerState.position;
    return Math.max(Math.abs(p.x - pos.x), Math.abs(p.y - pos.y)) <= this.vision;
  }
  explore(): void { const map = this.state.mapState; for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (this.visible({ x, y })) this.state.exploredMap[y * map.width + x] = true; }
  log(message: string): void { this.state.log.push(message); this.state.log = this.state.log.slice(-100); this.onLog?.(message); }
  onLog?: (message: string) => void;
  isOnScreen?: (point: Point) => boolean;
  private inPlayerScreen(point: Point): boolean { return this.visible(point) && (this.isOnScreen?.(point) ?? Math.max(Math.abs(point.x - this.state.playerState.position.x), Math.abs(point.y - this.state.playerState.position.y)) <= 5); }
  damage = (target: Actor, amount: number, attribute: Attribute, critical = false, attacker: Actor | null = this.state.playerState): void => {
    // All damage paths (including reactions and fields) truncate only at this boundary.
    const value = Math.max(0, Math.floor(amount));
    target.hp = Math.max(0, Math.floor(target.hp) - value);
    // 命中自体を敵視のきっかけにする（切り捨てで0ダメージでも反応）。
    // 索敵外からの攻撃や、追跡疲労によるスキップ中の攻撃にも対応します。
    if (attacker && target.hp > 0 && this.state.enemyStates.some(e => e.id === target.id) && (attacker.id === this.state.playerState.id || this.state.allyStates.some(a => a.id === attacker.id))) {
      if (target.mode !== 'hostile') target.alertedAt = this.state.playerActionCount;
      target.mode = 'hostile'; target.lastSeen = { ...attacker.position };
      target.pursuitLeft = target.pursuitTurns; target.chaseMoves = 0; target.chaseSkipLeft = 0;
    }
    const cells = occupied(target), position = { x: cells.reduce((n, c) => n + c.x, 0) / cells.length, y: cells.reduce((n, c) => n + c.y, 0) / cells.length };
    this.events.push({ type: 'damage', position, actorId: target.id, amount: value, attribute, critical });
    if (!this.groupingDamage) this.log(`${target.name}に${critical ? '会心' : ''}${value}ダメージ！`);
  };
  /** 一つの行動による各ヒット・反応を対象別に集計して、読みやすい一件のログにする。 */
  private logHits(label: string, start: number, multi = false): void {
    const hits = this.events.slice(start).filter(e => e.type === 'damage');
    const groups = new Map<string, { name: string; sum: number; count: number; critical: boolean }>();
    for (const hit of hits) {
      const id = hit.actorId!; const g = groups.get(id) ?? { name: this.actors.find(a => a.id === id)?.name ?? '対象', sum: 0, count: 0, critical: false };
      g.sum += hit.amount ?? 0; g.count++; g.critical ||= !!hit.critical; groups.set(id, g);
    }
    this.log(label + '！ ' + (groups.size ? [...groups.values()].map(g => g.name + 'に' + (multi || g.count > 1 ? '合計' : '') + (g.critical ? '会心' : '') + g.sum + 'ダメージ！').join(' ') : '対象なし'));
  }
  private strike(a: Actor, b: Actor, raw = attackPower(a), attribute = a.attribute, label = '攻撃'): void {
    const start = this.events.length, critical = this.rng.next() < criticalChance(a, b, attribute);
    this.groupingDamage = true;
    try { dealAttributeHit(b, raw * (critical ? a.criticalMultiplier ?? 1.5 : 1), attribute, this.state.playerActionCount, a.kind === 'sprite' ? this.state.enemyStates : [this.state.playerState, ...this.state.allyStates], (t, n, attr, crit) => this.damage(t, n, attr, crit, a), this.events, () => this.rng.next(), critical); }
    finally { this.groupingDamage = false; }
    this.logHits(a.name + 'の' + label, start);
  }
  acquireSkill(id: SkillId): void {
    this.state.skillWear![id] = { uses: 0, extraMp: 0 };
    if (this.state.skillLevels[id]) { this.state.skillLevels[id]!++; this.log(`${SKILLS[id].name}の基礎レベルが${this.state.skillLevels[id]}に！`); }
    else { this.state.skillLevels[id] = 1; this.state.skillBag.unshift({ skillId: id, position: null, rotation: 0, isNew: true }); autoPlace(this.state.skillBag, id, this.state.bagCells); this.log(`${SKILLS[id].name}を手に入れた。`); this.state.pendingBag = true; }
  }
  collect(): void {
    const s = this.state;
    for (const obj of [...s.mapState.objects]) {
      if (!same(obj.position, s.playerState.position) || obj.opened || obj.type === 'exit') continue;
      if (obj.type === 'gem') {
        const pool = Object.keys(GEM_REWARDS), choices: string[] = [];
        while (choices.length < 3 && pool.length) choices.push(pool.splice(this.rng.int(0, pool.length - 1), 1)[0]);
        s.pendingGemChoices!.push(choices); s.mapState.objects = s.mapState.objects.filter(o => o.id !== obj.id);
        this.events.push({ type: 'pickup', position: { ...obj.position }, sound: 'treasure' }); this.log('強化の宝石を手に入れた！');
      } else if (obj.type === 'chest') {
        obj.opened = true;
        this.events.push({ type: 'pickup', position: { ...obj.position } });
        this.log(`${CHESTS[obj.chestTier ?? 'wood'].name}を開いた。`);
        if (obj.objective) { s.objectiveChests++; this.log(`古代の宝箱を回収した！ ${s.objectiveChests}/${this.stage.requiredChests || 1}`); }
        for (const loot of obj.contents ?? legacyLoot(obj)) {
          if (loot.type === 'skill') this.acquireSkill(loot.id);
          else this.receiveItem(loot.id, obj.position);
        }
      } else if (obj.type === 'skill') { s.mapState.objects = s.mapState.objects.filter(o => o.id !== obj.id); this.acquireSkill(obj.skillId!); }
      else if (obj.itemId === 'scope') { this.gainVision(); s.mapState.objects = s.mapState.objects.filter(o => o.id !== obj.id); }
      else if (obj.itemId && s.itemSlots.length < 3) { s.itemSlots.push(obj.itemId); s.mapState.objects = s.mapState.objects.filter(o => o.id !== obj.id); this.log(`${ITEMS[obj.itemId].name}を拾った。`); }
      else if (!obj.fullNotified) { obj.fullNotified = true; this.log('道具枠がいっぱい。道具は床に残ります。'); }
    }
  }
  chooseGem(index: number): boolean {
    const s = this.state, id = s.pendingGemChoices?.[0]?.[index], reward = id && GEM_REWARDS[id];
    if (!reward || s.status !== 'playing') return false;
    const e = reward.effect, p = s.playerState;
    if (e.type === 'skill') { const pool = Object.values(SKILLS).filter(d => d.attribute === e.attribute); if (!pool.length) return false; this.acquireSkill(pool[this.rng.int(0, pool.length - 1)].id); }
    else if (e.type === 'hp') { p.maxHp += e.amount; p.hp += e.amount; }
    else if (e.type === 'mp') { p.maxMp += e.amount; p.mp += e.amount; }
    else if (e.type === 'criticalRate') p.criticalRate = Math.min(1, p.criticalRate + e.amount);
    else p.criticalMultiplier += e.amount;
    s.pendingGemChoices!.shift(); this.log('宝石の力！ ' + reward.name); s.randomSeed = this.rng.seed; return true;
  }
  gainVision(): void { const p = this.state.playerState; p.freeCamera = true; p.visionBonus = (p.visionBonus ?? 0) + 2; this.explore(); this.log('千里眼薬（小）！ 視野がさらに2マス広がった。'); }
  receiveItem(id: ItemId, p: Point): void {
    if (id === 'scope') { this.gainVision(); return; }
    if (this.state.itemSlots.length < 3) { this.state.itemSlots.push(id); this.log(`${ITEMS[id].name}を拾った。`); }
    else { this.state.mapState.objects.push({ id: `floor-${this.state.playerActionCount}-${this.state.mapState.objects.length}`, type: 'item', fullNotified: true, position: { ...p }, itemId: id }); this.log('道具枠がいっぱい。宝箱の道具を床に置いた。'); }
  }
  useItem(slot: number, skillId?: SkillId): boolean {
    const s = this.state, p = s.playerState, id = s.itemSlots[slot]; if (!id) return false;
    if (id === 'hourglass') { if (!skillId || !s.skillLevels[skillId] || !(s.cooldowns[skillId]! > 0)) { this.log('再使用待ちのスキルを選んでください。'); return false; } s.cooldowns[skillId] = Math.max(0, s.cooldowns[skillId]! - 10); this.log(SKILLS[skillId].name + 'のクールタイムを短縮！'); }
    if (id === 'potion' && p.hp >= p.maxHp || id === 'ether' && p.mp >= p.maxMp) { this.log('今は使う必要がありません。'); return false; }
    if (id === 'potion') { p.hp = Math.min(p.maxHp, p.hp + 15); this.events.push({ type: 'heal', position: { ...p.position }, text: '+HP' }); }
    if (id === 'ether') p.mp = Math.min(p.maxMp, p.mp + 10);
    if (id === 'scope') this.gainVision();
    if (id === 'summon') {
      let id = `ally-${s.playerActionCount}-${s.allyStates.length}`; while (this.actors.some(a => a.id === id)) id += '-new';
      const ally = actor(id, 'sprite', { ...p.position });
      const point = Object.values(VECTORS).map(v => ({ x: p.position.x + v.x, y: p.position.y + v.y })).find(pos => canStand(s.mapState, ally, pos, this.actors));
      if (!point) { this.log('精霊が現れる空きマスがありません。'); return false; }
      ally.position = point; ally.detectionRange = 7; ally.pattern = 'patrol'; s.allyStates.push(ally);
    }
    s.itemSlots.splice(slot, 1); this.log(`${ITEMS[id].name}を使った。`); return true;
  }
  canCast(id: SkillId): string | null {
    if (id === 'groundbreak') {
      const map = this.state.mapState, pos = this.state.playerState.position;
      if ((map.playerTraps?.length ?? 0) >= 2) return '地砕きは同時に2個までです。';
      if (map.objects.some(o => same(o.position, pos)) || map.fields.some(f => same(f.position, pos)) || map.traps?.some(t => !t.triggered && same(t.position, pos)) || map.playerTraps?.some(t => same(t.position, pos))) return '足元に物や罠があるため設置できません。';
    }
    if (id === 'warp' && (this.state.playerState.movementLockedUntil ?? -1) > this.state.playerActionCount) return 'トラばさみで移動できません。';
    if (id === 'warp' && !previewSkill(this.state, id, this.state.playerState.facing).cells.length) return 'ワープ先の空きマスがありません。';
    if (!this.state.skillBag.some(b => b.skillId === id && b.position)) return 'バッグに配置されていません。';
    if ((this.state.cooldowns[id] ?? 0) > 0) return `あと${this.state.cooldowns[id]}行動で使用できます。`;
    if (this.state.playerState.mp < skillMp(this.state, id)) return 'MPが足りません。';
    return null;
  }
  cast(id: SkillId, direction: keyof typeof VECTORS, aim?: Point): void {
    const s = this.state, p = s.playerState, def = SKILLS[id]; p.facing = direction; p.mp -= skillMp(s, id); s.cooldowns[id] = def.cooldown;
    if (wearSkill(s, id, this.rng)) this.log(def.name + 'が劣化し、次回からの消費MPが増えた。');
    if (id === 'groundbreak') {
      const damage = effectiveLevel(s.skillBag, s.skillLevels, id) >= 3 ? 12 : 7;
      s.mapState.playerTraps!.push({ id: 'groundbreak-' + s.playerActionCount, position: { ...p.position }, damage });
      this.events.push({ type: 'trap', actorId: p.id, position: { ...p.position }, visual: 'fallingRocks', sound: 'rocks' });
      this.log('地砕き！ 足元に自然の罠を設置した。'); return;
    }
    const targets = previewSkill(s, id, direction, aim);
    if (id === 'warp') {
      const destination = targets.cells[this.rng.int(0, targets.cells.length - 1)];
      this.events.push({ type: 'cast', actorId: p.id, position: { ...p.position }, target: destination, skillId: id, attribute: def.attribute });
      p.position = { ...destination }; this.log('ランダムワープを発動！'); return;
    }
    this.events.push({ type: 'cast', actorId: p.id, position: { ...p.position }, target: aim ?? targets.cells.at(-1) ?? { ...p.position }, path: targets.cells, skillId: id, attribute: def.attribute, sound: id === 'icestone' ? 'ice' : undefined });
    const level = effectiveLevel(s.skillBag, s.skillLevels, id), multiplier = 1 + (level - 1) * .05;
    const hitStart = this.events.length; this.groupingDamage = true;
    for (const targetId of targets.targetIds) {
      const target = s.enemyStates.find(e => e.id === targetId)!;
      for (let hit = 0; hit < def.hits && target.hp > 0; hit++) {
        const critical = this.rng.next() < criticalChance(p, target, def.attribute);
        const power = id === 'attack' ? .5 + this.rng.next() * .2 : def.multiplier;
        const amount = attackPower(p) * power * multiplier * (critical ? p.criticalMultiplier : 1);
        dealAttributeHit(target, amount, def.attribute, s.playerActionCount, s.enemyStates, this.damage, this.events, () => this.rng.next(), critical);
      }
      if (id === 'tornado' && target.hp > 0 && target.cells.length === 1 && !target.immobile) {
        const v = VECTORS[direction], pos = { x: target.position.x + v.x, y: target.position.y + v.y };
        if (canStand(s.mapState, target, pos, this.actors)) target.position = pos;
      }
    }
    this.groupingDamage = false; this.logHits(def.name, hitStart, def.hits > 1);
    for (const event of this.events.filter(e => e.type === 'reaction')) this.log(`${event.text}が発生！`);
  }
  /** 撃破経験値は味方・罠による撃破にも付与。超過分は次レベルへ持ち越す。 */
  private gainExperience(amount: number): void {
    const s = this.state, p = s.playerState;
    if (s.playerLevel! >= PROGRESSION.maxLevel || p.hp <= 0) return;
    s.experience! += amount;
    while (s.playerLevel! < PROGRESSION.maxLevel && s.experience! >= requiredExperience(s.playerLevel!)) {
      s.experience! -= requiredExperience(s.playerLevel!); s.playerLevel!++;
      const hp = Math.ceil(p.maxHp * PROGRESSION.statGrowth), mp = Math.ceil(p.maxMp * PROGRESSION.statGrowth);
      p.maxHp += hp; p.hp += hp; p.maxMp += mp; p.mp += mp;
      expandBag(s, this.rng);
      this.log('旅人がLv.' + s.playerLevel + 'に！ 最大HP+' + hp + '・最大MP+' + mp + '、バッグが1マス拡張！');
      this.events.push({ type: 'levelup', actorId: p.id, position: { ...p.position }, text: '✦ LEVEL UP! Lv.' + s.playerLevel, durationMs: 2200 });
    }
    if (s.playerLevel === PROGRESSION.maxLevel) s.experience = 0;
  }
  reap(): void {
    for (const e of this.state.enemyStates.filter(e => e.hp <= 0)) {
      this.state.defeatedEnemies!.push(structuredClone(e));
      this.gainExperience(actorDefinition(e.kind).experience * (e.experienceMultiplier ?? 1));
      this.log(`${e.name}を倒した。`); this.events.push({ type: 'defeat', position: { ...e.position } });
      rollDrops(actorDefinition(e.kind).drops, this.rng).forEach((loot, index) => this.state.mapState.objects.push(floorLoot(`drop-${e.id}-${index}`, e.position, loot)));
    }
    this.state.enemyStates = this.state.enemyStates.filter(e => e.hp > 0);
    this.state.allyStates = this.state.allyStates.filter(a => a.hp > 0);
  }
  goalReady(): boolean {
    const s = this.state;
    if (this.stage.goal === 'treasure') return s.objectiveChests >= this.stage.requiredChests;
    if (this.stage.goal === 'hunt') return !s.enemyStates.some(e => e.kind === 'golem');
    if (this.stage.goal === 'boss') return !s.enemyStates.some(e => e.kind === 'boss');
    return true;
  }
  canSleep(): boolean {
    return this.state.status === 'playing' && timeOfDay(this.state) === 'night' && !this.state.enemyStates.some(e => e.hp > 0 && e.mode === 'hostile');
  }
  /** 階層の地形・敵・探索記録だけを交換。プレイヤーの成長と手持ちは維持する。 */
  private advanceFloor(): void {
    const s = this.state, next = s.floorNumber! + 1;
    const { map, enemies, spawn } = generateMap(this.stage, this.rng, next);
    s.floorNumber = next; s.mapState = map; map.playerTraps = []; s.enemyStates = enemies;
    s.playerState.position = { ...spawn }; s.objectiveChests = 0; s.defeatedEnemies = []; s.nightRevived = 0; s.nightWave = undefined; s.nightTarget = undefined;
    s.exploredMap = new Array(map.width * map.height).fill(false);
    const placed: Actor[] = [s.playerState, ...enemies];
    for (const ally of s.allyStates) {
      const cells: Point[] = [];
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (canStand(map, ally, { x, y }, placed) && !map.objects.some(o => same(o.position, { x, y }))) cells.push({ x, y });
      cells.sort((a, b) => Math.abs(a.x - spawn.x) + Math.abs(a.y - spawn.y) - Math.abs(b.x - spawn.x) - Math.abs(b.y - spawn.y));
      if (cells[0]) ally.position = cells[0];
      ally.mode = 'idle'; ally.lastSeen = null; ally.pursuitLeft = 0; placed.push(ally);
    }
    this.explore(); this.log(`${this.stage.name} 第${next}層へ進んだ！`);
  }
  /** 夜・深夜・以降30行動ごとの復活。抽選数を保存し、未達分は空き床と撃破済みの敵が揃うまで再試行。 */
  private reviveAtNight(): void {
    const s = this.state, rule = floorRules(this.stage, s.floorNumber).nightRevival;
    if (timeOfDay(s) !== 'night') return;
    const count = s.daylightCount ?? 0;
    const wave = count < DAY_CYCLE.midnight ? 0 : 1 + Math.floor((count - DAY_CYCLE.midnight) / DAY_CYCLE.revivalInterval);
    if (s.nightWave !== wave) { s.nightWave = wave; s.nightRevived = 0; s.nightTarget = this.rng.int(rule.min, Math.max(rule.min, rule.max)); }
    const desired = s.nightTarget ?? rule.min;
    if (s.nightRevived! >= desired || !s.defeatedEnemies?.length) return;
    const dead = [...s.defeatedEnemies];
    while (dead.length && s.nightRevived! < desired) {
      const old = dead.splice(this.rng.int(0, dead.length - 1), 1)[0];
      const enemy = actor(`night-${s.floorNumber}-${s.playerActionCount}-${s.nightRevived}`, old.kind, old.position, s.stageId, s.floorNumber), cells: Point[] = [];
      for (let y = 1; y < s.mapState.height - 1; y++) for (let x = 1; x < s.mapState.width - 1; x++) {
        const p = { x, y };
        if (!canStand(s.mapState, enemy, p, this.actors) || occupied(enemy, p).some(c => s.mapState.objects.some(o => same(c, o.position)))) continue;
        const borders = Object.values(VECTORS).map(v => ({ x: x + v.x, y: y + v.y }));
        if (borders.some(c => s.exploredMap[c.y * s.mapState.width + c.x] && wall(s.mapState, c))) cells.push(p);
      }
      if (!cells.length) continue;
      enemy.experienceMultiplier = wave === 0 ? DAY_CYCLE.nightExperience : DAY_CYCLE.midnightExperience;
      enemy.position = cells[this.rng.int(0, cells.length - 1)]; s.enemyStates.push(enemy);
      s.defeatedEnemies = s.defeatedEnemies.filter(a => a.id !== old.id); s.nightRevived!++;
      if (this.inPlayerScreen(enemy.position)) { this.events.push({ type: 'trap', position: { ...enemy.position }, visual: 'summonRing', sound: 'howl' }); this.log(`壁際から${enemy.name}が現れた！`); }
    }
  }
  private sleep(): boolean {
    if (!this.canSleep()) { this.log('夜、敵に気付かれていないときだけ眠れます。'); return false; }
    const s = this.state, p = s.playerState;
    s.playerActionCount++; s.turnCount++; s.daylightCount = 0; s.nightRevived = 0; s.nightWave = undefined; s.nightTarget = undefined;
    p.hp = p.maxHp; p.mp = p.maxMp; p.afflictions = []; p.movementLockedUntil = 0;
    // 一晩で期限付き状態と再使用待ちを解消。回復カウントも新しい朝から開始。
    s.cooldowns = {}; s.mpRecoveryActions = 0;
    for (const a of this.actors) { a.buffs = []; a.afflictions = []; }
    const limit = this.stage.sleepRespawnCount ?? DAY_CYCLE.respawnCount;
    const dead = [...(s.defeatedEnemies ?? [])]; let count = 0;
    while (dead.length && count < limit) {
      const old = dead.splice(this.rng.int(0, dead.length - 1), 1)[0];
      const enemy = actor(`revived-${s.playerActionCount}-${count}`, old.kind, old.position, s.stageId, s.floorNumber);
      const cells: Point[] = [];
      for (let y = 0; y < s.mapState.height; y++) for (let x = 0; x < s.mapState.width; x++) {
        const pos = { x, y };
        if (Math.max(Math.abs(x - p.position.x), Math.abs(y - p.position.y)) <= 4 || !canStand(s.mapState, enemy, pos, this.actors)) continue;
        if (occupied(enemy, pos).some(c => s.mapState.objects.some(o => same(c, o.position)))) continue;
        cells.push(pos);
      }
      if (!cells.length) continue;
      enemy.position = cells.find(c => same(c, old.position)) ?? cells[this.rng.int(0, cells.length - 1)];
      s.enemyStates.push(enemy); s.defeatedEnemies = s.defeatedEnemies!.filter(a => a.id !== old.id); count++;
    }
    this.log(`朝になった！ HP・MP全回復。`);
    this.events.push({ type: 'heal', actorId: p.id, position: { ...p.position }, text: '朝・全回復', sound: 'healing' });
    this.capture('player'); this.explore(); s.randomSeed = this.rng.seed; return true;
  }
  execute(command: Command): boolean {
    const s = this.state, p = s.playerState;
    let walked = false;
    this.events = [];
    this.frames = []; this.frameEventStart = 0;
    if (s.status !== 'playing' || s.pendingBag || s.pendingGemChoices?.length) return false;
    if (command.type === 'cast') { const error = this.canCast(command.skillId); if (error) { this.log(error); return false; } if (!validSkillTarget(s, command.skillId, command.target)) { this.log('選択範囲内の着弾点を選んでください。'); return false; } }
    if (command.type === 'move') {
      p.facing = command.direction;
      if ((p.movementLockedUntil ?? -1) > s.playerActionCount) this.log('トラばさみに足を取られ、動けなかった。');
      else {
      const v = VECTORS[command.direction], next = { x: p.position.x + v.x, y: p.position.y + v.y };
      // 精霊を押し退けても自動行動の権利は消費せず、通常の味方フェーズへ進む。
      const ally = s.allyStates.find(a => a.hp > 0 && occupied(a).some(c => same(c, next)));
      const others = this.actors.filter(a => a.id !== p.id && a.id !== ally?.id);
      if (!canStand(s.mapState, p, next, ally ? others : this.actors) || ally && !canStand(s.mapState, ally, p.position, others)) { this.log('進路がふさがれています。'); return false; }
      if (ally) ally.position = { ...p.position };
      p.position = next; walked = true;
      }
    }
    if (command.type === 'item') { if (!this.useItem(command.slot, command.skillId)) return false; this.capture('player'); this.explore(); s.randomSeed = this.rng.seed; return true; }
    if (command.type === 'sleep') return this.sleep();
    s.playerActionCount++; s.daylightCount = (s.daylightCount ?? 0) + 1;
    if (command.type === 'cast') this.cast(command.skillId, command.direction, command.target);
    if (walked) triggerPlayerTraps(s, { rng: this.rng, events: this.events, damage: (target, amount, attribute, critical) => this.damage(target, amount, attribute, critical, null), log: message => this.log(message) });
    if (p.hp > 0) this.collect(); this.reap();
    this.capture('player');
    for (const ally of s.allyStates) { if (p.hp <= 0) break; actSummon(s, ally, this.rng, this.events, (a, b) => { this.events.push({ type: 'attack', actorId: a.id, position: { ...a.position }, target: { ...b.position }, attribute: a.attribute }); this.strike(a, b); }, message => this.log(message)); }
    this.reap(); this.capture('ally');
    for (const enemy of s.enemyStates) {
      if (p.hp <= 0) break;
      const beforePosition = { ...enemy.position };
      const innate = actorDefinition(enemy.kind).innateAttribute;
      if (innate) { enemy.afflictions = enemy.afflictions.filter(f => f.attribute !== innate); if (enemy.afflictions.length >= 2) enemy.afflictions.shift(); enemy.afflictions.push({ attribute: innate, remainingTurns: 10, appliedAt: s.playerActionCount }); }
      const skillContext = { action: s.playerActionCount, allies: s.enemyStates, map: s.mapState, actors: this.actors, rng: this.rng, events: this.events, damage: (target: Actor, amount: number, attribute: Attribute, _critical?: boolean, label?: string) => this.strike(enemy, target, amount, attribute, label), log: (message: string) => { if (this.inPlayerScreen(enemy.position) || this.events.at(-1)?.path?.some(p => this.inPlayerScreen(p))) this.log(message); } };
      // 支援は敵を見つけていなくても使用可能。攻撃スキルは通常AIの索敵後に試す。
      const support = { ...enemy, enemySkillIds: (enemy.enemySkillIds ?? []).filter(id => ENEMY_SKILLS[id]?.effect.type === 'allyBuff') };
      if (tryEnemySkill(support, [], skillContext)) { enemy.mp = support.mp; continue; }
      actEnemy(s.mapState, enemy, [p, ...s.allyStates], this.actors, this.rng, (a, b) => { this.events.push({ type: 'attack', actorId: a.id, position: { ...a.position }, target: { ...b.position }, attribute: a.attribute }); this.strike(a, b); }, s.playerActionCount, (caster, targets) => { const ids = caster.enemySkillIds; caster.enemySkillIds = (ids ?? []).filter(id => ENEMY_SKILLS[id]?.effect.type !== 'allyBuff'); try { return tryEnemySkill(caster, targets, skillContext); } finally { caster.enemySkillIds = ids; } });
      if (!same(beforePosition, enemy.position)) for (const trap of [...s.mapState.playerTraps!]) {
        if (enemy.hp <= 0 || !occupied(enemy).some(c => same(c, trap.position))) continue;
        s.mapState.playerTraps = s.mapState.playerTraps!.filter(t => t.id !== trap.id);
        const start = this.events.length; this.groupingDamage = true;
        dealAttributeHit(enemy, trap.damage, 'nature', s.playerActionCount, s.enemyStates, this.damage, this.events, () => this.rng.next());
        this.groupingDamage = false; this.logHits('地砕きの罠', start);
        this.events.push({ type: 'trap', position: { ...trap.position }, visual: 'fallingRocks', sound: 'rocks' });
      }
    }
    for (const field of s.mapState.fields) {
      const active = p.hp > 0 && (field.triggerType === 'turn' || walked);
      if (active && same(field.position, p.position)) { const amount = Math.floor(p.attack * field.damageMultiplier); dealAttributeHit(p, amount, field.attribute, s.playerActionCount, [p, ...s.allyStates], this.damage, this.events, () => this.rng.next()); if (field.onceOnly) field.remainingTurns = 0; }
    }
    this.reap();
    if (p.hp > 0) this.reviveAtNight();
    this.capture('enemy');
    endTurn(s, command.type === 'cast' ? command.skillId : undefined);
    this.explore();
    if (p.hp <= 0) { s.status = 'defeated'; s.pendingBag = false; this.log('冒険はここまで。また新しい旅へ。'); }
    else if (s.mapState.objects.some(o => o.type === 'exit' && same(o.position, p.position))) {
      if (this.goalReady()) { if (s.floorNumber! < s.floorCount!) this.advanceFloor(); else { s.status = 'cleared'; s.pendingBag = false; this.log(`${this.stage.name}を踏破した！`); } }
      else this.log('出口はまだ閉ざされています。');
    }
    s.randomSeed = this.rng.seed;
    return true;
  }
}
