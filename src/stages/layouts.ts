import type { StageLayout } from '../game/types';
import { forestLayout } from './forest';
/** 実際に使う森のレイアウトだけを登録。古いforest06サンプルは削除済み。 */
export const CUSTOM_LAYOUTS: Record<number, StageLayout> = { 6: forestLayout(false), 7: forestLayout(true) };
