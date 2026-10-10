import type { Crystal } from '../game/types';
import { CRYSTAL_FLIGHT_MS, CRYSTAL_BURST_MS } from '../game/CrystalTiming';
/** 約16px径（1マス面積の約1/4）。氷玉は放電、雷玉は冷気をまとう。 */
export function drawCrystal(ctx:CanvasRenderingContext2D,c:Pick<Crystal,'attribute'>,x:number,y:number,clock:number,index=0):void{
 const cx=Math.round(x+16+(index%3-1)*3),cy=Math.round(y+19-Math.floor(index/3)*2),ice=c.attribute==='ice';
 ctx.save();ctx.fillStyle='#24394b35';ctx.beginPath();ctx.ellipse(cx,cy+7,8,3,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=ice?'#429cc6':'#8850d1';ctx.fillRect(cx-5,cy-7,10,14);ctx.fillRect(cx-7,cy-5,14,10);
 ctx.fillStyle=ice?'#a7e5ff':'#cda0ff';ctx.fillRect(cx-5,cy-5,10,10);ctx.fillStyle=ice?'#effcff':'#fff3b3';ctx.fillRect(cx-4,cy-4,4,4);
 const phase=Math.floor(clock/160+index)%4;
 if(ice){ctx.strokeStyle='#e6b6ff';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(cx+6,cy-8+phase);ctx.lineTo(cx+3,cy-3+phase);ctx.lineTo(cx+8,cy-3+phase);ctx.lineTo(cx+5,cy+3+phase);ctx.stroke();}
 else{ctx.strokeStyle='#bbf1ff';ctx.lineWidth=1;for(let n=0;n<3;n++){const a=clock/700+n*Math.PI*2/3;const px=Math.round(cx+Math.cos(a)*9),py=Math.round(cy+Math.sin(a)*6);ctx.beginPath();ctx.moveTo(px-2,py);ctx.lineTo(px+2,py);ctx.moveTo(px,py-2);ctx.lineTo(px,py+2);ctx.stroke();}}
 ctx.restore();
}

/** 結晶本体と残像が直線で飛び、着弾してから破片へ変化する。ageは演出全体の0〜1。 */
export function drawCrystalFlight(ctx:CanvasRenderingContext2D,attribute:Crystal['attribute'],from:{x:number;y:number},to:{x:number;y:number},age:number):void{
 const elapsed=age*(CRYSTAL_FLIGHT_MS+CRYSTAL_BURST_MS),ice=attribute==='ice',color=ice?'#a7e5ff':'#cda0ff';
 if(elapsed<CRYSTAL_FLIGHT_MS){
  const t=elapsed/CRYSTAL_FLIGHT_MS;
  for(let n=3;n>0;n--){const p=Math.max(0,t-n*.07);ctx.globalAlpha=(4-n)*.12;ctx.fillStyle=color;ctx.fillRect(Math.round(from.x+(to.x-from.x)*p+14),Math.round(from.y+(to.y-from.y)*p+17),4,4);}
  ctx.globalAlpha=1;
  drawCrystal(ctx,{attribute},Math.round(from.x+(to.x-from.x)*t),Math.round(from.y+(to.y-from.y)*t),elapsed,1);
 }else{
  const t=Math.min(1,(elapsed-CRYSTAL_FLIGHT_MS)/CRYSTAL_BURST_MS),cx=to.x+16,cy=to.y+19;
  ctx.globalAlpha=1-t;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(cx,cy,4+t*13,3+t*9,0,0,Math.PI*2);ctx.stroke();
  for(let n=0;n<8;n++){const a=n*Math.PI/4,r=3+t*18;ctx.fillStyle=n%2?color:ice?'#effcff':'#fff3b3';ctx.fillRect(Math.round(cx+Math.cos(a)*r-1),Math.round(cy+Math.sin(a)*r-1),n%2?2:3,3);}
 }
 ctx.globalAlpha=1;
}
