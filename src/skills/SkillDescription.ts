/** 変動値は実効レベルから毎回算出。文章と実際の倍率を対応させる。 */
import { SKILLS } from '../data/skills';
import { connectionDamageMultiplier, effectiveLevel } from './SkillBag';
import type { BagBlock,SaveData,SkillId } from '../game/types';
export function skillDescription(state:SaveData,id:SkillId,bag:BagBlock[]):string {
 const d=SKILLS[id],level=effectiveLevel(bag,state.skillLevels,id),link=connectionDamageMultiplier(bag,id),scale=(1+(level-1)*.05)*link;
 const red=(n:number)=>'<em class="changing-value">'+Math.round(n*1000)/10+'%</em>';
 let detail='';
 if(id==='attack')detail='現在の攻撃力倍率：'+red(.5*scale)+'〜'+red(.7*scale);
 else if(id==='sweep')detail='現在の攻撃力倍率：'+red(.4*scale)+'〜'+red(.6*scale);
 else if(id==='chainLightning')detail='現在の各命中倍率：'+Array.from({length:level>=5?5:level>=3?3:2},(_,i)=>red((1-i*.1)*scale)).join(' → ');
 else if(id==='groundbreak')detail='設置時の倍率：'+red(scale)+'、10ターン後：'+red(1.5*scale);
 else if(d.multiplier>0)detail='現在の攻撃力倍率：'+red(d.multiplier*scale)+(d.hits>1?' × '+d.hits+'ヒット':'');
 return d.description+(detail?'<br>'+detail+'<br>レベル補正 ×'+(1+(level-1)*.05).toFixed(2)+' × 連結補正 <em class="changing-value">'+link.toFixed(2)+'</em>':'');
}
