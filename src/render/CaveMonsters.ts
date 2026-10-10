import type { Direction } from '../game/types';

/** 洞窟の岩・古木・触手の原画。描画幅だけ広げても占有マスは変わりません。 */
export function caveMonsterSprite(kind:'bombStone'|'elderTreant'|'treantTentacle',facing:Direction):string[]{
 // ボムストーンは16ドット原画を2倍にし、他の1マスキャラと粒の大きさを合わせる。
 const width=kind==='elderTreant'?40:kind==='bombStone'?16:32,height=kind==='elderTreant'?44:kind==='bombStone'?16:32;
 const pixels=Array.from({length:height},()=>Array<string>(width).fill('.'));
 const dot=(x:number,y:number,c:string)=>{if(pixels[y]?.[x]!==undefined)pixels[y][x]=c;};
 const rect=(x:number,y:number,w:number,h:number,c:string)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)dot(x+i,y+j,c);};
 const oval=(x:number,y:number,rx:number,ry:number,c:string)=>{for(let j=Math.floor(y-ry);j<=y+ry;j++)for(let i=Math.floor(x-rx);i<=x+rx;i++)if(((i-x)/rx)**2+((j-y)/ry)**2<=1)dot(i,j,c);};
 const line=(x:number,y:number,ex:number,ey:number,c:string,w=1)=>{const n=Math.max(Math.abs(ex-x),Math.abs(ey-y));for(let i=0;i<=n;i++)rect(Math.round(x+(ex-x)*i/(n||1)),Math.round(y+(ey-y)*i/(n||1)),w,w,c);};
 if(kind==='bombStone'){
  oval(8,9,7,6,'d');oval(7,8,6,5,'a');oval(6,7,4,4,'c');rect(4,4,4,2,'C');
  line(10,3,9,6,'R',2);line(9,6,11,9,'R',2);line(11,9,10,13,'R',2);
  line(10,3,9,6,'r');line(9,6,11,9,'y');line(11,9,10,13,'r');
  line(2,9,5,11,'R',2);line(5,11,4,13,'r');line(5,11,8,12,'y');
  line(13,6,12,8,'r');rect(10,14,3,1,'r');rect(4,14,2,1,'y');
  if(facing!=='up'){
   const x=facing==='left'?2:4;rect(x,7,3,3,'d');rect(x,7,2,2,'w');rect(x+1,8,1,2,'R');
   if(facing==='down'){rect(10,7,3,3,'d');rect(11,7,2,2,'w');rect(11,8,1,2,'R');}
  }
 }else if(kind==='treantTentacle'){
  oval(16,29,12,2,'f');
  const nodes=[[5,28],[10,24],[17,23],[20,18],[18,13],[12,12],[9,8],[13,5],[18,6]];
  for(let n=1;n<nodes.length;n++){const a=nodes[n-1],b=nodes[n];line(a[0],a[1],b[0],b[1],'f',5);line(a[0]+1,a[1],b[0]+1,b[1],'G',3);line(a[0]+2,a[1],b[0]+2,b[1],'g');}
  line(18,25,27,28,'O',2);line(11,27,4,30,'O',2);line(20,17,25,14,'m',2);line(11,13,6,15,'g',2);
 }else{
  // 四本の幹から根を広げる。樹冠は丸い塊ではなく、分岐する枝と尖った葉の集まり。
  const branch=(x:number,y:number,ex:number,ey:number,w:number)=>{line(x,y,ex,ey,'d',w+1);line(x,y,ex,ey,'O',w);line(x,y,ex,ey,'j');};
  for(const [x,y,ex,ey,w] of [[14,24,10,38,4],[18,23,17,39,4],[22,24,25,39,4],[26,23,31,37,3],[10,37,2,42,2],[10,37,8,43,2],[17,37,14,43,2],[17,38,21,42,2],[25,37,29,43,2],[30,36,38,41,2]])branch(x,y,ex,ey,w);
  for(const [x,y,ex,ey,w] of [[16,27,13,16,5],[23,28,25,16,5],[14,20,7,12,3],[7,12,3,6,2],[7,12,1,15,1],[14,20,12,7,2],[12,7,8,2,1],[12,7,17,3,1],[18,19,20,8,3],[20,8,18,1,1],[20,8,25,3,1],[25,19,31,10,3],[31,10,36,4,2],[31,10,38,13,1],[25,19,28,6,2],[28,6,31,1,1],[15,25,6,22,2],[6,22,1,19,1],[25,25,33,22,2],[33,22,38,19,1]])branch(x,y,ex,ey,w);
  const leaves=(x:number,y:number)=>{rect(x-3,y,7,2,'f');rect(x-2,y-2,5,3,'G');rect(x-1,y-3,2,2,'m');dot(x+3,y-1,'G');dot(x-3,y+2,'G');dot(x+1,y-2,'g');};
  for(const [x,y] of [[4,7],[9,3],[15,5],[19,2],[24,5],[29,3],[35,6],[33,11],[37,14],[28,12],[22,11],[15,11],[9,14],[3,15],[5,21],[11,20],[28,20],[34,23]])leaves(x,y);
  for(const [x,y] of [[6,13],[24,7],[32,18]]){rect(x-2,y-1,5,3,'B');rect(x-1,y-2,3,5,'b');rect(x-2,y,5,1,'3');dot(x,y,'9');}
  // 縦の樹皮と裂け目で、複数の幹を束ねた古木の顔にする。
  line(16,28,14,36,'d');line(22,28,24,36,'d');line(18,30,18,36,'j');line(29,28,30,34,'j');
  if(facing!=='up'){const x=facing==='left'?12:15;rect(x,25,4,3,'d');rect(x,25,2,2,'r');if(facing==='down'){rect(24,25,4,3,'d');rect(25,25,2,2,'r');}line(17,31,23,30,'d');}
 }
 const rows=kind==='bombStone'?pixels.flatMap(row=>{const enlarged=row.flatMap(c=>[c,c]).join('');return [enlarged,enlarged];}):pixels.map(row=>row.join(''));
 return facing==='right'?rows.map(row=>[...row].reverse().join('')):rows;
}
