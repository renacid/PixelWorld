import { actorDefinition } from '../data/enemies';
import type { Actor } from '../game/types';
import { ATTRIBUTE_COLORS } from '../data/skills';
import { movementLocked } from '../game/ActorStats';

// 8×8のコード内ドット絵。各状態の図案・色はここで差し替えられます。
export const STATUS_ICONS = {
  fireWeakness:['bbbbbbbb','bbbbbbbb','bbbbbbbb','.bbbbbb.','.bbbbbb.','..bbbb..','...bb...','........'],
  resistanceUp:['rrrrrrrr','rrrrrrrr','rrrrrrrr','.rrrrrr.','.rrrrrr.','..rrrr..','...rr...','........'],
  buff: ['......oo','.....ooo','....ooo.','o..ooo..','.oooo...','..oo....','.o.oo...','o.......'],
  bond: ['.rr..rr.','r..rr..r','r..rr..r','.rr..rr.','...rr...','...rr...','...rr...','...rr...'],
  root: ['..rrrr..','.rrrrrr.','rrrrrrrr','rwwwwwwr','rwwwwwwr','rrrrrrrr','.rrrrrr.','..rrrr..'],
  stun: ['rr....rr','rrr..rrr','.rrrrrr.','..rrrr..','..rrrr..','.rrrrrr.','rrr..rrr','rr....rr'],
  alert: ['...oo...','...oo...','...oo...','...oo...','........','...oo...','........','........'],
  // 土・氷の二つの勾玉が向かい合う形。白い点は付けず、二色だけで表現。
  frost: ['..eeee..','.eeeeei.','eeeeeiii','eeeeiiii','eeeiiiii','eeiiiii.','.eiiii..','..iiii..'],
} as const;
type Icon = { kind: keyof typeof STATUS_ICONS; color: string };

/** 属性はHPバー上の左端から最大3枠、その他の状態は足元に重ねる。下段だけ3個ずつ1秒で切り替える。 */
export function drawStatusIcons(ctx: CanvasRenderingContext2D, actor: Actor, x: number, y: number, width: number, height: number, clock: number, action: number): void {
  // HPバーと同じ24px幅を8pxずつ3分割。属性の保持数ルールとは独立した表示枠。
  const afflictions = actor.afflictions.filter(f => f.remainingTurns > 0).slice(0, 3);
  ctx.save();
  afflictions.forEach((affliction, index) => {
    const ax = Math.round(x + width / 2 - 12 + index * 8);
    const hpVisible=actor.kind!=='player'&&actor.hp<actor.maxHp;
    const ay = Math.round(y - (hpVisible||actor.kind==='player'?7:0));
    ctx.fillStyle = '#ffffff'; ctx.fillRect(ax, ay, 8, 6);
    ctx.fillStyle = ATTRIBUTE_COLORS[affliction.attribute]; ctx.fillRect(ax + 1, ay + 1, 6, 4);
  });
  ctx.restore();
  const icons: Icon[] = [];
  if(actorDefinition(actor.kind).fireVulnerability)icons.push({kind:'fireWeakness',color:'#ff6347'});
  if((actor.bossLinkUntil??0)>action)icons.push({kind:'bond',color:'#d95d84'});
  for (const buff of actor.buffs ?? []) if (buff.remainingTurns > 0) icons.push({ kind: 'buff', color: '#ff982e' });
  if ((actor.stunnedUntil??0)>action) icons.push({ kind: 'stun', color: '#f04444' });
  if (movementLocked(actor, action)) icons.push({ kind: 'root', color: '#f04444' });
  if (actor.frostErosion) icons.push({ kind: 'frost', color: '#a77948' });
  // 敵視開始だけは例外。従来どおり右上にはみ出す大きな「!」を1行動表示。
  if (actor.kind !== 'player' && actor.mode === 'hostile' && actor.alertedAt === action) {
    ctx.save();
    ctx.fillStyle = '#fff5d9'; ctx.fillRect(x + width - 6, y - 11, 10, 15);
    ctx.fillStyle = '#ee605d'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
    ctx.fillText('!', x + width - 1, y + 1);
    ctx.restore();
  }
  if (!icons.length) return;
  const page = Math.floor(clock / 1000) % Math.ceil(icons.length / 3);
  const visible = icons.slice(page * 3, page * 3 + 3);
  // 切り替わっても左端は固定。占有マス内の足元に重なる最大3枠（各8px、背景なし）。
  const left = Math.round(x + (width - 26) / 2), top = Math.round(y + height - 12);
  ctx.save();
  visible.forEach((icon, index) => {
    const ix = left + index * 9;
    drawStatusIcon(ctx, icon.kind, icon.color, ix, top);
  });
  ctx.restore();
}

/** ゲームと開発プレビューで同じ図案・描画処理を共有。 */
export function drawStatusIcon(ctx: CanvasRenderingContext2D, kind: keyof typeof STATUS_ICONS, color: string, x: number, y: number): void {
  STATUS_ICONS[kind].forEach((row, py) => [...row].forEach((cell, px) => {
    if (cell === '.') return;
    ctx.fillStyle = cell === 'w' ? '#ffffff' : cell === 'b' ? '#438be0' : cell === 'e' ? '#b68750' : cell === 'i' ? '#91dfff' : cell === 'r' ? '#f04444' : color;
    ctx.fillRect(x + px, y + py, 1, 1);
  }));
}
