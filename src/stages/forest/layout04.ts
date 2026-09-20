/** 下側の入口から北へ。狭い蛇行路・広場・環状路を組み合わせる。座標と幅はここで編集。 */
import type {Point,StageLayout} from '../../game/types';
export const FOREST04_SIZE={width:57,height:79};
export function forest04(floor:number):StageLayout{
 const {width:w,height:h}=FOREST04_SIZE,mid=28;
 const grid:string[][]=Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>x>1&&x<w-2&&y>1&&y<h-2?'#':' '));
 const carve=(p:Point,r=0)=>{for(let y=p.y-r;y<=p.y+r;y++)for(let x=p.x-r;x<=p.x+r;x++)if(y>0&&y<h-1&&x>0&&x<w-1)grid[y][x]='.';};
 const line=(a:Point,b:Point,r=0)=>{let p={...a};carve(p,r);while(p.x!==b.x){p.x+=Math.sign(b.x-p.x);carve(p,r);}while(p.y!==b.y){p.y+=Math.sign(b.y-p.y);carve(p,r);}};
 // 入口・出口だけ突き出した小道。階層ごとに東西を反転し広場位置も変える。
 for(let y=1;y<h-1;y++)if(y<7||y>h-8)for(let x=1;x<w-1;x++)grid[y][x]=' ';
 const shift=(floor-1)*2;
 const path:Point[]=[{x:mid,y:76},{x:mid,y:69},{x:10+shift,y:65},{x:10+shift,y:55},{x:44-shift,y:51},{x:44-shift,y:40},{x:12+shift,y:35},{x:12+shift,y:25},{x:43-shift,y:20},{x:43-shift,y:12},{x:mid,y:9},{x:mid,y:2}];
 for(let i=1;i<path.length;i++)line(path[i-1],path[i],i%3===0?0:1);
 const plazas=[{x:10+shift,y:61},{x:44-shift,y:44},{x:12+shift,y:29},{x:43-shift,y:15}];plazas.forEach((p,i)=>carve(p,i%2?4:3));
 // 広場と主道を結ぶ輪。一本道を迂回できる場所も残す。
 for(const [a,b] of [[plazas[0],plazas[1]],[plazas[2],plazas[3]]]){const corner={x:27,y:a.y-8};line(a,corner,0);line(corner,b,0);}
 const ends=[{x:6,y:47},{x:50,y:32},{x:7,y:15}];line({x:12+shift,y:55},ends[0]);line(plazas[1],ends[1]);line(plazas[2],ends[2]);
 const mirror=floor===2,flip=(p:Point)=>({x:mirror?w-1-p.x:p.x,y:p.y});
 return {rows:grid.map(r=>(mirror?[...r].reverse():r).join('')),legend:{' ':6,'#':4,'.':3},spawn:flip({x:mid,y:76}),
 objects:[...(floor===1?[{id:'forest4-start',type:'chest' as const,chestTier:'gold' as const,position:flip({x:mid,y:75}),skillIds:['attack' as const,'warp' as const]}]:[]),...ends.map((p,i)=>({id:'forest4-cache-'+i,type:'chest' as const,chestTier:i===2?'gold' as const:'silver' as const,position:flip(p)})),{id:'forest4-exit',type:'exit',position:flip({x:mid,y:2})}],
 enemies:[],randomEnemies:floor===3?[{kind:'goblin',count:9},{kind:'goblinArcher',count:5},{kind:'goblinFighter',count:5},{kind:'goblinMage',count:5},{kind:'wolf',count:4},{kind:'treant',count:2}]:[{kind:'goblin',count:13},{kind:'goblinArcher',count:7},{kind:'wolf',count:3},{kind:'treant',count:2}],randomChests:7,gemCount:1,trapPlacements:[{count:20+floor*2}]};
}
