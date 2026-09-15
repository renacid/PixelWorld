import type { GameSession } from '../game/GameSession';
import { lineOfSight, occupied, wall } from '../game/MapState';
import type { Actor, GameEvent, Point, SkillId, TurnFrame } from '../game/types';
import { ATTRIBUTE_COLORS, SKILLS } from '../data/skills';
import { previewSkill } from '../skills/SkillResolver';
import type { Settings } from '../game/SaveManager';
import { PIXEL_COLORS, spritePixels } from './SpriteAtlas';
import { TurnAnimation } from './TurnAnimation';
export const TILE = 32, VIEW_SIZE = 320, DRAW_CELLS = 11;
type Effect = GameEvent & { born: number; duration: number; index: number; played: boolean };
export class GameCanvas {
  private ctx: CanvasRenderingContext2D;
  private miniCtx: CanvasRenderingContext2D | null;
  private frame = 0;
  private effects: Effect[] = [];
  private animation: TurnAnimation | null = null;
  private animationStart = 0;
  private phase = '';
  session: GameSession | null = null;
  selected: SkillId | null = null;
  camera: Point | null = null;
  settings: Settings = { grid: false, motion: true, sound: true };
  onSound?: (event: GameEvent) => void;
  onPhase?: (phase: string) => void;
  constructor(private canvas: HTMLCanvasElement, mini?: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!; this.miniCtx = mini?.getContext('2d') ?? null;
    canvas.width = VIEW_SIZE; canvas.height = VIEW_SIZE;
    if (mini) { mini.width = 72; mini.height = 72; }
  }
  start(): void { const loop = () => { this.draw(); this.frame = requestAnimationFrame(loop); }; loop(); }
  destroy(): void { cancelAnimationFrame(this.frame); this.effects = []; }
  animateTurn(before: Actor[], frames: TurnFrame[]): number {
    this.animation = new TurnAnimation(before, frames, a => occupied(a).some(p => this.session!.visible(p)));
    this.animationStart = performance.now();
    this.effects = this.animation.events().map(({ event, delay, duration }, i) => ({ ...event, born: this.animationStart + (this.settings.motion ? delay : 0), duration: ['cast', 'attack'].includes(event.type) ? duration : 720, index: i, played: false }));
    if (!this.settings.motion) { this.animation = null; return 100; }
    return this.animation.duration;
  }
  private sprite(ctx: CanvasRenderingContext2D, a: Actor, x: number, y: number, clock: number): void {
    const width = (Math.max(...a.cells.map(c => c.x)) + 1) * TILE, height = (Math.max(...a.cells.map(c => c.y)) + 1) * TILE;
    const cx = x + width / 2, cy = y + height / 2;
    ctx.fillStyle = '#315d5c36'; ctx.beginPath(); ctx.ellipse(cx, y + height - 4, width * .3, 4, 0, 0, Math.PI * 2); ctx.fill();
    const pixels = spritePixels(a.kind, a.facing ?? 'down'), scale = a.kind === 'boss' ? 5 : a.kind === 'golem' ? 3 : 2;
    const step = this.settings.motion ? Math.floor(clock / (this.animation ? 110 : 230)) % 2 : 0;
    const bob = this.settings.motion && (a.kind === 'slime' || a.kind === 'sprite') ? Math.sin(clock / 200 + a.position.x) * 1.3 : 0;
    const flash = this.effects.some(e => e.type === 'damage' && e.actorId === a.id && clock >= e.born && clock - e.born < 140);
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      const color = PIXEL_COLORS[pixels[py][px]]; if (!color) continue;
      const foot = py >= 12 && (a.kind === 'player' || this.animation) ? (px < 8 ? step : 1 - step) * (this.settings.motion ? 1 : 0) : 0;
      ctx.fillStyle = flash ? '#fffcef' : color; ctx.fillRect(Math.round(cx - scale * 8 + px * scale), Math.round(cy - scale * 8 + py * scale + bob - foot), scale, scale);
    }
    if (a.kind !== 'player' && a.hp < a.maxHp) { ctx.fillStyle = '#fffefa'; ctx.fillRect(cx - 12, y, 24, 4); ctx.fillStyle = '#f27276'; ctx.fillRect(cx - 11, y + 1, 22 * a.hp / a.maxHp, 2); }
    a.afflictions.forEach((f, i) => { ctx.fillStyle = ATTRIBUTE_COLORS[f.attribute]; ctx.fillRect(cx - 7 + i * 9, y - 5, 6, 4); });
    if (a.mode === 'hostile' && a.kind !== 'player' && a.alertedAt === this.session?.state.playerActionCount) {
      ctx.fillStyle = '#fff5d9'; ctx.fillRect(x + width - 6, y - 9, 10, 13); ctx.fillStyle = '#ee605d'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText('!', x + width - 1, y + 1);
    }
  }
  private tile(ctx: CanvasRenderingContext2D, x: number, y: number, tx: number, ty: number, isWall: boolean, explored: boolean): void {
    const hash = Math.abs(Math.imul(tx + 71, 198491317) ^ Math.imul(ty + 13, 6542989));
    ctx.fillStyle = !explored ? '#cfdfdb' : isWall ? '#91bc8e' : ['#a2db83', '#a8df87', '#a4dc84', '#9ed980'][hash % 4]; ctx.fillRect(x, y, TILE + .5, TILE + .5);
    if (!explored) { if (hash % 3 === 0) { ctx.fillStyle = '#bcd3ce'; ctx.fillRect(x + 13, y + 13, 2, 2); } return; }
    if (isWall) {
      ctx.fillStyle = '#7ca988'; ctx.fillRect(x + 1, y + 24, 30, 7); ctx.fillStyle = '#c3d4b1'; ctx.fillRect(x + 1, y + 3, 29, 21); ctx.fillStyle = '#e2eccb'; ctx.fillRect(x + 2, y + 3, 27, 4);
      ctx.fillStyle = '#9ebc98'; ctx.fillRect(x + 3, y + 18, 26, 5); ctx.fillRect(x + 14, y + 8, 2, 6); ctx.fillStyle = '#68b97b'; ctx.fillRect(x + 2, y + 1, 8, 4);
    } else {
      const gx = x + 4 + hash % 19, gy = y + 4 + (hash >> 5) % 20;
      ctx.fillStyle = '#7abc6a'; ctx.fillRect(gx, gy, 2, 4); ctx.fillRect(gx - 2, gy + 1, 2, 2); ctx.fillRect(gx + 2, gy - 1, 2, 4);
      if (hash % 11 === 0) { ctx.fillStyle = hash % 2 ? '#fff3b7' : '#fffdf3'; ctx.fillRect(x + 18, y + 12, 2, 6); ctx.fillRect(x + 16, y + 14, 6, 2); ctx.fillStyle = '#efb64c'; ctx.fillRect(x + 18, y + 14, 2, 2); }
    }
    if (this.settings.grid) { ctx.strokeStyle = '#407d4820'; ctx.lineWidth = .5; ctx.strokeRect(x, y, TILE, TILE); }
  }
  draw(): void {
    const s = this.session; if (!s) return;
    this.canvas.dataset.vision = String(s.vision);
    const ctx = this.ctx, state = s.state, clock = performance.now(); ctx.imageSmoothingEnabled = false;
    const sample = this.animation?.sample(clock - this.animationStart); if (!sample) this.animation = null;
    const actors = sample?.actors ?? s.actors;
    const oldPlayer = sample?.step.before.find(a => a.id === 'player'), nextPlayer = sample?.step.actors.find(a => a.id === 'player');
    const walking = oldPlayer && nextPlayer && (oldPlayer.position.x !== nextPlayer.position.x || oldPlayer.position.y !== nextPlayer.position.y);
    const player = actors.find(a => a.id === 'player') ?? state.playerState;
    const viewPlayer = walking ? player.position : nextPlayer?.position ?? state.playerState.position;
    const center = this.camera ?? viewPlayer;
    const screen = (p: Point) => ({ x: (p.x - center.x) * TILE + 144, y: (p.y - center.y) * TILE + 144 });
    const visible = (p: Point) => { const from = { x: Math.round(viewPlayer.x), y: Math.round(viewPlayer.y) }, to = { x: Math.round(p.x), y: Math.round(p.y) }; return Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) <= s.vision && lineOfSight(state.mapState, from, to); };
    const phase = sample ? { player: 'あなたの行動', ally: '味方の行動', enemy: '敵の行動' }[sample.step.phase] : '';
    if (this.phase !== phase) { this.phase = phase; this.onPhase?.(phase); }
    ctx.fillStyle = '#cfdfdb'; ctx.fillRect(0, 0, VIEW_SIZE, VIEW_SIZE);
    // 11 cells, with the two outer cells each clipped by 16 of their 32 pixels.
    for (let y = Math.floor(center.y) - 5; y <= Math.ceil(center.y) + 5; y++) for (let x = Math.floor(center.x) - 5; x <= Math.ceil(center.x) + 5; x++) {
      const p = { x, y }, t = screen(p), inMap = x >= 0 && y >= 0 && x < state.mapState.width && y < state.mapState.height;
      const explored = inMap && state.exploredMap[y * state.mapState.width + x]; this.tile(ctx, t.x, t.y, x, y, wall(state.mapState, p), !!explored);
      if (explored && !visible(p)) { ctx.fillStyle = '#d3dfdd9c'; ctx.fillRect(t.x, t.y, TILE + .5, TILE + .5); }
    }
    for (const f of state.mapState.fields) if (visible(f.position)) { const p = screen(f.position); ctx.fillStyle = '#ffad7070'; ctx.fillRect(p.x + 3, p.y + 3, 26, 26); ctx.fillStyle = '#ff755c'; ctx.fillRect(p.x + 11, p.y + 15, 10, 8); ctx.fillStyle = '#fff295'; ctx.fillRect(p.x + 14, p.y + 9, 5, 11); }
    for (const obj of state.mapState.objects) {
      if (!visible(obj.position)) continue;
      const { x, y } = screen(obj.position);
      if (obj.type === 'exit') {
        ctx.fillStyle = '#5ca9a7'; ctx.fillRect(x + 4, y + 3, 24, 26); ctx.strokeStyle = '#fff8c8'; ctx.lineWidth = 2; ctx.strokeRect(x + 5, y + 3, 22, 25); ctx.fillStyle = s.goalReady() ? '#fff7bb' : '#badbcb'; for (let n = 0; n < 4; n++) ctx.fillRect(x + 8 + n * 2, y + 22 - n * 4, 16 - n * 3, 2);
      } else if (obj.type === 'chest') {
        ctx.fillStyle = '#59855550'; ctx.fillRect(x + 5, y + 25, 23, 3); ctx.fillStyle = obj.opened ? '#bb9b69' : '#d9934f'; ctx.fillRect(x + 6, y + 12, 21, 13); ctx.fillStyle = obj.opened ? '#927654' : '#ffe598'; ctx.fillRect(x + 5, y + (obj.opened ? 5 : 9), 23, 6);
        ctx.fillStyle = '#ffe49a'; ctx.fillRect(x + 8, y + 14, 2, 11); ctx.fillRect(x + 23, y + 14, 2, 11); ctx.fillRect(x + 15, y + 16, 4, 4);
        if (!obj.opened) { ctx.fillStyle = '#fffbe7'; ctx.fillRect(x + 15, y + 1, 2, 6); ctx.fillRect(x + 13, y + 3, 6, 2); }
      } else if (obj.type === 'skill') { ctx.fillStyle = '#fff3c5'; ctx.fillRect(x + 9, y + 8, 14, 18); ctx.fillStyle = '#e78474'; ctx.fillRect(x + 12, y + 12, 8, 2); ctx.fillRect(x + 12, y + 17, 7, 2); }
      else { ctx.fillStyle = obj.itemId === 'potion' ? '#f884a0' : obj.itemId === 'ether' ? '#64bfe8' : '#ffd15d'; ctx.fillRect(x + 12, y + 10, 8, 3); ctx.fillRect(x + 10, y + 14, 12, 12); ctx.fillStyle = '#fffae7'; ctx.fillRect(x + 13, y + 7, 6, 3); ctx.fillRect(x + 11, y + 16, 2, 6); }
    }
    if (this.selected && !sample) {
      const target = previewSkill(state, this.selected, state.playerState.facing), color = ATTRIBUTE_COLORS[SKILLS[this.selected].attribute];
      target.cells.forEach((cell, i) => { const p = screen(cell); ctx.fillStyle = `${color}55`; ctx.fillRect(p.x + 1, p.y + 1, 30, 30); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.strokeRect(p.x + 2, p.y + 2, 28, 28);
        if (this.selected !== 'firerain') { ctx.fillStyle = '#fffdf2'; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'center'; ctx.fillText(({ up: '↑', right: '→', down: '↓', left: '←' })[state.playerState.facing], p.x + 16, p.y + 21); }
        if (i === target.cells.length - 1 && this.selected !== 'firerain') { ctx.strokeStyle = '#fff9cb'; ctx.strokeRect(p.x + 6, p.y + 6, 20, 20); }
      });
      if (target.blocked) { const p = screen(target.blocked); ctx.fillStyle = '#e86c7d99'; ctx.fillRect(p.x + 1, p.y + 1, 30, 30); ctx.fillStyle = '#fff9eb'; ctx.textAlign = 'center'; ctx.fillText('×', p.x + 16, p.y + 22); }
    }
    for (const a of [...actors].sort((a, b) => a.position.y - b.position.y)) {
      if (a.hp <= 0 || !occupied(a).some(p => visible(p))) continue;
      const p = screen(a.position); ctx.save(); ctx.beginPath();
      const w = Math.max(...a.cells.map(c => c.x)) + 1, h = Math.max(...a.cells.map(c => c.y)) + 1;
      for (let y = Math.floor(a.position.y) - 1; y <= Math.ceil(a.position.y) + h; y++) for (let x = Math.floor(a.position.x) - 1; x <= Math.ceil(a.position.x) + w; x++) if (visible({ x, y })) { const t = screen({ x, y }); ctx.rect(t.x, t.y, TILE, TILE); }
      ctx.clip(); this.sprite(ctx, a, p.x, p.y, clock); ctx.restore();
    }
    this.effects = this.effects.filter(e => clock - e.born < e.duration);
    for (const e of this.effects) {
      if (clock < e.born || !visible(e.position)) continue;
      if (!e.played) { e.played = true; this.onSound?.(e); }
      const age = Math.min(1, (clock - e.born) / e.duration), p = screen(e.position), color = e.attribute ? ATTRIBUTE_COLORS[e.attribute] : '#ffc654'; ctx.save();
      if (e.type === 'cast' || e.type === 'attack') this.skillEffect(ctx, e, age, screen);
      else if (e.type === 'defeat' || e.type === 'pickup' || e.type === 'reaction') {
        ctx.globalAlpha = 1 - age; ctx.fillStyle = color;
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = 5 + age * 27; ctx.fillRect(p.x + 16 + Math.cos(a) * r, p.y + 13 + Math.sin(a) * r, 3, 3); }
        if (e.text) this.popup(ctx, e.text, p.x + 16, p.y - age * 20, color, true);
      } else { ctx.globalAlpha = 1 - age; this.popup(ctx, e.text ?? `${e.critical ? '!' : ''}${e.amount}`, p.x + 16 + (e.index % 3 - 1) * 7, p.y - age * 22 - e.index % 3 * 7, e.type === 'heal' ? '#24a991' : color, !!e.critical); }
      ctx.restore();
    }
    this.drawMini();
  }
  private popup(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, bold: boolean): void { ctx.font = `${bold ? 'bold ' : ''}${bold ? 14 : 12}px monospace`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#fffaf0'; ctx.fillStyle = color; ctx.strokeText(text, x, y); ctx.fillText(text, x, y); }
  private skillEffect(ctx: CanvasRenderingContext2D, e: GameEvent, age: number, screen: (p: Point) => Point): void {
    const from = screen(e.position), to = screen(e.target ?? e.position), x = from.x + 16 + (to.x - from.x) * Math.min(1, age * 1.5), y = from.y + 16 + (to.y - from.y) * Math.min(1, age * 1.5); ctx.globalAlpha = Math.min(1, (1 - age) * 3);
    if (e.skillId === 'fireball') { for (let i = 4; i >= 0; i--) { const t = Math.max(0, age * 1.5 - i * .035); ctx.fillStyle = i ? '#ff9868' : '#fff19b'; const size = i ? 4 : 10; ctx.fillRect(from.x + 16 + (to.x - from.x) * Math.min(1, t) - size / 2, from.y + 16 + (to.y - from.y) * Math.min(1, t) - size / 2, size, size); } }
    else if (e.skillId === 'thunder') { if (age > .15) { ctx.strokeStyle = '#b887f9'; ctx.lineWidth = 6; const path = () => { ctx.beginPath(); ctx.moveTo(to.x + 20, to.y - 27); ctx.lineTo(to.x + 9, to.y - 5); ctx.lineTo(to.x + 22, to.y - 5); ctx.lineTo(to.x + 13, to.y + 19); ctx.stroke(); }; path(); ctx.strokeStyle = '#fffde4'; ctx.lineWidth = 2; path(); } }
    else if (e.skillId === 'tornado') { ctx.strokeStyle = '#f6ffe9'; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x + Math.sin(age * 25 + i) * 3, y + 8 - i * 6, 4 + i * 3, 2 + i, age * 8, .3, Math.PI * 1.8); ctx.stroke(); } }
    else if (e.skillId === 'firerain') { for (const [i, cell] of (e.path ?? []).entries()) { const p = screen(cell), pulse = (age * 3 + i % 3 * .06) % 1; ctx.fillStyle = '#ff965c'; ctx.fillRect(p.x + 12, p.y - 13 + pulse * 30, 5, 12); ctx.fillStyle = '#fff19b'; ctx.fillRect(p.x + 13, p.y - 8 + pulse * 30, 3, 6); } }
    else { const angle = Math.atan2(to.y - from.y, to.x - from.x); ctx.strokeStyle = e.type === 'attack' ? e.actorId?.startsWith('ally') ? '#39bdb1' : '#ef6d85' : '#fff5bc'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(from.x + 16, from.y + 16, 23, angle - 1.2 + age, angle + .2 + age); ctx.stroke(); ctx.strokeStyle = '#fffefa'; ctx.lineWidth = 2; ctx.stroke(); }
  }
  drawMini(target?: CanvasRenderingContext2D): void {
    const ctx = target ?? this.miniCtx, s = this.session; if (!ctx || !s) return;
    const map = s.state.mapState, size = ctx.canvas.width, scale = size / Math.max(map.width, map.height); ctx.fillStyle = '#dae9df'; ctx.fillRect(0, 0, size, size); ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (s.state.exploredMap[y * map.width + x]) { ctx.fillStyle = map.tiles[y * map.width + x] === 1 ? '#adc7ac' : s.visible({ x, y }) ? '#82c884' : '#b5d7b3'; ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale)); }
    for (const obj of map.objects) if (s.state.exploredMap[obj.position.y * map.width + obj.position.x] && (obj.type === 'exit' || obj.type === 'chest' && !obj.opened)) { ctx.fillStyle = '#ecab3e'; ctx.fillRect(obj.position.x * scale, obj.position.y * scale, Math.max(2, scale), Math.max(2, scale)); }
    for (const e of s.state.enemyStates) for (const p of occupied(e)) if (s.visible(p)) { ctx.fillStyle = '#ec6d83'; ctx.fillRect(p.x * scale, p.y * scale, Math.max(2, scale), Math.max(2, scale)); }
    ctx.fillStyle = '#3487c6'; const p = s.state.playerState.position; ctx.fillRect(p.x * scale, p.y * scale, Math.max(3, scale), Math.max(3, scale));
  }
}
