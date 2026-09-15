import type { Direction, SkillId } from './types';
export type Command = { type: 'move'; direction: Direction } | { type: 'cast'; skillId: SkillId; direction: Direction } | { type: 'item'; slot: number } | { type: 'wait' };
export type CommandEnvelope = { sessionId: string; actionIndex: number; command: Command };
// Future versus transport can exchange commands and seed, without depending on UI.
export interface SessionTransport { send(envelope: CommandEnvelope): void; receive(handler: (envelope: CommandEnvelope) => void): void }
