import type { Crystal } from '../game/types';
/** 約16px径（1マス面積の約1/4）。氷玉は放電、雷玉は冷気をまとう。 */
export function drawCrystal(ctx:CanvasRenderingContext2D,c:Crystal,x:number,y:number,clock:number,index=0):void{
 const cx=Math.round(x+16+(index%3-1)*3),cy=Math.round(y+19-Math.floor(index/3)*2),ice=c.attribute==='ice';
 ctx.save();ctx.fillStyle='#24394b35';ctx.beginPath();ctx.ellipse(cx,cy+7,8,3,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=ice?'#429cc6':'#8850d1';ctx.fillRect(cx-5,cy-7,10,14);ctx.fillRect(cx-7,cy-5,14,10);
 ctx.fillStyle=ice?'#a7e5ff':'#cda0ff';ctx.fillRect(cx-5,cy-5,10,10);ctx.fillStyle=ice?'#effcff':'#fff3b3';ctx.fillRect(cx-4,cy-4,4,4);
 const phase=Math.floor(clock/160+index)%4;
 if(ice){ctx.strokeStyle='#e6b6ff';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(cx+6,cy-8+phase);ctx.lineTo(cx+3,cy-3+phase);ctx.lineTo(cx+8,cy-3+phase);ctx.lineTo(cx+5,cy+3+phase);ctx.stroke();}
 else{ctx.strokeStyle='#bbf1ff';ctx.lineWidth=1;for(let n=0;n<3;n++){const a=clock/700+n*Math.PI*2/3;const px=Math.round(cx+Math.cos(a)*9),py=Math.round(cy+Math.sin(a)*6);ctx.beginPath();ctx.moveTo(px-2,py);ctx.lineTo(px+2,py);ctx.moveTo(px,py-2);ctx.lineTo(px,py+2);ctx.stroke();}}
 ctx.restore();
}
