/** 森3：蛇行する幹道、環状路、宝箱の枝道。各階で経路を変える。 */
import type { Point, StageLayout } from '../../game/types';
export function forest03(floor = 1): StageLayout {
  const w=41,h=65, mid=20;
  const grid=Array.from({length:h},()=>Array<string>(w).fill(' '));
  for(let y=1;y<h-1;y++) { const margin=y<5||y>h-6?18:2+Math.floor((Math.sin(y*.4)+1)*1.5); for(let x=margin;x<w-margin;x++) grid[y][x]='#'; }
  const carve=(p:Point,r=1)=>{for(let y=p.y-r;y<=p.y+r;y++)for(let x=p.x-r;x<=p.x+r;x++)if(grid[y]?.[x]==='#')grid[y][x]='.';};
  const line=(a:Point,b:Point,r=1)=>{let {x,y}=a;carve({x,y},r);while(x!==b.x||y!==b.y){if(r===0){if(x!==b.x)x+=Math.sign(b.x-x);else y+=Math.sign(b.y-y);}else{x+=Math.sign(b.x-x);y+=Math.sign(b.y-y);}carve({x,y},r);}};
  const left= floor===2?12:8, right=floor===3?28:32;
  const path:Point[]=[{x:mid,y:2},{x:mid,y:7},{x:left,y:12},{x:left+4,y:20},{x:right,y:25},{x:right-4,y:34},{x:left,y:40},{x:left+3,y:48},{x:right,y:53},{x:mid,y:58},{x:mid,y:62}];
  for(let i=1;i<path.length;i++)line(path[i-1],path[i]);
  // 2つの輪は幹道へ接続。左右に迂回して接敵を避けることも可能。
  for(const y of [17,40]) { const loop=[{x:14,y},{x:26,y},{x:29,y:y+7},{x:13,y:y+7},{x:14,y}];for(let i=1;i<loop.length;i++)line(loop[i-1],loop[i]);line({x:left+2,y:y+2},loop[0]); }
  const ends=[{x:6,y:29},{x:35,y:37},{x:6,y:54}];
  line({x:20,y:25},ends[0],0);line({x:right-4,y:34},ends[1],0);line({x:left+3,y:48},ends[2],0);
  const magePositions=[{x:26,y:17},{x:14,y:40}];magePositions.forEach(p=>carve(p));
  return {rows:grid.map(r=>r.join('')),legend:{' ':6,'#':4,'.':3},spawn:{x:mid,y:2},
    objects:[...(floor===1?[{id:'forest3-start',type:'chest' as const,chestTier:'gold' as const,position:{x:mid,y:3},skillIds:['attack' as const,'warp' as const]}]:[]),...ends.map((position,i)=>({id:'forest3-deadend-'+i,type:'chest' as const,chestTier:i===2?'gold' as const:'silver' as const,position})),{id:'forest3-exit',type:'exit',position:{x:mid,y:62}}],
    enemies:floor===1?[]:magePositions.slice(0,floor-1).map(position=>({kind:'goblinMage',position})),
    randomEnemies:[{kind:'goblin',count:10+floor},{kind:'goblinArcher',count:4+floor},{kind:'wolf',count:3},{kind:'treant',count:2}],
    randomChests:7,gemCount:1,trapPlacements:[{count:18+floor*2,}]
  };
}
