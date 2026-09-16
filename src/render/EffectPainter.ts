import type { GameEvent, Point } from '../game/types';

/** データ側のvisualキーで再利用する罠演出。地形には描かず発動イベントだけを描画。 */
export function drawTrapEffect(ctx: CanvasRenderingContext2D, event: GameEvent, age: number, screen: (p: Point) => Point): void {
  ctx.globalAlpha = Math.min(1, (1 - age) * 3);
  for (const cell of event.path ?? [event.position]) {
    const p = screen(cell), x = p.x + 16, y = p.y + 16;
    if (event.visual === 'fireBlast') {
      ctx.fillStyle = '#ff935577'; ctx.fillRect(p.x, p.y, 32, 32);
      for (let i = 0; i < 5; i++) { const angle = i * Math.PI * .4, r = age * 24; ctx.fillStyle = i % 2 ? '#ff9b55' : '#fff1a2'; ctx.fillRect(x + Math.cos(angle) * r - 3, y + Math.sin(angle) * r - 3, 6, 6); }
    } else if (event.visual === 'fallingRocks') {
      const fall = Math.min(1, age * 2), rockY = y - 36 + fall * 36;
      ctx.fillStyle = '#776e65'; ctx.fillRect(x - 5, rockY - 5, 10, 10); ctx.fillStyle = '#dad1b1'; ctx.fillRect(x - 4, rockY - 4, 6, 3);
      if (fall === 1) { ctx.strokeStyle = '#eee0b9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + 6, age * 18, age * 8, 0, 0, Math.PI * 2); ctx.stroke(); }
    } else if (event.visual === 'summonRing') {
      ctx.strokeStyle = '#7169ac'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y + 9, 8 + age * 15, 4 + age * 7, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#f5eeff'; for (let i = 0; i < 3; i++) ctx.fillRect(x - 9 + i * 8, y - age * 30, 3, 10);
    } else if (event.visual === 'snare') {
      const gap = (1 - Math.min(1, age * 3)) * 13;
      ctx.strokeStyle = '#667b82'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x - gap, y, 13, Math.PI / 2, Math.PI * 1.5); ctx.stroke(); ctx.beginPath(); ctx.arc(x + gap, y, 13, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      ctx.fillStyle = '#fff2b8'; ctx.fillRect(x - 2, y - 20, 4, 8);
    } else {
      ctx.strokeStyle = event.visual === 'healingGlow' ? '#47c99b' : '#ffd674'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 7 + age * 22, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = event.visual === 'healingGlow' ? '#f2fff0' : '#fff2b9';
      for (let i = 0; i < 4; i++) { const dx = Math.cos(i * Math.PI / 2) * 17, dy = Math.sin(i * Math.PI / 2) * 17 - age * 13; ctx.fillRect(x + dx - 1, y + dy - 4, 3, 9); ctx.fillRect(x + dx - 4, y + dy - 1, 9, 3); }
    }
  }
}
