import { ITEMS } from '../data/items';
import { effectiveLevel } from '../skills/SkillBag';
import { actor } from '../actors/Actor';
import { actorDefinition } from '../data/enemies';
import { canStand,occupied,same } from './MapState';
import type { SaveData,Point,Actor } from './types';
export function summonCells(s:SaveData):Point[]{const cells:Point[]=[],p=s.playerState.position;for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const c={x:p.x+x,y:p.y+y};if((x||y)&&canStand(s.mapState,s.playerState,c,[...s.allyStates,...s.enemyStates])&&!s.mapState.objects.some(o=>same(o.position,c))&&!s.mapState.traps?.some(t=>!t.triggered&&same(t.position,c))&&!s.mapState.playerTraps?.some(t=>same(t.position,c))&&!s.mapState.fields.some(f=>same(f.position,c)))cells.push(c);}return cells;}
export function createSpirit(s:SaveData,kind:'sprite'|'greaterSprite',position:Point,level=1):Actor{let id='ally-'+s.playerActionCount+'-'+s.allyStates.length;while(s.allyStates.some(a=>a.id===id))id+='-new';const ally=actor(id,kind,position);ally.remainingLife=actorDefinition(kind).lifetime??30;/* 召喚時だけ基礎能力にレベル倍率を適用。道具召喚はLv1。 */const scale=1+Math.max(0,level-1)*.05;ally.hp=ally.maxHp=Math.floor(ally.maxHp*scale);ally.attack=Math.floor(ally.attack*scale);ally.mp=ally.maxMp=Math.floor((ally.maxMp??0)*scale);ally.remainingLife=Math.floor(ally.remainingLife*scale);ally.detectionRange=7;s.allyStates.push(ally);return ally;}

/** Lv3以降はレア2以上が必要。同じ最低レア階級の道具からランダムに1個消費。 */
// export function summonMedia(s:SaveData):number[]{const minimum=effectiveLevel(s.skillBag,s.skillLevels,'summonSpirit')>=3?2:1;const slots=s.itemSlots.map((id,index)=>({index,rank:ITEMS[id].rareRank})).filter(e=>e.rank>=minimum);const rank=Math.min(...slots.map(e=>e.rank));return slots.filter(e=>e.rank===rank).map(e=>e.index);}
/**
 * 精霊召喚術の媒体候補。
 *
 * Lv1～2:
 *   所持品の中で最も低いレア階級の道具を使う。
 *
 * Lv3以上:
 *   rareRank 2以上の道具が1個でもあれば、
 *   その中で最も低い階級を使う。
 *
 *   rareRank 2以上が1個も無ければ、
 *   rareRank 1の道具へフォールバックする。
 */
export function summonMedia(s: SaveData): number[] {
  const level = effectiveLevel(
    s.skillBag,
    s.skillLevels,
    'summonSpirit'
  );

  const slots = s.itemSlots.map((id, index) => ({
    index,
    rank: ITEMS[id].rareRank
  }));

  if (!slots.length) return [];

  let candidates = slots;

  if (level >= 3) {
    const advanced = slots.filter(e => e.rank >= 2);

    // 中級以上の媒体が存在する場合だけ、そちらを優先する。
    if (advanced.length) {
      candidates = advanced;
    }
  }

  const rank = Math.min(
    ...candidates.map(e => e.rank)
  );

  return candidates
    .filter(e => e.rank === rank)
    .map(e => e.index);
}