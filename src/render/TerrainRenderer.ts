import { terrain } from '../data/terrain';

type TileMap = { width:number; height:number; tiles:number[] };
const SIZE=32, CACHE_LIMIT=768;
// 上・右・下・左、続いて左上・右上・右下・左下。範囲外は床として扱わない。
const NEIGHBORS=[[0,-1],[1,0],[0,1],[-1,0],[-1,-1],[1,-1],[1,1],[-1,1]];
const cache=new Map<string,HTMLCanvasElement>(), images=new Map<string,HTMLImageElement>();
const isFloor=(id:number)=>id>=0&&!terrain(id).solid;

/** ゲーム乱数を使わない固定模様。地形変更時は周辺IDが変わるためキャッシュも自動更新。 */
function variantAt(x:number,y:number):number { return (Math.imul(x+71,198491317)^Math.imul(y+13,6542989))>>>0; }
function drawArt(ctx:CanvasRenderingContext2D,id:number,variant:number):void {
 const d=terrain(id);
 const height=SIZE+(d.overhang??0);
 if(d.pixels){const h=d.pixels.length,w=d.pixels[0].length;d.pixels.forEach((row,y)=>[...row].forEach((c,x)=>{const color=d.palette?.[c];if(color){ctx.fillStyle=color;ctx.fillRect(x*SIZE/w,y*height/h,SIZE/w,height/h);}}));}
 else if(!d.solid){
  const x=6+variant%4*4,y=7+variant%3*5;ctx.fillStyle='#7abc6a';ctx.fillRect(x,y,2,4);ctx.fillRect(x-2,y+1,2,2);ctx.fillRect(x+2,y-1,2,4);
  if(id===2||variant===0){ctx.fillStyle='#fff3b7';ctx.fillRect(22,12,2,6);ctx.fillRect(20,14,6,2);ctx.fillStyle='#efb64c';ctx.fillRect(22,14,2,2);}
 }
 if(d.image){
  let image=images.get(d.image);
  if(!image){image=new Image();image.onload=()=>cache.clear();image.src=`${import.meta.env.BASE_URL}${d.image}`;images.set(d.image,image);}
  if(image.complete&&image.naturalWidth)ctx.drawImage(image,0,0,SIZE,height);
 }
}
function drawBase(ctx:CanvasRenderingContext2D,id:number,variant:number):void {
 ctx.fillStyle=id===0?['#a2db83','#a8df87','#a4dc84','#9ed980'][variant%4]:terrain(id).color;ctx.fillRect(0,0,SIZE,SIZE);drawArt(ctx,id,variant);
}
/** 四方の床を優先し、角だけ床がある場合も木の下地を自然につなぐ。 */
function groundFor(neighbors:number[],fallback:number):number {
 const scores=new Map<number,number>();neighbors.forEach((id,i)=>{if(isFloor(id))scores.set(id,(scores.get(id)??0)+(i<4?3:1));});
 return [...scores].sort((a,b)=>b[1]-a[1])[0]?.[0]??fallback;
}
function paintBorder(ctx:CanvasRenderingContext2D,neighbors:number[],variant:number,shore:boolean):void {
 neighbors.forEach((id,side)=>{
  if(!isFloor(id))return;
  ctx.save();ctx.beginPath();
  if(side<4){
   // 壁マスの内側だけに2〜4pxの不規則な縁を作る。床の通行範囲は変えない。
   for(let n=0;n<16;n++){const depth=(shore?(Math.floor(n/4)+side+variant)%3===0:(n*7+variant+side*3)%5===0)?4:2;
    if(side===0)ctx.rect(n*2,0,2,depth);
    if(side===1)ctx.rect(SIZE-depth,n*2,depth,2);
    if(side===2)ctx.rect(n*2,SIZE-depth,2,depth);
    if(side===3)ctx.rect(0,n*2,depth,2);
   }
  }else{const right=side===5||side===6,bottom=side>=6;ctx.rect(right?28:0,bottom?28:0,4,4);}
  ctx.clip();drawBase(ctx,id,variant);ctx.restore();
  // 水際に点線状の反射光は付けず、床と水の面だけで境界を表現する。
 });
}

/** 32pxの完成タイルを共有。毎フレームは隣接ID参照とdrawImageのみ。上限付きでメモリを抑える。 */
export function drawTerrain(ctx:CanvasRenderingContext2D,id:number,x:number,y:number,size:number,map?:TileMap,tx=0,ty=0):void {
 const d=terrain(id),variant=variantAt(tx,ty)%12,overhang=d.overhang??0;
 const neighbors=d.boundary&&d.boundary!=='wall'?NEIGHBORS.map(([dx,dy])=>map?(tx+dx<0||ty+dy<0||tx+dx>=map.width||ty+dy>=map.height?-1:map.tiles[(ty+dy)*map.width+tx+dx]):d.groundTile??0):[];
 const key=`${id}:${variant}:${neighbors.join(',')}`;
 let tile=cache.get(key);
 if(!tile){
  tile=document.createElement('canvas');tile.width=SIZE;tile.height=SIZE+overhang;const c=tile.getContext('2d')!;c.imageSmoothingEnabled=false;c.translate(0,overhang);
  if(d.boundary==='tree'){
   drawBase(c,groundFor(neighbors,d.groundTile??0),variant);paintBorder(c,neighbors,variant,false);c.translate(0,-overhang);drawArt(c,id,variant);
  }else{
   drawBase(c,id,variant);if(d.boundary==='shore')paintBorder(c,neighbors,variant,true);
  }
  if(cache.size>=CACHE_LIMIT)cache.delete(cache.keys().next().value!);cache.set(key,tile);
 }
 ctx.imageSmoothingEnabled=false;ctx.drawImage(tile,x,y-overhang*size/SIZE,size,size+overhang*size/SIZE);
}
