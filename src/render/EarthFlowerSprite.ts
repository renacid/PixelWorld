/** 地晶花。16×20の大きな色面で描き、32×40へ展開して他キャラの粗さに合わせる。 */
export function earthFlowerSprite(facing:'down'|'up'|'left'):string[]{
 const pixels=Array.from({length:20},()=>Array<string>(16).fill('.'));
 const dot=(x:number,y:number,c:string)=>{if(x>=0&&x<16&&y>=0&&y<20)pixels[y][x]=c;};
 const line=(points:number[][],color:string)=>{
  for(let i=1;i<points.length;i++){
   const [x,y]=points[i-1],[ex,ey]=points[i],n=Math.max(Math.abs(ex-x),Math.abs(ey-y));
   for(let j=0;j<=n;j++)dot(Math.round(x+(ex-x)*j/(n||1)),Math.round(y+(ey-y)*j/(n||1)),color);
  }
 };
 const oval=(cx:number,cy:number,rx:number,ry:number,color:string)=>{
  for(let y=0;y<20;y++)for(let x=0;x<16;x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1)dot(x,y,color);
 };
 // ツルは3本に絞り、葉と茎に使う緑も少なくする。
 line([[7,11],[7,14],[4,16],[2,16],[1,15]],'l');
 line([[8,11],[9,14],[12,16],[14,16],[14,15]],'l');
 line([[8,13],[7,16],[8,18],[10,18]],'G');
 oval(4,14,3,1.5,'l');oval(11,13.5,3,1.5,'l');
 line([[2,13],[4,14],[6,14]],'G');line([[10,14],[12,13],[13,13]],'G');
 // 丸い花びらの形は保ち、細い葉脈の代わりに広い明暗で立体感を出す。
 const petal=(cx:number,cy:number,rx:number,ry:number)=>{
  oval(cx,cy,rx,ry,'k');oval(cx,cy-.5,rx-.7,ry-.6,'b');
  oval(cx,cy-1.3,Math.max(1,rx-1.5),Math.max(.7,ry-1.6),'3');
 };
 petal(7.5,3,3.5,3);
 petal(3,7,3,3);petal(12,7,3,3);
 petal(5,10,3,3);petal(10,10,3,3);
 oval(7.5,7.5,3.5,3.5,'k');
 if(facing==='down'){
  for(const x of [6,9]){dot(x,7,'r');dot(x,8,'R');}
 }else if(facing==='left'){
  dot(5,7,'r');dot(5,8,'R');dot(8,7,'R');
  line([[10,5],[11,7],[10,9]],'B');
 }else{
  oval(7.5,8,2.5,2.5,'l');line([[7,6],[7,9],[8,10]],'G');
 }
 return pixels.flatMap(row=>{const expanded=row.map(c=>c+c).join('');return [expanded,expanded];});
}
