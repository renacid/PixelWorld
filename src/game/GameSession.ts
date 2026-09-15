import { actor, createPlayer } from '../actors/Actor';
import { actEnemy } from '../ai/EnemyAI';
import { ITEMS } from '../data/items';
import { SKILLS } from '../data/skills';
import { applyAttribute } from '../skills/AttributeSystem';
import { autoPlace, effectiveLevel } from '../skills/SkillBag';
import { previewSkill } from '../skills/SkillResolver';
import { STAGES } from '../stages';
import type { Command } from './Command';
import { canStand, generateMap, lineOfSight, occupied, same } from './MapState';
import { Random } from './Random';
import { BALANCE, endTurn } from './TurnManager';
import { VECTORS, type Actor, type Attribute, type GameEvent, type ItemId, type Point, type SaveData, type SkillId, type TurnFrame } from './types';
export class GameSession {
  events: GameEvent[] = [];
  frames: TurnFrame[] = [];
  private frameEventStart = 0;
  rng: Random;
  constructor(public state: SaveData) {
    this.rng = new Random(state.randomSeed);
    // Older saves remain playable; existing hostile enemies do not alert again.
    for (const a of this.actors) { a.facing ??= 'down'; a.alertedAt ??= -1; }
  }
  private capture(phase: TurnFrame['phase']): void {
    this.frames.push({ phase, actors: structuredClone(this.actors), events: structuredClone(this.events.slice(this.frameEventStart)) });
    this.frameEventStart = this.events.length;
  }
  static create(stageId: number, seed: number): GameSession {
    const stage = STAGES.find(s => s.id === stageId)!;
    const rng = new Random(seed), { map, enemies } = generateMap(stage, rng);
    const session = new GameSession({ version: 1, stageId, initialSeed: seed, randomSeed: rng.seed, mapState: map, playerState: createPlayer(), enemyStates: enemies, allyStates: [], skillBag: [], skillLevels: {}, cooldowns: {}, itemSlots: [], exploredMap: new Array(map.width * map.height).fill(false), turnCount: 0, playerActionCount: 0, status: 'playing', objectiveChests: 0, pendingBag: false, log: ['目の前の宝箱へ進み、アタックを手に入れよう。'] });
    session.explore(); return session;
  }
  get stage() { return STAGES[this.state.stageId - 1]; }
  get actors() { return [this.state.playerState, ...this.state.allyStates, ...this.state.enemyStates]; }
  get vision() { return this.stage.vision + (this.state.playerState.freeCamera ? 2 : 0); }
  visible(p: Point): boolean {
    const pos = this.state.playerState.position;
    return Math.max(Math.abs(p.x - pos.x), Math.abs(p.y - pos.y)) <= this.vision && lineOfSight(this.state.mapState, pos, p);
  }
  explore(): void { const map = this.state.mapState; for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (this.visible({ x, y })) this.state.exploredMap[y * map.width + x] = true; }
  log(message: string): void { this.state.log.push(message); this.state.log = this.state.log.slice(-30); }
  damage = (target: Actor, amount: number, attribute: Attribute, critical = false): void => {
    const value = Math.round(amount * 10) / 10;
    target.hp = Math.max(0, Math.round((target.hp - value) * 10) / 10);
    this.events.push({ type: 'damage', position: { ...target.position }, actorId: target.id, amount: value, attribute, critical });
  };
  acquireSkill(id: SkillId): void {
    if (this.state.skillLevels[id]) { this.state.skillLevels[id]!++; this.log(`${SKILLS[id].name}の基礎レベルが${this.state.skillLevels[id]}に！`); }
    else { this.state.skillLevels[id] = 1; this.state.skillBag.push({ skillId: id, position: null, rotation: 0 }); autoPlace(this.state.skillBag, id); this.log(`${SKILLS[id].name}を手に入れた。バッグに配置しよう。`); }
    this.state.pendingBag = true;
  }
  collect(): void {
    const s = this.state;
    for (const obj of [...s.mapState.objects]) {
      if (!same(obj.position, s.playerState.position) || obj.opened || obj.type === 'exit') continue;
      if (obj.type === 'chest') {
        obj.opened = true;
        this.events.push({ type: 'pickup', position: { ...obj.position } });
        if (obj.objective) { s.objectiveChests++; this.log(`古代の宝箱を回収した！ ${s.objectiveChests}/${this.stage.requiredChests || 1}`); }
        if (obj.skillId) this.acquireSkill(obj.skillId);
        if (obj.itemId) this.receiveItem(obj.itemId, obj.position);
      } else if (obj.type === 'skill') { s.mapState.objects = s.mapState.objects.filter(o => o.id !== obj.id); this.acquireSkill(obj.skillId!); }
      else if (obj.itemId && s.itemSlots.length < 3) { s.itemSlots.push(obj.itemId); s.mapState.objects = s.mapState.objects.filter(o => o.id !== obj.id); this.log(`${ITEMS[obj.itemId].name}を拾った。`); }
      else this.log('道具枠がいっぱい。道具は床に残ります。');
    }
  }
  receiveItem(id: ItemId, p: Point): void {
    if (this.state.itemSlots.length < 3) { this.state.itemSlots.push(id); this.log(`${ITEMS[id].name}を拾った。`); }
    else { this.state.mapState.objects.push({ id: `floor-${this.state.playerActionCount}-${this.state.mapState.objects.length}`, type: 'item', position: { ...p }, itemId: id }); this.log('道具枠がいっぱい。宝箱の道具を床に置いた。'); }
  }
  useItem(slot: number): boolean {
    const s = this.state, p = s.playerState, id = s.itemSlots[slot]; if (!id) return false;
    if (id === 'potion' && p.hp >= p.maxHp || id === 'ether' && p.mp >= p.maxMp || id === 'scope' && p.freeCamera) { this.log('今は使う必要がありません。'); return false; }
    if (id === 'potion') { p.hp = Math.min(p.maxHp, p.hp + 15); this.events.push({ type: 'heal', position: { ...p.position }, text: '+HP' }); }
    if (id === 'ether') p.mp = Math.min(p.maxMp, p.mp + 10);
    if (id === 'scope') p.freeCamera = true;
    if (id === 'summon') {
      const ally = actor(`ally-${s.playerActionCount}`, 'sprite', { ...p.position });
      const point = Object.values(VECTORS).map(v => ({ x: p.position.x + v.x, y: p.position.y + v.y })).find(pos => canStand(s.mapState, ally, pos, this.actors));
      if (!point) { this.log('精霊が現れる空きマスがありません。'); return false; }
      ally.position = point; ally.detectionRange = 7; ally.pattern = 'patrol'; s.allyStates.push(ally);
    }
    s.itemSlots.splice(slot, 1); this.log(`${ITEMS[id].name}を使った。`); return true;
  }
  canCast(id: SkillId): string | null {
    if (!this.state.skillBag.some(b => b.skillId === id && b.position)) return 'バッグに配置されていません。';
    if ((this.state.cooldowns[id] ?? 0) > 0) return `あと${this.state.cooldowns[id]}行動で使用できます。`;
    if (this.state.playerState.mp < SKILLS[id].mp) return 'MPが足りません。待機でも5行動ごとに3回復します。';
    return null;
  }
  cast(id: SkillId, direction: keyof typeof VECTORS): void {
    const s = this.state, p = s.playerState, def = SKILLS[id]; p.facing = direction; p.mp -= def.mp; s.cooldowns[id] = def.cooldown;
    const targets = previewSkill(s, id, direction);
    this.events.push({ type: 'cast', actorId: p.id, position: { ...p.position }, target: targets.cells.at(-1) ?? { ...p.position }, path: targets.cells, skillId: id, attribute: def.attribute });
    const level = effectiveLevel(s.skillBag, s.skillLevels, id), multiplier = 1 + (level - 1) * .05;
    let total = 0;
    for (const targetId of targets.targetIds) {
      const target = s.enemyStates.find(e => e.id === targetId)!;
      for (let hit = 0; hit < def.hits && target.hp > 0; hit++) {
        const critical = this.rng.next() < p.criticalRate;
        const power = id === 'attack' ? .5 + this.rng.next() * .2 : def.multiplier;
        const amount = Math.round(p.attack * power * multiplier * (critical ? p.criticalMultiplier : 1) * 10) / 10;
        this.damage(target, amount, def.attribute, critical); total += amount;
        applyAttribute(target, def.attribute, amount, s.playerActionCount, s.enemyStates, this.damage, this.events);
      }
      if (id === 'tornado' && target.hp > 0) {
        const v = VECTORS[direction], pos = { x: target.position.x + v.x, y: target.position.y + v.y };
        if (canStand(s.mapState, target, pos, this.actors)) target.position = pos;
      }
    }
    this.log(`${def.name}！${targets.targetIds.length ? ` ${Math.round(total * 10) / 10}ダメージ` : ' 対象なし'}`);
    for (const event of this.events.filter(e => e.type === 'reaction')) this.log(`${event.text}が発生！`);
  }
  reap(): void {
    for (const e of this.state.enemyStates.filter(e => e.hp <= 0)) {
      this.log(`${e.name}を倒した。`); this.events.push({ type: 'defeat', position: { ...e.position } });
      if (this.rng.next() < BALANCE.dropChance) {
        const skill = this.rng.next() < .3;
        const itemId: ItemId = (['potion', 'potion', 'ether', 'ether', 'scope', 'summon'] as ItemId[])[this.rng.int(0, 5)];
        this.state.mapState.objects.push({ id: `drop-${e.id}`, type: skill ? 'skill' : 'item', position: { ...e.position }, ...(skill ? { skillId: (['fireball', 'thunder', 'tornado'] as SkillId[])[this.rng.int(0, 2)] } : { itemId }) });
      }
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
  execute(command: Command): boolean {
    const s = this.state, p = s.playerState;
    this.events = [];
    this.frames = []; this.frameEventStart = 0;
    if (s.status !== 'playing' || s.pendingBag) return false;
    if (command.type === 'cast') { const error = this.canCast(command.skillId); if (error) { this.log(error); return false; } }
    if (command.type === 'move') {
      p.facing = command.direction;
      const v = VECTORS[command.direction], next = { x: p.position.x + v.x, y: p.position.y + v.y };
      if (!canStand(s.mapState, p, next, this.actors)) { this.log('進めません。敵にはスキルを選んで攻撃しよう。'); return false; }
      p.position = next;
    }
    if (command.type === 'item' && !this.useItem(command.slot)) return false;
    s.playerActionCount++;
    if (command.type === 'cast') this.cast(command.skillId, command.direction);
    this.collect(); this.reap();
    this.capture('player');
    for (const ally of s.allyStates) { actEnemy(s.mapState, ally, s.enemyStates, this.actors, this.rng, (a, b) => { this.events.push({ type: 'attack', actorId: a.id, position: { ...a.position }, target: { ...b.position }, attribute: a.attribute }); this.damage(b, a.attack, a.attribute); }, s.playerActionCount); }
    this.reap();
    this.capture('ally');
    for (const enemy of s.enemyStates) {
      if (p.hp <= 0) break;
      actEnemy(s.mapState, enemy, [p, ...s.allyStates], this.actors, this.rng, (a, b) => { this.events.push({ type: 'attack', actorId: a.id, position: { ...a.position }, target: { ...b.position }, attribute: a.attribute }); this.damage(b, a.attack, a.attribute); applyAttribute(b, a.attribute, a.attack, s.playerActionCount, [p, ...s.allyStates], this.damage, this.events); }, s.playerActionCount);
    }
    for (const field of s.mapState.fields) {
      const active = field.triggerType === 'turn' || command.type === 'move';
      if (active && same(field.position, p.position)) { const amount = p.attack * field.damageMultiplier; this.damage(p, amount, field.attribute); applyAttribute(p, field.attribute, amount, s.playerActionCount, [p, ...s.allyStates], this.damage, this.events); if (field.onceOnly) field.remainingTurns = 0; }
    }
    this.reap();
    this.capture('enemy');
    endTurn(s, command.type === 'cast' ? command.skillId : undefined);
    this.explore();
    if (p.hp <= 0) { s.status = 'defeated'; s.pendingBag = false; this.log('冒険はここまで。また新しい旅へ。'); }
    else if (s.mapState.objects.some(o => o.type === 'exit' && same(o.position, p.position))) {
      if (this.goalReady()) { s.status = 'cleared'; s.pendingBag = false; this.log(`${this.stage.name}を踏破した！`); }
      else this.log(`出口はまだ閉ざされている。${this.stage.objective}`);
    }
    s.randomSeed = this.rng.seed;
    return true;
  }
}
