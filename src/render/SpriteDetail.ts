import type { SpriteId } from '../data/enemies';
import { earthFlowerSprite } from './EarthFlowerSprite';

/** 16ドット原画の雰囲気を残した32ドット版。数字は追加の中間色です。 */
export const DETAIL_COLORS: Record<string,string> = {
 '1':'#ffb390', '2':'#8ce49a', '3':'#85c4ee', '4':'#e7cda2',
 '5':'#a5b3af', '6':'#d5b6fa', '7':'#e4ffd0', '8':'#748653',
 '9':'#ccefff', '0':'#36464b', h:'#dbe2d9', j:'#b18156', f:'#244f3b', l:'#337354',
};
type Facing = 'down'|'up'|'left';

/** 座標は32×32。右向きは完成後の左右反転で作るので装備も一緒に向きます。 */
export function detailSprite(kind:SpriteId,facing:Facing,source:string[]):string[]{
 if(kind==='earthFlower')return earthFlowerSprite(facing);
 if(source[0].length!==16)return source;
 const pixels=source.flatMap(row=>[0,1].map(()=>[...row].flatMap(c=>[c,c])));
 const original=pixels.map(row=>[...row]);
 const at=(x:number,y:number)=>original[y]?.[x]??'.';
 const dot=(x:number,y:number,c:string)=>{if(x>=0&&x<32&&y>=0&&y<32)pixels[y][x]=c;};
 const rect=(x:number,y:number,w:number,h:number,c:string)=>{for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++)dot(x+dx,y+dy,c);};
 const line=(x:number,y:number,ex:number,ey:number,c:string)=>{const n=Math.max(Math.abs(ex-x),Math.abs(ey-y));for(let i=0;i<=n;i++)dot(Math.round(x+(ex-x)*i/(n||1)),Math.round(y+(ey-y)*i/(n||1)),c);};
 const on=(x:number,y:number,c:string,materials:string)=>{if(materials.includes(pixels[y]?.[x]??'.'))dot(x,y,c);};
 const light:Record<string,string>={r:'1',g:'2',G:'g',p:'7',b:'3',B:'b',o:'4',O:'o',c:'5',C:'h',v:'6',V:'v',m:'8',a:'c'};
 const dark:Record<string,string>={r:'R',g:'G',p:'g',b:'B',o:'O',c:'a',C:'c',v:'V',m:'0'};
 // 輪郭だけを1ドット単位で整える。目・口や細い装備は削らない。
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){
  const c=at(x,y);if(!light[c])continue;
  if(at(x,y-1)==='.'&&(at(x-1,y)==='.'||at(x+1,y)==='.')&&at(x,y+1)!=='.')dot(x,y,'.');
  else if(at(x,y-1)==='.')dot(x,y,light[c]);
  else if(at(x,y+1)==='.'&&dark[c])dot(x,y,dark[c]);
 }
 const eyes=(positions:number[][],color='k')=>{for(const [x,y] of positions){rect(x,y,3,4,color);dot(x,y,'w');dot(x+2,y+3,'0');}};
 if(kind==='player'){
  line(9,5,21,5,'1');line(7,7,9,6,'1');
  if(facing==='down'){eyes([[10,10],[18,10]]);line(14,17,17,17,'R');rect(14,19,3,2,'4');}
  else if(facing==='left'){eyes([[6,10]]);line(3,15,7,15,'1');line(22,20,22,26,'4');}
  else{line(12,20,18,20,'4');line(13,21,13,26,'O');dot(17,24,'w');}
  for(const x of [11,19]){on(x,22,'3','bB');on(x,27,'5','k');}
 }else if(['goblin','archer','fighter','mage'].includes(kind)){
  if(facing==='down'){eyes([[10,10],[18,10]]);line(12,16,19,16,'w');dot(15,17,'G');dot(18,17,'G');}
  else if(facing==='left'){eyes([[6,10]]);dot(4,15,'2');}
  for(const [x,y] of [[4,10],[27,10],[12,9],[18,9]])on(x,y,'2','gG');
  for(const x of [11,19])line(x,22,x,24,kind==='mage'?'b':'j');
  if(kind==='fighter'){
   line(9,3,22,3,'h');line(15,1,15,6,'w');
   const x=facing==='left'?0:28;line(x,10,x,21,'w');line(x+1,12,x+1,20,'5');dot(Math.max(0,x-1),22,'4');
  }else if(kind==='archer'){
   line(10,2,20,2,'4');line(8,5,23,5,'j');
   const x=facing==='left'?0:facing==='up'?2:22;
   rect(x,10,2,20,'.');line(x+1,10,x+1,29,'w');
   line(x+3,11,x+7,16,'4');line(x+7,16,x+7,22,'4');line(x+7,22,x+3,28,'4');
   line(x,19,x+7,19,'o');dot(x+7,18,'h');dot(x+7,20,'h');
  }else if(kind==='mage'){
   line(11,3,20,3,'3');line(11,22,11,25,'b');line(20,21,20,25,'0');
   dot(25,14,'w');dot(26,15,'1');line(27,19,27,27,'4');
  }
 }else if(kind==='slime'||kind==='stoneSlime'){
  const stone=kind==='stoneSlime';
  if(facing==='down')eyes([[10,20],[20,20]]);
  else if(facing==='left')eyes([[6,20],[12,20]]);
  line(9,14,12,14,stone?'h':'7');dot(8,16,stone?'5':'7');
  if(stone){line(20,15,19,18,'O');line(19,18,21,20,'O');line(8,24,12,25,'O');dot(23,23,'4');}
  else for(const [x,y] of [[7,19],[24,23],[21,16]])on(x,y,'2','gG');
 }else if(kind==='wolf'){
  if(facing==='down'){eyes([[10,14],[20,14]]);line(13,20,18,20,'k');dot(14,19,'9');}
  else if(facing==='left'){eyes([[4,12]]);line(0,15,2,15,'0');line(13,10,21,10,'3');}
  for(const [x,y] of [[9,10],[11,16],[20,19],[14,8],[6,24],[21,24]]){on(x,y,'3','bB');on(x+1,y+1,'9','wb');}
 }else if(kind==='frostBoar'){
  for(const [x,y] of [[12,10],[20,12],[16,18],[24,16]]){rect(x,y,3,3,'b');line(x,y,x+2,y,'9');dot(x,y+1,'w');dot(x+2,y+2,'B');}
  if(facing==='down'){eyes([[10,16],[20,16]],'R');line(13,23,18,23,'0');line(6,20,7,25,'w');line(23,20,22,25,'w');}
  else if(facing==='left'){eyes([[4,16]],'R');line(0,21,1,26,'w');line(9,22,9,26,'w');}
  for(const [x,y] of [[15,12],[9,18],[22,22]])on(x,y,'5','acC');
 }else if(kind==='reaper'){
  if(facing!=='up'){rect(10,10,3,2,'R');dot(10,10,'1');rect(18,10,3,2,'R');dot(18,10,'1');}
  for(const [x,y] of [[8,18],[10,22],[19,21]]){on(x,y,'5','ak');on(x+1,y+2,'0','ak');}
  // 高い位置から大きく湾曲する銀の刃。左向きは武器全体を左右反転。
  const weaponDot=(x:number,y:number,c:string)=>dot(facing==='left'?31-x:x,y,c);
  const blade=[
   '.....................00000000...',
   '................00000hhhhhhh00..',
   '............0000hhhhwwwwwwwhh0..',
   '.........000hhhwwwwhhhh55555500.',
   '.......00hhwwwwhh55555000000000.',
   '.....00hwwwwh550000000.......0..',
   '....0hwwwh55000.............0...',
   '...0hwwh500.................0...',
   '..0hww500...................0...',
   '..0ww50.....................0...',
   '.0ww50......................0...',
   '.0w50.......................0...',
   '.050........................0...',
   '.00.........................0...',
  ];
  // 暗い輪郭・明るい刃先・青灰色の刃腹で、背景とローブ双方から分離。
  for(let y=0;y<blade.length;y++)for(let x=0;x<32;x++)if(blade[y][x]!=='.')weaponDot(x,y,blade[y][x]);
  for(let y=5;y<=30;y++){weaponDot(27,y,'0');weaponDot(28,y,'O');weaponDot(29,y,'4');weaponDot(30,y,'0');}
  for(const y of [7,8,22,24,26]){weaponDot(28,y,'h');weaponDot(29,y,'5');}
  for(let x=24;x<=29;x++){weaponDot(x,17,'h');weaponDot(x,18,'5');}weaponDot(25,16,'w');
 }else if(kind==='treant'){
  for(const [x,y] of [[13,11],[18,14],[13,20],[19,24],[6,9],[25,3],[8,29]]){
   for(let i=0;i<4;i++)on(x,y+i,i===0?'4':'j','Oo');on(x+1,y+3,'0','Oo');
  }
  if(facing!=='up'){const x=facing==='left'?10:12;line(x,14,x+2,14,'1');line(facing==='left'?16:20,14,facing==='left'?18:22,14,'1');}
 }else if(kind==='thunderButterfly'){
  // 模様は羽だけ。黄色い目は原画の頭部分を保つ。
  for(let y=2;y<27;y++)for(let x=0;x<32;x++)if(at(x,y)==='v'&&at(x,y-1)==='V')dot(x,y,'6');
  if(facing==='left'){for(const [x,y] of [[16,13],[20,16],[22,24]]){on(x,y,'6','vV');on(x+1,y,'6','vV');}}
  else for(const [x,y] of [[5,10],[7,14],[6,20],[9,24]]){on(x,y,'6','vV');on(31-x,y,'6','vV');}
 }else if(kind==='sprite'||kind==='greaterSprite'){
  line(11,8,14,8,'w');dot(9,10,'7');
  if(facing!=='up'){const x=facing==='left'?8:10,other=facing==='left'?14:20;rect(x,14,2,4,'k');dot(x,14,'w');rect(other,14,2,4,'k');dot(other,14,'w');}
  for(const x of [8,12,18,22]){on(x,23,'7','pg');on(x+1,25,'2','pg');}
  if(kind==='greaterSprite')for(const x of [8,20]){dot(x-1,4,'7');dot(x+2,4,'7');dot(x,3,'w');dot(x,4,'y');}
 }
 return pixels.map(row=>row.join(''));
}
