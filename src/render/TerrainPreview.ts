import { terrain } from '../data/terrain';
/** 開発エディタの縮小タイル。ドット定義はゲームと共有する。 */
export function drawTerrainPreview(ctx:CanvasRenderingContext2D,id:number,x:number,y:number,size:number):void {
 const d=terrain(id);ctx.fillStyle=d.color;ctx.fillRect(x,y,size,size);ctx.imageSmoothingEnabled=false;
 if(d.pixels){const h=d.pixels.length,w=d.pixels[0].length;d.pixels.forEach((row,py)=>[...row].forEach((c,px)=>{const color=d.palette?.[c];if(color){ctx.fillStyle=color;ctx.fillRect(x+px*size/w,y+py*size/h,size/w,size/h);}}));}
 else if(d.solid){ctx.fillStyle='#e2eccb';ctx.fillRect(x+size*.08,y+size*.1,size*.84,size*.65);ctx.fillStyle='#7ca988';ctx.fillRect(x+size*.08,y+size*.75,size*.84,size*.18);ctx.fillStyle='#9ebc98';ctx.fillRect(x+size*.46,y+size*.26,size*.06,size*.35);}
 else{ctx.fillStyle='#7abc6a';ctx.fillRect(x+size*.3,y+size*.3,size*.08,size*.25);ctx.fillRect(x+size*.22,y+size*.4,size*.25,size*.07);if(id===2){ctx.fillStyle='#fff3b7';ctx.fillRect(x+size*.65,y+size*.6,size*.13,size*.2);}}
}
