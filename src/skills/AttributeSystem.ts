/** 属性の付着・消費・爆破と風散。実ダメージの整数化はGameSession.damageが担当。 */
import type { Actor, Attribute, GameEvent, CrystalSource } from '../game/types';
import { occupied } from '../game/MapState';
/** セッション単位の結晶生成フック。独立した属性計算にもゲーム状態を強制しない。 */
const crystalHandlers=new WeakMap<GameEvent[],(target:Actor,attribute:'ice'|'thunder',source?:CrystalSource)=>void>();
export function bindCrystalReaction(events:GameEvent[],handler:(target:Actor,attribute:'ice'|'thunder',source?:CrystalSource)=>void):void{crystalHandlers.set(events,handler);}
export const ATTRIBUTE_DURATION: Record<Attribute, number> = { fire: 10, ice: 10, thunder: 10, earth: 10, wind: 0, neutral: 0, physical: 0, nature: 10 };
export type DamageHandler = (target: Actor, damage: number, attribute: Attribute, critical?: boolean) => void;
/** 先に融激倍率を適用してから整数化。反応で両属性を消費するため、後続ヒットは通常付着。 */
export function dealAttributeHit(target: Actor, raw: number, attribute: Attribute, action: number, actors: Actor[], damage: DamageHandler, events: GameEvent[], random: () => number, critical = false, allowSwirl = true, source?:CrystalSource): number {
  if (attribute === 'nature') attribute = 'earth';
  const opposite = attribute === 'fire' ? 'ice' : attribute === 'ice' ? 'fire' : null;
  const frostReady=!!target.frostErosion&&!target.frostErosion.spent&&hasFrostAttributes(target);
  const melt = !!opposite && target.afflictions.some(a => a.attribute === opposite);
  const amount = Math.max(0, Math.floor(raw * (melt ? 1.5 + random() * .5 : 1)));
  if (melt) {
    target.afflictions = target.afflictions.filter(a => a.attribute !== 'fire' && a.attribute !== 'ice');
    events.push({ type: 'reaction', position: { ...target.position }, attribute, text: '融激' });
  }
  if(melt)reactionDamage(target,amount,attribute,damage,events,critical,frostReady);else damage(target, amount, attribute, critical);
  if (!melt) applyAttribute(target, attribute, amount, action, actors, damage, events, allowSwirl, random, source);
  syncFrost(target,action,events);
  return amount;
}
export function applyAttribute(target: Actor, attribute: Attribute, hitDamage: number, action: number, enemies: Actor[], damage: DamageHandler, events: GameEvent[], allowSwirl = true, random: () => number = () => 0, source?:CrystalSource): void {
  target.afflictions = target.afflictions.filter(a => a.attribute !== 'wind');
  if (attribute !== 'wind' && !ATTRIBUTE_DURATION[attribute]) return;
  const crystalAttribute=attribute==='thunder'?'ice':attribute==='ice'?'thunder':null;
  if(crystalAttribute&&target.afflictions.some(a=>a.attribute===crystalAttribute)){
    target.afflictions=target.afflictions.filter(a=>a.attribute!=='ice'&&a.attribute!=='thunder');
    events.push({type:'reaction',position:{...target.position},attribute:crystalAttribute,text:crystalAttribute==='ice'?'氷結晶':'雷結晶'});
    crystalHandlers.get(events)?.(target,crystalAttribute,source);syncFrost(target,action,events);return;
  }
  const opposite = attribute === 'fire' ? 'thunder' : attribute === 'thunder' ? 'fire' : null;
  if (opposite && target.afflictions.some(a => a.attribute === opposite)) {
    target.afflictions = target.afflictions.filter(a => a.attribute !== 'fire' && a.attribute !== 'thunder');
    reactionDamage(target,hitDamage*.8,'fire',damage,events);
    events.push({ type: 'reaction', position: { ...target.position }, text: '爆破', attribute: 'fire' });
    syncFrost(target,action,events);
    return;
  }
  const spread = target.afflictions.filter(a => ['fire', 'ice', 'thunder'].includes(a.attribute));
  if (attribute === 'wind' && spread.length && allowSwirl) {
    // 元の炎・氷・雷と残り持続時間は維持し、風は付着させない。
    target.afflictions = target.afflictions.filter(a => a.attribute !== 'wind');
    // 拡散する属性色で風を描く。演出の長さはダメージ判定やターン数に影響しない。
    spread.forEach((element, index) => events.push({ type: 'reaction', position: { ...target.position }, text: index === 0 ? '風散' : undefined, attribute: element.attribute, visual: 'elementalSwirl', durationMs: 1200 }));
    for (const other of enemies) {
      if (other.id === target.id || other.hp <= 0) continue;
      if (!occupied(other).some(c => occupied(target).some(t => Math.max(Math.abs(c.x - t.x), Math.abs(c.y - t.y)) <= 1))) continue;
      for (const spreadElement of spread) {
        const splash = Math.ceil(hitDamage * .2);
        let first=true;
        dealAttributeHit(other,splash,spreadElement.attribute,action,enemies,(t,n,a,crit)=>{if(first){first=false;reactionDamage(t,n,a,damage,events,crit);}else damage(t,n,a,crit);},events,random,false,false,source);
      }
    }
    return;
  }
  // 風は反応だけを起こし、反応しなくても付着しない。
  if (attribute === 'wind') return;
  if (['fire', 'ice', 'thunder'].includes(attribute)) target.afflictions = target.afflictions.filter(a => a.attribute !== 'wind');
  const existing = target.afflictions.find(a => a.attribute === attribute);
  if (existing) { existing.remainingTurns = ATTRIBUTE_DURATION[attribute]; existing.appliedAt = action; }
  else {
    if (target.afflictions.length >= 2) target.afflictions.shift();
    target.afflictions.push({ attribute, remainingTurns: ATTRIBUTE_DURATION[attribute], appliedAt: action });
  }
  syncFrost(target,action,events);
}
export function tickAttributes(actor: Actor, action: number): void {
  actor.afflictions = actor.afflictions.filter(a => { if (a.appliedAt < action) a.remainingTurns--; return a.attribute !== 'wind' && a.remainingTurns > 0; });
  if(!hasFrostAttributes(actor))delete actor.frostErosion;
}

function hasFrostAttributes(a:Actor):boolean{return a.afflictions.some(f=>f.attribute==='ice')&&a.afflictions.some(f=>f.attribute==='earth');}
/** 共存開始時だけ移動を封じる。同じ属性の更新で追加ダメージ権を再装填しない。 */
function syncFrost(a:Actor,action:number,events:GameEvent[]):void{
 if(!hasFrostAttributes(a)){delete a.frostErosion;return;}
 if(a.frostErosion)return;
 a.frostErosion={spent:false,rootUntil:action+(a.kind!=='player'&&a.lastActedAt===action?2:1)};
 events.push({type:'reaction',position:{...a.position},text:'霜蝕',attribute:'ice'});
}
/** 反応の整数ダメージと同量を1度だけ追加。霜蝕ダメージ自体は再反応させない。 */
function reactionDamage(a:Actor,amount:number,attribute:Attribute,damage:DamageHandler,events:GameEvent[],critical=false,eligible=!!a.frostErosion&&!a.frostErosion.spent&&hasFrostAttributes(a)):void{
 const value=Math.max(0,Math.floor(amount));if(eligible&&a.frostErosion)a.frostErosion.spent=true;
 damage(a,value,attribute,critical);
 if(eligible){damage(a,value,'ice');events.push({type:'reaction',position:{...a.position},text:'霜蝕ダメージ',attribute:'ice'});}
}

/** 結晶などの反応攻撃。霜蝕の追撃は最初のダメージだけに適用する。 */
export function dealReactionHit(target:Actor,raw:number,attribute:Attribute,action:number,actors:Actor[],damage:DamageHandler,events:GameEvent[],random:()=>number,source?:CrystalSource):void{
 let first=true;
 dealAttributeHit(target,raw,attribute,action,actors,(a,n,element,critical)=>{if(first){first=false;reactionDamage(a,n,element,damage,events,critical);}else damage(a,n,element,critical);},events,random,false,true,source);
}
