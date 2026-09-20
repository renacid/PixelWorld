import type { InstallationKind } from '../data/installations';
/** 16×16の座標を2倍表示。絵柄の変更はこの描画関数だけで行えます。 */
export function drawInstallation(ctx:CanvasRenderingContext2D,kind:InstallationKind,x:number,y:number):void{
 ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(2,2);
 const box=(color:string,x:number,y:number,w:number,h:number)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
 box('#344b4944',2,13,12,2);
 if(kind==='icePillar'){
  box('#4b9cbd',5,4,7,10);box('#88d6ef',5,3,6,10);box('#c3efff',6,2,3,11);box('#effcff',7,1,1,10);box('#63b6d7',10,5,2,8);box('#a5e5f8',3,13,11,2);box('#e4faff',5,13,4,1);
 }else if(kind==='pot'){
  box('#714a38',4,5,8,8);box('#714a38',3,7,10,5);box('#bb7950',4,6,8,6);box('#daa06a',4,7,3,4);box('#f2c58a',5,7,1,3);box('#714a38',5,3,6,3);box('#e3ad74',4,3,8,1);box('#4d3836',6,4,4,1);box('#8e573d',5,12,6,2);
 }else{
  box('#68503d',2,7,12,7);box('#9b7b53',3,5,10,3);box('#796341',5,3,6,3);box('#222d2b',4,8,8,6);box('#101f25',5,7,6,7);box('#748750',2,6,3,2);box('#8ba363',10,4,3,2);box('#bea477',2,12,2,2);box('#ad946c',12,11,2,3);box('#b6a17b',12,3,1,7);box('#a75c42',13,3,2,3);
 }
 ctx.restore();
}
