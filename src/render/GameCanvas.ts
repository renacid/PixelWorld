import type { GameSession } from '../game/GameSession';
import { occupied, wall } from '../game/MapState';
import type { Actor, GameEvent, Point, SkillId } from '../game/types';
import { ATTRIBUTE_COLORS } from '../data/skills';
import { previewSkill } from '../skills/SkillResolver';
import type { Settings } from '../game/SaveManager';
const TILE = 32;
type Effect = GameEvent & { born: number; index: number };
const PALETTE: Record<string, string> = { '.': '', h: '#443c35', s: '#f5d4a0', w: '#f6ecc8', g: '#749466', G: '#405a45', d: '#243c34', b: '#557f8d', B: '#324a60', y: '#d5b064', r: '#b77f5d', k: '#1a292b', p: '#a9d2a3', l: '#7dad76', e: '#ebedbc', o: '#bf9265' };
const HERO = [
  '......hhhh......', '.....hhhhhh.....', '....hhhhhhhh....', '....hssssssh....', '....hskssks.....', '.....ssssss.....', '......ssss......', '....GGwwGGGG....', '...GGGwwGGGGG...', '...sGGwwGGG.s...', '...sGGyyyyG.s...', '....GGbbbbG.....', '....bb..bbb.....', '....bb..bbb.....', '...hhh..hhhh....', '................',
];
const SLIME = [
  '................', '................', '................', '......lll.......', '....lllllll.....', '...lppplllll....', '..lppplllllll...', '..lppllllllll...', '.llllklllkllll..', '.llllklllkllll..', '.lllllllllllll..', '..lllllllllll...', '...lllllllll....', '....GGGGGGG.....', '................', '................',
];
const WOLF = [
  '..b........b....', '..bb......bb....', '..bbb....bbb....', '..bbbbbbbbbb....', '...bwbbbbwb.....', '...bkbbbbkb.....', '...bbbbbbbb.....', '....bbwwbb......', '.....bkkb.......', '....bbbbbb......', '...bbbbbbbb.....', '...bbBBBBbb.....', '...bb....bb.....', '..kkk....kkk....', '................', '................',
];
const GOLEM = [
  '.....GGGGGG.....', '...GGooooooGG...', '..GooorooooooG..', '..GookooookooG..', '..GooeyooeyooG..', '...GooooooooG...', '....GooooooG....', '..GGoGGGGGooGG..', '.GooGooooooGooG.', '.GooGooGoooGooG.', '.GooGooooooGooG.', '..GGGooooooGGG..', '....GGoGGooG....', '...GoooGGoooG...', '...GGGG..GGGG...', '................',
];
export class GameCanvas {
  private ctx: CanvasRenderingContext2D;
  private miniCtx: CanvasRenderingContext2D | null;
  private frame = 0;
  private effects: Effect[] = [];
  session: GameSession | null = null;
  selected: SkillId | null = null;
  camera: Point | null = null;
  settings: Settings = { grid: false, motion: true };
  constructor(private canvas: HTMLCanvasElement, mini?: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!; this.miniCtx = mini?.getContext('2d') ?? null;
    canvas.width = 288; canvas.height = 288;
    if (mini) { mini.width = 72; mini.height = 72; }
  }
  start(): void { const loop = () => { this.draw(); this.frame = requestAnimationFrame(loop); }; loop(); }
  destroy(): void { cancelAnimationFrame(this.frame); }
  animate(events: GameEvent[]): void { this.effects.push(...events.map((e, i) => ({ ...e, born: performance.now(), index: i }))); }
  sprite(ctx: CanvasRenderingContext2D, a: Actor, x: number, y: number, clock: number): void {
    const width = (Math.max(...a.cells.map(c => c.x)) + 1) * TILE;
    const height = (Math.max(...a.cells.map(c => c.y)) + 1) * TILE;
    const cx = x + width / 2, cy = y + height / 2;
    ctx.fillStyle = '#102c2866'; ctx.beginPath(); ctx.ellipse(cx, y + height - 6, width * .31, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (a.kind === 'sprite') {
      const bob = this.settings.motion ? Math.sin(clock / 280) * 2 : 0;
      ctx.fillStyle = '#a7e6c066'; ctx.fillRect(cx - 10, cy - 10 + bob, 20, 20); ctx.fillStyle = '#d7f6ba'; ctx.fillRect(cx - 4, cy - 7 + bob, 8, 12); ctx.fillRect(cx - 6, cy - 3 + bob, 12, 4); return;
    }
    const pixels = a.kind === 'player' ? HERO : a.kind === 'slime' ? SLIME : a.kind === 'wolf' ? WOLF : GOLEM;
    const scale = a.kind === 'boss' ? 5 : a.kind === 'golem' ? 3 : 2;
    const bob = a.kind === 'slime' && this.settings.motion ? Math.round(Math.sin(clock / 420 + a.position.x) * 1) : 0;
    const flash = this.effects.some(e => e.type === 'damage' && e.position.x === a.position.x && e.position.y === a.position.y && clock - e.born < 200);
    for (let py = 0; py < pixels.length; py++) for (let px = 0; px < pixels[py].length; px++) {
      const color = PALETTE[pixels[py][px]]; if (!color) continue;
      ctx.fillStyle = flash ? '#fff6d2' : color;
      ctx.fillRect(Math.floor(cx - scale * 8 + px * scale), Math.floor(cy - scale * 8 + py * scale + bob), scale, scale);
    }
    if (a.kind === 'boss') { ctx.fillStyle = '#e8ca74'; ctx.fillRect(cx - 12, y + 5, 24, 6); ctx.fillRect(cx - 12, y, 4, 8); ctx.fillRect(cx - 2, y - 3, 4, 9); ctx.fillRect(cx + 8, y, 4, 8); }
    if (a.kind !== 'player' && a.hp < a.maxHp) { ctx.fillStyle = '#1c2826'; ctx.fillRect(cx - 11, y + 2, 22, 3); ctx.fillStyle = '#dd9b7e'; ctx.fillRect(cx - 11, y + 2, 22 * a.hp / a.maxHp, 3); }
    a.afflictions.forEach((f, i) => { ctx.fillStyle = ATTRIBUTE_COLORS[f.attribute]; ctx.fillRect(cx - 7 + i * 9, y - 5, 6, 4); });
    if (a.mode === 'hostile' && a.kind !== 'player') { ctx.fillStyle = '#efbb88'; ctx.font = 'bold 9px monospace'; ctx.fillText('!', x + width - 4, y + 3); }
  }
  tile(ctx: CanvasRenderingContext2D, x: number, y: number, tx: number, ty: number, isWall: boolean, explored = true): void {
    const hash = Math.abs(Math.imul(tx + 71, 198491317) ^ Math.imul(ty + 13, 6542989));
    ctx.fillStyle = !explored ? '#112424' : isWall ? '#2b4942' : ['#415c43', '#3e5941', '#435e44', '#405a42'][hash % 4]; ctx.fillRect(x, y, TILE, TILE);
    if (!explored) return;
    if (isWall) {
      ctx.fillStyle = '#213d36'; ctx.fillRect(x, y + 25, 32, 7);
      ctx.fillStyle = '#637561'; ctx.fillRect(x + 1, y + 3, 29, 19);
      ctx.fillStyle = '#71816a'; ctx.fillRect(x + 2, y + 3, 27, 3);
      ctx.fillStyle = '#4f6756'; ctx.fillRect(x + 3, y + 15, 26, 6); ctx.fillRect(x + 13, y + 5, 2, 8);
      ctx.fillStyle = '#879262'; ctx.fillRect(x + 2, y + 1, 8, 4);
    } else {
      ctx.fillStyle = '#587049';
      const gx = x + 4 + hash % 19, gy = y + 4 + (hash >> 5) % 20;
      ctx.fillRect(gx, gy, 2, 4); ctx.fillRect(gx - 2, gy + 1, 2, 2); ctx.fillRect(gx + 2, gy - 1, 2, 4);
      ctx.fillStyle = '#769064'; ctx.fillRect(x + hash % 27, y + (hash >> 8) % 26, 2, 1);
      if (hash % 19 === 0) { ctx.fillStyle = '#d5cc97'; ctx.fillRect(x + 17, y + 13, 2, 2); ctx.fillStyle = '#8d9c65'; ctx.fillRect(x + 17, y + 15, 1, 3); }
    }
    if (this.settings.grid) { ctx.strokeStyle = '#cde2b712'; ctx.lineWidth = .5; ctx.strokeRect(x, y, TILE, TILE); }
  }
  draw(): void {
    const s = this.session;
    if (!s) return;
    const ctx = this.ctx, state = s.state, clock = performance.now();
    ctx.imageSmoothingEnabled = false;
    const center = this.camera ?? state.playerState.position;
    const origin = { x: center.x - 4, y: center.y - 4 };
    const screen = (p: Point) => ({ x: (p.x - origin.x) * TILE, y: (p.y - origin.y) * TILE });
    ctx.fillStyle = '#112424'; ctx.fillRect(0, 0, 288, 288);
    for (let dy = 0; dy < 9; dy++) for (let dx = 0; dx < 9; dx++) {
      const p = { x: origin.x + dx, y: origin.y + dy };
      const explored = p.x >= 0 && p.y >= 0 && p.x < state.mapState.width && p.y < state.mapState.height && state.exploredMap[p.y * state.mapState.width + p.x];
      this.tile(ctx, dx * TILE, dy * TILE, p.x, p.y, wall(state.mapState, p), !!explored);
      if (explored && !s.visible(p)) { ctx.fillStyle = '#101f24aa'; ctx.fillRect(dx * TILE, dy * TILE, TILE, TILE); }
    }
    for (const f of state.mapState.fields) if (s.visible(f.position)) {
      const p = screen(f.position); ctx.fillStyle = '#e4915c66'; ctx.fillRect(p.x + 3, p.y + 3, 26, 26);
      ctx.fillStyle = '#efb56f'; ctx.fillRect(p.x + 11, p.y + 15, 10, 8); ctx.fillRect(p.x + 14, p.y + 9, 5, 11);
    }
    for (const obj of state.mapState.objects) {
      if (!s.visible(obj.position)) continue;
      const { x, y } = screen(obj.position);
      if (obj.type === 'exit') {
        ctx.fillStyle = '#1b3831'; ctx.fillRect(x + 4, y + 3, 24, 26); ctx.strokeStyle = s.goalReady() ? '#d7d2a0' : '#799889'; ctx.strokeRect(x + 5.5, y + 3.5, 22, 25);
        ctx.fillStyle = s.goalReady() ? '#baca90' : '#71816a'; for (let n = 0; n < 4; n++) ctx.fillRect(x + 8 + n * 2, y + 22 - n * 4, 16 - n * 3, 2);
      } else if (obj.type === 'chest') {
        ctx.fillStyle = '#24392dcc'; ctx.fillRect(x + 5, y + 24, 23, 4);
        ctx.fillStyle = obj.opened ? '#685c40' : '#9b673c'; ctx.fillRect(x + 6, y + 12, 21, 13);
        ctx.fillStyle = obj.opened ? '#363e2e' : obj.objective ? '#f1dd8a' : '#d6ac63'; ctx.fillRect(x + 5, y + (obj.opened ? 5 : 10), 23, 5);
        ctx.fillStyle = '#d0b16b'; ctx.fillRect(x + 8, y + 13, 2, 11); ctx.fillRect(x + 23, y + 13, 2, 11); ctx.fillRect(x + 15, y + 15, 4, 4);
        if (!obj.opened && obj.objective) { ctx.fillStyle = '#f9e2a5'; ctx.fillRect(x + 15, y + 3, 3, 3); }
      } else if (obj.type === 'skill') {
        ctx.fillStyle = '#dec080'; ctx.fillRect(x + 9, y + 9, 14, 16); ctx.fillStyle = '#695b44'; ctx.fillRect(x + 12, y + 12, 8, 2); ctx.fillRect(x + 12, y + 17, 7, 2);
      } else {
        ctx.fillStyle = obj.itemId === 'potion' ? '#e39489' : obj.itemId === 'ether' ? '#9dbddb' : '#d7d798';
        ctx.fillRect(x + 12, y + 10, 8, 3); ctx.fillRect(x + 10, y + 14, 12, 12); ctx.fillStyle = '#e9e1bd'; ctx.fillRect(x + 13, y + 7, 6, 3); ctx.fillRect(x + 11, y + 16, 2, 6);
      }
    }
    if (this.selected) {
      const target = previewSkill(state, this.selected, state.playerState.facing);
      const color = ATTRIBUTE_COLORS[({ attack: 'physical', fireball: 'fire', thunder: 'thunder', tornado: 'wind', firerain: 'fire' } as const)[this.selected]];
      target.cells.forEach((cell, i) => {
        const p = screen(cell); ctx.fillStyle = `${color}44`; ctx.fillRect(p.x + 1, p.y + 1, 30, 30); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.strokeRect(p.x + 2.5, p.y + 2.5, 27, 27);
        if (this.selected !== 'firerain') { ctx.fillStyle = color; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'center'; ctx.fillText(({ up: '↑', right: '→', down: '↓', left: '←' })[state.playerState.facing], p.x + 16, p.y + 21); }
        if (i === target.cells.length - 1 && this.selected !== 'firerain') { ctx.strokeStyle = '#fff2c9'; ctx.strokeRect(p.x + 6.5, p.y + 6.5, 19, 19); }
      });
      if (target.blocked) { const p = screen(target.blocked); ctx.fillStyle = '#d8867899'; ctx.fillRect(p.x + 1, p.y + 1, 30, 30); ctx.fillStyle = '#fff1cf'; ctx.textAlign = 'center'; ctx.fillText('×', p.x + 16, p.y + 22); }
    }
    const actors = [...state.allyStates, ...state.enemyStates, state.playerState].sort((a, b) => a.position.y - b.position.y);
    for (const a of actors) {
      if (a.hp <= 0 || !occupied(a).some(p => s.visible(p))) continue;
      const p = screen(a.position);
      // Clip large sprites to currently visible cells: unseen enemies never leak into fog.
      ctx.save(); ctx.beginPath(); for (const c of occupied(a).filter(c => s.visible(c))) { const t = screen(c); ctx.rect(t.x, t.y - 7, 32, 39); } ctx.clip();
      this.sprite(ctx, a, p.x, p.y, clock); ctx.restore();
    }
    if (!this.camera) {
      const p = screen(state.playerState.position), v = ({ up: [16, 0], right: [31, 16], down: [16, 31], left: [0, 16] })[state.playerState.facing];
      ctx.fillStyle = '#f4df9c'; ctx.fillRect(p.x + v[0] - 1, p.y + v[1] - 1, 3, 3);
    }
    this.effects = this.effects.filter(e => clock - e.born < (this.settings.motion ? 1000 : 450));
    for (const e of this.effects) {
      if (!s.visible(e.position)) continue;
      const age = (clock - e.born) / 1000, p = screen(e.position);
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - age);
      const color = e.attribute ? ATTRIBUTE_COLORS[e.attribute] : '#e8d69e';
      if (e.type === 'cast') { ctx.fillStyle = color + '55'; ctx.fillRect(p.x + 6, p.y + 6, 20, 20); }
      else if (e.type === 'defeat') { ctx.strokeStyle = '#e9d8a8'; ctx.strokeRect(p.x + 16 - age * 12, p.y + 16 - age * 12, age * 24, age * 24); }
      else {
        ctx.font = `${e.critical ? 'bold ' : ''}${e.type === 'reaction' ? 12 : e.critical ? 15 : 12}px monospace`;
        ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#192a25'; ctx.fillStyle = e.type === 'heal' ? '#a5e0ab' : color;
        const label = e.text ?? `${e.critical ? '!' : ''}${e.amount}`;
        const y = p.y + 1 - (this.settings.motion ? age * 22 : 0) - (e.index % 3) * 9;
        ctx.strokeText(label, p.x + 16, y); ctx.fillText(label, p.x + 16, y);
      }
      ctx.restore();
    }
    this.drawMini();
  }
  drawMini(target?: CanvasRenderingContext2D): void {
    const ctx = target ?? this.miniCtx, s = this.session; if (!ctx || !s) return;
    const map = s.state.mapState, size = ctx.canvas.width, scale = size / Math.max(map.width, map.height);
    ctx.fillStyle = '#132b28'; ctx.fillRect(0, 0, size, size); ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      if (!s.state.exploredMap[y * map.width + x]) continue;
      ctx.fillStyle = map.tiles[y * map.width + x] === 1 ? '#6c806c' : s.visible({ x, y }) ? '#4c7658' : '#2c4a3e'; ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
    }
    for (const obj of map.objects) if (s.state.exploredMap[obj.position.y * map.width + obj.position.x] && (obj.type === 'exit' || obj.type === 'chest' && !obj.opened)) { ctx.fillStyle = '#d8bf7b'; ctx.fillRect(obj.position.x * scale, obj.position.y * scale, Math.max(2, scale), Math.max(2, scale)); }
    for (const e of s.state.enemyStates) for (const p of occupied(e)) if (s.visible(p)) { ctx.fillStyle = '#de9682'; ctx.fillRect(p.x * scale, p.y * scale, Math.max(2, scale), Math.max(2, scale)); }
    ctx.fillStyle = '#f5edca'; const p = s.state.playerState.position; ctx.fillRect(p.x * scale, p.y * scale, Math.max(3, scale), Math.max(3, scale));
  }
}
