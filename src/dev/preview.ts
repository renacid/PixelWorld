/** 開発専用の演出確認データ。ユーザーのセーブとは別名で保存し公開ビルドには含めません。 */
/// <reference types="vite/client" />
import { GameSession } from '../game/GameSession';
import { SaveManager } from '../game/SaveManager';
import { actor } from '../actors/Actor';
// A dev-only fixture. Uses a separate storage namespace and is not part of dist.
if (import.meta.env.DEV) {
  const saves = new SaveManager(undefined, 'pixel-world.preview');
  if (new URLSearchParams(location.search).has('fixture') || !saves.load()) {
    const s = GameSession.create(1, 7707); s.state.playerState.position = { x: 8, y: 8 };
    for (const id of ['attack', 'icestone', 'fireball', 'thunder', 'tornado', 'firerain', 'warp'] as const) s.acquireSkill(id);
    s.state.pendingBag = false; s.state.enemyStates = [actor('preview-slime', 'slime', { x: 10, y: 8 }), actor('preview-wolf', 'wolf', { x: 8, y: 12 })];
    s.state.mapState.tiles.fill(0); s.state.mapState.objects = []; s.state.playerState.criticalRate = 0;
    s.explore(); saves.save(s.state); saves.saveSettings({ grid: true, motion: true, sound: true });
  }
  void import('../main');
}
