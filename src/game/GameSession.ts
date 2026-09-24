import { contactBossFire, startBoss, actKing, tickBanners, kingPhases, isGoblin, KING_RULES } from './BossEncounter';
import { targetableCrystals } from './CrystalTargets';
import { startThunderPrison, tickThunderPrisons } from '../skills/ThunderPrison';
import { afterSwirlCrystals, createCrystal, crystalSource, hitCrystalsAt, tickCrystals } from './CrystalSystem';
import { bindAttributeBatch, bindCrystalReaction, bindSwirlReaction, reactionLabel } from '../skills/AttributeSystem';
import { icePillarCells, placeIcePillars } from '../skills/IcePillar';
import { initializeBooks, rollBookAttributes } from './SkillBooks';
import {castFieldSkill,contactSkillFields,tickSkillFields} from '../skills/FieldSkills';
import { INSTALLATIONS } from '../data/installations';
import { summonCells,createSpirit,summonMedia } from './Summoning';
import { skillPool } from '../data/loot';
import { itemCapacity } from './Inventory';
import { passiveChance, passiveDamageScale } from '../skills/PassiveSkills';
import { canRollSkill, rollSkillBySize } from '../skills/SkillLoot';
import { resolveChestSkills } from './LootSystem';
import { hitInstallation, moveNearInstallations, tickInstallations } from './InstallationSystem';
import { applyBuff } from './ActorStats';
import { vacuumDestinations, chainHitLimit, nextChainTarget, chainOrigin } from '../skills/SkillResolver';
import { PROGRESSION, requiredExperience, expandBag } from './Progression';
import { blockCells, initialBagCells } from '../skills/SkillBag';
/** 1プレイの進行役。コマンドを処理し、描画用イベントと保存可能な状態を生成します。 */
import { actor, createPlayer } from '../actors/Actor';
import { actSummon } from '../ai/SummonAI';
import { attackPower, criticalChance, movementLocked, detection } from './ActorStats';
import { DAY_CYCLE, timeOfDay, reaperRules, sleepHpRatio } from './DayCycle';
import { actEnemy } from '../ai/EnemyAI';
import { actorDefinition } from '../data/enemies';
import { ENEMY_SKILLS, canonicalEnemySkillId } from '../data/enemySkills';
import { CHESTS } from '../data/loot';
import { makeChest, weighted, floorLoot, legacyLoot, rollDrops } from './LootSystem';
import { triggerPlayerTraps } from './TrapSystem';
import { tryEnemySkill, enemyActionCount } from '../skills/EnemySkillResolver';
import { ITEMS } from '../data/items';
import { GEM_REWARDS } from '../data/gems';
import { skillMp, wearSkill } from '../skills/SkillWear';
import { SKILLS } from '../data/skills';
import { dealAttributeHit } from '../skills/AttributeSystem';
import { autoPlace, connectionDamageMultiplier, effectiveLevel } from '../skills/SkillBag';
import { previewSkill, validSkillTarget } from '../skills/SkillResolver';
import { floorRules, stageForFloor } from '../stages/DungeonRules';
import { STAGES } from '../stages';
import type { Command } from './Command';
import { canStand, generateMap, occupied, same, wall } from './MapState';
import { Random } from './Random';
import { endTurn } from './TurnManager';
import { VECTORS, type Actor, type Attribute, type GameEvent, type ItemId, type Point, type SaveData, type SkillId, type TurnFrame } from './types';
export class GameSession {
  events: GameEvent[] = [];
  frames: TurnFrame[] = [];
  private frameEventStart = 0;
  rng: Random;
  private groupingDamage = false;
  constructor(public state: SaveData) {
    this.rng = new Random(state.randomSeed);
    initializeBooks(state.mapState,this.rng);
    state.pendingBookAttributes ??= [];
    while(state.pendingBookAttributes.length<(state.pendingSkillBooks??0))state.pendingBookAttributes.push(rollBookAttributes(this.rng));
    state.randomSeed=this.rng.seed;
    // 旧仕様の持続竜巻はロード時に撤去する。
    state.mapState.fields=state.mapState.fields.filter(f=>f.skillKind!=='tornadoSummon');
    state.bookFragments ??= 0;
    state.playerLevel ??= 1; state.experience = Math.ceil(state.experience ?? 0); state.bagCells ??= initialBagCells(5);
    for (const list of [state.enemyStates, state.defeatedEnemies ?? []]) for (const a of list) {
      if ((a.kind as string) === 'boss' || a.kind === 'golem' && a.name === '守護岩') {
        const replacement = actor(a.id, 'golem', a.position, state.stageId, state.floorNumber ?? 1);
        Object.assign(a, replacement, { hp: a.hp <= 0 ? 0 : Math.min(a.hp, replacement.maxHp) });
      }
    }
    state.reinforcementKinds ??= [...new Set(state.enemyStates.map(e=>e.kind))].filter(k=>k!=='player'&&k!=='sprite'&&k!=='greaterSprite'&&k!=='reaper');
    state.allyStates.forEach(a=>{a.remainingLife ??= actorDefinition(a.kind).lifetime ?? 30;});
    state.floorNumber ??= 1; state.floorCount = Math.max(state.floorNumber, this.stage.dungeon?.floors ?? 1); state.nightRevived ??= (state.daylightCount ?? 0) >= 100 ? floorRules(this.stage).nightRevival.min : 0;
    // 旧セーブは過去のスキル使用回数を復元できないため回復カウントを0から開始。
    // 旧セーブの固定ダメージ罠も新しい経過ターン方式へ移行。
    for (const trap of state.mapState.playerTraps ?? []) {
      trap.sourceSkillId ??= 'groundbreak';
      if (trap.placedAt === undefined) { const oldTurn = Number(trap.id.replace('groundbreak-', '')); trap.placedAt = Number.isInteger(oldTurn) && oldTurn >= 0 ? Math.min(oldTurn, state.playerActionCount) : state.playerActionCount; trap.damage = attackPower(state.playerState); }
    }
    state.mapState.playerTraps = (state.mapState.playerTraps ?? []).filter(t => !!state.skillLevels[t.sourceSkillId!]);
    state.floorKills ??= Object.fromEntries(Object.entries((state.defeatedEnemies ?? []).reduce<Record<string, number>>((counts, e) => { counts[e.kind] = (counts[e.kind] ?? 0) + 1; return counts; }, {})));
    state.mapState.objects = state.mapState.objects.filter(o => !(o.objective && o.opened)).map(o => o.objective ? { id: o.id, type: 'record' as const, position: o.position } : o);
    state.dayCount ??= 1; state.killCombo ??= 0; state.fatigue ??= 0;
    state.mpRecoveryActions ??= 0; state.daylightCount ??= 0; state.defeatedEnemies ??= []; state.skillWear ??= {}; state.pendingGemChoices ??= []; state.mapState.playerTraps ??= []; state.playerState.visionBonus ??= state.playerState.freeCamera ? 2 : 0;
    // 旧セーブで朝まで残っていた死神も補正し、通常の復活候補には入れない。
    if(timeOfDay(state)!=='night')state.enemyStates=state.enemyStates.filter(e=>e.kind!=='reaper');
    state.defeatedEnemies=state.defeatedEnemies.filter(e=>e.kind!=='reaper'&&e.kind!=='goblinKing');
    state.reinforcementKinds=state.reinforcementKinds?.filter(k=>k!=='reaper'&&k!=='goblinKing');
    // Older saves remain playable; existing hostile enemies do not alert again.
    for (const a of this.actors) {
      a.facing ??= 'down'; a.alertedAt ??= -1; a.hp = Math.floor(a.hp);
      if (a.kind === 'wolf') a.cells = [{ x: 0, y: 0 }];
      // 旧セーブにMPがない場合のみ初期値を補完。消費済みの0は維持します。
      const loadout = actorDefinition(a.kind);
      a.mp ??= loadout.mp; a.maxMp ??= loadout.mp; a.enemySkillIds ??= [...loadout.skills];
      a.enemySkillIds = a.enemySkillIds.map(canonicalEnemySkillId);
      a.criticalRate ??= loadout.criticalRate; a.criticalMultiplier ??= loadout.criticalMultiplier;
      a.immobile ??= loadout.immobile; a.skillChances ??= { ...loadout.skillChances }; a.buffs ??= [];
      if (a.attribute === 'nature') a.attribute = 'earth';
      a.afflictions = a.afflictions.filter(f => f.attribute !== 'wind');
      for (const f of a.afflictions) if (f.attribute === 'nature') f.attribute = 'earth';
      // 旧セーブの連続停止タイマーは破棄し、新しいスキップ状態だけを利用。
      const legacy = a as typeof a & { disengageTurns?: number; disengageLeft?: number };
      delete legacy.disengageTurns; delete legacy.disengageLeft;
    }
    const startChest = state.mapState.objects.find(o => o.id === 'start-attack' && !o.opened);
    if (startChest && !startChest.contents) startChest.skillIds = [...new Set([...(startChest.skillIds ?? []), 'warp' as const])];
    state.mapState.traps ??= []; state.mapState.loot ??= this.stage.loot;
    for (const chest of state.mapState.objects.filter(o => o.type === 'chest')) {
      chest.contents ??= legacyLoot(chest);
      chest.chestTier ??= chest.contents.filter(e => e.type === 'skill').length >= 2 ? 'gold' : chest.contents.some(e => e.type === 'skill') ? 'silver' : 'wood';
    }
    for (const f of state.mapState.fields) if (f.attribute === 'nature') f.attribute = 'earth';
    state.log = state.log.slice(-100);
    state.mapState.crystals??=[];this.prepareCrystalReactions();
  }
  private prepareCrystalReactions():void{
    bindAttributeBatch(this.events,resolve=>{
      if(this.groupingDamage)return resolve();
      const start=this.events.length;this.groupingDamage=true;
      try{return resolve();}finally{this.groupingDamage=false;if(this.events.slice(start).some(e=>e.type==='damage'))this.logHits('攻撃',start);}
    });
    bindCrystalReaction(this.events,(target,attribute,source)=>createCrystal(this.state,target,attribute,source??crystalSource(this.state,this.state.playerState),{rng:this.rng,events:this.events,damage:this.damage,log:m=>this.log(m)}));
    bindSwirlReaction(this.events,(target,resolve)=>{
      const context={rng:this.rng,events:this.events,damage:this.damage,log:(m:string)=>this.log(m)};
      const near=(p:Point)=>occupied(target).some(t=>Math.max(Math.abs(p.x-t.x),Math.abs(p.y-t.y))<=1);
      const objects=(this.state.mapState.installations??[]).filter(i=>near(i.position));
      const crystals=targetableCrystals(this.state.mapState,this.state.playerActionCount).filter(i=>near(i.position));
      afterSwirlCrystals(this.state,context,()=>{
        resolve();
        for(const object of objects)hitInstallation(this.state,object.id,context);
        hitCrystalsAt(this.state,crystals.map(c=>c.position),context);
      });
    });
  }
  private capture(phase: TurnFrame['phase']): void {
    this.frames.push({ phase, actors: structuredClone(this.actors), events: structuredClone(this.events.slice(this.frameEventStart)) });
    this.frameEventStart = this.events.length;
  }
  static create(stageId: number, seed: number): GameSession {
    const stage = STAGES.find(s => s.id === stageId)!;
    const rng = new Random(seed); const floorCount = stage.dungeon?.floors ?? 1; const { map, enemies, spawn } = generateMap(stage, rng);
    const player = createPlayer();
    if (stage.initialPlayerMp !== undefined) player.maxMp = player.mp = Math.max(0, Math.floor(stage.initialPlayerMp));
    const session = new GameSession({ version: 1, stageId, playerLevel: 1, experience: 0, bagCells: initialBagCells(stage.initialBagSize ?? 4), floorNumber: 1, floorCount, nightRevived: 0, initialSeed: seed, randomSeed: rng.seed, mapState: map, playerState: player, enemyStates: enemies, allyStates: [], skillBag: [], skillLevels: {}, cooldowns: {}, itemSlots: [], exploredMap: new Array(map.width * map.height).fill(false), turnCount: 0, playerActionCount: 0, status: 'playing', objectiveChests: 0, pendingBag: false, log: ['目の前の宝箱へ進み、斬撃を手に入れよう。'] });
    session.state.playerState.position = { ...spawn };
    if (stage.initialSkillLevels) {
      for (const [id, level] of Object.entries(stage.initialSkillLevels) as [SkillId, number][]) {
        if (!(id in SKILLS) || !Number.isInteger(level) || level < 1) continue;
        session.state.skillLevels[id] = level;
        session.state.skillBag.push({ skillId: id, position: null, rotation: 0, isNew: false });
        autoPlace(session.state.skillBag, id, session.state.bagCells);
      }
    }
    session.state.log = []; session.explore(); return session;
  }
  get stage() { return stageForFloor(STAGES.find(s => s.id === this.state.stageId)!, this.state.floorNumber ?? 1); }
  get actors() { return [this.state.playerState, ...this.state.allyStates, ...this.state.enemyStates]; }
  get vision() { return (timeOfDay(this.state) === 'night' ? Math.min((this.state.daylightCount ?? 0) >= DAY_CYCLE.midnight ? 3 : 4, this.stage.vision) : this.stage.vision) + (this.state.playerState.visionBonus ?? 0); }
  visible(p: Point): boolean {
    const pos = this.state.playerState.position;
    return Math.max(Math.abs(p.x - pos.x), Math.abs(p.y - pos.y)) <= this.vision;
  }
  explore(): void { const map = this.state.mapState; for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (this.visible({ x, y })) this.state.exploredMap[y * map.width + x] = true; }
  log(message: string): void { this.state.log.push(message); this.state.log = this.state.log.slice(-100); this.onLog?.(message); }
  onLog?: (message: string) => void;
  isOnScreen?: (point: Point) => boolean;
  private inPlayerScreen(point: Point): boolean { return this.visible(point) && (this.isOnScreen?.(point) ?? Math.max(Math.abs(point.x - this.state.playerState.position.x), Math.abs(point.y - this.state.playerState.position.y)) <= 5); }
  damage = (target: Actor, amount: number, attribute: Attribute, critical = false, attacker: Actor | null = this.state.playerState): void => {
    hitCrystalsAt(this.state,occupied(target),{rng:this.rng,events:this.events,damage:this.damage,log:m=>this.log(m)});
    // All damage paths (including reactions and fields) truncate only at this boundary.
    const value = Math.max(0, Math.floor(amount));
    target.hp = Math.max(0, Math.floor(target.hp) - value);
    // 命中自体を敵視のきっかけにする（切り捨てで0ダメージでも反応）。
    // 索敵外からの攻撃や、追跡疲労によるスキップ中の攻撃にも対応します。
    if (attacker && target.hp > 0 && this.state.enemyStates.some(e => e.id === target.id) && (attacker.id === this.state.playerState.id || this.state.allyStates.some(a => a.id === attacker.id))) {
      if (target.mode !== 'hostile') target.alertedAt = this.state.playerActionCount;
      target.mode = 'hostile'; target.lastSeen = { ...attacker.position };
      target.pursuitLeft = target.pursuitTurns; target.chaseMoves = 0; target.chaseSkipLeft = 0;
    }
    const cells = occupied(target), position = { x: cells.reduce((n, c) => n + c.x, 0) / cells.length, y: cells.reduce((n, c) => n + c.y, 0) / cells.length };
    const reaction = reactionLabel(this.events);
    this.events.push({ type: 'damage', position, actorId: target.id, amount: value, attribute, critical, reaction });
    if (!this.groupingDamage) this.log(`${target.name}に${critical ? '会心' : ''}${value}${reaction==='融撃'?'の融撃ダメージ':'ダメージ'}！`);
    // 追加雷撃は物理ではないため再帰発動しない。反応は通常の属性処理へ渡す。
    const activeArmor=attacker?.buffs?.find(b=>b.remainingTurns>0&&(b.thunderFollowup||b.iceFollowup));
    const followup=activeArmor?.thunderFollowup??activeArmor?.iceFollowup;
    const followupAttribute=activeArmor?.iceFollowup?'ice':'thunder';
    if(attribute==='physical'&&value>0&&target.hp>0&&followup&&this.rng.next()<followup.chance){
      this.events.push({type:'reaction',actorId:target.id,position:{...target.position},attribute:followupAttribute,text:followupAttribute==='ice'?'氷装':'雷装',sound:followupAttribute==='ice'?'ice':'magicCast'});
      dealAttributeHit(target,Math.floor(value*followup.ratio),followupAttribute,this.state.playerActionCount,this.actors,(t,n,a,crit)=>this.damage(t,n,a,crit,attacker),this.events,()=>this.rng.next(),false,true,attacker?crystalSource(this.state,attacker):undefined);
    }
  };
  /** 一つの行動による各ヒット・反応を対象別に集計して、読みやすい一件のログにする。 */
  private logHits(label: string, start: number, multi = false): void {
    const hits = this.events.slice(start).filter(e => e.type === 'damage');
    const groups = new Map<string, { name: string; sum: number; count: number; critical: boolean; melt: boolean }>();
    for (const hit of hits) {
      const id = hit.actorId!; const g = groups.get(id) ?? { name: this.actors.find(a => a.id === id)?.name ?? '対象', sum: 0, count: 0, critical: false, melt: false };
      g.sum += hit.amount ?? 0; g.count++; g.critical ||= !!hit.critical; g.melt ||= hit.reaction==='融撃'; groups.set(id, g);
    }
    this.log(label + '！ ' + (groups.size ? [...groups.values()].map(g => g.name + 'に' + (multi || g.count > 1 ? '合計' : '') + (g.critical ? '会心' : '') + g.sum + (g.count===1&&g.melt?'の融撃ダメージ！':'のダメージ！')).join(' ') : '対象なし'));
  }
  private strike(a: Actor, b: Actor, raw = attackPower(a), attribute = a.attribute, label = '攻撃'): void {
    const shield=b.id===this.state.playerState.id && this.state.enemyStates.some(e=>e.id===a.id) && occupied(a).some(c=>occupied(b).some(p=>Math.max(Math.abs(c.x-p.x),Math.abs(c.y-p.y))<=1)) && !this.canCast('iceShield',true) && this.rng.next()<passiveChance(this.state,'iceShield');
    if(shield){const s=this.state;s.playerState.mp-=skillMp(s,'iceShield');s.cooldowns.iceShield=SKILLS.iceShield.cooldown;(s.passiveTriggeredAt??={}).iceShield=s.playerActionCount;if(wearSkill(s,'iceShield',this.rng))this.log('アイスシールドが劣化し、次回からの消費MPが増えた。');raw*=SKILLS.iceShield.passive!.reduction;}
    const start = this.events.length, critical = this.rng.next() < criticalChance(a, b, attribute);
    this.groupingDamage = true;
    try { dealAttributeHit(b, raw * (critical ? a.criticalMultiplier ?? 1.5 : 1), attribute, this.state.playerActionCount, this.state.allyStates.some(ally=>ally.id===a.id) ? this.state.enemyStates : [this.state.playerState, ...this.state.allyStates], (t, n, attr, crit) => this.damage(t, n, attr, crit, a), this.events, () => this.rng.next(), critical,true,crystalSource(this.state,a)); }
    finally { this.groupingDamage = false; }
    this.logHits(a.name + 'の' + label, start);
    if(shield && b.hp>0)this.releaseIceShield();
  }
  /** 反撃は敵の一撃を解決した後。再帰的な敵の攻撃扱いにはしない。 */
  private releaseIceShield():void{
    const s=this.state,p=s.playerState,start=this.events.length;
    const cells:Point[]=[];for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const c={x:p.position.x+x,y:p.position.y+y};if((x||y)&&!wall(s.mapState,c))cells.push(c);}
    this.events.push({type:'trap',position:{...p.position},path:cells,visual:'iceShield',sound:'ice',durationMs:550});
    this.groupingDamage=true;
    for(const e of s.enemyStates)if(e.hp>0&&occupied(e).some(c=>cells.some(t=>same(c,t))))dealAttributeHit(e,attackPower(p)*passiveDamageScale(s,'iceShield'),'ice',s.playerActionCount,s.enemyStates,this.damage,this.events,()=>this.rng.next());
    for(const i of [...s.mapState.installations??[],...targetableCrystals(s.mapState,s.playerActionCount)])if(cells.some(c=>same(c,i.position)))hitInstallation(s,i.id,{rng:this.rng,events:this.events,damage:this.damage,log:m=>this.log(m)});
    this.groupingDamage=false;this.logHits('アイスシールド',start);
  }
  /** スキル喪失時の後始末を集約。今後の設置効果も生成元IDで撤去できる。 */
  loseSkill(id: SkillId): void {
    const s = this.state;
    if(s.skillBag.some(b=>b.skillId===id)){const count=s.skillLevels[id]??1;s.bookFragments=(s.bookFragments??0)+count;this.log('魔導書の切れ端を'+count+'枚獲得！（所持'+s.bookFragments+'枚）');}
    if(id==='thunderPrison')s.mapState.thunderPrisons=[];
    delete s.skillLevels[id]; delete s.cooldowns[id]; delete s.skillWear?.[id];
    s.skillBag = s.skillBag.filter(b => b.skillId !== id);
    s.mapState.playerTraps = (s.mapState.playerTraps ?? []).filter(t => t.sourceSkillId !== id);
    s.mapState.fields = s.mapState.fields.filter(f => f.sourceSkillId !== id);
    s.mapState.installations=s.mapState.installations?.filter(i=>i.sourceSkillId!==id);
  }
  acquireSkill(id: SkillId): void {
    this.state.skillWear![id] ??= { uses: 0, extraMp: 0 };
    if (this.state.skillLevels[id]) { this.state.skillLevels[id]!++; this.log(`${SKILLS[id].name}の基礎レベルが${this.state.skillLevels[id]}に！`); }
    else { this.state.skillLevels[id] = 1; this.state.skillBag.unshift({ skillId: id, position: null, rotation: 0, isNew: true }); autoPlace(this.state.skillBag, id, this.state.bagCells); this.log(`${SKILLS[id].name}を手に入れた。`); this.state.pendingBag = true; }
  }
  /** バッグを隙間なく埋めた報酬。配置できる床がない場合は次回へ持ち越す。 */
  rewardFullBag(): void {
    const s = this.state, p = s.playerState.position;
    if (s.fullBagRewardClaimed || s.status !== 'playing') return;
    const filled = new Set(s.skillBag.flatMap(blockCells).map(c => c.x + ',' + c.y));
    if (!s.bagCells?.every(c => filled.has(c.x + ',' + c.y))) return;
    // 壁越しではなく、旅人から歩いて届く付近の床を探す。
    const queue = [{ ...p }], seen = new Set([p.x + ',' + p.y]), candidates: Point[] = [];
    for (let i = 0; i < queue.length && i < 81; i++) for (const v of Object.values(VECTORS)) {
      const c = { x: queue[i].x + v.x, y: queue[i].y + v.y }, key = c.x + ',' + c.y;
      if (seen.has(key) || Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) > 4 || wall(s.mapState, c)) continue;
      seen.add(key); queue.push(c);
      if (!s.mapState.objects.some(o => same(o.position, c)) && !s.mapState.installations?.some(i=>same(i.position,c)) && !this.actors.some(a => occupied(a).some(t => same(t, c))) && !s.mapState.traps?.some(t => same(t.position, c)) && !s.mapState.playerTraps?.some(t => same(t.position, c)) && !s.mapState.fields.some(t => same(t.position, c))) candidates.push(c);
    }
    if (!candidates.length) return;
    candidates.sort((a,b) => Math.abs(a.x-p.x)+Math.abs(a.y-p.y)-Math.abs(b.x-p.x)-Math.abs(b.y-p.y));
    const tier = weighted([{value:'iron' as const,weight:6},{value:'silver' as const,weight:3},{value:'gold' as const,weight:1}], this.rng);
    s.mapState.objects.push(makeChest('full-bag-' + s.floorNumber, candidates[0], tier, this.rng, [], s.floorNumber, s.mapState.loot));
    s.fullBagRewardClaimed = true; s.randomSeed = this.rng.seed;
    this.log('バッグをぴったり埋めた！ 近くに' + CHESTS[tier].name + 'が出現！');
  }
  /** 捨てた道具はそのマスから離れるまで自動取得しない。ターンは消費しない。 */
  dropItem(slot: number): boolean {
    const s = this.state, id = s.itemSlots[slot]; if (!id || s.status !== 'playing') return false;
    s.itemSlots.splice(slot, 1);
    this.log(ITEMS[id].name + 'を捨てた。'); return true;
  }
  collect(): void {
    const s = this.state;
    for (const obj of [...s.mapState.objects]) {
      if (obj.waitForLeave) { if (same(obj.position, s.playerState.position)) continue; obj.waitForLeave = false; }
      if (!same(obj.position, s.playerState.position) || obj.opened || obj.type === 'exit') continue;
      if(obj.type==='skillBook'){
        s.pendingSkillBooks=(s.pendingSkillBooks??0)+1;(s.pendingBookAttributes??=[]).push(obj.bookAttributes??rollBookAttributes(this.rng));s.mapState.objects=s.mapState.objects.filter(o=>o.id!==obj.id);this.log('魔導書を手に入れた！');this.events.push({type:'pickup',position:{...obj.position},sound:'magicCast'});
      } else if (obj.type === 'record') {
        s.objectiveChests++; s.mapState.objects = s.mapState.objects.filter(o => o.id !== obj.id);
        this.log('古代の記録を手に入れた！');
        this.events.push({ type: 'pickup', position: { ...obj.position }, sound: 'ancientRecord' });
      } else if (obj.type === 'gem') {
        const pool = Object.keys(GEM_REWARDS).filter(id=>{const e=GEM_REWARDS[id].effect;return e.type!=='skill'||Object.values(SKILLS).some(d=>d.attribute===e.attribute&&canRollSkill(s,d.id));}), choices: string[] = [];
        while (choices.length < 3 && pool.length) choices.push(pool.splice(this.rng.int(0, pool.length - 1), 1)[0]);
        s.pendingGemChoices!.push(choices); s.mapState.objects = s.mapState.objects.filter(o => o.id !== obj.id);
        this.events.push({ type: 'pickup', position: { ...obj.position }, sound: 'treasure' }); this.log('強化の宝石を手に入れた！');
      } else if (obj.type === 'chest') {
        resolveChestSkills(s,obj,this.rng);
        obj.opened = true;
        this.events.push({ type: 'pickup', position: { ...obj.position } });
        this.log(`${CHESTS[obj.chestTier ?? 'wood'].name}を開いた。`);
        for (const loot of obj.contents ?? legacyLoot(obj)) {
          if (loot.type === 'skill') this.acquireSkill(loot.id);
          else this.receiveItem(loot.id, obj.position);
        }
      } else if (obj.type === 'skill') { s.mapState.objects = s.mapState.objects.filter(o => o.id !== obj.id); this.acquireSkill(obj.skillId!); }
      else if (obj.itemId === 'scope') { this.gainVision(); s.mapState.objects = s.mapState.objects.filter(o => o.id !== obj.id); }
      else if (obj.itemId && s.itemSlots.length < itemCapacity(s)) { s.itemSlots.push(obj.itemId); s.mapState.objects = s.mapState.objects.filter(o => o.id !== obj.id); this.log(`${ITEMS[obj.itemId].name}を拾った。`); }
      else if (!obj.fullNotified) { obj.fullNotified = true; this.log('道具枠がいっぱい。道具は床に残ります。'); }
    }
  }
  /** 書は出現表と所持最大ブロック数+1で候補を制限。属性ボタンと実際の抽選で同じ候補を使う。 */
  bookSkills(attribute:Attribute){return (this.state.mapState.loot?.skills??skillPool).filter(e=>e.weight>0&&SKILLS[e.value].attribute===attribute&&canRollSkill(this.state,e.value));}
  returnBook():void{const s=this.state;if(!s.pendingSkillBooks)return;const bookAttributes=s.pendingBookAttributes?.shift();s.pendingSkillBooks--;let id='returned-book-'+s.playerActionCount;while(s.mapState.objects.some(o=>o.id===id))id+='-new';s.mapState.objects.push({id,type:'skillBook',bookAttributes,position:{...s.playerState.position},waitForLeave:true});this.log('魔導書を足元に戻した。');}
  /** 切れ端はダンジョン内で保持。生成時に候補を固定し、抽選し直しを防ぐ。 */
  useBookFragments():boolean{
    const s=this.state;if((s.bookFragments??0)<3||s.pendingSkillBooks||s.pendingGemChoices?.length||s.pendingBag||s.status!=='playing')return false;
    s.bookFragments!-=3;s.pendingSkillBooks=1;(s.pendingBookAttributes??=[]).push(rollBookAttributes(this.rng));
    s.randomSeed=this.rng.seed;this.log('魔導書の切れ端3枚から魔導書を復元した！');return true;
  }
  chooseBook(attribute:Attribute):boolean{
    const s=this.state,pool=this.bookSkills(attribute);if(!s.pendingSkillBooks||!s.pendingBookAttributes?.[0]?.includes(attribute)||!pool.length||s.status!=='playing')return false;
    const id=rollSkillBySize(s,pool,this.rng);if(!id)return false;
    s.pendingSkillBooks--;s.pendingBookAttributes!.shift();this.acquireSkill(id);s.randomSeed=this.rng.seed;return true;
  }
  chooseGem(index: number): boolean {
    const s = this.state, id = s.pendingGemChoices?.[0]?.[index], reward = id && GEM_REWARDS[id];
    if (!reward || s.status !== 'playing') return false;
    const e = reward.effect, p = s.playerState;
    if (e.type === 'skill') { const pool = Object.values(SKILLS).filter(d => d.attribute === e.attribute && canRollSkill(s,d.id)); if (!pool.length) return false; this.acquireSkill(pool[this.rng.int(0, pool.length - 1)].id); }
    else if (e.type === 'hp') { p.maxHp += e.amount; p.hp += e.amount; }
    else if (e.type === 'mp') { p.maxMp += e.amount; p.mp += e.amount; }
    else if (e.type === 'criticalRate') p.criticalRate = Math.min(1, p.criticalRate + e.amount);
    else p.criticalMultiplier += e.amount;
    s.pendingGemChoices!.shift(); this.log('宝石の力！ ' + reward.name); s.randomSeed = this.rng.seed; return true;
  }
  gainVision(): void { const p = this.state.playerState; p.freeCamera = true; p.visionBonus = (p.visionBonus ?? 0) + 2; this.explore(); this.log('千里眼薬（小）！ 視野がさらに2マス広がった。'); }
  receiveItem(id: ItemId, p: Point): void {
    if (id === 'scope') { this.gainVision(); return; }
    if (this.state.itemSlots.length < itemCapacity(this.state)) { this.state.itemSlots.push(id); this.log(`${ITEMS[id].name}を拾った。`); }
    else { this.state.mapState.objects.push({ id: `floor-${this.state.playerActionCount}-${this.state.mapState.objects.length}`, type: 'item', fullNotified: true, position: { ...p }, itemId: id }); this.log('道具枠がいっぱい。宝箱の道具を床に置いた。'); }
  }
  useItem(slot: number, skillId?: SkillId): boolean {
    const s = this.state, p = s.playerState, id = s.itemSlots[slot]; if (!id) return false;
    const cellLimit=ITEMS[id].skillCellLimit;
    if(cellLimit!==undefined){
      if(!skillId||!s.skillBag.some(b=>b.skillId===skillId)||!s.skillLevels[skillId]||SKILLS[skillId].cells.length>cellLimit){this.log(cellLimit+'マス以下の所持スキルを選んでください。');return false;}
      s.skillLevels[skillId]++;this.log(SKILLS[skillId].name+'がLv.'+s.skillLevels[skillId]+'に上がった！');
      this.events.push({type:'heal',position:{...p.position},text:'スキルLv.UP',sound:'magicCast'});
    }
    if (id === 'powerPotion') { applyBuff(p,{id:'item:powerPotion',attackBonus:5,attackMultiplier:1,detectionBonus:0,remainingTurns:10,appliedAt:s.playerActionCount});this.events.push({type:'heal',position:{...p.position},text:'攻撃力+5',sound:'healing'}); }
    if (id === 'hourglass') { if (!skillId || !s.skillLevels[skillId] || !(s.cooldowns[skillId]! > 0)) { this.log('再使用待ちのスキルを選んでください。'); return false; } s.cooldowns[skillId] = Math.max(0, s.cooldowns[skillId]! - 10); this.log(SKILLS[skillId].name + 'のクールタイムを短縮！'); }
    if (ITEMS[id].restoreHp && p.hp >= p.maxHp || ITEMS[id].restoreMp && p.mp >= p.maxMp) { this.log('今は使う必要がありません。'); return false; }
    if (ITEMS[id].restoreHp) { p.hp = Math.min(p.maxHp, p.hp + ITEMS[id].restoreHp!); this.events.push({ type: 'heal', position: { ...p.position }, text: '+HP' }); }
    if (ITEMS[id].restoreMp) p.mp = Math.min(p.maxMp, p.mp + ITEMS[id].restoreMp!);
    if (id === 'scope') this.gainVision();
    if (id === 'summon') {
      let id = `ally-${s.playerActionCount}-${s.allyStates.length}`; while (this.actors.some(a => a.id === id)) id += '-new';
      const ally = actor(id, 'sprite', { ...p.position }); ally.remainingLife=actorDefinition('sprite').lifetime ?? 30;
      const point = Object.values(VECTORS).map(v => ({ x: p.position.x + v.x, y: p.position.y + v.y })).find(pos => canStand(s.mapState, ally, pos, this.actors));
      if (!point) { this.log('精霊が現れる空きマスがありません。'); return false; }
      ally.position = point; ally.detectionRange = 7; ally.pattern = 'patrol'; s.allyStates.push(ally);
    }
    s.itemSlots.splice(slot, 1); this.log(`${ITEMS[id].name}を使った。`); return true;
  }
  canCast(id: SkillId, automatic = false): string | null {
    if(SKILLS[id].kind==='passive'&&!automatic)return '攻撃を受けたときに自動発動';
    if(id==='summonSpirit'){
      if(!summonMedia(this.state).length)
        return '召喚の媒体にする道具がありません。';
      if(!summonCells(this.state).length)
        return '周囲に精霊が現れる空きマスがありません。';
    }
    if(id==='icePillar'&&!(['up','right','down','left'] as const).some(direction=>icePillarCells(this.state,direction,this.rng).length>0))return '周囲十字に空きマスが必要です。';
    if(id==='fireWall'&&!previewSkill(this.state,id,this.state.playerState.facing).cells.length)return '前方が壁で設置できません。';
    if(id==='tornadoSummon'&&!previewSkill(this.state,id,this.state.playerState.facing).cells.length)return '竜巻が移動できるマスがありません。';
    if (id === 'groundbreak') {
      const map = this.state.mapState, pos = this.state.playerState.position;
      if ((map.playerTraps?.length ?? 0) >= 2) return '地砕きは同時に2個までです。';
      if (map.objects.some(o => same(o.position, pos)) || map.fields.some(f => same(f.position, pos)) || map.traps?.some(t => !t.triggered && same(t.position, pos)) || map.playerTraps?.some(t => same(t.position, pos))) return '足元に物や罠があるため設置できません。';
    }
    if ((id === 'warp' || id === 'vacuumSlash') && movementLocked(this.state.playerState,this.state.playerActionCount)) return '移動不可のため移動できません。';
    if (id === 'warp' && !previewSkill(this.state, id, this.state.playerState.facing).cells.length) return 'ワープ先の空きマスがありません。';
    if (!this.state.skillBag.some(b => b.skillId === id && b.position)) return 'バッグに配置されていません。';
    if ((this.state.cooldowns[id] ?? 0) > 0) return `あと${this.state.cooldowns[id]}行動で使用できます。`;
    if (this.state.playerState.mp < skillMp(this.state, id)) return 'MPが足りません。';
    return null;
  }
  cast(id: SkillId, direction: keyof typeof VECTORS, aim?: Point): void {
    this.prepareCrystalReactions();
    const s = this.state, p = s.playerState, def = SKILLS[id]; p.facing = direction; p.mp -= skillMp(s, id); s.cooldowns[id] = def.cooldown;
    if (wearSkill(s, id, this.rng)) this.log(def.name + 'が劣化し、次回からの消費MPが増えた。');
    const fieldStart=this.events.length;this.groupingDamage=true;
    const fieldCast=castFieldSkill(s,id,direction,{rng:this.rng,events:this.events,damage:this.damage,log:m=>this.log(m)},aim);this.groupingDamage=false;
    if(fieldCast){if(this.events.slice(fieldStart).some(e=>e.type==='damage'))this.logHits(def.name,fieldStart);else this.log(def.name+'を発動！');return;}
    if(id==='thunderPrison'){startThunderPrison(s,{rng:this.rng,events:this.events,damage:this.damage,log:m=>this.log(m)});return;}
    if(id==='icePillar'){
      const cells=placeIcePillars(s,direction,this.rng,aim);
      for(const position of cells)this.events.push({type:'trap',position,visual:'iceLance',sound:'magicCast',durationMs:450});
      this.log('アイス・ピラー！ 氷柱を'+cells.length+'本設置した。');return;
    }
    if(id==='thunderArmor'){
      const level=effectiveLevel(s.skillBag,s.skillLevels,id),chance=level>=5?1:level>=3?.7:.5,turns=level>=5?10:level>=3?8:7;
      applyBuff(p,{id:'skill:thunderArmor',name:'雷装',appliedAt:s.playerActionCount,remainingTurns:turns,attackMultiplier:1,detectionBonus:0,thunderFollowup:{chance,ratio:.3*(1+(level-1)*.05)}});
      this.events.push({type:'trap',position:{...p.position},visual:'summonRing',sound:'magicCast',attribute:'thunder'});this.log('雷装！ '+turns+'ターン雷をまとう。');return;
    }
    if(id==='summonSpirit'){
      const cells = summonCells(s);const media = summonMedia(s);
      const slot = media[this.rng.int(0, media.length - 1)];
      const item = s.itemSlots.splice(slot, 1)[0];
      const level = effectiveLevel(s.skillBag,s.skillLevels,id);

      // Lv3以上かつ、実際に使った媒体がrareRank 2以上なら中級精霊。
      // rank1へフォールバックした場合は下級精霊。
      const spiritKind =level >= 3 && ITEMS[item].rareRank >= 2?'greaterSprite':'sprite';
      const ally = createSpirit(s,spiritKind,cells[this.rng.int(0, cells.length - 1)],level);
      this.events.push({type: 'trap',position: { ...ally.position },visual: 'summonRing',sound: 'magicCast'});

      this.log(ITEMS[item].name +'を媒体に'+ally.name+'を召喚！');
      return;
    }
    if (id === 'chainLightning') {
      let origins=occupied(p), source={...p.position}; const hit=new Set<string>(), start=this.events.length;
      const level=effectiveLevel(s.skillBag,s.skillLevels,id), levelScale=(1+(level-1)*.05)*connectionDamageMultiplier(s.skillBag,id);
      this.groupingDamage=true;
      for(let n=0;n<chainHitLimit(s);n++) {
        const enemy=n===0?chainOrigin(s,aim):nextChainTarget(s,origins,hit);if(!enemy)break;
        hit.add(enemy.id); const cells=occupied(enemy), impact={...enemy.position};
        this.events.push({type:'cast',actorId:p.id,position:source,target:impact,skillId:id,attribute:'thunder',sound:n===0?'magicCast':undefined,delayMs:n*160,durationMs:300});
        if(hitInstallation(s,enemy.id,{rng:this.rng,events:this.events,log:m=>this.log(m)})){origins=cells;source=impact;continue;}
        const critical=this.rng.next()<criticalChance(p,enemy,'thunder');
        const before=this.events.length;
        dealAttributeHit(enemy,attackPower(p)*(1-n*.1)*levelScale*(critical?p.criticalMultiplier:1),'thunder',s.playerActionCount,s.enemyStates,this.damage,this.events,()=>this.rng.next(),critical);
        for(const event of this.events.slice(before))event.delayMs=(event.delayMs??0)+n*160+100;
        origins=cells;source=impact;
      }
      this.groupingDamage=false;this.logHits(def.name,start);
      if(!hit.size)this.log(def.name+'！ 対象の敵がいなかった。');
      return;
    }
    if (id === 'groundbreak') {
      const damage = attackPower(p) * (1 + (effectiveLevel(s.skillBag, s.skillLevels, id) - 1) * .05);
      s.mapState.playerTraps!.push({ id: 'groundbreak-' + s.playerActionCount, position: { ...p.position }, damage, sourceSkillId: id, placedAt: s.playerActionCount });
      this.events.push({ type: 'trap', actorId: p.id, position: { ...p.position }, visual: 'fallingRocks', sound: 'rocks' });
      this.log('地砕き！ 足元に土の罠を設置した。'); return;
    }
    const targets = previewSkill(s, id, direction, aim);
    if (id === 'warp') {
      const destination = targets.cells[this.rng.int(0, targets.cells.length - 1)];
      this.events.push({ type: 'cast', actorId: p.id, position: { ...p.position }, target: destination, skillId: id, attribute: def.attribute });
      p.position = { ...destination }; this.log('ランダムワープを発動！'); return;
    }
    const relocation = id === 'vacuumSlash' ? vacuumDestinations(s,s.enemyStates.find(e=>e.id===targets.targetIds[0])!) : [];
    this.events.push({ type: 'cast', actorId: p.id, position: { ...p.position }, target: aim ?? targets.cells.at(-1) ?? { ...p.position }, path: targets.cells, skillId: id, attribute: def.attribute, sound: id === 'icestone' ? 'ice' : id === 'vacuumSlash' ? 'magicCast' : id === 'sweep' ? 'strike' : undefined });
    const level = effectiveLevel(s.skillBag, s.skillLevels, id), multiplier = (1 + (level - 1) * .05) * connectionDamageMultiplier(s.skillBag, id);
    const hitStart = this.events.length; this.groupingDamage = true;
    for (const targetId of targets.targetIds) {
      if(hitInstallation(s,targetId,{rng:this.rng,events:this.events,log:m=>this.log(m)}))continue;
      const target = s.enemyStates.find(e => e.id === targetId)!;
      for (let hit = 0; hit < def.hits && target.hp > 0; hit++) {
        const critical = this.rng.next() < criticalChance(p, target, def.attribute);
        const power = id === 'attack' ? .5 + this.rng.next() * .2 : id === 'sweep' ? .4 + this.rng.next() * .2 : def.multiplier;
        const amount = attackPower(p) * power * multiplier * (critical ? p.criticalMultiplier : 1);
        dealAttributeHit(target, amount, def.attribute, s.playerActionCount, s.enemyStates, this.damage, this.events, () => this.rng.next(), critical);
      }
      if (id === 'tornado' && target.hp > 0 && target.cells.length === 1 && !target.immobile) {
        const v = VECTORS[direction], pos = { x: target.position.x + v.x, y: target.position.y + v.y };
        if (canStand(s.mapState, target, pos, this.actors)) target.position = pos;
      }
    }
    if (relocation.length) { const from={...p.position}; p.position={...relocation[this.rng.int(0,relocation.length-1)]};this.events.push({type:'cast',actorId:p.id,position:from,target:{...p.position},skillId:'warp',attribute:'wind',delayMs:250,durationMs:250}); }
    this.groupingDamage = false; this.logHits(def.name, hitStart, def.hits > 1);
    for (const event of this.events.filter(e => e.type === 'reaction')) this.log(`${event.text}が発生！`);
  }
  /** 撃破経験値は味方・罠による撃破にも付与。超過分は次レベルへ持ち越す。 */
  private gainExperience(amount: number): void {
    const s = this.state, p = s.playerState;
    if (s.playerLevel! >= PROGRESSION.maxLevel || p.hp <= 0) return;
    s.experience! += Math.ceil(amount);
    while (s.playerLevel! < PROGRESSION.maxLevel && s.experience! >= requiredExperience(s.playerLevel!)) {
      s.experience! -= requiredExperience(s.playerLevel!); s.playerLevel!++;
      const hp = Math.ceil(p.maxHp * PROGRESSION.statGrowth), mp = Math.ceil(p.maxMp * PROGRESSION.statGrowth);
      p.maxHp += hp; p.hp += hp; p.maxMp += mp; p.mp += mp;
      if (s.playerLevel! % 3 === 0) p.attack++;
      const expansion=s.playerLevel!%5===0?2:1;
      for(let n=0;n<expansion;n++)expandBag(s, this.rng);
      this.log('旅人がLv.' + s.playerLevel + 'に！ 最大HP+' + hp + '・最大MP+' + mp + (s.playerLevel! % 3 === 0 ? '・基礎攻撃力+1' : '') + '、バッグが'+expansion+'マス拡張！');
      this.events.push({ type: 'levelup', actorId: p.id, position: { ...p.position }, text: '✦ LEVEL UP! Lv.' + s.playerLevel, durationMs: 2200 });
    }
    if (s.playerLevel === PROGRESSION.maxLevel) s.experience = 0;
  }
  reap(): void {
    for (const e of this.state.enemyStates.filter(e => e.hp <= 0)) {
      if(e.kind!=='reaper'&&e.kind!=='goblinKing')this.state.defeatedEnemies!.push(structuredClone(e));
      const s = this.state;
      const kills = s.floorKills ??= {}; kills[e.kind as keyof typeof kills] = (kills[e.kind as keyof typeof kills] ?? 0) + 1;
      // 同時撃破も1体ずつ加算。撃破なしの行動を挟むと次の撃破から数え直す。
      if (s.lastKillAction === undefined || s.lastKillAction < s.playerActionCount - 1) s.killCombo = 0;
      s.killCombo = (s.killCombo ?? 0) + 1; s.lastKillAction = s.playerActionCount;
      const definition = actorDefinition(e.kind);
      // 基礎HPに対する実際の最大HP比を経験値へ反映。被ダメージでは報酬を減らさない。
      // ステージ加算・階層倍率を含め、夜の補正を掛けて切り上げた後に連続撃破ボーナスを適用。
      const hpMultiplier = e.maxHp / Math.max(1, definition.hp);
      const base = Math.ceil(definition.experience * hpMultiplier * (e.experienceMultiplier ?? 1));
      const multiplier = s.killCombo >= 4 ? 1.5 : s.killCombo >= 2 ? 1.2 : 1;
      const earned = Math.ceil(base * multiplier), bonus = earned - base;
      this.log(`${e.name}を倒した！経験値${earned}${bonus > 0 ? `(+${bonus})` : ''}獲得`);
      this.gainExperience(earned); this.events.push({ type: 'defeat', position: { ...e.position } });
      rollDrops(this.stage.enemyDrops?.[e.kind as import("../data/enemies").EnemyKind] ?? actorDefinition(e.kind).drops, this.rng, this.state.floorNumber).forEach((loot, index) => this.state.mapState.objects.push(floorLoot(`drop-${e.id}-${index}`, e.position, loot)));
    }
    // 連帯責任は今回倒れたゴブリンだけを数え、王の撃破も通常処理へ渡す。
    const fallen=this.state.enemyStates.filter(e=>e.hp<=0&&isGoblin(e));
    const kings=this.state.enemyStates.filter(e=>e.kind==='goblinKing'&&e.hp>0);
    for(const king of kings)if((king.bossLinkUntil??0)>this.state.playerActionCount){
      const count=fallen.filter(e=>Math.max(Math.abs(e.position.x-king.position.x),Math.abs(e.position.y-king.position.y))<=5).length;
      if(count)this.damage(king,count*KING_RULES.linkDamage,'neutral',false,null);
    }
    const newlyFallen=kings.filter(k=>k.hp<=0);
    this.state.enemyStates = this.state.enemyStates.filter(e => e.hp > 0 || newlyFallen.includes(e));
    if(newlyFallen.length)this.reap();
    for(const king of kings)kingPhases(this.state,king,{rng:this.rng,events:this.events,log:m=>this.log(m),hit:(a,b,n,attribute,label)=>this.strike(a,b,n,attribute,label)});
    this.state.allyStates = this.state.allyStates.filter(a => a.hp > 0);
  }
  goalReady(): boolean {
    const goal = this.stage.clearCondition;
    if (goal?.type === 'records') return this.state.objectiveChests >= goal.count;
    if(goal?.type==='destroyInstallations')return (this.state.destroyedInstallations?.[goal.kind]??0)>=goal.count;
    if (goal?.type === 'defeat') return (this.state.floorKills?.[goal.kind] ?? 0) >= goal.count;
    return true;
  }
  objectiveLabel(): string {
    const custom=this.stage.floorSettings?.[this.state.floorNumber??1]?.objective;
    if(custom)return custom;
    const goal = this.stage.clearCondition;
    if (goal?.type === 'records') return `古代の記録 ${this.state.objectiveChests}/${goal.count}個を回収し、出口へ`;
    if(goal?.type==='destroyInstallations')return INSTALLATIONS[goal.kind].name+' '+(this.state.destroyedInstallations?.[goal.kind]??0)+'/'+goal.count+'個を破壊し、出口へ';
    if (goal?.type === 'defeat') return `${actorDefinition(goal.kind).name} ${this.state.floorKills?.[goal.kind] ?? 0}/${goal.count}体を倒し、出口へ`;
    return '出口を探そう';
  }
  canSleep(): boolean {
    return this.state.status === 'playing' && timeOfDay(this.state) === 'night' && (this.state.daylightCount??0)>DAY_CYCLE.night && !this.state.enemyStates.some(e => e.hp > 0 && e.mode === 'hostile');
  }
  /** 階層の地形・敵・探索記録だけを交換。プレイヤーの成長と手持ちは維持する。 */
  private advanceFloor(): void {
    const s = this.state, next = s.floorNumber! + 1;
    const { map, enemies, spawn } = generateMap(STAGES.find(stage => stage.id === s.stageId)!, this.rng, next);
    s.killCombo = 0; s.lastKillAction = undefined;
    s.floorNumber = next; s.mapState = map; map.playerTraps = []; s.enemyStates = enemies; s.reinforcementKinds=[...new Set(enemies.map(e=>e.kind))].filter(k=>k!=='player'&&k!=='sprite'&&k!=='greaterSprite');
    s.playerState.position = { ...spawn }; s.objectiveChests = 0; s.floorKills = {}; s.destroyedInstallations = {}; s.fullBagRewardClaimed = false; s.defeatedEnemies = []; s.nightRevived = 0; s.nightWave = undefined; s.nightTarget = undefined;
    s.exploredMap = new Array(map.width * map.height).fill(false);
    const placed: Actor[] = [s.playerState, ...enemies];
    for (const ally of s.allyStates) {
      const cells: Point[] = [];
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (canStand(map, ally, { x, y }, placed) && !map.objects.some(o => same(o.position, { x, y }))) cells.push({ x, y });
      cells.sort((a, b) => Math.abs(a.x - spawn.x) + Math.abs(a.y - spawn.y) - Math.abs(b.x - spawn.x) - Math.abs(b.y - spawn.y));
      if (cells[0]) ally.position = cells[0];
      ally.mode = 'idle'; ally.lastSeen = null; ally.pursuitLeft = 0; placed.push(ally);
    }
    this.explore(); this.log(`${this.stage.name} 第${next}層へ進んだ！`);
  }
  /** 夜・深夜・以降30行動ごとの復活。抽選数を保存し、未達分は空き床と撃破済みの敵が揃うまで再試行。 */
  private spawnReaper():void{
    const s=this.state,day=s.dayCount??1;if(s.status!=='playing'||timeOfDay(s)!=='night')return;
    const wave=(s.daylightCount??0)<DAY_CYCLE.midnight?0:1+Math.floor(((s.daylightCount??0)-DAY_CYCLE.midnight)/DAY_CYCLE.revivalInterval);
    if(s.lastReaperDay===day&&(s.lastReaperWave??0)>=wave)return;
    const rule=reaperRules(day),count=rule.count,probe=actor('reaper-probe','reaper',{x:0,y:0}),cells:Point[]=[];
    for(let y=1;y<s.mapState.height-1;y++)for(let x=1;x<s.mapState.width-1;x++){const p={x,y};if(canStand(s.mapState,probe,p,this.actors)&&!s.mapState.objects.some(o=>same(o.position,p)))cells.push(p);}
    if(!cells.length)return;
    const spawned:Actor[]=[];
    for(let n=0;n<count&&cells.length;n++){
      const distant=cells.filter(p=>!this.visible(p)),pool=distant.length?distant:cells,position=pool[this.rng.int(0,pool.length-1)];
      cells.splice(cells.findIndex(p=>same(p,position)),1);
      const enemy=actor('reaper-day-'+day+'-wave-'+wave+'-'+n,'reaper',position);enemy.hp=enemy.maxHp=rule.hp;enemy.attack=rule.attack;s.enemyStates.push(enemy);spawned.push(enemy);
    }
    s.lastReaperDay=day;s.lastReaperWave=wave;
    const message='死神が'+spawned.length+'体現れた';this.log(day+'日目の夜。'+message+'！');this.events.push({type:'trap',position:{...spawned[0].position},visual:'summonRing',announcement:message});this.capture('enemy');
  }

  private reviveAtNight(): void {
    const s = this.state, rule = floorRules(this.stage, s.floorNumber).nightRevival;
    if (timeOfDay(s) !== 'night') return;
    const count = s.daylightCount ?? 0;
    const wave = count < DAY_CYCLE.midnight ? 0 : 1 + Math.floor((count - DAY_CYCLE.midnight) / DAY_CYCLE.revivalInterval);
    if (s.nightWave !== wave) {
      s.nightWave = wave; s.nightRevived = 0;
      // 夜の通常復活(wave0)は階層設定、深夜の追加波は波数に比例して拡大。
      // wave1=1〜2、wave2=2〜4、wave3=3〜6…となる。
      const min = wave === 0 ? rule.min : wave;
      const max = wave === 0 ? Math.max(rule.min, rule.max) : wave * 2;
      s.nightTarget = this.rng.int(min, Math.max(min, max));
    }
    const desired = s.nightTarget ?? rule.min;
    if (s.nightRevived! >= desired || wave===0&&!s.defeatedEnemies?.length) return;
    const pool=(s.reinforcementKinds ?? []).filter(k=>k!=='reaper'&&k!=='goblinKing');
    const dead = wave===0 ? (s.defeatedEnemies??[]).filter(e=>e.kind!=='reaper'&&e.kind!=='goblinKing') : Array.from({length:desired-s.nightRevived!},(_,i)=>actor('reinforcement-'+i,pool.length?pool[this.rng.int(0,pool.length-1)]:'slime',{x:0,y:0},s.stageId,s.floorNumber));
    while (dead.length && s.nightRevived! < desired) {
      const old = dead.splice(this.rng.int(0, dead.length - 1), 1)[0];
      const enemy = actor(`night-${s.floorNumber}-${s.playerActionCount}-${s.nightRevived}`, old.kind, old.position, s.stageId, s.floorNumber), cells: Point[] = [];
      for (let y = 1; y < s.mapState.height - 1; y++) for (let x = 1; x < s.mapState.width - 1; x++) {
        const p = { x, y };
        if (!canStand(s.mapState, enemy, p, this.actors) || occupied(enemy, p).some(c => s.mapState.objects.some(o => same(c, o.position)))) continue;
        const borders = Object.values(VECTORS).map(v => ({ x: x + v.x, y: y + v.y }));
        if (borders.some(c => s.exploredMap[c.y * s.mapState.width + c.x] && wall(s.mapState, c))) cells.push(p);
      }
      if (!cells.length) continue;
      enemy.experienceMultiplier = wave === 0 ? DAY_CYCLE.nightExperience : DAY_CYCLE.midnightExperience;
      enemy.position = cells[this.rng.int(0, cells.length - 1)]; s.enemyStates.push(enemy);
      if(wave===0)s.defeatedEnemies = s.defeatedEnemies!.filter(a => a.id !== old.id); s.nightRevived!++;
      if (this.inPlayerScreen(enemy.position)) { this.events.push({ type: 'trap', position: { ...enemy.position }, visual: 'summonRing', sound: 'howl' }); this.log(`壁際から${enemy.name}が現れた！`); }
    }
  }
  private sleep(): boolean {
    if (!this.canSleep()) { this.log('夜、敵に気付かれていないときだけ眠れます。'); return false; }
    const s = this.state, p = s.playerState;
    s.dayCount = (s.dayCount ?? 1) + 1; s.killCombo = 0; s.lastKillAction = undefined;
    if(s.dayCount%4===0&&(s.fatigue??0)<5){s.fatigue=(s.fatigue??0)+1;this.log('疲労度が'+s.fatigue+'になった。睡眠時のHP回復量は最大HPの'+Math.round(sleepHpRatio(s.fatigue)*100)+'％。');}
    s.playerActionCount++; s.turnCount++; s.daylightCount = 0; s.nightRevived = 0; s.nightWave = undefined; s.nightTarget = undefined;
    const recovered=Math.min(p.maxHp-p.hp,Math.floor(p.maxHp*sleepHpRatio(s.fatigue??0)));
    p.hp += recovered; p.mp = p.maxMp; p.afflictions = []; delete p.frostErosion; p.movementLockedUntil = 0;
    // 一晩で期限付き状態と再使用待ちを解消。回復カウントも新しい朝から開始。
    s.cooldowns = {}; s.mpRecoveryActions = 0;
    for (const a of this.actors) { a.buffs = []; a.afflictions = []; if(a.id!==p.id)a.hp=a.maxHp; if(a.maxMp!==undefined)a.mp=a.maxMp; }
    s.allyStates=[];s.mapState.thunderPrisons=[];
    s.enemyStates=s.enemyStates.filter(e=>e.kind!=='reaper');
    s.defeatedEnemies=s.defeatedEnemies?.filter(e=>e.kind!=='reaper'&&e.kind!=='goblinKing');
    s.reinforcementKinds=s.reinforcementKinds?.filter(k=>k!=='reaper'&&k!=='goblinKing');
    const limit = this.stage.sleepRespawnCount ?? DAY_CYCLE.respawnCount;
    const dead = [...(s.defeatedEnemies ?? [])]; let count = 0;
    while (dead.length && count < limit) {
      const old = dead.splice(this.rng.int(0, dead.length - 1), 1)[0];
      const enemy = actor(`revived-${s.playerActionCount}-${count}`, old.kind, old.position, s.stageId, s.floorNumber);
      const cells: Point[] = [];
      for (let y = 0; y < s.mapState.height; y++) for (let x = 0; x < s.mapState.width; x++) {
        const pos = { x, y };
        if (Math.max(Math.abs(x - p.position.x), Math.abs(y - p.position.y)) <= 4 || !canStand(s.mapState, enemy, pos, this.actors)) continue;
        if (occupied(enemy, pos).some(c => s.mapState.objects.some(o => same(c, o.position)))) continue;
        cells.push(pos);
      }
      if (!cells.length) continue;
      enemy.position = cells.find(c => same(c, old.position)) ?? cells[this.rng.int(0, cells.length - 1)];
      s.enemyStates.push(enemy); s.defeatedEnemies = s.defeatedEnemies!.filter(a => a.id !== old.id); count++;
    }
    this.log(`朝になった！ HP${recovered}回復・MP全回復。`);
    this.events.push({ type: 'heal', actorId: p.id, position: { ...p.position }, text: '朝・HP+'+recovered, sound: 'healing' });
    this.capture('player'); this.explore(); s.randomSeed = this.rng.seed; return true;
  }
  execute(command: Command): boolean {
    const s = this.state, p = s.playerState;
    let walked = false;
    this.events = [];
    this.frames = []; this.frameEventStart = 0;this.prepareCrystalReactions();
    if (s.status !== 'playing' || s.pendingBag || s.pendingGemChoices?.length || s.pendingSkillBooks) return false;
    if((p.stunnedUntil??0)>s.playerActionCount){command={type:'wait'};this.log('旅人は行動不能で動けない！');}
    if (command.type === 'cast') { const error = this.canCast(command.skillId); if (error) { this.log(error); return false; } if (!validSkillTarget(s, command.skillId, command.target)) { this.log('選択範囲内の着弾点を選んでください。'); return false; } }
    if (command.type === 'move') {
      p.facing = command.direction;
      if (movementLocked(p,s.playerActionCount)) this.log('移動不可のため、動けなかった。');
      else {
      const v = VECTORS[command.direction], next = { x: p.position.x + v.x, y: p.position.y + v.y };
      // 精霊を押し退けても自動行動の権利は消費せず、通常の味方フェーズへ進む。
      const ally = s.allyStates.find(a => a.hp > 0 && occupied(a).some(c => same(c, next)));
      const others = this.actors.filter(a => a.id !== p.id && a.id !== ally?.id);
      if (!canStand(s.mapState, p, next, ally ? others : this.actors) || ally && !canStand(s.mapState, ally, p.position, others)) { this.log('進路がふさがれています。'); return false; }
      if (ally) ally.position = { ...p.position };
      p.position = next; walked = true;
      }
    }
    if (command.type === 'item') { if (!this.useItem(command.slot, command.skillId)) return false; this.capture('player'); this.explore(); s.randomSeed = this.rng.seed; return true; }
    if (command.type === 'sleep') return this.sleep();
    s.playerActionCount++; s.daylightCount = (s.daylightCount ?? 0) + 1;
    startBoss(s,this.events);
    if (command.type === 'cast') this.cast(command.skillId, command.direction, command.target);
    if(walked)contactBossFire(s,p,(t,n,a,c)=>this.damage(t,n,a,c,null),this.events,this.rng);
    if (walked) triggerPlayerTraps(s, { rng: this.rng, events: this.events, damage: (target, amount, attribute, critical) => this.damage(target, amount, attribute, critical, null), log: message => this.log(message) });
    if(walked) moveNearInstallations(s,{rng:this.rng,events:this.events,log:m=>this.log(m)});
    if (p.hp > 0) this.collect(); this.reap();
    this.groupingDamage=true;
    tickThunderPrisons(s,{rng:this.rng,events:this.events,damage:this.damage,log:m=>this.log(m)});
    this.groupingDamage=false;this.reap();
    this.capture('player');
    for (const ally of s.allyStates) { if (p.hp <= 0) break; if((ally.stunnedUntil??0)>s.playerActionCount)continue; const from={...ally.position}; actSummon(s, ally, this.rng, this.events, (a, b) => { this.events.push({ type: 'attack', actorId: a.id, position: { ...a.position }, target: { ...b.position }, attribute: a.attribute }); this.strike(a, b); }, message => this.log(message)); if(!same(from,ally.position))contactBossFire(s,ally,(t,n,a,c)=>this.damage(t,n,a,c,null),this.events,this.rng); }
    for(const ally of s.allyStates){if(ally.remainingLife!==undefined&&--ally.remainingLife<=0){ally.hp=0;this.log(ally.name+'は役目を終え、消えていった。');this.events.push({type:'defeat',actorId:ally.id,position:{...ally.position},text:'消滅'});}}
    this.reap(); this.capture('ally');
    tickBanners(s);
    for (const enemy of [...s.enemyStates]) {
      if (p.hp <= 0) break;
      if(enemy.hp<=0)continue;
      if((enemy.stunnedUntil??0)>s.playerActionCount){this.log(enemy.name+'は行動不能！');continue;}
      const arena=s.mapState.bossArena;
      if(enemy.summonedBy||arena&&occupied(enemy).some(c=>c.x>=arena.x&&c.y>=arena.y&&c.x<arena.x+arena.width&&c.y<arena.y+arena.height)){enemy.mode='hostile';enemy.lastSeen={...p.position};}
      const canRollSkills=enemy.mode==='hostile'||occupied(enemy).some(c=>occupied(p).some(t=>Math.max(Math.abs(c.x-t.x),Math.abs(c.y-t.y))<=detection(enemy)*2));
      const actionCount=canRollSkills?enemyActionCount(enemy,{rng:this.rng,events:this.events,log:m=>{if(this.inPlayerScreen(enemy.position))this.log(m);}}):1;
      for(let extra=0;extra<actionCount;extra++){
      if(p.hp<=0||enemy.hp<=0)break;
      if((enemy.stunnedUntil??0)>s.playerActionCount)break;
      contactSkillFields(s,{rng:this.rng,events:this.events,damage:this.damage,log:m=>this.log(m)});
      if(enemy.hp<=0)break;
      const beforePosition = { ...enemy.position };
      const innate = actorDefinition(enemy.kind).innateAttribute;
      if (innate && innate !== 'wind') { enemy.afflictions = enemy.afflictions.filter(f => f.attribute !== innate); if (enemy.afflictions.length >= 2) enemy.afflictions.shift(); enemy.afflictions.push({ attribute: innate, remainingTurns: 10, appliedAt: s.playerActionCount }); }
      const skillContext = { hitInstallation:(id:string)=>hitInstallation(s,id,{rng:this.rng,events:this.events,log:m=>this.log(m)}), action: s.playerActionCount, allies: s.enemyStates, map: s.mapState, actors: this.actors, rng: this.rng, events: this.events, damage: (target: Actor, amount: number, attribute: Attribute, _critical?: boolean, label?: string) => this.strike(enemy, target, amount, attribute, label), log: (message: string) => { if (this.inPlayerScreen(enemy.position) || this.events.at(-1)?.path?.some(p => this.inPlayerScreen(p))) this.log(message); } };
      // 支援は敵を見つけていなくても使用可能。攻撃スキルは通常AIの索敵後に試す。
      Object.assign(skillContext,{allowSkills:canRollSkills});
      enemy.enemyCooldownUntil ??= {};
      const support = { ...enemy, enemySkillIds: (enemy.enemySkillIds ?? []).filter(id => ENEMY_SKILLS[id]?.effect.type === 'allyBuff') };
      if (canRollSkills && tryEnemySkill(support, [], skillContext)) { enemy.mp = support.mp; continue; }
      const chargeIds=(enemy.enemySkillIds??[]).filter(id=>ENEMY_SKILLS[id]?.effect.type==='charge');
      const charged=chargeIds.length>0&&(()=>{const ids=enemy.enemySkillIds;enemy.enemySkillIds=chargeIds;try{return tryEnemySkill(enemy,[p,...s.allyStates],skillContext);}finally{enemy.enemySkillIds=ids;}})();
      if (!charged && !actKing(s,enemy,{rng:this.rng,events:this.events,log:m=>this.log(m),hit:(a,b,n,attribute,label)=>this.strike(a,b,n,attribute,label)})) actEnemy(s.mapState, enemy, [p, ...s.allyStates], this.actors, this.rng, (a, b) => { this.events.push({ type: 'attack', actorId: a.id, position: { ...a.position }, target: { ...b.position }, attribute: a.attribute }); this.strike(a, b); }, s.playerActionCount, (caster, targets) => { const ids = caster.enemySkillIds; caster.enemySkillIds = (ids ?? []).filter(id => ENEMY_SKILLS[id]?.effect.type !== 'allyBuff'); try { return tryEnemySkill(caster, targets, skillContext); } finally { caster.enemySkillIds = ids; } });
      // 移動先のダメージで倒れる場合も、到着した姿を先に描画できるよう保存。
      const arrivalActors = !same(beforePosition, enemy.position) ? structuredClone(this.actors) : null;
      const arrivalEventStart = this.events.length;
      if (arrivalActors) for (const trap of [...s.mapState.playerTraps!]) {
        if (enemy.hp <= 0 || !occupied(enemy).some(c => same(c, trap.position))) continue;
        s.mapState.playerTraps = s.mapState.playerTraps!.filter(t => t.id !== trap.id);
        const start = this.events.length; this.groupingDamage = true;
        const elapsed = Math.min(10, Math.max(0, s.playerActionCount - (trap.placedAt ?? s.playerActionCount)));
        dealAttributeHit(enemy, trap.damage * (1 + elapsed * .05) * connectionDamageMultiplier(s.skillBag, trap.sourceSkillId ?? 'groundbreak'), 'earth', s.playerActionCount, s.enemyStates, this.damage, this.events, () => this.rng.next());
        this.groupingDamage = false; this.logHits('地砕きの罠', start);
        this.events.push({ type: 'trap', position: { ...trap.position }, visual: 'fallingRocks', sound: 'rocks' });
      }
      enemy.lastActedAt=s.playerActionCount;
      contactSkillFields(s,{rng:this.rng,events:this.events,damage:this.damage,log:m=>this.log(m)});
      if (arrivalActors && this.events.length > arrivalEventStart) {
        // 到着→罠・床・反応の順に再生。戦闘処理の順序や乱数は変えない。
        this.frames.push({ phase: 'enemy', actors: arrivalActors, events: structuredClone(this.events.slice(this.frameEventStart, arrivalEventStart)) });
        this.frameEventStart = arrivalEventStart;
        for (const event of this.events.slice(arrivalEventStart)) event.delayMs ??= 0;
        this.capture('enemy');
      }
      if(actionCount>1)this.capture('enemy');
      }
    }
    tickCrystals(s,{rng:this.rng,events:this.events,damage:this.damage,log:m=>this.log(m)});
    tickInstallations(s,{rng:this.rng,events:this.events,damage:this.damage,log:m=>this.log(m)});
    tickSkillFields(s,{rng:this.rng,events:this.events,damage:this.damage,log:m=>this.log(m)});
    for (const field of s.mapState.fields) {
      if(field.skillKind||field.effectId.startsWith('king-fire-'))continue;
      const active = p.hp > 0 && (field.triggerType === 'turn' || walked);
      if (active && same(field.position, p.position)) { const amount = Math.floor((field.power ?? p.attack) * field.damageMultiplier); dealAttributeHit(p, amount, field.attribute, s.playerActionCount, [p, ...s.allyStates], this.damage, this.events, () => this.rng.next()); if (field.onceOnly) field.remainingTurns = 0; }
    }
    this.reap();
    if (p.hp > 0) this.reviveAtNight();
    this.capture('enemy');
    endTurn(s, command.type === 'cast' ? command.skillId : undefined);
    this.explore();
    if (p.hp <= 0) { s.status = 'defeated'; s.pendingBag = false; this.log('冒険はここまで。また新しい旅へ。'); }
    else if (s.mapState.objects.some(o => o.type === 'exit' && same(o.position, p.position))) {
      if (this.goalReady()) { if (s.floorNumber! < s.floorCount!) this.advanceFloor(); else { s.status = 'cleared'; s.pendingBag = false; this.log(`${this.stage.name}を踏破した！`); } }
      else this.log('出口はまだ閉ざされています。');
    }
    if(p.hp>0)this.spawnReaper();
    s.randomSeed = this.rng.seed;
    return true;
  }
}
