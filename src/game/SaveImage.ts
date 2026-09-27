/** セーブ文字列をPNGのRGB画素へ保存する。メタデータが削除されても画素が同じなら復元可能。 */
const WIDTH=640, HEADER=160, LIMIT=12_000_000;
const MAGIC=new TextEncoder().encode('PWSIMG01');

export async function createSaveImage(text:string,label:string):Promise<Blob>{
 const data=new TextEncoder().encode(text);
 if(data.length>LIMIT)throw new Error('セーブデータが大きすぎます。文字列で保存してください。');
 const bytes=new Uint8Array(12+data.length);bytes.set(MAGIC);
 new DataView(bytes.buffer).setUint32(8,data.length);bytes.set(data,12);
 const rows=Math.ceil(bytes.length/(WIDTH*3)),canvas=document.createElement('canvas');
 canvas.width=WIDTH;canvas.height=HEADER+rows;
 const ctx=canvas.getContext('2d')!;ctx.fillStyle='#203c35';ctx.fillRect(0,0,WIDTH,HEADER);
 ctx.fillStyle='#d6f0a4';ctx.font='bold 26px sans-serif';ctx.fillText('PIXEL WORLD / セーブ画像',24,44);
 ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.fillText(label,24,80,592);
 ctx.font='14px sans-serif';ctx.fillText('ゲームの「セーブデータを使用」→「画像から再開」',24,112);
 ctx.fillText('元のPNGを保存してください。切り抜き・圧縮・スクリーンショット不可',24,140);
 const pixels=ctx.createImageData(WIDTH,rows);
 for(let i=0,j=0;i<pixels.data.length;i+=4){pixels.data[i]=bytes[j++]??0;pixels.data[i+1]=bytes[j++]??0;pixels.data[i+2]=bytes[j++]??0;pixels.data[i+3]=255;}
 ctx.putImageData(pixels,0,HEADER);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('画像を作成できませんでした。')),'image/png'));
}

export async function readSaveImage(file:File):Promise<string>{
 if(file.size>24_000_000)throw new Error('画像が大きすぎます。元のセーブPNGを選択してください。');
 // デコード前にPNGの寸法を検査し、巨大な画像の展開を防ぐ。
 const head=new Uint8Array(await file.slice(0,24).arrayBuffer());
 if(head.length<24||![137,80,78,71,13,10,26,10].every((v,i)=>head[i]===v))throw new Error('元のセーブPNGを選択してください。');
 const view=new DataView(head.buffer),width=view.getUint32(16),height=view.getUint32(20);
 if(width!==WIDTH||height<=HEADER||height>HEADER+Math.ceil((LIMIT+12)/(WIDTH*3)))throw new Error('セーブ画像のサイズが異なります。加工前のPNGを選択してください。');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();img.src=url;await img.decode();
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height-HEADER;
  const ctx=canvas.getContext('2d')!;ctx.drawImage(img,0,-HEADER);
  const pixels=ctx.getImageData(0,0,width,height-HEADER).data;
  const bytes=new Uint8Array(pixels.length/4*3);
  for(let i=0,j=0;i<pixels.length;i+=4){bytes[j++]=pixels[i];bytes[j++]=pixels[i+1];bytes[j++]=pixels[i+2];}
  if(!MAGIC.every((v,i)=>bytes[i]===v))throw new Error('セーブ画像ではないか、画像が加工されています。');
  const length=new DataView(bytes.buffer).getUint32(8);
  if(length>LIMIT||length>bytes.length-12)throw new Error('セーブ画像が破損しています。');
  // チェック値・アプリ版・ゲーム状態の検査は既存のimportSaveに任せる。
  return new TextDecoder().decode(bytes.subarray(12,12+length));
 }finally{URL.revokeObjectURL(url);}
}
