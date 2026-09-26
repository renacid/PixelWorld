import type { Installation, InstallationPlacement } from '../data/installations';
/** セーブ・ゲームロジック・描画で共通利用するデータ型。追加フィールドは旧セーブ互換に注意。 */
export type Point = { x: number; y: number };
import type { ActorKind, EnemyKind } from '../data/enemies';
import type { ChestTier, Loot, LootPools, DropEntry } from '../data/loot';
import type { TrapInstance, TrapPlacement, TrapVisual, SoundCue } from '../data/traps';
export type Direction = 'up' | 'right' | 'down' | 'left';
export const VECTORS: Record<Direction, Point> = { up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 } };
export type Attribute = 'fire' | 'ice' | 'thunder' | 'earth' | 'wind' | 'neutral' | 'physical' | 'nature';
export type SkillId = 'earthBlessing' | 'flurry' | 'randomThunder' | 'thunderPrison' | 'meteor' | 'icePillar' | 'thunderArmor' | 'iceLance' | 'fireWall' | 'tornadoSummon' | 'earthquake' | 'summonSpirit' | 'iceShield' | 'sweep' | 'vacuumSlash' | 'chainLightning' | 'attack' | 'fireball' | 'thunder' | 'tornado' | 'firerain' | 'warp' | 'icestone' | 'groundbreak';
export type ItemId = 'ironKey' | 'bookmarkLesser' | 'bookmarkMiddle' | 'bookmarkGreater' | 'powerPotion' | 'healingPotion' | 'etherMedium' | 'potion' | 'ether' | 'scope' | 'summon' | 'hourglass';
export type Affliction = { attribute: Attribute; remainingTurns: number; appliedAt: number };
export type Actor = { stunnedUntil?: number; bossPhases?: number[]; bossLinkUntil?: number; summonedBy?: string; lastActedAt?:number; movementLockedUntil?: number; frostErosion?: { spent:boolean; rootUntil?:number };
  wideAttack?: boolean; skillSelection?: 'exclusive';
  enemyCooldownUntil?: Record<string, number>; mpRecoveryTurns?: number;
  remainingLife?: number;
  experienceMultiplier?: number;
  criticalRate?: number; criticalMultiplier?: number;
  immobile?: boolean; skillChances?: Record<string, number>;
  buffs?: { skillMode?: string; name?: string; iceFollowup?: { chance:number; ratio:number }; thunderFollowup?: { chance:number; ratio:number }; id: string; remainingTurns: number; appliedAt: number; attackBonus?: number; attackMultiplier: number; detectionBonus: number }[];
  id: string; name: string; kind: ActorKind;
  position: Point; cells: Point[]; directions: Direction[]; attackCells: Point[]; facing: Direction;
  hp: number; maxHp: number; attack: number; attribute: Attribute; afflictions: Affliction[];
  detectionRange: number; pattern: 'patrol' | 'wait' | 'guard'; attackRange: number;
  priorityTarget: 'player' | 'nearest'; pursuitTurns: number;
  mode: 'idle' | 'hostile'; lastSeen: Point | null; pursuitLeft: number; alertedAt: number;
  chaseMoveLimit?: number; chaseMoves?: number; chaseSkipLeft?: number; chaseRecoveryChance?: number;
  mp?: number; maxMp?: number; enemySkillIds?: string[];
};
export type Player = Actor & { mp: number; maxMp: number; criticalRate: number; criticalMultiplier: number; facing: Direction; freeCamera: boolean; visionBonus?: number; movementLockedUntil?: number };
export type BagBlock = { isNew?: boolean; skillId: SkillId; position: Point | null; rotation: number };
export type GroundObject = { bookAttributes?: Attribute[]; randomSkillsResolved?: boolean; /** ステージ定義で中身を指定した宝箱。共通の初期報酬上書きを受けません。 */ fixedContents?: boolean; id: string; position: Point; type: 'skillBook' | 'record' | 'chest' | 'item' | 'skill' | 'exit' | 'gem'; skillId?: SkillId; skillIds?: SkillId[]; itemId?: ItemId; chestTier?: ChestTier; waitForLeave?: boolean; fullNotified?: boolean; contents?: Loot[]; opened?: boolean; objective?: boolean };
export type FieldEffect = { skillKind?: 'fireWall'|'tornadoSummon'; placedAt?:number; direction?:Direction; power?:number; hitAction?:number; hitIds?:string[]; sourceSkillId?: SkillId; effectId: string; position: Point; attribute: Attribute; remainingTurns: number; triggerType: 'enter' | 'turn'; damageMultiplier: number; onceOnly: boolean };
export type CrystalSource = { actorId:string; team:'player'|'enemy'; attack:number };
export type Crystal = { id:string; position:Point; attribute:'ice'|'thunder'; source:CrystalSource; damage:number; placedAt:number; remainingTurns:number };
export type ThunderPrison = { id:string; startedAt:number; lastProcessedAt:number; cells:Point[]; power:number; source:CrystalSource; criticalRate:number; criticalMultiplier:number };
export type MapState = { delayedRocks?:{position:Point;dueAt:number;damage:number}[]; bossArena?: import("./BossEncounter").BossArena; thunderPrisons?:ThunderPrison[]; crystals?:Crystal[]; installations?: Installation[]; loot?: LootPools; width: number; height: number; tiles: number[]; objects: GroundObject[]; playerTraps?: { id: string; position: Point; damage: number; sourceSkillId?: SkillId; placedAt?: number }[]; traps?: TrapInstance[]; fields: FieldEffect[] };
export type SaveData = {
  version: 1; stageId: number; randomSeed: number; initialSeed: number;
  mapState: MapState; playerState: Player; allyStates: Actor[]; enemyStates: Actor[];
  skillBag: BagBlock[]; skillLevels: Partial<Record<SkillId, number>>; cooldowns: Partial<Record<SkillId, number>>;
  itemSlots: ItemId[]; exploredMap: boolean[]; turnCount: number; playerActionCount: number;
  /** スキル以外の行動だけを数えるMP回復用カウンター。旧セーブでは未定義。 */
  mpRecoveryActions?: number;
  playerLevel?: number; experience?: number; bagCells?: Point[];
  passiveTriggeredAt?: Partial<Record<SkillId, number>>;
  skillWear?: Partial<Record<SkillId, { uses: number; extraMp: number; stage?: number }>>;
  bookFragments?: number;
  pendingSkillBooks?: number;
  pendingBookAttributes?: Attribute[][];
  pendingGemChoices?: string[][];
  daylightCount?: number;
  /** 睡眠ごとに進む日数。旧セーブは1日目から再開。 */
  dayCount?: number;
  fatigue?: number;
  lastReaperDay?: number;
  lastReaperWave?: number;
  /** 同一行動・直前の行動から続く撃破数。 */
  killCombo?: number; lastKillAction?: number;
  fullBagRewardClaimed?: boolean;
  floorNumber?: number; floorCount?: number; nightRevived?: number; nightWave?: number; nightTarget?: number;
  reinforcementKinds?: EnemyKind[];
  defeatedEnemies?: Actor[];
  /** 階層内の討伐実績。睡眠では維持し、次層でリセット。 */
  destroyedInstallations?: Partial<Record<import('../data/installations').InstallationKind,number>>;
  floorKills?: Partial<Record<EnemyKind, number>>;
  status: 'playing' | 'cleared' | 'defeated'; objectiveChests: number; pendingBag: boolean;
  log: string[];
};
export type GameEvent = { castingAura?: boolean; bossIntro?: boolean; bossJump?: boolean; reaction?: import('../skills/AttributeSystem').ReactionLabel; crystalAttribute?: 'ice'|'thunder'; announcement?: string; type: 'damage' | 'heal' | 'cast' | 'defeat' | 'reaction' | 'attack' | 'pickup' | 'trap' | 'levelup'; position: Point; amount?: number; attribute?: Attribute; critical?: boolean; text?: string; actorId?: string; target?: Point; skillId?: SkillId; enemySkillId?: string; visual?: TrapVisual | 'stone' | 'strike'; sound?: SoundCue; delayMs?: number; durationMs?: number; path?: Point[] };
export type TurnFrame = { phase: 'player' | 'ally' | 'enemy'; actors: Actor[]; events: GameEvent[] };
/** 出現順と個数を定義。固定配置の敵はpositionを指定します。 */
export type EnemySpawn = { kind: EnemyKind; count: number; position?: Point };
export type FloorRules = { gemCount: number; extraPassages: number; enemyVariance: number; nightRevival: { min: number; max: number } };
/** 条件達成後は出口へ。kindはenemies.tsのキーを指定。 */
export type ClearCondition = {type:'destroyInstallations';kind:import('../data/installations').InstallationKind;count:number} | { type: 'exit' } | { type: 'records'; count: number } | { type: 'defeat'; kind: EnemyKind; count: number };
export type LayoutSource = StageLayout | ((stage: Stage, floor: number) => StageLayout);
/** 1層あたりの書の上限と、2冊目以降の追加抽選確率。初期配置も上限に含む。 */
export type SkillBookPlacement = { max: number; extraChance: number };
export type FloorSettings = { /** 階層専用の目標表示。省略時はクリア条件から自動生成。 */ objective?: string; skillBooks?: SkillBookPlacement; installationPlacements?: InstallationPlacement[]; width?: number; height?: number; clearCondition?: ClearCondition; enemySpawns?: EnemySpawn[]; trapPlacements?: TrapPlacement[]; trapPool?: TrapPlacement['pool']; loot?: LootPools; enemyDrops?: Partial<Record<EnemyKind, DropEntry[]>>; layout?: LayoutSource };
export type Stage = { skillBooks?: SkillBookPlacement; installationPlacements?: InstallationPlacement[]; regionId?: string; code?: string; clearCondition?: ClearCondition; floorSettings?: Record<number, FloorSettings>; layout?: LayoutSource; loot?: LootPools; trapPool?: TrapPlacement['pool']; enemyDrops?: Partial<Record<EnemyKind, DropEntry[]>>; dungeon?: FloorRules & { floors: number; enemyScaling?: { everyFloors: number; multiplier: number }; overrides?: Record<number, Partial<FloorRules>> }; /** 開始時に全スキルを配る開発用設定。 */ initialSkillLevels?: Partial<Record<SkillId, number>>; initialBagSize?: number; initialPlayerMp?: number; id: number; name: string; subtitle: string; description: string; objective: string; vision: number; width: number; height: number; enemyCount: number; enemySpawns?: EnemySpawn[]; trapPlacements?: TrapPlacement[]; sleepRespawnCount?: number };
/** ASCII文字と地形IDを対応させ、手作りダンジョンを定義できます。 */
export type StageLayout = { bossArena?: import("./BossEncounter").BossArena; installations?: Installation[]; randomEnemies?: EnemySpawn[]; randomChests?: number; gemCount?: number; rows: string[]; legend: Record<string, number>; spawn: Point; objects: GroundObject[]; enemies: { kind: EnemyKind; position: Point }[]; fields?: FieldEffect[]; trapPlacements?: TrapPlacement[]; traps?: TrapInstance[] };
