/** 文字配列から4方向のドット絵を生成。パレットと各キャラの形をここで編集。 */
import type { Direction } from '../game/types';
import type { SpriteId } from '../data/enemies';
export const PIXEL_COLORS: Record<string, string> = { '.': '', r: '#fa775e', R: '#c34b54', s: '#ffe6b0', w: '#fff9e6', b: '#4a9ed9', B: '#306da2', k: '#29445f', y: '#ffd05f', g: '#75d982', G: '#42ab70', p: '#b7f4a0', o: '#d8b987', O: '#ac9067', t: '#67e7d1', a: '#485557', c: '#7f8b87', C: '#b9bcb0', d: '#303e40', m: '#536d39', M: '#8ca659' };
function make(kind: SpriteId, facing: 'down' | 'up' | 'left'): string[] {
  if (kind === 'golem') return makeGolem(facing);
  const pixels = Array.from({ length: 16 }, () => Array<string>(16).fill('.'));
  const rect = (x: number, y: number, w: number, h: number, color: string) => { for (let dy = y; dy < y + h; dy++) for (let dx = x; dx < x + w; dx++) if (dy >= 0 && dy < 16 && dx >= 0 && dx < 16) pixels[dy][dx] = color; };
  if(kind==='reaper'){
    rect(4,2,7,2,'a');rect(3,4,9,7,'k');rect(4,4,7,5,'d');rect(5,5,2,1,'r');rect(9,5,2,1,'r');rect(4,9,7,3,'a');rect(3,11,3,2,'k');rect(8,11,4,2,'k');rect(5,12,2,2,'a');
    const x=facing==='left'?1:13;rect(x,3,1,11,'O');rect(Math.max(0,x-4),1,5,1,'C');rect(Math.max(0,x-5),2,2,2,'w');rect(Math.max(0,x-5),4,1,2,'c');
    if(facing==='up'){rect(4,4,7,4,'a');rect(6,4,2,5,'k');}
  }else if (kind === 'player') {
    rect(4, 1, 8, 1, 'R'); rect(3, 2, 10, 7, 'r'); rect(2, 3, 12, 4, 'r'); rect(4, 9, 8, 4, 'b'); rect(3, 10, 1, 3, 's'); rect(12, 10, 1, 3, 's'); rect(5, 13, 2, 2, 'k'); rect(9, 13, 2, 2, 'k'); rect(4, 12, 8, 1, 'B');
    if (facing === 'down') { rect(4, 4, 8, 4, 's'); rect(5, 5, 2, 2, 'k'); rect(9, 5, 2, 2, 'k'); rect(7, 8, 2, 1, 's'); rect(5, 9, 6, 1, 'y'); }
    else if (facing === 'up') { rect(4, 3, 8, 2, 'R'); rect(5, 9, 6, 4, 'y'); rect(6, 9, 4, 1, 'w'); rect(7, 11, 2, 1, 'O'); }
    else { rect(2, 4, 5, 4, 's'); rect(3, 5, 2, 2, 'k'); rect(1, 6, 2, 1, 's'); rect(10, 9, 3, 4, 'y'); rect(5, 10, 2, 2, 's'); rect(8, 3, 3, 1, 'R'); }
  } else if (kind === 'slime') {
    rect(5, 5, 6, 1, 'G'); rect(3, 6, 10, 2, 'g'); rect(2, 8, 12, 5, 'g'); rect(3, 13, 10, 1, 'G'); rect(4, 7, 3, 2, 'p');
    if (facing === 'down') { rect(5, 10, 2, 2, 'k'); rect(10, 10, 2, 2, 'k'); rect(8, 12, 1, 1, 'G'); }
    else if (facing === 'left') { rect(3, 10, 2, 2, 'k'); rect(6, 10, 1, 2, 'k'); rect(10, 9, 3, 3, 'G'); }
    else { rect(7, 8, 4, 1, 'p'); rect(5, 11, 7, 2, 'G'); }
  } else if (kind === 'fighter' || kind === 'goblin' || kind === 'archer' || kind === 'mage') {
    // 緑の耳と茶色の服、手に持った石でスライムと見分けられるようにします。
    rect(4, 3, 8, 7, 'g'); rect(1, 4, 3, 3, 'G'); rect(12, 4, 3, 3, 'G');
    rect(5, 10, 6, 3, 'O'); rect(4, 13, 3, 2, 'k'); rect(9, 13, 3, 2, 'k');
    if (facing === 'down') { rect(5, 5, 2, 2, 'k'); rect(9, 5, 2, 2, 'k'); rect(6, 8, 4, 1, 'w'); rect(12, 10, 3, 3, 'o'); }
    else if (facing === 'up') { rect(5, 4, 6, 2, 'G'); rect(6, 10, 4, 3, 'o'); rect(2, 10, 3, 3, 'o'); }
    else { rect(3, 5, 2, 2, 'k'); rect(2, 7, 3, 2, 'g'); rect(1, 10, 3, 3, 'o'); rect(9, 4, 2, 4, 'G'); }
    if (kind === 'archer') {
      // 服と同じ茶色の帽子。上面とつばを描き、耳と顔は残す。
      rect(5,0,6,1,'O'); rect(4,1,8,2,'O'); rect(5,1,6,1,'o');
      rect(facing==='left'?2:3,3,10,1,'O');
      // 弦と外側の太い弓を分け、縦10ドットの輪郭で目立たせる。
      const x = facing==='left'?0:facing==='up'?1:11;
      rect(x,5,1,10,'w'); rect(x+1,5,2,1,'o'); rect(x+2,6,2,2,'O');
      rect(x+3,8,2,4,'o'); rect(x+2,12,2,2,'O'); rect(x+1,14,2,1,'o');
      rect(x,9,4,1,'y');
    }
    if(kind==='fighter'){
      rect(4,1,8,3,'c');rect(3,3,10,1,'a');rect(7,0,2,4,'C');rect(4,4,1,3,'a');rect(11,4,1,3,'a');
      const x=facing==='left'?0:14;rect(x,5,1,7,'C');rect(x,5,1,2,'w');rect(Math.max(0,x-1),11,3,1,'y');rect(x,12,1,3,'O');
    }
    if (kind === 'mage') { rect(5, 1, 6, 3, 'B'); rect(3, 3, 10, 1, 'b'); rect(5, 10, 6, 3, 'B'); rect(13, 8, 1, 7, 'O'); rect(12, 7, 3, 2, 'r'); }
  } else if (kind === 'wolf') {
    // 背中の明部・腹側の陰・手前と奥の足で斜め上からの厚みを出す。
    if(facing==='left'){
      rect(6,9,2,3,'B');rect(11,9,2,3,'B');
      rect(4,5,9,5,'B');rect(5,4,7,4,'b');rect(6,4,5,1,'w');
      rect(3,9,2,5,'k');rect(10,9,2,5,'k');rect(3,10,2,3,'b');rect(10,10,2,3,'b');
      rect(1,4,5,6,'b');rect(1,2,2,3,'B');rect(4,2,2,3,'B');rect(2,5,3,2,'w');
      rect(0,7,4,3,'w');rect(0,7,1,2,'k');rect(2,6,1,1,'k');rect(4,9,2,2,'B');
      rect(12,5,2,3,'b');rect(14,3,1,4,'B');rect(14,2,1,2,'w');
    }else{
      rect(4,7,2,6,'B');rect(10,7,2,6,'B');rect(5,5,6,7,'B');rect(6,5,4,5,'b');
      if(facing==='down'){
        rect(4,5,8,6,'b');rect(4,3,2,3,'B');rect(10,3,2,3,'B');rect(6,9,4,3,'w');rect(7,10,2,1,'k');rect(5,7,1,1,'k');rect(10,7,1,1,'k');rect(7,2,2,3,'B');
      }else{
        rect(4,3,8,5,'b');rect(4,2,2,3,'B');rect(10,2,2,3,'B');rect(5,4,6,1,'w');rect(7,10,2,4,'b');rect(7,13,2,1,'w');
      }
    }
  } else if (kind === 'treant') {
    // 枯れ枝・裂けた幹・赤い目。足元の根を描画基準にする。
    rect(6,4,5,10,'O');rect(7,5,2,9,'o');rect(4,14,9,1,'O');rect(2,15,4,1,'O');rect(12,15,3,1,'O');
    rect(3,5,3,2,'O');rect(2,2,2,4,'O');rect(0,1,3,1,'O');rect(10,3,3,2,'O');rect(12,0,2,4,'O');rect(14,2,2,1,'O');rect(7,1,2,4,'O');rect(5,0,3,1,'O');
    rect(3,10,3,2,'O');rect(1,8,2,3,'O');rect(11,9,3,2,'O');rect(14,7,1,3,'O');rect(8,11,1,3,'k');
    if(facing!=='up'){rect(facing==='left'?5:6,7,2,1,'r');rect(facing==='left'?8:10,7,2,1,'r');rect(7,10,3,2,'k');rect(8,10,1,1,'w');}
  } else if ((kind === 'sprite' || kind === 'greaterSprite')) {
    // 薄緑の丸い傘と長い触手。描画側で上下に漂わせる。
    rect(6, 2, 4, 1, 'p'); rect(4, 3, 8, 2, 'p'); rect(3, 5, 10, 4, 'p'); rect(2, 7, 12, 3, 'g'); rect(3, 7, 10, 2, 'p');
    rect(4, 10, 1, 4, 'p'); rect(6, 10, 1, 6, 'g'); rect(9, 10, 1, 5, 'p'); rect(11, 10, 1, 4, 'g'); rect(5, 4, 3, 2, 'w');
    if (facing !== 'up') { rect(facing === 'left' ? 4 : 5, 7, 1, 2, 'k'); rect(facing === 'left' ? 7 : 10, 7, 1, 2, 'k'); }
  }
  if(kind==='greaterSprite')for(const x of [4,10]){rect(x,1,1,3,'w');rect(x-1,2,3,1,'w');rect(x,2,1,1,'y');}
  return pixels.map(row => row.join(''));
}
/** 大型キャラは元絵の解像度を増やす。32×40を2倍で描き、通常キャラと同じ2pxドットにする。 */
function makeGolem(facing: 'down' | 'up' | 'left'): string[] {
  const pixels = Array.from({ length: 40 }, () => Array<string>(32).fill('.'));
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++)
      if (py >= 0 && py < 40 && px >= 0 && px < 32) pixels[py][px] = c;
  };
  // 上面を4〜5行、前面を暗く。横向きでは奥の足→胴→手前の足・腕の順に描く。
  const stone = (x:number,y:number,w:number,h:number) => {
    rect(x+2,y,w-4,1,'a'); rect(x+1,y+1,w-2,h-2,'a'); rect(x,y+3,w,h-5,'a');
    rect(x+2,y+1,w-4,3,'C'); rect(x+1,y+4,w-3,h-6,'c');
    rect(x+w-3,y+4,2,h-5,'a'); rect(x+2,y+h-2,w-4,1,'d');
    rect(x+3,y+2,w-6,1,'C');
  };
  if(facing==='left') {
    stone(17,27,10,8); // 奥脚は高い位置、小さめ。つま先も左を向く。
    rect(14,31,7,3,'a'); rect(15,30,7,1,'C');
    stone(20,11,9,15); // 奥腕
    stone(9,10,16,20); rect(20,16,2,10,'a');
    stone(5,0,17,13); rect(5,6,6,4,'c'); rect(4,8,3,3,'a');
    rect(6,7,5,2,'d'); rect(6,7,3,1,'t');
    stone(9,28,10,10); rect(5,33,8,4,'a'); rect(6,32,7,2,'C');
    stone(4,15,10,16); stone(1,25,11,10); // 手前腕と拳を低く置く
    rect(14,18,1,7,'d'); rect(15,21,3,1,'a');
  } else {
    stone(5,28,10,10); stone(19,28,10,10);
    stone(6,9,21,22); stone(1,14,9,15); stone(24,15,8,15);
    stone(0,24,10,11); stone(23,25,9,11);
    stone(8,0,17,13);
    if(facing==='down') {
      rect(10,7,5,2,'d'); rect(18,7,4,2,'d'); rect(11,7,3,1,'t'); rect(18,7,2,1,'t');
      rect(15,8,2,3,'C'); rect(12,11,8,1,'a');
      rect(15,18,2,7,'d'); rect(12,20,8,2,'a'); rect(15,18,1,6,'t'); rect(13,20,6,1,'t');
      rect(5,35,7,1,'C'); rect(19,35,7,1,'C');
    } else {
      rect(13,6,8,2,'c'); rect(17,8,1,4,'a');
      rect(15,17,1,11,'a'); rect(16,23,4,1,'d'); rect(9,16,4,3,'m');
      rect(7,34,6,2,'a'); rect(20,34,6,2,'a');
    }
  }
  // 苔は頭頂・肩の平らな面に生やす。刻印とひびは1ドットの線。
  const moss = facing==='left'?[[8,1],[10,2],[20,12],[5,17],[3,27],[10,30]]:[[11,1],[13,2],[7,11],[24,17],[2,26],[21,31]];
  for(const [x,y] of moss){rect(x,y,3,2,'m');rect(x,y,2,1,'M');rect(x+2,y+2,1,1,'m');}
  const cracks=facing==='left'?[[16,5],[23,19],[8,23],[13,32]]:[[20,4],[9,23],[27,28],[10,32]];
  for(const [x,y] of cracks){rect(x,y,1,3,'a');rect(x+1,y+2,1,2,'d');rect(x-1,y,1,1,'C');}
  return pixels.map(row => row.join(''));
}

const atlas = new Map<string, string[]>();
export function spritePixels(kind: SpriteId, direction: Direction): string[] {
  const key = `${kind}:${direction}`;
  if (!atlas.has(key)) { const pixels = make(kind, direction === 'right' ? 'left' : direction); atlas.set(key, direction === 'right' ? pixels.map(row => [...row].reverse().join('')) : pixels); }
  return atlas.get(key)!;
}
