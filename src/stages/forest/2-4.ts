import type {Stage} from '../../game/types';
import {forest04,FOREST04_SIZE} from './layout04';
/** 破壊目標の巣穴は出現上限後も残り、攻撃で壊すまで消えません。 */
export const stage:Stage={id:9,regionId:'forest',code:'2-4',name:'森 2-4',subtitle:'ゴブリンの住処 -中層-',description:'南の入口から、広場と細道を抜けて集落の奥へ。',objective:'1層：出口／2層：巣穴2個破壊／3層：巣穴3個破壊',vision:5,...FOREST04_SIZE,enemyCount:25,sleepRespawnCount:3,
 dungeon:{floors:3,gemCount:1,extraPassages:4,enemyVariance:0,nightRevival:{min:1,max:2},enemyScaling:{everyFloors:3,multiplier:1.2}},
 clearCondition:{type:'exit'},installationPlacements:[{kind:'pot',count:10,nearWall:true},{kind:'goblinNest',count:2,nearWall:true}],
 floorSettings:{2:{clearCondition:{type:'destroyInstallations',kind:'goblinNest',count:2}},3:{clearCondition:{type:'destroyInstallations',kind:'goblinNest',count:3},installationPlacements:[{kind:'pot',count:12,nearWall:true},{kind:'goblinNest',count:3,nearWall:true}]}},
 layout:(_stage,floor)=>forest04(floor)};
