import type { Actor, Direction } from '../game/types';
export const PIXEL_COLORS: Record<string, string> = { '.': '', r: '#fa775e', R: '#c34b54', s: '#ffe6b0', w: '#fff9e6', b: '#4a9ed9', B: '#306da2', k: '#29445f', y: '#ffd05f', g: '#75d982', G: '#42ab70', p: '#b7f4a0', o: '#d8b987', O: '#ac9067', t: '#67e7d1' };
function make(kind: Actor['kind'], facing: 'down' | 'up' | 'left'): string[] {
  const pixels = Array.from({ length: 16 }, () => Array<string>(16).fill('.'));
  const rect = (x: number, y: number, w: number, h: number, color: string) => { for (let dy = y; dy < y + h; dy++) for (let dx = x; dx < x + w; dx++) if (dy >= 0 && dy < 16 && dx >= 0 && dx < 16) pixels[dy][dx] = color; };
  if (kind === 'player') {
    rect(4, 1, 8, 1, 'R'); rect(3, 2, 10, 7, 'r'); rect(2, 3, 12, 4, 'r'); rect(4, 9, 8, 4, 'b'); rect(3, 10, 1, 3, 's'); rect(12, 10, 1, 3, 's'); rect(5, 13, 2, 2, 'k'); rect(9, 13, 2, 2, 'k'); rect(4, 12, 8, 1, 'B');
    if (facing === 'down') { rect(4, 4, 8, 4, 's'); rect(5, 5, 2, 2, 'k'); rect(9, 5, 2, 2, 'k'); rect(7, 8, 2, 1, 's'); rect(5, 9, 6, 1, 'y'); }
    else if (facing === 'up') { rect(4, 3, 8, 2, 'R'); rect(5, 9, 6, 4, 'y'); rect(6, 9, 4, 1, 'w'); rect(7, 11, 2, 1, 'O'); }
    else { rect(2, 4, 5, 4, 's'); rect(3, 5, 2, 2, 'k'); rect(1, 6, 2, 1, 's'); rect(10, 9, 3, 4, 'y'); rect(5, 10, 2, 2, 's'); rect(8, 3, 3, 1, 'R'); }
  } else if (kind === 'slime') {
    rect(5, 5, 6, 1, 'G'); rect(3, 6, 10, 2, 'g'); rect(2, 8, 12, 5, 'g'); rect(3, 13, 10, 1, 'G'); rect(4, 7, 3, 2, 'p');
    if (facing === 'down') { rect(5, 10, 2, 2, 'k'); rect(10, 10, 2, 2, 'k'); rect(8, 12, 1, 1, 'G'); }
    else if (facing === 'left') { rect(3, 10, 2, 2, 'k'); rect(6, 10, 1, 2, 'k'); rect(10, 9, 3, 3, 'G'); }
    else { rect(7, 8, 4, 1, 'p'); rect(5, 11, 7, 2, 'G'); }
  } else if (kind === 'wolf') {
    rect(3, 2, 2, 4, 'B'); rect(11, 2, 2, 4, 'B'); rect(4, 4, 8, 7, 'b'); rect(3, 6, 10, 3, 'b'); rect(5, 11, 6, 2, 'B'); rect(4, 13, 3, 2, 'k'); rect(9, 13, 3, 2, 'k');
    if (facing === 'down') { rect(5, 6, 2, 2, 'k'); rect(9, 6, 2, 2, 'k'); rect(6, 8, 4, 2, 'w'); rect(7, 8, 2, 1, 'k'); }
    else if (facing === 'left') { rect(4, 6, 2, 2, 'k'); rect(1, 8, 5, 2, 'w'); rect(1, 8, 1, 1, 'k'); rect(12, 10, 2, 2, 'b'); }
    else { rect(6, 5, 4, 5, 'B'); rect(7, 11, 2, 3, 'w'); }
  } else if (kind === 'sprite') {
    rect(6, 3, 4, 1, 'G'); rect(4, 4, 8, 8, 'p'); rect(3, 6, 10, 4, 'p'); rect(1, 7, 2, 3, 'w'); rect(13, 7, 2, 3, 'w'); rect(6, 12, 4, 2, 'g');
    if (facing === 'down') { rect(5, 7, 2, 2, 'k'); rect(9, 7, 2, 2, 'k'); } else if (facing === 'left') { rect(4, 7, 2, 2, 'k'); rect(10, 6, 2, 4, 'g'); } else rect(6, 6, 4, 4, 'g');
  } else {
    rect(4, 2, 8, 1, 'O'); rect(3, 3, 10, 6, 'o'); rect(4, 9, 8, 4, 'o'); rect(1, 9, 3, 4, 'O'); rect(12, 9, 3, 4, 'O'); rect(4, 13, 3, 2, 'O'); rect(9, 13, 3, 2, 'O');
    if (facing === 'down') { rect(5, 5, 2, 2, 'k'); rect(9, 5, 2, 2, 'k'); rect(5, 5, 1, 1, 't'); rect(9, 5, 1, 1, 't'); rect(7, 10, 2, 2, 't'); }
    else if (facing === 'left') { rect(3, 5, 2, 2, 'k'); rect(3, 5, 1, 1, 't'); rect(2, 7, 3, 1, 'O'); rect(9, 4, 1, 4, 'O'); }
    else { rect(7, 3, 1, 3, 'O'); rect(8, 6, 2, 1, 'O'); rect(6, 10, 4, 1, 'O'); }
    if (kind === 'boss') { rect(4, 1, 8, 2, 'y'); rect(4, 0, 2, 1, 'y'); rect(7, 0, 2, 1, 'y'); rect(10, 0, 2, 1, 'y'); }
  }
  return pixels.map(row => row.join(''));
}
const atlas = new Map<string, string[]>();
export function spritePixels(kind: Actor['kind'], direction: Direction): string[] {
  const key = `${kind}:${direction}`;
  if (!atlas.has(key)) { const pixels = make(kind, direction === 'right' ? 'left' : direction); atlas.set(key, direction === 'right' ? pixels.map(row => [...row].reverse().join('')) : pixels); }
  return atlas.get(key)!;
}
