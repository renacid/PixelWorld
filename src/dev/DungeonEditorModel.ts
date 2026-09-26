/** エディタの保存形式と、ゲームが直接読み込めるStageへの変換。 */
import type { Stage, StageLayout, FloorSettings, ClearCondition, GroundObject, Point } from '../game/types';
import { TERRAIN } from '../data/terrain';
import { ENEMIES } from '../data/enemies';
export type EditorFloor = {
  bossArena?: StageLayout['bossArena'];
  name:string; width:number; height:number; tiles:number[]; spawn:Point;
  objects:GroundObject[]; enemies:StageLayout['enemies']; traps:NonNullable<StageLayout['traps']>;
  installations:NonNullable<StageLayout['installations']>;
  clearCondition:ClearCondition; randomChests:number; gemCount:number;
  settings:FloorSettings;
};
export type EditorProject = { version:1; stage:Omit<Stage,'layout'|'floorSettings'>; floors:EditorFloor[] };
/** JSON出力（EditorProject）と、TypeScript出力から取り出したStage JSONの両方を編集形式へ戻します。 */
export function projectFromJson(input: unknown): EditorProject {
  if (!input || typeof input !== 'object') throw new Error('JSONオブジェクトを指定してください');
  const value = input as Record<string, any>;
  if (Array.isArray(value.floors) && value.stage) return { ...value, version: 1 } as EditorProject;
  if (!value.floorSettings || typeof value.floorSettings !== 'object') throw new Error('ダンジョン工房のJSON、またはTypeScript出力のStage JSONではありません');
  const stage = { ...value } as Record<string, any>;
  delete stage.floorSettings; delete stage.layout;
  const floors: EditorFloor[] = [];
  for (const key of Object.keys(value.floorSettings).sort((a, b) => Number(a) - Number(b))) {
    const settings = value.floorSettings[key] as Record<string, any>;
    const layout = settings.layout;
    if (!layout || !Array.isArray(layout.rows) || !layout.legend) throw new Error(`${key}層のlayoutが見つかりません`);
    const height = Number(settings.height ?? layout.rows.length), width = Number(settings.width ?? layout.rows[0]?.length);
    const tiles = layout.rows.flatMap((row: string) => [...row].map(char => {
      const tile = layout.legend[char]; if (!Number.isInteger(tile)) throw new Error(`${key}層に未定義の地形文字があります`); return tile;
    }));
    const floorSettings = { ...settings }; delete floorSettings.layout; delete floorSettings.width; delete floorSettings.height; delete floorSettings.clearCondition;
    floors.push({
      bossArena: structuredClone(layout.bossArena), name: settings.name ?? `${key}層`, width, height, tiles,
      spawn: { ...layout.spawn }, objects: structuredClone(layout.objects ?? []), enemies: structuredClone(layout.enemies ?? []),
      traps: structuredClone(layout.traps ?? []), installations: structuredClone(layout.installations ?? []),
      clearCondition: structuredClone(settings.clearCondition ?? { type: 'exit' }),
      randomChests: layout.randomChests ?? 0, gemCount: layout.gemCount ?? 0, settings: floorSettings,
    });
  }
  if (!floors.length) throw new Error('階層がありません');
  return { version: 1, stage: stage as EditorProject['stage'], floors };
}
export function newFloor(width=30,height=30):EditorFloor {
  return {name:'新しい階層',width,height,tiles:Array.from({length:width*height},(_,i)=>i%width===0||i%width===width-1||i<width||i>=width*(height-1)?1:0),spawn:{x:2,y:2},objects:[],enemies:[],traps:[],installations:[],clearCondition:{type:'exit'},randomChests:0,gemCount:0,settings:{trapPlacements:[],installationPlacements:[],skillBooks:{max:0,extraChance:0}}};
}
export function newProject():EditorProject {
  return {version:1,stage:{id:11,regionId:'forest',code:'2-5',name:'森 2-5',subtitle:'新しい冒険',description:'',objective:'出口を目指す',width:30,height:30,vision:5,enemyCount:0,sleepRespawnCount:3,dungeon:{floors:1,gemCount:0,extraPassages:0,enemyVariance:0,nightRevival:{min:1,max:2},enemyScaling:{everyFloors:3,multiplier:1.2}}},floors:[newFloor()]};
}
export function exportStage(project:EditorProject):Stage {
  const floorSettings:Record<number,FloorSettings>={};
  const tileIds=Object.keys(TERRAIN).map(Number),symbols='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if(tileIds.length>symbols.length)throw new Error('地形種類が文字数上限を超えています');
  const legend=Object.fromEntries(tileIds.map((id,i)=>[symbols[i],id]));
  for(const [i,f] of project.floors.entries()){
    const rows=Array.from({length:f.height},(_,y)=>f.tiles.slice(y*f.width,(y+1)*f.width).map(id=>symbols[tileIds.indexOf(id)]).join(''));
    floorSettings[i+1]={...structuredClone(f.settings),width:f.width,height:f.height,clearCondition:structuredClone(f.clearCondition),layout:{bossArena:structuredClone(f.bossArena),rows,legend,spawn:{...f.spawn},objects:structuredClone(f.objects),enemies:structuredClone(f.enemies),traps:structuredClone(f.traps),installations:structuredClone(f.installations),randomChests:f.randomChests,gemCount:f.gemCount,randomEnemies:[],trapPlacements:[]}};
  }
  const first=project.floors[0];
  return {...structuredClone(project.stage),width:first.width,height:first.height,dungeon:{...project.stage.dungeon!,floors:project.floors.length,overrides:{...project.stage.dungeon?.overrides,...Object.fromEntries(project.floors.map((f,i)=>[i+1,{...project.stage.dungeon?.overrides?.[i+1],gemCount:f.gemCount}]))}},floorSettings};
}
export function stageCode(project:EditorProject):string {
  return '/** ダンジョン工房で作成。src/stages/地域名/番号.ts に保存してください。 */\nimport type { Stage } from "../../game/types";\n\nexport const stage: Stage = '+JSON.stringify(exportStage(project),null,2)+';\n';
}
/** 大型敵の占有・固定配置・出口への到達を出力前に検査。 */
export function validateProject(project:EditorProject):string[] {
  const samePoint=(a:Point,b:Point)=>a.x===b.x&&a.y===b.y;
  const errors:string[]=[];
  if(project.version!==1||!Array.isArray(project.floors)||!project.floors.length)throw new Error('対応していないプロジェクト形式です');
  if(!Number.isInteger(project.stage.id)||project.stage.id<1)errors.push('ステージIDは1以上の整数にしてください');
  for(const [index,f] of project.floors.entries()){
    const fail=(text:string)=>errors.push((index+1)+'層：'+text);
    if(!Number.isInteger(f.width)||!Number.isInteger(f.height)||f.width<9||f.height<9||f.width>120||f.height>120||f.tiles.length!==f.width*f.height){fail('サイズは9～120、タイル数と一致させてください');continue;}
    if(f.tiles.some(id=>!(id in TERRAIN))){fail('未定義の地形があります');continue;}
    const pass=(p:Point)=>Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&p.x<f.width&&p.y<f.height&&!TERRAIN[f.tiles[p.y*f.width+p.x]].solid;
    const key=(p:Point)=>p.x+','+p.y,used=new Set<string>();
    for(const entry of [{position:f.spawn},...f.objects,...f.traps,...f.installations]){
      if(!pass(entry.position))fail('配置が壁か範囲外です ('+key(entry.position)+')');
      if(used.has(key(entry.position)))fail('配置が重複しています ('+key(entry.position)+')');used.add(key(entry.position));
    }
    for(const enemy of f.enemies){const definition=ENEMIES[enemy.kind];if(!definition){fail('未定義の敵');continue;}
      for(let y=0;y<definition.size;y++)for(let x=0;x<definition.size;x++){const p={x:enemy.position.x+x,y:enemy.position.y+y};if(!pass(p)||used.has(key(p)))fail('敵の占有マスが壁・配置物と重なります ('+key(p)+')');used.add(key(p));}
    }
    if(f.bossArena){const a=f.bossArena;
      if(![a.x,a.y,a.width,a.height].every(Number.isInteger)||a.x<0||a.y<0||a.width<1||a.height<1||a.x+a.width>f.width||a.y+a.height>f.height)fail('ボス戦エリアが範囲外です');
      if(a.wallTile!==undefined&&!TERRAIN[a.wallTile]?.solid)fail('封鎖用の地形には壁を指定してください');
      for(const p of a.sealTiles??[])if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=f.width||p.y>=f.height)fail('封鎖マスが範囲外です');
      if(f.enemies.some(e=>e.kind==='goblinKing'&&(a.sealTiles??[]).some(p=>samePoint(p,e.position))))fail('ボスの配置マスは封鎖できません');
    }
    const exits=f.objects.filter(o=>o.type==='exit');if(!exits.length)fail('出口を置いてください');
    if(f.objects.filter(o=>o.type==='gem').length>f.gemCount)fail('宝石配置数が宝石上限を超えています');
    if(f.objects.filter(o=>o.type==='skillBook').length>(f.settings.skillBooks?.max??1))fail('魔導書配置数が上限を超えています');
    if(f.clearCondition.type==='records'&&f.objects.filter(o=>o.type==='record').length<f.clearCondition.count)fail('クリアに必要な古代の記録が不足しています');
    if(f.clearCondition.type==='destroyInstallations'&&f.installations.filter(o=>o.kind===(f.clearCondition as {kind:string}).kind).length<f.clearCondition.count)fail('破壊目標の設置物が不足しています');
    const reached=new Set<string>(),queue=[f.spawn];
    for(let n=0;n<queue.length;n++){const p=queue[n];if(!pass(p)||reached.has(key(p)))continue;reached.add(key(p));for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push({x:p.x+x,y:p.y+y});}
    if(exits.some(o=>!reached.has(key(o.position))))fail('開始地点から出口へつながる床がありません');
  }
  return [...new Set(errors)];
}
