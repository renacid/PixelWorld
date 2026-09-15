import './style.css';
import { GameSession } from './game/GameSession';
import { SaveManager } from './game/SaveManager';
import type { Command } from './game/Command';
import type { BagBlock, Direction, Point, SkillId } from './game/types';
import { ATTRIBUTE_COLORS, ATTRIBUTE_NAMES, SKILLS } from './data/skills';
import { ITEMS } from './data/items';
import { blockCells, connectionBonus, effectiveLevel, shape, validPlacement } from './skills/SkillBag';
import { STAGES } from './stages';
import { GameCanvas } from './render/GameCanvas';

const app = document.querySelector<HTMLDivElement>('#app')!;
const saves = new SaveManager();
let settings = saves.settings();
let session: GameSession | null = null;
let renderer: GameCanvas | null = null;
let selected: SkillId | null = null;
let screen: 'home' | 'stages' | 'game' = 'home';
let modal: HTMLElement | null = null;
let actionLocked = false;
let lastOutcome = '';
const icons: Record<SkillId, string> = { attack: '⚔', fireball: '♨', thunder: 'ϟ', tornado: '≋', firerain: '☄' };
const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
function on(id: string, fn: () => void): void { document.getElementById(id)?.addEventListener('click', fn); }
function closeModal(): void { modal?.remove(); modal = null; }
function dialog(content: string, className = ''): HTMLElement {
  closeModal(); modal = document.createElement('div'); modal.className = `modal-backdrop ${className}`;
  modal.innerHTML = `<section class="dialog" role="dialog" aria-modal="true" tabindex="-1">${content}</section>`;
  document.body.append(modal); modal.querySelector<HTMLElement>('.dialog')?.focus();
  modal.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...modal!.querySelectorAll<HTMLElement>('button:not(:disabled),input,[tabindex="0"]')];
    const first = focusable[0], last = focusable.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === modal!.querySelector('.dialog'))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  return modal;
}
function persist(): void { if (session) { saves.save(session.state); if (session.state.status === 'cleared') saves.complete(session.state.stageId); } }
function header(label: string, back = true): string { return `<header class="page-header">${back ? '<button id="back" class="icon-button" aria-label="戻る">←</button>' : '<span class="brand-mark">✦</span>'}<span>${label}</span><span class="tiny">PIXEL WORLD</span></header>`; }
function stopRenderer(): void { renderer?.destroy(); renderer = null; }
function home(): void {
  stopRenderer(); closeModal(); screen = 'home';
  const saved = saves.load(), progress = saves.progress();
  app.innerHTML = `<main class="home-shell">${header('草原の迷宮', false)}
    <section class="hero"><div class="eyebrow"><span></span> A LITTLE TURN-BASED ADVENTURE</div>
      <h1>ピクセル<span>ワールド</span></h1><p class="hero-copy">一歩ずつ、未知の奥へ。</p>
      <div class="hero-art"><canvas id="hero-canvas" aria-label="ドット絵の草原と冒険者"></canvas><div class="hero-vignette"></div><span class="location-tag">✦ THE GREEN EXPANSE</span></div>
      <div class="hero-caption"><span>5つの平原、ひとつの冒険。</span><span>01 — 05</span></div>
    </section>
    <nav class="home-actions"><button id="solo" class="primary large"><span>ソロプレイ<span class="button-sub">新しい冒険をはじめる</span></span><span>↗</span></button>
      <button id="continue" class="secondary large" ${saved?.status === 'playing' ? '' : 'disabled'}><span>続きから<span class="button-sub">${saved?.status === 'playing' ? `${STAGES[saved.stageId - 1].name} · ${saved.playerActionCount}行動` : '中断中の冒険はありません'}</span></span><span>→</span></button>
      <div class="home-bottom"><button disabled><span>⚑ 対戦</span><small>準備中</small></button><button id="settings">⚙ 設定・あそび方</button></div>
    </nav><footer class="home-footer"><span class="status-dot"></span> SOLO PROTOTYPE <span>${progress}/5 EXPLORED</span></footer>
    ${saves.error ? `<p class="save-warning">${escape(saves.error)}</p>` : ''}</main>`;
  const demo = GameSession.create(4, 8421);
  demo.state.playerState.position = { x: 7, y: 6 }; demo.explore();
  demo.state.mapState.objects.push({ id: 'hero-chest', type: 'chest', position: { x: 9, y: 5 }, objective: true });
  renderer = new GameCanvas(document.querySelector('#hero-canvas')!); renderer.session = demo; renderer.settings = settings; renderer.start();
  on('solo', stages); on('continue', () => { if (saved?.status === 'playing') { session = new GameSession(saved); selected = null; lastOutcome = ''; showGame(); } }); on('settings', showSettings);
}
function stages(): void {
  stopRenderer(); closeModal(); screen = 'stages'; const progress = saves.progress();
  app.innerHTML = `<main class="stage-shell">${header('冒険を選ぶ')}<div class="section-intro"><div class="eyebrow">THE GREEN EXPANSE</div><h1>平原の先へ。</h1><p>スキルを集め、組み合わせ、道を切り開こう。</p></div><div class="stage-list">${STAGES.map(stage => {
    const locked = stage.id > progress + 1, clear = stage.id <= progress;
    return `<button class="stage-card ${locked ? 'locked' : ''} ${stage.id === Math.min(5, progress + 1) ? 'current' : ''}" data-stage="${stage.id}" ${locked ? 'disabled' : ''}><span class="stage-number">0${stage.id}</span><span class="stage-details"><small>${stage.name} ${clear ? '· 踏破済み' : locked ? '· 未解放' : '· 探索可能'}</small><strong>${stage.subtitle}</strong><span>${stage.objective}</span></span><span class="stage-arrow">${locked ? '◇' : clear ? '✓' : '↗'}</span></button>`;
  }).join('')}</div><div class="note-card"><span>✧</span><p>冒険ごとに、新しい組み合わせ。<br><small>HP・MP・スキル・道具は出発時にリセットされます。</small></p></div><p class="footnote">宝箱へ移動すると開きます。行動するまで敵も動きません。</p></main>`;
  on('back', home);
  app.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(button => button.addEventListener('click', () => {
    const id = Number(button.dataset.stage), saved = saves.load();
    if (saved?.status === 'playing') {
      dialog(`<div class="eyebrow">NEW ADVENTURE</div><h2>新しく出発しますか？</h2><p>中断中の${STAGES[saved.stageId - 1].name}（${saved.playerActionCount}行動）は、新しい冒険で上書きされます。</p><button id="start-new" class="primary">新しく出発</button><button id="cancel-new" class="secondary">戻る</button>`);
      on('start-new', () => startStage(id)); on('cancel-new', closeModal);
    } else startStage(id);
  }));
}
function startStage(id: number): void {
  closeModal(); session = GameSession.create(id, crypto.getRandomValues(new Uint32Array(1))[0]); selected = null; lastOutcome = ''; persist(); showGame();
}
function showGame(): void {
  stopRenderer(); screen = 'game'; const s = session!;
  app.innerHTML = `<main class="game-shell"><header class="game-header"><div><span class="eyebrow">THE GREEN EXPANSE / 0${s.state.stageId}</span><h1>${s.stage.name}<span>${s.stage.subtitle}</span></h1></div><button id="pause" class="icon-button" aria-label="中断メニュー">Ⅱ</button></header>
    <section class="hud"><button id="map-button" class="minimap-button" aria-label="全体マップを開く"><canvas id="minimap"></canvas><span>MAP ↗</span></button><div class="vitals"><div class="vital"><label>HP <strong id="hp-label"></strong></label><div class="meter"><i id="hp-bar"></i></div></div><div class="vital mp"><label>MP <strong id="mp-label"></strong></label><div class="meter"><i id="mp-bar"></i></div></div></div><div class="turn-counter"><small>ACTION</small><strong id="turn-label">00</strong><span id="regen-label"></span></div></section>
    <div class="objective-line"><span>◇</span><span id="objective-text"></span><span class="floor-label">平原 / 0${s.state.stageId}</span></div>
    <section class="map-viewport"><canvas id="game-canvas" aria-label="プレイヤー中心の9×9ダンジョンマップ"></canvas><div class="map-corner top-left"></div><div class="map-corner bottom-right"></div><button id="camera-reset" hidden>◎ プレイヤーへ</button><div id="map-badge">宝箱へ進んでスキルを入手</div></section>
    <section class="game-message" aria-live="polite"><span class="message-dot"></span><span id="message-text"></span></section>
    <section class="controls"><div class="skills-heading"><span>SKILLS <small>スキル</small></span><button id="bag-button">▦ スキルバッグ <span id="bag-count"></span></button></div><div id="skill-buttons" class="skill-buttons"></div>
      <div id="aim-bar" class="aim-bar" hidden><span id="aim-label"></span><button id="cancel-aim" aria-label="スキル選択を解除">×</button></div>
      <div class="control-bottom"><div class="dpad" aria-label="方向操作"><button data-dir="up" class="up" aria-label="上へ移動、スキル選択中は上を向く">↑</button><button data-dir="left" class="left" aria-label="左へ移動、スキル選択中は左を向く">←</button><button id="wait" class="wait" aria-label="1行動待機">待機</button><button data-dir="right" class="right" aria-label="右へ移動、スキル選択中は右を向く">→</button><button data-dir="down" class="down" aria-label="下へ移動、スキル選択中は下を向く">↓</button></div>
      <div class="action-column"><div class="items-label">ITEMS <small>道具 / 3枠</small></div><div id="items" class="items"></div><button id="cast" class="cast-button" disabled><span>スキルを選択</span><span>↗</span></button></div></div>
    </section><footer class="game-footer"><span id="save-label">● 自動保存</span><span>一歩ずつ、ゆっくりと。</span></footer></main>`;
  renderer = new GameCanvas(document.querySelector<HTMLCanvasElement>('#game-canvas')!, document.querySelector<HTMLCanvasElement>('#minimap')!); renderer.session = s; renderer.settings = settings; renderer.selected = selected; renderer.start();
  on('pause', pause); on('bag-button', () => openBag(false)); on('map-button', fullMap); on('wait', () => { selected = null; act({ type: 'wait' }); });
  on('cast', () => { if (selected) act({ type: 'cast', skillId: selected, direction: s.state.playerState.facing }); });
  on('cancel-aim', () => { selected = null; update(); });
  on('camera-reset', () => { renderer!.camera = null; update(); });
  app.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach(button => button.addEventListener('click', () => direction(button.dataset.dir as Direction)));
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
  let drag: { x: number; y: number; camera: Point } | null = null;
  canvas.addEventListener('pointerdown', e => { if (!s.state.playerState.freeCamera || modal) return; drag = { x: e.clientX, y: e.clientY, camera: { ...(renderer!.camera ?? s.state.playerState.position) } }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (!drag) return; const unit = canvas.getBoundingClientRect().width / 9; renderer!.camera = { x: Math.max(0, Math.min(s.state.mapState.width - 1, drag.camera.x - Math.round((e.clientX - drag.x) / unit))), y: Math.max(0, Math.min(s.state.mapState.height - 1, drag.camera.y - Math.round((e.clientY - drag.y) / unit))) }; update(); });
  canvas.addEventListener('pointerup', () => { drag = null; }); canvas.addEventListener('pointercancel', () => { drag = null; });
  update(); if (s.state.pendingBag) openBag(true);
}
function update(): void {
  if (screen !== 'game' || !session) return;
  const s = session.state, p = s.playerState;
  const text = (id: string, value: string) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  text('hp-label', `${Math.ceil(p.hp)} / ${p.maxHp}`); text('mp-label', `${p.mp} / ${p.maxMp}`); text('turn-label', String(s.playerActionCount).padStart(2, '0'));
  text('regen-label', `MP回復まで${5 - s.playerActionCount % 5}`);
  document.getElementById('hp-bar')!.style.width = `${p.hp / p.maxHp * 100}%`; document.getElementById('mp-bar')!.style.width = `${p.mp / p.maxMp * 100}%`;
  text('objective-text', `${session.goalReady() ? '出口へ向かおう' : session.stage.objective}${session.stage.goal === 'treasure' ? ` (${s.objectiveChests}/${session.stage.requiredChests})` : ''}`);
  text('message-text', s.log.at(-1) ?? ''); text('bag-count', `${s.skillBag.filter(b => b.position).flatMap(blockCells).length}/25`);
  text('save-label', saves.error ? `⚠ ${saves.error}` : '● 自動保存');
  const buttons = document.getElementById('skill-buttons')!;
  buttons.innerHTML = (Object.keys(SKILLS) as SkillId[]).map(id => {
    const def = SKILLS[id], owned = !!s.skillLevels[id], placed = s.skillBag.some(b => b.skillId === id && b.position), cd = s.cooldowns[id] ?? 0;
    return `<button class="skill-button ${selected === id ? 'selected' : ''} ${owned && !placed ? 'unplaced' : ''}" style="--skill-color:${ATTRIBUTE_COLORS[def.attribute]}" data-skill="${id}" ${!owned || !placed ? 'disabled' : ''} aria-label="${def.name}、MP${def.mp}${cd ? `、再使用まで${cd}行動` : ''}" aria-pressed="${selected === id}"><span class="skill-icon">${icons[id]}</span><strong>${owned ? def.short : '未入手'}</strong><small>${!owned ? '宝箱で発見' : !placed ? '未配置' : cd ? `CD ${cd}` : `MP ${def.mp}`}</small>${owned ? `<span class="skill-level">${effectiveLevel(s.skillBag, s.skillLevels, id)}</span>` : ''}</button>`;
  }).join('');
  buttons.querySelectorAll<HTMLButtonElement>('[data-skill]').forEach(b => b.addEventListener('click', () => { selected = selected === b.dataset.skill ? null : b.dataset.skill as SkillId; update(); }));
  document.getElementById('items')!.innerHTML = Array.from({ length: 3 }, (_, i) => { const item = s.itemSlots[i]; return `<button data-item="${i}" ${item ? '' : 'disabled'} aria-label="${item ? ITEMS[item].name : `空き枠${i + 1}`}"><span>${item ? ITEMS[item].icon : '·'}</span><small>${item ? ITEMS[item].name : '空き'}</small></button>`; }).join('');
  document.querySelectorAll<HTMLButtonElement>('[data-item]').forEach(b => b.addEventListener('click', () => itemDialog(Number(b.dataset.item))));
  const aim = document.getElementById('aim-bar')!; aim.hidden = !selected;
  const cast = document.querySelector<HTMLButtonElement>('#cast')!;
  cast.disabled = !selected || !!session.canCast(selected); cast.classList.toggle('ready', !!selected && !cast.disabled);
  cast.innerHTML = `<span>${selected ? `${SKILLS[selected].short}を発動` : 'スキルを選択'}</span><span>↗</span>`;
  if (selected) text('aim-label', session.canCast(selected) ?? `${SKILLS[selected].name} · ${SKILLS[selected].target === 'area' ? '周囲24マス' : '矢印で方向を選択'}`);
  if (renderer) renderer.selected = selected;
  document.getElementById('camera-reset')!.hidden = !renderer?.camera;
  const badge = document.getElementById('map-badge')!; badge.hidden = s.playerActionCount > 0 && !renderer?.camera; badge.textContent = renderer?.camera ? '遠見モード · 視界はプレイヤー基準' : '↓ 目の前の宝箱にアタック';
}
function direction(dir: Direction): void {
  if (modal || actionLocked || !session) return;
  if (selected) { session.state.playerState.facing = dir; if (renderer) renderer.camera = null; update(); }
  else act({ type: 'move', direction: dir });
}
function act(command: Command): void {
  if (!session || modal || actionLocked) return;
  if (renderer) renderer.camera = null;
  const success = session.execute(command);
  if (success) { renderer?.animate(session.events); persist(); actionLocked = true; window.setTimeout(() => { actionLocked = false; }, 130); }
  update();
  if (session.state.status !== 'playing') { if (lastOutcome !== session.state.status) { lastOutcome = session.state.status; window.setTimeout(outcome, 350); } }
  else if (session.state.pendingBag) openBag(true);
}
function itemDialog(slot: number): void {
  const id = session!.state.itemSlots[slot]; if (!id) return;
  dialog(`<div class="eyebrow">ITEM / ${slot + 1}</div><h2>${ITEMS[id].icon} ${ITEMS[id].name}</h2><p>${ITEMS[id].description}。使用すると1行動が経過します。</p><button class="primary" id="use-item">使用する</button><button class="secondary" id="close-item">戻る</button>`);
  on('use-item', () => { closeModal(); act({ type: 'item', slot }); }); on('close-item', closeModal);
}
function pause(): void {
  persist();
  dialog(`<div class="eyebrow">TAKE A BREATH</div><h2>ひとやすみ。</h2><p>${session!.stage.name} · ${session!.state.playerActionCount}行動<br>${saves.error || '冒険の途中経過を保存しました。'}</p><button id="resume" class="primary">冒険に戻る</button><button id="pause-settings" class="secondary">設定・あそび方</button><button id="to-home" class="text-button">中断してトップへ</button>`);
  on('resume', closeModal); on('pause-settings', showSettings); on('to-home', home);
}
function outcome(): void {
  if (!session || screen !== 'game') return;
  const clear = session.state.status === 'cleared', id = session.state.stageId;
  dialog(`<div class="result-symbol">${clear ? '✦' : '◇'}</div><div class="eyebrow">${clear ? 'EXPEDITION COMPLETE' : 'END OF EXPEDITION'}</div><h2>${clear ? '平原を踏破した。' : 'また、新しい一歩を。'}</h2><p>${session.stage.name} · ${session.stage.subtitle}<br>${session.state.playerActionCount}行動 / 古代の宝箱 ${session.state.objectiveChests}個</p><div class="note-card"><p>${clear && id < 5 ? `${STAGES[id].name}「${STAGES[id].subtitle}」が解放されました。` : clear ? '5つの平原をすべて踏破しました！' : '集めたスキルと道具は回収されます。新しい構成で再挑戦しよう。'}</p></div><button id="next-adventure" class="primary">${clear && id < 5 ? '次の平原へ' : 'もう一度挑戦'}</button><button id="result-stages" class="secondary">ステージ選択へ</button>`);
  on('next-adventure', () => startStage(clear && id < 5 ? id + 1 : id)); on('result-stages', stages);
}
function fullMap(): void {
  dialog(`<div class="dialog-heading"><div><div class="eyebrow">EXPLORATION MAP</div><h2>${session!.stage.name}の記録</h2></div><button id="close-map" class="icon-button" aria-label="地図を閉じる">×</button></div><canvas id="full-map" width="432" height="432" aria-label="探索済みの全体マップ"></canvas><div class="map-legend"><span>◼ 自分</span><span>◼ 宝箱・出口</span><span>◼ 視界内の敵</span></div><p class="footnote">地形は探索した場所だけ記録されます。<br>敵は現在の視界内だけ表示します。${session!.state.playerState.freeCamera ? '<br>地図をタップすると、その場所へカメラを移動します。' : ''}</p>`);
  const canvas = document.querySelector<HTMLCanvasElement>('#full-map')!; renderer?.drawMini(canvas.getContext('2d')!);
  if (session!.state.playerState.freeCamera) canvas.addEventListener('click', e => { const bounds = canvas.getBoundingClientRect(), size = Math.max(session!.state.mapState.width, session!.state.mapState.height); renderer!.camera = { x: Math.min(session!.state.mapState.width - 1, Math.floor((e.clientX - bounds.left) / bounds.width * size)), y: Math.min(session!.state.mapState.height - 1, Math.floor((e.clientY - bounds.top) / bounds.height * size)) }; closeModal(); update(); });
  on('close-map', closeModal);
}
function showSettings(): void {
  dialog(`<div class="dialog-heading"><div><div class="eyebrow">FIELD GUIDE</div><h2>設定とあそび方</h2></div><button id="close-settings" class="icon-button" aria-label="設定を閉じる">×</button></div><label class="setting-row">マップのマス目を表示<input id="grid-setting" type="checkbox" ${settings.grid ? 'checked' : ''}></label><label class="setting-row">アニメーション<input id="motion-setting" type="checkbox" ${settings.motion ? 'checked' : ''}></label><div class="guide"><h3>01 / 一歩が、1ターン。</h3><p>方向キーで移動。敵はあなたの行動後に動きます。宝箱はそのマスへ進むと開きます。敵にぶつかっても攻撃しません。</p><h3>02 / 選ぶ → 向く → 発動。</h3><p>スキルを選び、方向キーで照準を合わせて「発動」。選択中は移動しません。×で解除。待機でも5行動ごとにMPが3回復します。</p><h3>03 / つなぐと、強くなる。</h3><p>新しいスキルを入手したらバッグを配置。ブロックをドラッグ、または一覧で選んでマスをタップ。同じ属性を辺でつなぐと実効レベル+1。重複取得ではブロックは増えず基礎レベルが上がります。</p><h3>04 / 属性を組み合わせる。</h3><p>炎＋雷は即爆破。起爆したヒットの120%を追加し両属性を消去。風は炎・氷・雷を周囲1マスへ風散させ、10%ダメージ。属性は10行動持続します。</p><h3>キーボード</h3><p>矢印 / WASD：移動・照準、1〜5：スキル選択、Enter：発動、Space：待機、B：バッグ、M：地図。</p><p class="footnote">保存先はこのブラウザのlocalStorageです。ブラウザデータを消去すると復元できません。効果音は未実装です。</p></div>`);
  on('close-settings', closeModal);
  document.getElementById('grid-setting')!.addEventListener('change', e => { settings.grid = (e.target as HTMLInputElement).checked; saves.saveSettings(settings); if (renderer) renderer.settings = settings; });
  document.getElementById('motion-setting')!.addEventListener('change', e => { settings.motion = (e.target as HTMLInputElement).checked; saves.saveSettings(settings); if (renderer) renderer.settings = settings; });
}
function openBag(acquisition: boolean): void {
  if (!session) return;
  const draft: BagBlock[] = structuredClone(session.state.skillBag);
  let active = draft.at(-1)?.skillId ?? null;
  let rotation = draft.find(b => b.skillId === active)?.rotation ?? 0;
  let message = acquisition ? '手に入れたスキルを、旅の力に。' : '現在の配置を確認できます。';
  const editable = acquisition;
  dialog(`<div class="dialog-heading"><div><div class="eyebrow">YOUR SKILL BAG</div><h2>スキルバッグ</h2></div><span class="bag-size">5 × 5</span></div><p class="bag-intro">${editable ? 'ドラッグ、またはスキルを選んでマスをタップ。' : '配置の変更は新しいスキルを取得したときにできます。'}</p><div class="bag-layout"><div class="bag-grid" id="bag-grid" role="grid" aria-label="5×5のスキルバッグ"></div><div class="bag-tools"><button id="rotate" aria-label="選択ブロックを90度回転" ${editable ? '' : 'disabled'}>↻<small>回転</small></button><button id="unplace" ${editable ? '' : 'disabled'}>↥<small>外す</small></button></div></div><div id="bag-message" class="bag-message" aria-live="polite"></div><div id="bag-list" class="bag-list"></div><div id="skill-detail" class="skill-detail"></div><button id="confirm-bag" class="primary">${editable ? '配置を確定して進む' : '冒険に戻る'}<span>→</span></button>`, 'bag-modal');
  const grid = document.getElementById('bag-grid')!;
  function drawBag(): void {
    grid.innerHTML = Array.from({ length: 25 }, (_, i) => `<button class="bag-cell" data-cell="${i}" role="gridcell" aria-label="${i % 5 + 1}列${Math.floor(i / 5) + 1}行"></button>`).join('');
    for (const block of draft.filter(b => b.position)) {
      const def = SKILLS[block.skillId];
      const piece = document.createElement('div'); piece.className = `bag-piece ${block.skillId === active ? 'active' : ''}`; piece.dataset.block = block.skillId; piece.style.setProperty('--skill-color', ATTRIBUTE_COLORS[def.attribute]);
      const cells = shape(block.skillId, block.rotation), w = Math.max(...cells.map(c => c.x)) + 1, h = Math.max(...cells.map(c => c.y)) + 1;
      piece.style.cssText += `left:${block.position!.x * 20}%;top:${block.position!.y * 20}%;width:${w * 20}%;height:${h * 20}%;`;
      cells.forEach((c, i) => { const cell = document.createElement('span'); cell.className = 'piece-cell'; cell.style.cssText = `left:${c.x / w * 100}%;top:${c.y / h * 100}%;width:${100 / w}%;height:${100 / h}%;`; cell.textContent = i === 0 ? icons[block.skillId] : '·'; piece.append(cell); }); grid.append(piece);
    }
    document.getElementById('bag-message')!.textContent = message;
    document.getElementById('bag-list')!.innerHTML = draft.map(b => `<button data-bag-skill="${b.skillId}" class="bag-list-item ${active === b.skillId ? 'active' : ''}" style="--skill-color:${ATTRIBUTE_COLORS[SKILLS[b.skillId].attribute]}"><span>${icons[b.skillId]}</span><span><strong>${SKILLS[b.skillId].name}</strong><small>${ATTRIBUTE_NAMES[SKILLS[b.skillId].attribute]} · 基礎Lv.${session!.state.skillLevels[b.skillId]} ${connectionBonus(draft, b.skillId) ? `＋ 連結${connectionBonus(draft, b.skillId)}` : ''}</small></span><small>${b.position ? `Lv.${effectiveLevel(draft, session!.state.skillLevels, b.skillId)}` : '未配置'}</small></button>`).join('') || '<p class="footnote">まだスキルを持っていません。目の前の宝箱を開こう。</p>';
    document.querySelectorAll<HTMLButtonElement>('[data-bag-skill]').forEach(b => {
      b.addEventListener('click', () => { active = b.dataset.bagSkill as SkillId; rotation = draft.find(p => p.skillId === active)!.rotation; message = `${SKILLS[active].name}を選択中。${editable ? '置きたいマスをタップ。' : ''}`; drawBag(); });
      if (editable) b.addEventListener('pointerdown', e => beginDrag(e, b.dataset.bagSkill as SkillId));
    });
    document.querySelectorAll<HTMLElement>('[data-block]').forEach(b => b.addEventListener('pointerdown', e => { active = b.dataset.block as SkillId; rotation = draft.find(p => p.skillId === active)!.rotation; if (editable) beginDrag(e, active); else drawBag(); }));
    grid.querySelectorAll<HTMLButtonElement>('[data-cell]').forEach(b => b.addEventListener('click', () => { if (editable && active) place(active, { x: Number(b.dataset.cell) % 5, y: Math.floor(Number(b.dataset.cell) / 5) }); }));
    const detail = document.getElementById('skill-detail')!;
    if (active) { const d = SKILLS[active]; detail.innerHTML = `<strong>${d.name}</strong><span>MP ${d.mp} / CT ${d.cooldown} / 実効Lv.${effectiveLevel(draft, session!.state.skillLevels, active)}</span><p>${d.description}</p>`; }
    else detail.textContent = '';
  }
  function place(id: SkillId, p: Point): void {
    if (validPlacement(draft, id, p, rotation)) { const block = draft.find(b => b.skillId === id)!; block.position = p; block.rotation = rotation; const bonus = connectionBonus(draft, id); message = bonus ? `炎の連結！ つながるスキルの実効レベル +${bonus}` : '配置しました。'; }
    else message = 'その場所には入りません。空いているマスへ置こう。';
    drawBag();
  }
  function beginDrag(event: PointerEvent, id: SkillId): void {
    if (event.button !== 0) return;
    active = id; rotation = draft.find(b => b.skillId === id)!.rotation;
    const start = { x: event.clientX, y: event.clientY }; let moving = false;
    const ghost = document.createElement('div'); ghost.className = 'drag-ghost'; ghost.style.setProperty('--skill-color', ATTRIBUTE_COLORS[SKILLS[id].attribute]); ghost.textContent = icons[id];
    const move = (e: PointerEvent) => { if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 7 && !moving) return; moving = true; if (!ghost.isConnected) document.body.append(ghost); ghost.style.left = `${e.clientX}px`; ghost.style.top = `${e.clientY - 24}px`; };
    const finish = (e: PointerEvent) => {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish); document.removeEventListener('pointercancel', cancel); ghost.remove();
      if (moving) { e.preventDefault(); const r = grid.getBoundingClientRect(); place(id, { x: Math.floor((e.clientX - r.left) / r.width * 5), y: Math.floor((e.clientY - r.top) / r.height * 5) }); }
      else { message = `${SKILLS[id].name}を選択中。置きたいマスをタップ。`; drawBag(); }
    };
    const cancel = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish); document.removeEventListener('pointercancel', cancel); ghost.remove(); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', finish); document.addEventListener('pointercancel', cancel);
  }
  on('rotate', () => {
    if (!active || !editable || !SKILLS[active].rotatable) return;
    const b = draft.find(b => b.skillId === active)!; rotation = (rotation + 1) % 4;
    if (b.position && !validPlacement(draft, active, b.position, rotation)) { b.position = null; message = '回転しました。空いているマスに置き直してください。'; }
    else message = '90度回転しました。';
    b.rotation = rotation; drawBag();
  });
  on('unplace', () => { if (active && editable) { draft.find(b => b.skillId === active)!.position = null; message = 'バッグから外しました。一覧に保管されます。'; drawBag(); } });
  on('confirm-bag', () => { if (editable) { session!.state.skillBag = draft; session!.state.pendingBag = false; persist(); } if (selected && !draft.find(b => b.skillId === selected)?.position) selected = null; closeModal(); update(); });
  drawBag();
}
document.addEventListener('keydown', event => {
  if (screen !== 'game' || modal || event.repeat) return;
  const dirs: Record<string, Direction> = { ArrowUp: 'up', w: 'up', ArrowRight: 'right', d: 'right', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left' };
  if (dirs[event.key]) { event.preventDefault(); direction(dirs[event.key]); }
  else if (event.key === ' ') { event.preventDefault(); selected = null; act({ type: 'wait' }); }
  else if (event.key === 'Enter' && selected) { event.preventDefault(); act({ type: 'cast', skillId: selected, direction: session!.state.playerState.facing }); }
  else if (/^[1-5]$/.test(event.key)) { const id = (Object.keys(SKILLS) as SkillId[])[Number(event.key) - 1]; if (session!.state.skillBag.some(b => b.skillId === id && b.position)) { selected = selected === id ? null : id; update(); } }
  else if (event.key === 'Escape') { selected = null; update(); }
  else if (event.key === 'b') openBag(false);
  else if (event.key === 'm') fullMap();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'game') persist(); });
window.addEventListener('pagehide', () => { if (screen === 'game') persist(); });
home();
