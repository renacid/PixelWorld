/** プレイヤー入力と将来の対戦同期に使うコマンド契約。 */
import type { Direction, Point, SkillId } from './types';
export type Command = { type: 'move'; direction: Direction } | { type: 'cast'; skillId: SkillId; direction: Direction; target?: Point; secondTarget?: Point } | { type: 'item'; slot: number; skillId?: SkillId } | { type: 'wait' } | { type: 'sleep' };
export type CommandEnvelope = { sessionId: string; actionIndex: number; command: Command };
// Future versus transport can exchange commands and seed, without depending on UI.
export interface SessionTransport { send(envelope: CommandEnvelope): void; receive(handler: (envelope: CommandEnvelope) => void): void }
