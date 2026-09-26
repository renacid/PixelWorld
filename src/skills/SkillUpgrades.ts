import { SKILLS } from '../data/skills';
import type { SkillId } from '../game/types';
/** 特殊なレベル強化はここへ集約。通常の説明には基本効果だけを載せる。 */
export const SKILL_UPGRADES: Partial<Record<SkillId,Record<number,string>>> = {
 fireball:{5:'着弾点と上下左右の計5マスに、3ターン持続する炎上床（30%炎ダメージ）を生成。'},
 flurry:{3:'追加攻撃が3回（初撃を含め4回）になる。',5:'追加攻撃が4回（初撃を含め5回）になる。'},
 randomThunder:{3:'対象が2体になる。',5:'対象が4体になる。'},
 meteor:{3:'着弾範囲の各マスに50%の確率で3ターンの炎上床（30%炎ダメージ）。',5:'着弾点の選択範囲が7×7になる。'},
 icePillar:{3:'設置マスの横に空きがあれば氷柱を1本追加。',5:'追加した柱の十字方向に空きがあればさらに1本追加。'},
 thunderArmor:{3:'追加攻撃の発動率70%、継続8ターン。',5:'追加攻撃の発動率100%、継続10ターン。'},
 iceLance:{3:'射程4マス。4体目の基礎ダメージ150%。'},
 fireWall:{5:'設置範囲が横3×奥行2マスになる。'},
 tornadoSummon:{3:'合計5マス移動。',5:'合計7マス移動。'},
 earthquake:{3:'移動不可の付与確率80%。',5:'攻撃範囲が9×9になる。'},
 summonSpirit:{3:'レア階級2以上の媒体があれば中級精霊を召喚（最低レア階級優先）。'},
 vacuumSlash:{5:'対象の選択範囲が7×7になる。'},
 chainLightning:{3:'最大3体まで連鎖。',5:'最大5体まで連鎖。'},
 icestone:{3:'着弾点の選択範囲が7×7になる。',5:'異なる着弾点を2つ選択し、氷岩を2つ落とす。'},
 firerain:{5:'攻撃範囲が7×7になる。'},
};
export function skillUpgradeHtml(id:SkillId,current:number):string{
 const d=SKILLS[id],growth=id==='summonSpirit'?'召喚時HP・攻撃力・MP・生存ターン':id==='thunderArmor'?'追加雷ダメージ倍率':'ダメージ倍率';
 const grows=d.multiplier>0||['groundbreak','summonSpirit','thunderArmor'].includes(id);
 const rows=Array.from({length:Math.max(5,Math.min(current,20))},(_,i)=>{const lv=i+1;
  const common=id==='earthBlessing'?'回復量 '+(10+i*3)+'／攻撃力＋'+(3+i)+'（15ターン）／精霊HP＋'+(i*3)+'・攻撃＋'+i+'・生存'+(30+i*5)+'ターン／異なる効果を'+(lv>=5?3:lv>=3?2:1)+'つ発動':grows?growth+'：Lv.1の'+(100+i*5)+'%'+(id==='summonSpirit'?'（整数切り捨て）':''):i===0?'基本効果':'特殊な変更なし';
  const passive=d.passive?'／発動率 '+Math.round(Math.min(1,d.passive.chance+i*d.passive.chancePerLevel)*100)+'%':'';
  return '<li><strong>Lv.'+lv+(lv===current?'（現在）':'')+'</strong><p>'+common+passive+'</p>'+(SKILL_UPGRADES[id]?.[lv]?'<p>'+SKILL_UPGRADES[id]![lv]+'</p>':'')+'</li>';
 });
 return '<p>強化は累積します。ダメージの連結補正は別枠です。</p><ul class="upgrade-list">'+rows.join('')+'</ul>'+(grows?'<p>Lv.6以降も1レベルごとに基準値の5%分が増加します。</p>':'');
}
