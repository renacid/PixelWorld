import cave2Stage from '../stages/cave/3-2.json';
import caveStage from '../stages/cave/3-1.json';
import forestStage from '../stages/forest/2-5.json';
import { drawTerrainPreview } from '../render/TerrainPreview';
import './dungeon-editor.css';
import { TERRAIN } from '../data/terrain';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import { ITEMS } from '../data/items';
import { SKILLS } from '../data/skills';
import { TRAPS, type TrapId } from '../data/traps';
import { INSTALLATIONS, type InstallationKind } from '../data/installations';
import { REGIONS } from '../stages/regions';
import type { Point, GroundObject, ItemId, SkillId, ClearCondition } from '../game/types';
import { exportStage, newFloor, newProject, projectFromJson, stageCode, validateProject, type EditorProject } from './DungeonEditorModel';

// エディタ下書きはゲームのセーブと別キー。ゲーム状態を書き換えません。
const SAVE_KEY='pixel-world:dungeon-editor:v1';
let project=newProject(), floorIndex=0, zoom=24, category='tile', tool='paint', brush='0';
let dragging=false, anchor:Point|null=null, hover:Point|null=null, selected:Point|null=null;
const undo: string[]=[],redo:string[]=[];
const root=document.querySelector<HTMLDivElement>('#editor')!;
root.innerHTML=`<header><div><small>PIXEL WORLD / DEVELOPER TOOLS</small><h1>ダンジョン工房</h1></div><nav><button id="new">新規</button><button id="open-cave">洞窟3-1を開く</button><button id="open-cave2">洞窟3-2を開く</button><button id="open-forest">森2-5を開く</button><button id="load">JSONを開く</button><button id="save">下書き保存</button><button id="json">JSON出力</button><button id="export" class="primary">TypeScript出力</button></nav></header>
<div class="workspace"><aside class="left"><h2>ダンジョン設定</h2><div id="stage-form"></div><h2>階層 <button id="add-floor">＋</button><button id="copy-floor">複製</button><button id="delete-floor">削除</button></h2><div id="floors"></div><div id="floor-form"></div></aside>
<main><div class="toolbar"><select id="category"><option value="tile">地形</option><option value="object">宝箱・道具</option><option value="enemy">敵</option><option value="trap">罠</option><option value="installation">設置物</option><option value="spawn">開始地点</option></select><select id="tool"><option value="paint">ペン</option><option value="rectangle">四角塗り</option><option value="fill">塗りつぶし（地形）</option><option value="inspect">選択・詳細</option><option value="erase">配置物消去</option></select><button id="undo">戻す</button><button id="redo">やり直す</button><label>倍率 <input id="zoom" type="range" min="12" max="48" value="24"></label><span id="coordinates">X — / Y —</span></div><div id="palette"></div><div id="viewport"><canvas id="map"></canvas></div><footer id="status">ペンでドラッグして配置。右クリックで配置物を消去。Ctrl+Zで戻す。</footer></main>
<aside class="right"><h2>選択マス</h2><div id="inspect">マスをクリックすると座標と配置を表示します。</div><h2>出力の使い方</h2><ol><li>サイズと階層を決める</li><li>床・壁・開始地点・出口を配置</li><li>敵・罠・宝箱などを配置</li><li>検査してTypeScriptを保存</li></ol><p>出力ファイルを <code>src/stages/地域名/番号.ts</code> に置き、<code>src/stages/index.ts</code> でimportし、STAGES配列に追加してください。</p><p>設定の反映は新規プレイから。JSONはこのエディタで再編集するための形式です。</p><button id="validate">配置を検査</button><details><summary>操作ガイド</summary><p>四角塗り・塗りつぶしは地形専用です。配置物は1マス1つ、大型敵は全占有セルを確保します。壁を上から塗ると配置物を消します。</p><p>「選択・詳細」で選んだ宝箱はcontents、巣穴はoverridesなどをJSONで編集できます。宝石は各層の上限1まで。魔導書は各層の設定上限以内です。</p><p>斬撃を含む初期宝箱には、ゲーム共通の開始報酬上書きが適用されます。</p></details></aside></div>
<dialog id="output"><div class="dialog-title"><h2 id="output-title">出力</h2><button id="close-output">×</button></div><textarea id="output-text" spellcheck="false"></textarea><div><button id="copy-output">コピー</button><button id="download-output" class="primary">ダウンロード</button></div></dialog><input id="file" type="file" accept=".json" hidden>`;
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=$<HTMLCanvasElement>('map'),ctx=canvas.getContext('2d')!;
const floor=()=>project.floors[floorIndex];
const escape=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const field=(label:string,id:string,value:unknown,type='text')=>`<label>${label}<input id="${id}" type="${type}" value="${escape(value)}"></label>`;
const number=(id:string,min:number,max:number)=>Math.min(max,Math.max(min,Number($<HTMLInputElement>(id).value)||min));
const note=(s:string)=>{$('status').textContent=s;};
function checkpoint(){undo.push(JSON.stringify(project));if(undo.length>50)undo.shift();redo.length=0;}
function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(project));}catch{note('下書き保存に失敗。JSONをダウンロードしてください。');}}
function commit(){persist();draw();}
function renderForms(){
  const s=project.stage,f=floor();
  $('stage-form').innerHTML=field('ステージID（既存と重複しない値）','sid',s.id,'number')+field('表示番号','code',s.code)+field('名前','name',s.name)+field('サブタイトル','subtitle',s.subtitle)+`<label>地域<select id="region">${REGIONS.map(r=>`<option value="${r.id}" ${s.regionId===r.id?'selected':''}>${r.name}</option>`).join('')}</select></label>`+field('視野','vision',s.vision,'number')+field('睡眠後の復活数','respawn',s.sleepRespawnCount??3,'number')+field('敵強化の階層間隔','scaling-interval',s.dungeon?.enemyScaling?.everyFloors??3,'number')+field('敵強化倍率','scaling-rate',s.dungeon?.enemyScaling?.multiplier??1.2,'number')+'<button id="advanced-stage">詳細設定JSON</button>';
  for(const id of ['sid','code','name','subtitle','region','vision','respawn','scaling-interval','scaling-rate'])$(id).onchange=()=>{
    checkpoint();Object.assign(s,{id:Math.floor(number('sid',1,9999)),code:$<HTMLInputElement>('code').value,name:$<HTMLInputElement>('name').value,subtitle:$<HTMLInputElement>('subtitle').value,regionId:$<HTMLSelectElement>('region').value,vision:Math.floor(number('vision',1,60)),sleepRespawnCount:Math.floor(number('respawn',0,100))});
    s.dungeon!.enemyScaling={everyFloors:Math.floor(number('scaling-interval',1,100)),multiplier:number('scaling-rate',1,10)};commit();
  };
  $('advanced-stage').onclick=()=>editJSON('ダンジョン詳細（loot・初期MP・夜の復活数など）',s,value=>{project.stage=value;});
  $('floors').innerHTML=project.floors.map((f,i)=>`<button data-floor="${i}" class="${i===floorIndex?'active':''}">${i+1}F ${escape(f.name)}</button>`).join('');
  document.querySelectorAll<HTMLElement>('[data-floor]').forEach(b=>b.onclick=()=>{floorIndex=Number(b.dataset.floor);selected=null;renderForms();draw();inspect();});
  $('floor-form').innerHTML=field('階層名','fname',f.name)+`<div class="pair">${field('横マス','width',f.width,'number')}${field('縦マス','height',f.height,'number')}</div><button id="resize">サイズを適用（9～120）</button><label>クリア条件<select id="goal"><option value="exit">出口へ到達</option><option value="records">古代の記録を回収＋出口</option><option value="defeat">指定モンスター討伐＋出口</option><option value="destroyInstallations">設置物破壊＋出口</option></select></label><label>目標対象<select id="goal-kind"></select></label>`+field('必要数','goal-count','count' in f.clearCondition?f.clearCondition.count:1,'number')+field('ランダム宝箱数','chests',f.randomChests,'number')+field('宝石上限（0～1）','gems',f.gemCount,'number')+field('魔導書上限','books',f.settings.skillBooks?.max??0,'number')+field('追加魔導書確率（0～1）','book-chance',f.settings.skillBooks?.extraChance??0,'number')+'<button id="boss-settings">ボス戦エリア・封鎖マス</button><button id="advanced-floor">階層詳細JSON（ランダム配置・抽選表）</button>';
  $<HTMLSelectElement>('goal').value=f.clearCondition.type;
  const goalOptions=()=>{const type=$<HTMLSelectElement>('goal').value;const entries=type==='destroyInstallations'?Object.entries(INSTALLATIONS):Object.entries(ENEMIES).filter(([id])=>!['player','sprite','greaterSprite'].includes(id));$('goal-kind').innerHTML=entries.map(([id,d])=>`<option value="${id}">${escape(d.name)}</option>`).join('');if('kind' in f.clearCondition)$<HTMLSelectElement>('goal-kind').value=f.clearCondition.kind;};goalOptions();
  for(const id of ['fname','goal','goal-kind','goal-count','chests','gems','books','book-chance'])$(id).onchange=()=>{
    checkpoint();if(id==='goal')goalOptions();f.name=$<HTMLInputElement>('fname').value;
    const type=$<HTMLSelectElement>('goal').value,count=Math.floor(number('goal-count',1,1000)),kind=$<HTMLSelectElement>('goal-kind').value;
    f.clearCondition=(type==='exit'?{type}:type==='records'?{type,count}:{type,kind,count}) as ClearCondition;
    f.randomChests=Math.floor(number('chests',0,100));f.gemCount=Math.floor(number('gems',0,1));f.settings.skillBooks={max:Math.floor(number('books',0,100)),extraChance:number('book-chance',0,1)};commit();
  };
  $('resize').onclick=()=>{
    const w=Math.floor(number('width',9,120)),h=Math.floor(number('height',9,120));
    if((w<f.width||h<f.height)&&!confirm('範囲外の地形と配置を削除して縮小しますか？'))return;
    checkpoint();const oldWidth=f.width,oldHeight=f.height,tiles=f.tiles;
    f.tiles=Array.from({length:w*h},(_,i)=>i%w<oldWidth&&Math.floor(i/w)<oldHeight?tiles[Math.floor(i/w)*oldWidth+i%w]:1);f.width=w;f.height=h;
    const inside=(p:Point)=>p.x<w&&p.y<h;
    f.objects=f.objects.filter(o=>inside(o.position));f.traps=f.traps.filter(o=>inside(o.position));f.installations=f.installations.filter(o=>inside(o.position));f.enemies=f.enemies.filter(o=>o.position.x+ENEMIES[o.kind].size<=w&&o.position.y+ENEMIES[o.kind].size<=h);
    if(!inside(f.spawn))f.spawn={x:1,y:1};renderForms();commit();
  };
  $('boss-settings').onclick=()=>editJSON('ボス戦範囲 x/y/width/height・sealTiles [{x,y}]・wallTile 地形ID',f.bossArena??{x:1,y:1,width:15,height:11,sealTiles:[],wallTile:1},value=>{f.bossArena=value;});
  $('advanced-floor').onclick=()=>editJSON('階層詳細：enemySpawns / trapPlacements / loot など',f.settings,value=>{f.settings=value;});
  const random=document.createElement('section');random.innerHTML='<h2>ランダム配置</h2><div id="random-list"></div><label>敵の種類<select id="random-enemy">'+Object.entries(ENEMIES).filter(([id])=>!['player','sprite','greaterSprite'].includes(id)).map(([id,d])=>'<option value="'+id+'">'+escape(d.name)+'</option>').join('')+'</select></label>'+field('敵の数','random-enemy-count',1,'number')+'<button id="add-random-enemy">敵の抽選配置を追加</button><label>罠の種類<select id="random-trap">'+Object.entries(TRAPS).map(([id,d])=>'<option value="'+id+'">'+escape(d.name)+'</option>').join('')+'</select></label>'+field('罠の数','random-trap-count',1,'number')+'<button id="add-random-trap">罠の抽選配置を追加</button><p>全床から配置します。局所密集は階層詳細JSONの各ルールにregionを指定してください。</p>';
  $('floor-form').append(random);
  $('random-list').innerHTML=[...(f.settings.enemySpawns??[]).map((e,i)=>'<p>'+escape(ENEMIES[e.kind]?.name??e.kind)+' × '+e.count+' <button data-remove-enemy="'+i+'">削除</button></p>'),...(f.settings.trapPlacements??[]).map((t,i)=>{const pool=t.pool??[];const name=pool.length===1?TRAPS[pool[0].value]?.name:'罠（抽選）';return '<p>'+escape(name??'罠')+' × '+t.count+(t.region?'（指定範囲）':'')+' <button data-remove-trap="'+i+'">削除</button></p>';})].join('');
  $('add-random-enemy').onclick=()=>{checkpoint();(f.settings.enemySpawns??=[]).push({kind:$<HTMLSelectElement>('random-enemy').value as EnemyKind,count:Math.floor(number('random-enemy-count',1,100))});renderForms();commit();};
  $('add-random-trap').onclick=()=>{checkpoint();(f.settings.trapPlacements??=[]).push({count:Math.floor(number('random-trap-count',1,100)),pool:[{value:$<HTMLSelectElement>('random-trap').value as TrapId,weight:1}]});renderForms();commit();};
  document.querySelectorAll<HTMLElement>('[data-remove-enemy]').forEach(b=>b.onclick=()=>{checkpoint();f.settings.enemySpawns!.splice(Number(b.dataset.removeEnemy),1);renderForms();commit();});
  document.querySelectorAll<HTMLElement>('[data-remove-trap]').forEach(b=>b.onclick=()=>{checkpoint();f.settings.trapPlacements!.splice(Number(b.dataset.removeTrap),1);renderForms();commit();});
}
function entries():[string,string,string][] {
  if(category==='tile')return Object.entries(TERRAIN).map(([id,d])=>[id,d.name,d.color]);
  if(category==='enemy')return Object.entries(ENEMIES).filter(([id])=>!['player','sprite','greaterSprite'].includes(id)).map(([id,d])=>[id,d.name+' '+d.size+'×'+d.size,'#a76567']);
  if(category==='trap')return Object.entries(TRAPS).map(([id,d])=>[id,d.name,'#bb8053']);
  if(category==='installation')return Object.entries(INSTALLATIONS).map(([id,d])=>[id,d.name,'#ae8c73']);
  if(category==='spawn')return [['spawn','旅人の開始地点','#5f9de0']];
  return [...['wood','iron','silver','gold'].map((id,i):[string,string,string]=>['chest:'+id,['木の宝箱','鉄の宝箱','銀の宝箱','金の宝箱'][i],'#d4ad5b']),['exit','出口','#f0e0a0'],['record','古代の記録','#b6b4a6'],['gem','宝石','#a58ee8'],['skillBook','魔導書','#d5a3dd'],...Object.entries(ITEMS).map(([id,d]):[string,string,string]=>['item:'+id,d.name,'#5eae8d']),...Object.entries(SKILLS).map(([id,d]):[string,string,string]=>['skill:'+id,d.name,'#879cdb'])];
}
function palette(){const all=entries();if(!all.some(e=>e[0]===brush))brush=all[0][0];$('palette').innerHTML=all.map(([id,name,color])=>`<button data-brush="${id}" class="${brush===id?'active':''}"><i style="background:${color}"></i>${escape(name)}</button>`).join('');if(category==='tile')document.querySelectorAll<HTMLElement>('[data-brush]').forEach(b=>{const c=document.createElement('canvas');c.width=24;c.height=24;c.style.cssText='width:24px;height:24px;display:inline-block;vertical-align:middle;margin-right:5px';drawTerrainPreview(c.getContext('2d')!,Number(b.dataset.brush),0,0,24);b.querySelector('i')?.replaceWith(c);});document.querySelectorAll<HTMLElement>('[data-brush]').forEach(b=>b.onclick=()=>{brush=b.dataset.brush!;palette();});}
function same(a:Point,b:Point){return a.x===b.x&&a.y===b.y;}
function enemyAt(p:Point){return floor().enemies.find(e=>p.x>=e.position.x&&p.y>=e.position.y&&p.x<e.position.x+ENEMIES[e.kind].size&&p.y<e.position.y+ENEMIES[e.kind].size);}
function erase(p:Point){const f=floor(),enemy=enemyAt(p);f.enemies=f.enemies.filter(e=>e!==enemy);f.objects=f.objects.filter(o=>!same(o.position,p));f.traps=f.traps.filter(o=>!same(o.position,p));f.installations=f.installations.filter(o=>!same(o.position,p));}
function paint(p:Point){
 const f=floor();if(p.x<0||p.y<0||p.x>=f.width||p.y>=f.height)return;
 if(tool==='erase'){erase(p);return;}
 if(category==='tile'){f.tiles[p.y*f.width+p.x]=Number(brush);if(TERRAIN[Number(brush)].solid)erase(p);return;}
 if(TERRAIN[f.tiles[p.y*f.width+p.x]].solid){note('床の上へ配置してください。');return;}
 if(category==='spawn'){erase(p);f.spawn={...p};return;}
 if(same(p,f.spawn)){note('開始地点は空けてください。');return;}
 const size=category==='enemy'?ENEMIES[brush as EnemyKind].size:1;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const q={x:p.x+x,y:p.y+y};if(q.x>=f.width||q.y>=f.height||TERRAIN[f.tiles[q.y*f.width+q.x]].solid||same(q,f.spawn)||enemyAt(q)||[...f.objects,...f.traps,...f.installations].some(o=>same(o.position,q))){note('配置できる空きマスがありません。先に消去してください。');return;}
 }
 const id='editor-'+crypto.randomUUID();
 if(category==='enemy')f.enemies.push({kind:brush as EnemyKind,position:{...p}});
 else if(category==='trap')f.traps.push({id,trapId:brush as TrapId,position:{...p},triggered:false});
 else if(category==='installation')f.installations.push({id,kind:brush as InstallationKind,position:{...p},spawned:0,requiredForGoal:brush==='goblinNest'});
 else {const [type,value]=brush.split(':');f.objects.push({id,type:type as GroundObject['type'],position:{...p},...(type==='chest'?{chestTier:value as GroundObject['chestTier']}:type==='item'?{itemId:value as ItemId}:type==='skill'?{skillId:value as SkillId}:{})});}
}
function draw(){
 const f=floor();canvas.width=f.width*zoom;canvas.height=f.height*zoom;ctx.imageSmoothingEnabled=false;
 for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){drawTerrainPreview(ctx,f.tiles[y*f.width+x],x*zoom,y*zoom,zoom);ctx.strokeStyle='#17372925';ctx.strokeRect(x*zoom,y*zoom,zoom,zoom);}
 const label=(p:Point,text:string,color:string,size=1)=>{ctx.fillStyle=color;ctx.fillRect(p.x*zoom+2,p.y*zoom+2,zoom*size-4,zoom*size-4);ctx.fillStyle='#fff';ctx.font=`bold ${Math.max(10,zoom*.45)}px sans-serif`;ctx.textAlign='center';ctx.fillText(text,p.x*zoom+zoom*size/2,p.y*zoom+zoom*size/2+4);};
 for(const o of f.objects)label(o.position,({chest:'箱',exit:'出',record:'記',gem:'宝',skillBook:'書',item:'薬',skill:'技'})[o.type],'#80714c');
 for(const t of f.traps)label(t.position,'罠','#b86742');
 for(const i of f.installations)label(i.position,i.kind==='pot'?'壺':i.kind==='goblinNest'?'巣':'柱','#755840');
 for(const e of f.enemies)label(e.position,ENEMIES[e.kind].name.slice(0,2),'#a44757',ENEMIES[e.kind].size);
 label(f.spawn,'始','#387aa9');
 if(selected){ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.strokeRect(selected.x*zoom+1,selected.y*zoom+1,zoom-2,zoom-2);}
 if(dragging&&tool==='rectangle'&&anchor&&hover){ctx.fillStyle='#ffffff55';ctx.fillRect(Math.min(anchor.x,hover.x)*zoom,Math.min(anchor.y,hover.y)*zoom,(Math.abs(anchor.x-hover.x)+1)*zoom,(Math.abs(anchor.y-hover.y)+1)*zoom);}
}
function inspect(){
 if(!selected){$('inspect').textContent='マスを選択してください。';return;}
 const p=selected,f=floor(),entry=enemyAt(p)??[...f.objects,...f.traps,...f.installations].find(o=>same(o.position,p));
 $('inspect').innerHTML=`<p>X ${p.x} / Y ${p.y}<br>${escape(TERRAIN[f.tiles[p.y*f.width+p.x]].name)}</p>`+(entry?`<textarea id="entry" spellcheck="false">${escape(JSON.stringify(entry,null,2))}</textarea><button id="apply-entry">配置の詳細を適用</button><button id="remove-entry">この配置を削除</button><p>宝箱の固定報酬例：<code>"contents": [{"type":"skill","id":"fireball"}]</code></p>`:'<p>配置物なし</p>');
 if(entry){$('remove-entry').onclick=()=>{checkpoint();erase(p);commit();inspect();};$('apply-entry').onclick=()=>{try{const value=JSON.parse($<HTMLTextAreaElement>('entry').value);if(!value.position||!Number.isInteger(value.position.x)||!Number.isInteger(value.position.y))throw new Error('座標は整数で指定してください');checkpoint();Object.keys(entry).forEach(k=>delete (entry as unknown as Record<string,unknown>)[k]);Object.assign(entry,value);commit();inspect();}catch(e){note(String(e));}};}
}
const pointer=(e:PointerEvent):Point=>{const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(floor().width-1,Math.floor((e.clientX-r.left)/zoom))),y:Math.max(0,Math.min(floor().height-1,Math.floor((e.clientY-r.top)/zoom)))};};
canvas.oncontextmenu=e=>e.preventDefault();
canvas.onpointerdown=e=>{if(e.button!==0&&e.button!==2)return;selected=pointer(e);anchor=selected;hover=selected;if(tool==='inspect'&&e.button===0){inspect();draw();return;}checkpoint();dragging=true;canvas.setPointerCapture(e.pointerId);
 if(e.button===2)erase(selected);else if(tool==='fill'&&category==='tile'){
   const f=floor(),old=f.tiles[selected.y*f.width+selected.x],queue=[selected],seen=new Set<string>();
   for(let i=0;i<queue.length;i++){const p=queue[i],key=p.x+','+p.y;if(p.x<0||p.y<0||p.x>=f.width||p.y>=f.height||seen.has(key)||f.tiles[p.y*f.width+p.x]!==old)continue;seen.add(key);paint(p);for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push({x:p.x+x,y:p.y+y});}
 }else if(tool!=='rectangle')paint(selected);draw();inspect();};
canvas.onpointermove=e=>{hover=pointer(e);$('coordinates').textContent=`X ${hover.x} / Y ${hover.y}`;if(!dragging)return;if(e.buttons===2)erase(hover);else if(tool==='paint'||tool==='erase')paint(hover);draw();};
canvas.onpointerup=e=>{if(!dragging)return;if(tool==='rectangle'&&category==='tile'&&anchor&&hover)for(let y=Math.min(anchor.y,hover.y);y<=Math.max(anchor.y,hover.y);y++)for(let x=Math.min(anchor.x,hover.x);x<=Math.max(anchor.x,hover.x);x++)paint({x,y});dragging=false;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);commit();inspect();};
canvas.onpointercancel=()=>{dragging=false;commit();};
$('category').onchange=()=>{category=$<HTMLSelectElement>('category').value;palette();};$('tool').onchange=()=>{tool=$<HTMLSelectElement>('tool').value;};$('zoom').oninput=()=>{zoom=Number($<HTMLInputElement>('zoom').value);draw();};
function history(back:boolean){const from=back?undo:redo,to=back?redo:undo;if(!from.length)return;to.push(JSON.stringify(project));project=JSON.parse(from.pop()!);floorIndex=Math.min(floorIndex,project.floors.length-1);selected=null;renderForms();commit();inspect();}
$('undo').onclick=()=>history(true);$('redo').onclick=()=>history(false);
document.addEventListener('keydown',e=>{if((e.target as HTMLElement).matches('input,textarea,select'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();history(!e.shiftKey);}});
$('add-floor').onclick=()=>{checkpoint();project.floors.push(newFloor(floor().width,floor().height));floorIndex=project.floors.length-1;selected=null;renderForms();commit();inspect();};
$('copy-floor').onclick=()=>{checkpoint();project.floors.splice(floorIndex+1,0,structuredClone(floor()));floorIndex++;renderForms();commit();};
$('delete-floor').onclick=()=>{if(project.floors.length===1||!confirm('この階層を削除しますか？（戻すで復元できます）'))return;checkpoint();project.floors.splice(floorIndex,1);floorIndex=Math.min(floorIndex,project.floors.length-1);selected=null;renderForms();commit();inspect();};
$('save').onclick=()=>{persist();note('このブラウザに下書きを保存しました。');};
$('new').onclick=()=>{if(!confirm('新しい下書きを作成しますか？必要なら先にJSON出力してください。'))return;checkpoint();project=newProject();floorIndex=0;selected=null;renderForms();commit();inspect();};
function download(name:string,content:string){const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
let outputName='stage.ts',applyOutput:(()=>void)|null=null;
function showOutput(title:string,text:string,name:string){$('output-title').textContent=title;$<HTMLTextAreaElement>('output-text').value=text;outputName=name;applyOutput=null;$('copy-output').textContent='コピー';$<HTMLDialogElement>('output').showModal();}
function editJSON(title:string,value:unknown,apply:(value:any)=>void){showOutput(title,JSON.stringify(value,null,2),'settings.json');$('copy-output').textContent='設定を適用';applyOutput=()=>{try{const data=JSON.parse($<HTMLTextAreaElement>('output-text').value);if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('JSONオブジェクトを指定してください');checkpoint();apply(data);renderForms();commit();$<HTMLDialogElement>('output').close();}catch(e){note(String(e));}};}
$('close-output').onclick=()=>$<HTMLDialogElement>('output').close();$('download-output').onclick=()=>download(outputName,$<HTMLTextAreaElement>('output-text').value);
$('copy-output').onclick=()=>{if(applyOutput){applyOutput();return;}navigator.clipboard.writeText($<HTMLTextAreaElement>('output-text').value).then(()=>note('コピーしました。'),()=>note('コピーできません。テキストを選択してコピーしてください。'));};
$('json').onclick=()=>download('dungeon-project.json',JSON.stringify(project,null,2));
$('validate').onclick=()=>{try{const errors=validateProject(project);note(errors.length?errors.join(' / '):'固定配置・占有・出口への経路は正常です。');}catch(e){note(String(e));}};
$('export').onclick=()=>{try{const errors=validateProject(project);if(errors.length){showOutput('配置を修正してください',errors.join('\n'),'validation.txt');return;}exportStage(project);showOutput('TypeScript / src/stages/地域名/番号.ts',stageCode(project),(project.stage.code??'custom')+'.ts');}catch(e){note(String(e));}};
$('open-cave2').onclick=()=>{if(!confirm('下書きを洞窟3-2で置き換えますか？'))return;checkpoint();project=projectFromJson(cave2Stage);floorIndex=0;renderForms();commit();};
$('open-cave').onclick=()=>{if(!confirm('下書きを洞窟3-1で置き換えますか？'))return;checkpoint();project=projectFromJson(caveStage);floorIndex=0;renderForms();commit();};
$('open-forest').onclick=()=>{if(!confirm('下書きを森2-5で置き換えますか？'))return;checkpoint();project=projectFromJson(forestStage);floorIndex=0;renderForms();commit();};
$('load').onclick=()=>$<HTMLInputElement>('file').click();
 $('file').onchange=async()=>{const file=$<HTMLInputElement>('file').files?.[0];if(!file)return;try{const next=projectFromJson(JSON.parse(await file.text()));const errors=validateProject(next);if(errors.length)throw new Error(errors.join(' / '));if(!confirm('現在の下書きを読み込んだ内容で置き換えますか？'))return;checkpoint();project=next;floorIndex=0;selected=null;renderForms();commit();inspect();note('JSONを読み込みました。続きから編集できます。');}catch(e){note('読み込み失敗：'+String(e));}$<HTMLInputElement>('file').value='';};
try{const saved=localStorage.getItem(SAVE_KEY);if(saved){const loaded=JSON.parse(saved);validateProject(loaded);project=loaded;}}catch{note('保存済みの下書きを読み込めませんでした。');}
renderForms();palette();draw();
