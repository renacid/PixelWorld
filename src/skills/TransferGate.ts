/** 門は歩行可能な設置物。選択のキャンセルではMP・ターンを消費しない。 */
import { canStand, same } from '../game/MapState';
import { effectiveLevel } from './SkillBag';
import { VECTORS, type Point, type SaveData } from '../game/types';
export function gateCells(s:SaveData):Point[]{
 return Object.values(VECTORS).map(v=>({x:s.playerState.position.x+v.x,y:s.playerState.position.y+v.y})).filter(p=>
 canStand(s.mapState,s.playerState,p,[...s.enemyStates,...s.allyStates])&&
 ![...s.mapState.objects,...s.mapState.traps??[],...s.mapState.playerTraps??[],...s.mapState.fields,...s.mapState.crystals??[],...s.mapState.gates??[]].some(o=>same(o.position,p)));
}
export function placeGate(s:SaveData,p:Point):void{
 const level=effectiveLevel(s.skillBag,s.skillLevels,'transferGate'),limit=level>=5?5:level>=3?3:2;
 const gates=s.mapState.gates??=[];
 gates.push({id:'gate-'+s.playerActionCount,position:{...p},placedAt:s.playerActionCount});
 while(gates.length>limit)gates.shift();
}
export function gateDestinations(s:SaveData,entrance:Point){
 if(!(s.mapState.gates??[]).some(g=>same(g.position,entrance)))return [];
 return (s.mapState.gates??[]).filter(g=>!same(g.position,entrance)&&canStand(s.mapState,s.playerState,g.position,[...s.enemyStates,...s.allyStates]));
}
