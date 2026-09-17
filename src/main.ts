import { pixelIcon, SKILL_ICONS, ITEM_ICONS } from './data/PixelIcons';
import { skillDescription } from './skills/SkillDescription';
import { requiredExperience } from './game/Progression';
/** 画面遷移・タッチ操作・モーダルを管理。ゲームのルールはGameSessionへ委譲します。 */
/// <reference types="vite/client" />
import './style.css';
import './pop.css';
import { GameSession } from './game/GameSession';
import { SaveManager } from './game/SaveManager';
import type { Command } from './game/Command';
import type { BagBlock, Direction, Point, SkillId } from './game/types';
import { ATTRIBUTE_COLORS, ATTRIBUTE_NAMES, SKILLS } from './data/skills';
import { GEM_REWARDS } from './data/gems';
import { skillMpLabel } from './skills/SkillWear';
import { ITEMS } from './data/items';
import { blockCells, connectionDamageMultiplier, connectionBonus, effectiveLevel, shape, validPlacement } from './skills/SkillBag';
import { STAGES } from './stages';
import { GameCanvas } from './render/GameCanvas';
import { SoundManager } from './audio/SoundManager';
import { previewSkill, validSkillTarget } from './skills/SkillResolver';
import { timeOfDay } from './game/DayCycle';
import { attackPower, detection } from './game/ActorStats';
import { occupied, same } from './game/MapState';
import { BALANCE } from './game/TurnManager';

const app = document.querySelector<HTMLDivElement>('#app')!;
const saves = new SaveManager(undefined, import.meta.env.DEV && location.pathname === '/dev/preview.html' ? 'pixel-world.preview' : 'pixel-world');
let settings = saves.settings();
const sound = new SoundManager(); sound.enabled = settings.sound;
let session: GameSession | null = null;
let renderer: GameCanvas | null = null;
let selected: SkillId | null = null;
let aim: Point | undefined;
let screen: 'home' | 'stages' | 'game' = 'home';
let modal: HTMLElement | null = null;
let actionLocked = false;
let lastOutcome = '';
const icons = Object.fromEntries(Object.entries(SKILL_ICONS).map(([id, d]) => [id,pixelIcon(d)])) as Record<SkillId,string>;
function selectSkill(id: SkillId): void {
  selected = selected === id ? null : id; aim = undefined;
  if (renderer && selected && ['pointArea','enemyWarp'].includes(SKILLS[selected].target)) renderer.camera = null;
  update();
  if (selected) { const strip = document.getElementById('skill-buttons'), button = strip?.querySelector<HTMLElement>('[data-skill="' + selected + '"]'); if (strip && button) { const r = button.getBoundingClientRect(), box = strip.getBoundingClientRect(); if (r.left < box.left || r.right > box.right) strip.scrollBy({ left: r.left < box.left ? r.left - box.left - 4 : r.right - box.right + 4, behavior: 'smooth' }); } }
}
function castSelected(): void {
  if (selected && session && validSkillTarget(session.state, selected, aim)) act({ type: 'cast', skillId: selected, direction: session.state.playerState.facing, target: aim });
}
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
const gameInputCleanup: (()=>void)[] = [];
function stopRenderer(): void { gameInputCleanup.splice(0).forEach(cleanup=>cleanup()); document.body.classList.remove('critical-health'); renderer?.destroy(); renderer = null; }
function home(): void {
  stopRenderer(); closeModal(); screen = 'home';
  const saved = saves.load(), progress = saves.progress();
  app.innerHTML = `<main class="home-shell">${header('草原の迷宮', false)}
    <section class="hero"><div class="eyebrow"><span></span> A LITTLE TURN-BASED ADVENTURE</div>
      <h1>ピクセル<span>ワールド</span></h1>
      <div class="hero-art"><canvas id="hero-canvas" aria-label="ドット絵の草原と冒険者"></canvas><div class="hero-vignette"></div></div>
    </section>
    <nav class="home-actions"><button id="solo" class="primary large"><span>ソロプレイ<span class="button-sub">新しい冒険をはじめる</span></span><span>↗</span></button>
      <button id="continue" class="secondary large" ${saved?.status === 'playing' ? '' : 'disabled'}><span>続きから<span class="button-sub">${saved?.status === 'playing' ? `${STAGES[saved.stageId - 1].name} · ${saved.playerActionCount}行動` : '中断中の冒険はありません'}</span></span><span>→</span></button>
      <div class="home-bottom"><button disabled><span>⚑ 対戦</span><small>準備中</small></button><button id="settings">⚙ 設定・あそび方</button></div>
    </nav><footer class="home-footer"><span class="status-dot"></span> SOLO PROTOTYPE <span>${progress}/${STAGES.length} EXPLORED</span></footer>
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
    return `<button class="stage-card ${locked ? 'locked' : ''} ${stage.id === Math.min(STAGES.length, progress + 1) ? 'current' : ''}" data-stage="${stage.id}" ${locked ? 'disabled' : ''}><span class="stage-number">0${stage.id}</span><span class="stage-details"><small>${stage.name} ${clear ? '· 踏破済み' : locked ? '· 未解放' : '· 探索可能'}</small><strong>${stage.subtitle}</strong><span>${stage.objective} · ${stage.dungeon?.floors ?? "1"}層</span></span><span class="stage-arrow">${locked ? '◇' : clear ? '✓' : '↗'}</span></button>`;
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
  closeModal(); session = GameSession.create(id, crypto.getRandomValues(new Uint32Array(1))[0]); selected = null; lastOutcome = ''; showGame(); session.log(`${session.stage.name} 第1層の探索を開始した！`); persist();
}
function showGame(): void {
  stopRenderer(); screen = 'game'; const s = session!;
  app.innerHTML = `<main class="game-shell"><header class="game-header"><div><span class="eyebrow">THE GREEN EXPANSE / 0${s.state.stageId}</span><h1>${s.stage.name} <small>${s.state.floorNumber ?? 1}/${s.state.floorCount ?? 1}層</small><span>${s.stage.subtitle}</span></h1></div><button id="pause" class="icon-button" aria-label="中断メニュー">Ⅱ</button></header>
    <section class="hud"><button id="map-button" class="minimap-button" aria-label="全体マップを開く"><canvas id="minimap"></canvas><span>MAP ↗</span></button><div class="vitals"><div class="vital"><span class="vital-title">HP</span><div class="meter"><i id="hp-bar"></i></div><strong id="hp-label"></strong></div><div class="vital mp"><span class="vital-title">MP</span><div class="meter"><i id="mp-bar"></i></div><strong id="mp-label"></strong></div><div class="vital exp"><span class="vital-title" id="level-label"></span><div class="meter"><i id="exp-bar"></i></div><strong id="exp-label"></strong></div></div><div class="turn-counter"><small>ACTION</small><strong id="turn-label">00</strong><span id="regen-label"></span></div></section>
    <section class="map-viewport"><canvas id="game-canvas" aria-label="周囲11×11、外周が半マス見切れるダンジョンマップ"></canvas><div class="map-objective" id="objective-text"></div><div id="phase-label" hidden></div><button id="camera-reset" hidden>◎ プレイヤーへ</button><div id="event-feed" aria-live="polite"></div><button id="sleep-button" class="sleep-button" hidden>☾ 睡眠</button><div class="map-tools"><button id="day-clock" aria-label="昼夜の状態"></button><button id="log-button">ログ</button><button id="bag-button" aria-label="スキルバッグを開く">▦ バッグ</button></div><div class="cast-slot"><button id="cast" class="cast-button" hidden></button></div></section>
    <section class="controls"><div class="skill-strip-wrap"><span id="skill-left" class="scroll-hint" hidden>‹</span><span id="skill-right" class="scroll-hint right" hidden>›</span><div id="skill-buttons" class="skill-buttons" tabindex="0" aria-label="配置済みスキル。左右にスクロールできます"></div></div>
      <div class="control-bottom"><div class="dpad" aria-label="方向操作"><button data-dir="up" class="up" aria-label="上へ移動、スキル選択中は上を向く">↑</button><button data-dir="left" class="left" aria-label="左へ移動、スキル選択中は左を向く">←</button><button id="wait" class="wait" aria-label="1行動待機">待機</button><button data-dir="right" class="right" aria-label="右へ移動、スキル選択中は右を向く">→</button><button data-dir="down" class="down" aria-label="下へ移動、スキル選択中は下を向く">↓</button></div>
      <div class="action-column"><div class="items-label">道具 <small>3枠</small></div><div id="items" class="items"></div></div></div>
    </section><footer class="game-footer"><span id="save-label">● 自動保存</span><span>一歩ずつ、ゆっくりと。</span></footer></main>`;
  renderer = new GameCanvas(document.querySelector<HTMLCanvasElement>('#game-canvas')!, document.querySelector<HTMLCanvasElement>('#minimap')!); renderer.session = s; renderer.settings = settings; renderer.selected = selected; renderer.start();
  renderer.onSound = event => sound.play(event);
  s.isOnScreen = point => renderer?.onScreen(point) ?? false;
  s.onLog = message => {
    const feed = document.getElementById('event-feed'); if (!feed || screen !== 'game') return;
    const line = document.createElement('div'); line.textContent = message; feed.append(line);
    const fade = (entry: HTMLElement) => { if (entry.dataset.fading) return; entry.dataset.fading = 'true'; entry.classList.add('fading'); entry.addEventListener('animationend', event => { if (event.animationName === 'log-exit') entry.remove(); }); };
    window.setTimeout(() => fade(line), 4000);
    const waiting = [...feed.children].filter(el => !(el as HTMLElement).dataset.fading) as HTMLElement[];
    waiting.slice(0, Math.max(0, waiting.length - 5)).forEach(fade);
  };
  on('sleep-button', () => { if (!actionLocked && s.canSleep()) { selected = null; act({ type: 'sleep' }); } });
  on('log-button', () => {
    dialog(`<div class="dialog-heading"><h2>冒険ログ</h2><button id="close-log" class="icon-button" aria-label="ログを閉じる">×</button></div><ol class="history-log">${s.state.log.slice(-100).reverse().map(line => `<li>${escape(line)}</li>`).join('') || '<li>まだ記録はありません。</li>'}</ol>`);
    on('close-log', closeModal);
  });
  renderer.onPhase = phase => { const label = document.getElementById('phase-label'); if (label) { label.textContent = phase; label.hidden = !phase; } };
  on('pause', pause); on('bag-button', () => openBag(false)); on('map-button', fullMap); on('wait', () => { selected = null; act({ type: 'wait' }); });
  on('cast', castSelected);
  on('cancel-aim', () => { selected = null; update(); });
  on('camera-reset', () => { renderer!.camera = null; update(); });
  app.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach(button => {
    let repeat=0, pointer:number|null=null;
    const stop=()=>{clearTimeout(repeat);pointer=null;};
    const tick=()=>{if(pointer===null||!button.isConnected||modal||screen!=='game'){stop();return;}if(!actionLocked)direction(button.dataset.dir as Direction);repeat=window.setTimeout(tick,100);};
    button.addEventListener('pointerdown',e=>{if(e.button!==0||pointer!==null)return;e.preventDefault();pointer=e.pointerId;button.setPointerCapture(e.pointerId);direction(button.dataset.dir as Direction);repeat=window.setTimeout(tick,400);});
    button.addEventListener('pointerup',stop);button.addEventListener('pointercancel',stop);button.addEventListener('lostpointercapture',stop);
    button.addEventListener('click',e=>{e.preventDefault();if(e.detail===0)direction(button.dataset.dir as Direction);});
    const hide=()=>{if(document.hidden)stop();};window.addEventListener('blur',stop);document.addEventListener('visibilitychange',hide);
    gameInputCleanup.push(()=>{stop();window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',hide);});
  });
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
  // マウスのみドラッグを補助。タッチはブラウザ本来の横スクロールを使います。
  const strip = document.getElementById('skill-buttons')!;
  let gesture: {x:number;y:number;currentX:number;currentY:number;scroll:number;id:SkillId|null;timer:number;reorder:boolean;moved:boolean;pointer:number}|null=null;
  let ghost:HTMLElement|null=null, frame=0, lastTime=0;
  const arrows=()=>{const l=document.getElementById('skill-left'),r=document.getElementById('skill-right');if(l)l.hidden=strip.scrollLeft<2;if(r)r.hidden=strip.scrollLeft+strip.clientWidth>=strip.scrollWidth-2;};
  strip.addEventListener('scroll',arrows); const observer=new ResizeObserver(arrows);observer.observe(strip);
  const reorderTick=(now:number)=>{
    const g=gesture;if(!g?.reorder||!strip.isConnected){ghost?.remove();ghost=null;return;}
    const dt=Math.min(40,now-lastTime||16);lastTime=now;const box=strip.getBoundingClientRect();
    const edge=42, speed=g.currentX<box.left+edge?-Math.min(1,(box.left+edge-g.currentX)/edge):g.currentX>box.right-edge?Math.min(1,(g.currentX-box.right+edge)/edge):0;
    strip.scrollLeft+=speed*180*dt/1000;
    if(ghost){ghost.style.left=(g.currentX-ghost.offsetWidth/2)+'px';ghost.style.top=(g.currentY-ghost.offsetHeight/2-8)+'px';}
    const buttons=[...strip.querySelectorAll<HTMLElement>('[data-skill]')], current=buttons.find(b=>b.dataset.skill===g.id);
    if(current){
      current.classList.add('drag-source');const ci=buttons.indexOf(current);
      const target=buttons.find((b,i)=>{const middle=box.left+b.offsetLeft-strip.scrollLeft+b.offsetWidth/2;return i<ci?g.currentX<middle:i>ci&&g.currentX>middle;});
      if(target){
        buttons.forEach(b=>b.getAnimations().forEach(a=>a.cancel()));
        const before=new Map(buttons.map(b=>[b.dataset.skill!,b.getBoundingClientRect().left]));
        const bag=s.state.skillBag,from=bag.findIndex(b=>b.skillId===g.id),to=bag.findIndex(b=>b.skillId===target.dataset.skill);bag.splice(to,0,bag.splice(from,1)[0]);update();
        for(const b of strip.querySelectorAll<HTMLElement>('[data-skill]')){
          if(b.dataset.skill===g.id){b.classList.add('drag-source');continue;}
          const dx=(before.get(b.dataset.skill!)??b.getBoundingClientRect().left)-b.getBoundingClientRect().left;
          if(dx&&settings.motion)b.animate([{transform:'translateX('+dx+'px)'},{transform:'translateX(0)'}],{duration:180,easing:'ease-out'});
        }
      }
    }
    frame=requestAnimationFrame(reorderTick);
  };
  strip.addEventListener('pointerdown',e=>{
    if(e.button!==0||actionLocked||gesture)return;strip.setPointerCapture(e.pointerId);strip.classList.add('drag-scrolling');
    const button=(e.target as HTMLElement).closest<HTMLElement>('[data-skill]'),id=button?.dataset.skill as SkillId|undefined;
    gesture={x:e.clientX,y:e.clientY,currentX:e.clientX,currentY:e.clientY,scroll:strip.scrollLeft,id:id??null,reorder:false,moved:false,pointer:e.pointerId,timer:window.setTimeout(()=>{
      if(gesture&&!gesture.moved&&gesture.id&&button){gesture.reorder=true;strip.classList.add('reordering-skills');strip.setPointerCapture(e.pointerId);sound.ui();ghost=button.cloneNode(true) as HTMLElement;ghost.removeAttribute('data-skill');ghost.classList.add('skill-drag-ghost');ghost.style.width=button.offsetWidth+'px';ghost.style.height=button.offsetHeight+'px';document.body.append(ghost);lastTime=performance.now();frame=requestAnimationFrame(reorderTick);}
    },1000)};
  });
  strip.addEventListener('pointermove',e=>{const g=gesture;if(!g)return;g.currentX=e.clientX;g.currentY=e.clientY;const dx=e.clientX-g.x;
    if(!g.reorder&&Math.hypot(dx,e.clientY-g.y)>7){g.moved=true;clearTimeout(g.timer);}
    if(g.reorder){e.preventDefault();}else if(g.moved){strip.setPointerCapture(e.pointerId);strip.scrollLeft=g.scroll-dx;e.preventDefault();}
  });
  const finish=()=>{if(!gesture)return;clearTimeout(gesture.timer);cancelAnimationFrame(frame);if(gesture.reorder){persist();}const pointer=gesture.pointer;gesture=null;if(strip.hasPointerCapture(pointer))strip.releasePointerCapture(pointer);ghost?.remove();ghost=null;strip.classList.remove('reordering-skills','drag-scrolling');strip.querySelectorAll('.drag-source').forEach(b=>b.classList.remove('drag-source'));};
  gameInputCleanup.push(()=>{finish();observer.disconnect();});
  const hideStrip=()=>{if(document.hidden)finish();};document.addEventListener('visibilitychange',hideStrip);window.addEventListener('blur',finish);gameInputCleanup.push(()=>{document.removeEventListener('visibilitychange',hideStrip);window.removeEventListener('blur',finish);});
  // pointer capture中のclickはカードではなく欄へ届くため、短いタップはここで選択。
  strip.addEventListener('pointerup',e=>{
    const g=gesture;if(!g||g.pointer!==e.pointerId)return;
    const tapped=!g.moved&&!g.reorder&&Math.hypot(e.clientX-g.x,e.clientY-g.y)<8;
    const id=g.id;finish();
    if(tapped&&id&&!actionLocked&&!modal)selectSkill(id);
  });strip.addEventListener('pointercancel',finish);strip.addEventListener('lostpointercapture',e=>{if(e.target===strip&&gesture?.pointer===e.pointerId)finish();});
  strip.addEventListener('click',e=>{if(e.detail>0){e.preventDefault();e.stopImmediatePropagation();}},true);
  strip.addEventListener('contextmenu',e=>e.preventDefault());strip.addEventListener('dragstart',e=>e.preventDefault());requestAnimationFrame(arrows);

  let drag: { x: number; y: number; camera: Point } | null = null;
  canvas.addEventListener('pointerdown', e => {
    if (modal || actionLocked) return;
    if (selected && ['pointArea', 'enemyWarp'].includes(SKILLS[selected].target)) {
      const target = renderer!.mapPoint(e.clientX, e.clientY);
      if (validSkillTarget(s.state, selected, target)) { aim = target; update(); }
      return;
    }
    const cell = renderer!.mapPoint(e.clientX, e.clientY);
    if (occupied(s.state.playerState).some(p => same(p, cell))) {
      const p = s.state.playerState;
      dialog('<div class="dialog-heading"><h2>旅人 Lv.' + s.state.playerLevel + '</h2><button id="close-player" class="icon-button">×</button></div><p>HP ' + p.hp + ' / ' + p.maxHp + '<br>MP ' + p.mp + ' / ' + p.maxMp + '<br>基礎攻撃力 ' + p.attack + '（現在 ' + attackPower(p) + '）<br>会心率 ' + Math.round(p.criticalRate * 100) + '%<br>会心ダメージ ' + Math.round(p.criticalMultiplier * 100) + '%</p><h3>バフ・状態</h3><p>' + ((p.buffs ?? []).filter(b => b.remainingTurns > 0).map(b => '攻撃+' + (b.attackBonus ?? 0) + '・攻撃×' + b.attackMultiplier + '・索敵+' + b.detectionBonus + '：残り' + b.remainingTurns + 'ターン').concat(p.afflictions.map(a => ATTRIBUTE_NAMES[a.attribute] + '：残り' + a.remainingTurns + 'ターン'), (p.movementLockedUntil ?? 0) > s.state.playerActionCount ? ['移動不可'] : [], p.visionBonus ? ['視野+' + p.visionBonus] : []).join('<br>') || 'なし') + '</p>');
      on('close-player', closeModal); return;
    }
    const ally = s.state.allyStates.find(a => a.hp > 0 && s.visible(a.position) && occupied(a).some(p => same(p, cell)));
    if (ally) {
      dialog('<div class="dialog-heading"><h2>' + escape(ally.name) + '</h2><button id="close-ally" class="icon-button" aria-label="閉じる">×</button></div><p>HP ' + ally.hp + ' / ' + ally.maxHp + '<br>生存ターン 残り' + (ally.remainingLife ?? 30) + '<br>攻撃力 ' + attackPower(ally) + '<br>索敵範囲 ' + detection(ally) + 'マス<br>会心率 ' + Math.round((ally.criticalRate ?? .05) * 100) + '%<br>会心ダメージ ' + Math.round((ally.criticalMultiplier ?? 1.5) * 100) + '%</p><p class="footnote">旅人から周囲9×9の外へ離れると、最優先で近くへワープします。</p>');
      const dismiss = document.createElement('button'); dismiss.textContent = '精霊を強制消滅'; dismiss.className = 'dismiss-ally'; modal!.querySelector('.dialog')?.append(dismiss);
      if (!dismiss.isConnected) modal!.firstElementChild!.append(dismiss);
      dismiss.addEventListener('click', () => { if (!window.confirm(ally.name + 'を消滅させますか？')) return; s.state.allyStates = s.state.allyStates.filter(a => a.id !== ally.id); s.log(ally.name + 'を消滅させた。'); persist(); closeModal(); update(); });
      on('close-ally', closeModal); return;
    }
    if (!s.state.playerState.freeCamera) return;
    drag = { x: e.clientX, y: e.clientY, camera: { ...(renderer!.camera ?? s.state.playerState.position) } }; canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => { if (!drag) return; const unit = canvas.getBoundingClientRect().width / 10; renderer!.camera = { x: Math.max(0, Math.min(s.state.mapState.width - 1, drag.camera.x - Math.round((e.clientX - drag.x) / unit))), y: Math.max(0, Math.min(s.state.mapState.height - 1, drag.camera.y - Math.round((e.clientY - drag.y) / unit))) }; update(); });
  canvas.addEventListener('pointerup', () => { drag = null; }); canvas.addEventListener('pointercancel', () => { drag = null; });
  update(); if (s.state.pendingGemChoices?.length) openGem(); else if (s.state.pendingBag) openBag(true);
}
function update(): void {
  if (screen !== 'game' || !session) return;
  const s = session.state, p = s.playerState;
  const text = (id: string, value: string) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  text('hp-label', `${Math.ceil(p.hp)} / ${p.maxHp}`); text('mp-label', `${p.mp} / ${p.maxMp}`); text('turn-label', String(s.playerActionCount).padStart(2, '0'));
  const clock = document.querySelector<HTMLButtonElement>('#day-clock')!;
  document.body.classList.toggle('critical-health', p.hp > 0 && p.hp / p.maxHp <= .1);
  document.body.classList.toggle('still-effects', !settings.motion);
  const tod = timeOfDay(s), count = s.daylightCount ?? 0;
  document.getElementById('sleep-button')!.hidden=!session.canSleep();
  clock.textContent = (tod === 'night' ? (count >= 150 ? '☾ 深夜' : '☾ 夜') : tod === 'evening' ? '◒ 夕' : '☀ 昼') + ' ' + count;
  clock.style.setProperty('--day-progress', Math.min(100, count) + '%');
  clock.title = '昼0〜79・夕80〜99・夜100以降。夜、敵に見つかっていなければ睡眠できます';
  clock.setAttribute('aria-label', clock.title);
  clock.classList.remove('sleep-ready');
  text('regen-label', (p.movementLockedUntil ?? -1) > s.playerActionCount ? '移動不可 · 1行動' : `MP回復まで${BALANCE.mpRecoveryInterval - (s.mpRecoveryActions ?? 0)}`);
  document.getElementById('hp-bar')!.style.width = `${p.hp / p.maxHp * 100}%`; document.getElementById('mp-bar')!.style.width = `${p.mp / p.maxMp * 100}%`;
  text('objective-text', `${session.goalReady() ? '出口へ向かおう' : session.stage.objective}${session.stage.goal === 'treasure' ? ` (${s.objectiveChests}/${session.stage.requiredChests})` : ''}`);
  text('level-label', `Lv.${s.playerLevel}`); text('exp-label', s.playerLevel === 20 ? 'MAX' : `${s.experience}/${requiredExperience(s.playerLevel!)}`); document.getElementById('exp-bar')!.style.width = `${s.playerLevel === 20 ? 100 : s.experience! / requiredExperience(s.playerLevel!) * 100}%`; document.getElementById('exp-bar')!.parentElement!.setAttribute('aria-label', '経験値'); text('message-text', s.log.at(-1) ?? ''); text('bag-count', `${s.skillBag.filter(b => b.position).flatMap(blockCells).length}/${s.bagCells!.length}`);
  text('save-label', saves.error ? `⚠ ${saves.error}` : '● 自動保存');
  const buttons = document.getElementById('skill-buttons')!;
  const scrollLeft = buttons.scrollLeft;
  const equipped = s.skillBag.filter(b => b.position).map(b => b.skillId);
  buttons.innerHTML = equipped.map(id => {
    const def = SKILLS[id], cd = s.cooldowns[id] ?? 0;
    const unavailable = session!.canCast(id);
    return `<button class="skill-button ${cd ? 'cooling' : unavailable ? 'unavailable' : 'available'} ${selected === id ? 'selected' : ''}" style="--skill-color:${ATTRIBUTE_COLORS[def.attribute]}" data-skill="${id}" aria-label="${def.name}、${skillMpLabel(s, id)}${selected === id ? '、もう一度タップで選択解除' : ''}${cd ? `、再使用まで${cd}行動` : ''}" aria-pressed="${selected === id}"><span class="skill-icon">${icons[id]}</span><strong>${def.name}</strong><small class="skill-cost">${skillMpLabel(s, id)}${selected === id ? ' · ×解除' : ''}</small><span class="skill-level">${cd ? `⌛ あと${cd}行動` : unavailable ? unavailable : `発動可能 · CT ${def.cooldown}`} · Lv.${effectiveLevel(s.skillBag, s.skillLevels, id)}</span></button>`;
  }).join('') || '<div class="empty-skills"><span>✦</span><p>宝箱から、最初のスキルを！<small>配置したスキルがここに並びます</small></p></div>';
  buttons.scrollLeft = scrollLeft; buttons.dispatchEvent(new Event('scroll'));
  buttons.querySelectorAll<HTMLButtonElement>('[data-skill]').forEach(b => b.addEventListener('click', () => selectSkill(b.dataset.skill as SkillId)));
  document.getElementById('items')!.innerHTML = Array.from({ length: 3 }, (_, i) => { const item = s.itemSlots[i]; return `<button class="${item ? 'item-filled' : 'item-empty'}" data-item="${i}" ${item ? '' : 'disabled'} aria-label="${item ? ITEMS[item].name : `空き枠${i + 1}`}"><span>${item ? pixelIcon(ITEM_ICONS[item]) : '·'}</span><small>${item ? ITEMS[item].name : '空き'}</small></button>`; }).join('');
  document.querySelectorAll<HTMLButtonElement>('[data-item]').forEach(b => b.addEventListener('click', () => itemDialog(Number(b.dataset.item))));
  const cast = document.querySelector<HTMLButtonElement>('#cast')!;
  if (selected && !validSkillTarget(s, selected, aim)) aim = undefined;
  // 選択中はボタン自体を残し、MP・CT・着弾点など発動できない理由を表示する。
  const castError = selected ? session.canCast(selected) ?? (!validSkillTarget(s, selected, aim) ? 'マップで対象を選択' : actionLocked ? '行動の終了を待っています' : null) : null;
  cast.disabled = !selected || !!castError; cast.classList.toggle('ready', !!selected && !cast.disabled);
  cast.hidden = !selected;
  cast.textContent = selected ? castError ?? `${SKILLS[selected].short}を発動 ↗` : '';
  cast.setAttribute('aria-label', selected ? `${SKILLS[selected].name}：${castError ?? '発動確定'}` : 'スキルを選択');
  if (selected && !aim && ['pointArea', 'enemyWarp'].includes(SKILLS[selected].target)) text('objective-text', SKILLS[selected].target === 'enemyWarp' ? 'マップで周囲5×5内の敵をタップして選択' : 'マップをタップして着弾点を選択');
  if (renderer) { renderer.selected = selected; renderer.aim = aim; }
  document.getElementById('camera-reset')!.hidden = !renderer?.camera;
}
function direction(dir: Direction): void {
  if (modal || actionLocked || !session) return;
  if (selected) { session.state.playerState.facing = dir; if (renderer) renderer.camera = null; update(); }
  else act({ type: 'move', direction: dir });
}
function act(command: Command): void {
  if (!session || modal || actionLocked) return;
  sound.unlock();
  if (renderer) renderer.camera = null;
  const before = structuredClone(session.actors);
  const previousFloor = session.state.floorNumber;
  const success = session.execute(command);
  if (success && command.type === 'cast' && selected && (session.canCast(selected) || !['warp','groundTrap'].includes(SKILLS[selected].target) && !previewSkill(session.state,selected,session.state.playerState.facing,aim).targetIds.length)) { selected = null; aim = undefined; }
  if (success && previousFloor !== session.state.floorNumber) { selected = null; persist(); showGame(); session.onLog?.(session.state.log.at(-1)!); arrivalEffect('第' + session.state.floorNumber + '層へ', false); return; }
  if (success) {
    if (command.type === 'sleep') arrivalEffect('朝になった', true);
    if (command.type === 'move' && before[0] && (before[0].position.x !== session.state.playerState.position.x || before[0].position.y !== session.state.playerState.position.y)) sound.step();
    const duration = Math.max(renderer?.animateTurn(before, session.frames) ?? 0, command.type === 'sleep' ? 2400 : 0);
    persist(); actionLocked = true;
    document.querySelector('.game-shell')?.setAttribute('aria-busy', 'true');
    window.setTimeout(() => {
      actionLocked = false; document.querySelector('.game-shell')?.setAttribute('aria-busy', 'false');
      if (!session || screen !== 'game') return;
      update();
      if (session.state.status !== 'playing') { if (lastOutcome !== session.state.status) { lastOutcome = session.state.status; outcome(); } }
      else if (session.state.pendingGemChoices?.length) openGem();
      else if (session.state.pendingBag) openBag(true);
    }, duration);
  }
  update();
}
function openGem(): void {
  if (!session?.state.pendingGemChoices?.length) return;
  dialog('<h2>宝石の力を選ぶ</h2><p>冒険中の強化を1つ選択してください。</p>' + session.state.pendingGemChoices[0].map((id, i) => '<button class="secondary gem-choice" data-reward="' + i + '">' + escape(GEM_REWARDS[id].name) + '</button>').join(''));
  modal!.querySelectorAll<HTMLElement>('[data-reward]').forEach(b => b.addEventListener('click', () => {
    if (!session!.chooseGem(Number(b.dataset.reward))) return;
    persist(); closeModal(); update(); if (session!.state.pendingGemChoices?.length) openGem(); else if (session!.state.pendingBag) openBag(true);
  }));
}
function arrivalEffect(label:string, morning:boolean):void {
  const panel=document.createElement('div');panel.className='arrival-effect '+(morning?'morning':'floor-arrival');panel.innerHTML=morning?'<span class="morning-title">'+label+'</span><i class="eyelid top"></i><i class="eyelid bottom"></i>':label;document.querySelector('.map-viewport')?.append(panel);
  sound.play({type:'pickup',position:{x:0,y:0},sound:morning?'healing':'magicCast'});
  window.setTimeout(()=>panel.remove(),morning?2400:1600);
}
function itemDialog(slot: number): void {
  if (actionLocked) return;
  const id = session!.state.itemSlots[slot]; if (!id) return;
  const drop = () => { if (session!.dropItem(slot)) { persist(); closeModal(); update(); } };
  if (id === 'hourglass') {
    const choices = session!.state.skillBag.filter(b => (session!.state.cooldowns[b.skillId] ?? 0) > 0);
    dialog('<h2>砂時計（小）</h2><p>短縮するスキルを選択</p>' + choices.map(b => '<button class="secondary gem-choice" data-hourglass="' + b.skillId + '">' + SKILLS[b.skillId].name + ' CT ' + session!.state.cooldowns[b.skillId] + ' → ' + Math.max(0, session!.state.cooldowns[b.skillId]! - 10) + '</button>').join('') + (choices.length ? '' : '<p>再使用待ちのスキルはありません。</p>') + '<button id="drop-item" class="secondary">その場に捨てる</button><button id="close-item" class="text-button">戻る</button>');
    modal!.querySelectorAll<HTMLElement>('[data-hourglass]').forEach(b => b.addEventListener('click', () => { closeModal(); act({ type: 'item', slot, skillId: b.dataset.hourglass as SkillId }); })); on('drop-item', drop); on('close-item', closeModal); return;
  }
  dialog(`<div class="eyebrow">ITEM / ${slot + 1}</div><h2>${pixelIcon(ITEM_ICONS[id])} ${ITEMS[id].name}</h2><p>レアランク ${ITEMS[id].rareRank} · ${ITEMS[id].description}。使用してもターンは経過しません。</p><button class="primary" id="use-item">使用する</button><button class="secondary" id="drop-item">その場に捨てる</button><button class="secondary" id="close-item">戻る</button>`);
  on('drop-item', drop); on('use-item', () => { closeModal(); act({ type: 'item', slot }); }); on('close-item', closeModal);
}
function pause(): void {
  if (actionLocked) return;
  persist();
  dialog(`<div class="eyebrow">TAKE A BREATH</div><h2>ひとやすみ。</h2><p>${session!.stage.name} · ${session!.state.playerActionCount}行動<br>${saves.error || '冒険の途中経過を保存しました。'}</p><button id="resume" class="primary">冒険に戻る</button><button id="pause-settings" class="secondary">設定・あそび方</button><button id="to-home" class="text-button">中断してトップへ</button>`);
  on('resume', closeModal); on('pause-settings', showSettings); on('to-home', home);
}
function outcome(): void {
  if (!session || screen !== 'game') return;
  const clear = session.state.status === 'cleared', id = session.state.stageId;
  dialog(`<div class="result-symbol">${clear ? '✦' : '◇'}</div><div class="eyebrow">${clear ? 'EXPEDITION COMPLETE' : 'END OF EXPEDITION'}</div><h2>${clear ? 'ステージを踏破した。' : 'また、新しい一歩を。'}</h2><p>${session.stage.name} · ${session.stage.subtitle}<br>${session.state.playerActionCount}行動 / 古代の宝箱 ${session.state.objectiveChests}個</p><div class="note-card"><p>${clear && id < STAGES.length ? `${STAGES[id].name}「${STAGES[id].subtitle}」が解放されました。` : clear ? 'すべてのステージを踏破しました！' : '集めたスキルと道具は回収されます。新しい構成で再挑戦しよう。'}</p></div><button id="next-adventure" class="primary">${clear && id < STAGES.length ? '次のステージへ' : 'もう一度挑戦'}</button><button id="result-stages" class="secondary">ステージ選択へ</button>`);
  on('next-adventure', () => startStage(clear && id < STAGES.length ? id + 1 : id)); on('result-stages', stages);
}
function fullMap(): void {
  if (actionLocked) return;
  dialog(`<div class="dialog-heading"><div><div class="eyebrow">EXPLORATION MAP</div><h2>${session!.stage.name}の記録</h2></div><button id="close-map" class="icon-button" aria-label="地図を閉じる">×</button></div><canvas id="full-map" width="432" height="432" aria-label="探索済みの全体マップ"></canvas><div class="map-legend"><span>◼ 自分</span><span>◼ 宝箱・出口</span><span>◼ 視界内の敵</span></div><p class="footnote">地形は探索した場所だけ記録されます。<br>敵は現在の視界内だけ表示します。${session!.state.playerState.freeCamera ? '<br>地図をタップすると、その場所へカメラを移動します。' : ''}</p>`);
  const canvas = document.querySelector<HTMLCanvasElement>('#full-map')!; renderer?.drawMini(canvas.getContext('2d')!);
  if (session!.state.playerState.freeCamera) canvas.addEventListener('click', e => { const bounds = canvas.getBoundingClientRect(), size = Math.max(session!.state.mapState.width, session!.state.mapState.height); renderer!.camera = { x: Math.min(session!.state.mapState.width - 1, Math.floor((e.clientX - bounds.left) / bounds.width * size)), y: Math.min(session!.state.mapState.height - 1, Math.floor((e.clientY - bounds.top) / bounds.height * size)) }; closeModal(); update(); });
  on('close-map', closeModal);
}
function showSettings(): void {
  dialog(`<div class="dialog-heading"><div><div class="eyebrow">FIELD GUIDE</div><h2>設定とあそび方</h2></div><button id="close-settings" class="icon-button" aria-label="設定を閉じる">×</button></div><label class="setting-row">効果音<input id="sound-setting" type="checkbox" ${settings.sound ? 'checked' : ''}></label><label class="setting-row">マップのマス目を表示<input id="grid-setting" type="checkbox" ${settings.grid ? 'checked' : ''}></label><label class="setting-row">アニメーション<input id="motion-setting" type="checkbox" ${settings.motion ? 'checked' : ''}></label><div class="guide"><h3>01 / 一歩が、1ターン。</h3><p>方向キーで移動。敵はあなたの行動後に動きます。宝箱はそのマスへ進むと開きます。敵にぶつかっても攻撃しません。</p><h3>02 / 選ぶ → 向く → 発動。</h3><p>スキルを選び、方向キーで照準を合わせて「発動」。選択中は移動しません。同じスキルを再タップすると解除。移動・待機を合計5行動するとMPが3回復します。スキル使用では回復カウントは進みません。アイスストーンはマップをタップして着弾点を選びます。</p><h3>03 / つなぐと、強くなる。</h3><p>バッグはいつでも配置を変更できます。ブロックをドラッグ、または一覧で選んでマスをタップ。同じ属性を辺でつなぐと実効レベル+1。重複取得ではブロックは増えず基礎レベルが上がります。</p><h3>04 / 属性を組み合わせる。</h3><p>炎＋氷は融激。後から与えた初撃を1.5〜2倍に増幅し両属性を消去します。炎＋雷は即爆破。起爆したヒットの120%を追加し両属性を消去。風は炎・氷・雷を周囲1マスへ風散させ、10%ダメージ。属性は10行動持続します。</p><h3>キーボード</h3><p>矢印 / WASD：移動・照準、1〜9：配置済みスキルを選択、Enter：発動、Space：待機、B：バッグ、M：地図。</p><p class="footnote">保存先はこのブラウザのlocalStorageです。ブラウザデータを消去すると復元できません。効果音は最初のタップから再生されます。</p></div>`);
  on('close-settings', closeModal);
  document.getElementById('sound-setting')!.addEventListener('change', e => { settings.sound = (e.target as HTMLInputElement).checked; sound.setEnabled(settings.sound); saves.saveSettings(settings); if (settings.sound) sound.ui(); });
  document.getElementById('grid-setting')!.addEventListener('change', e => { settings.grid = (e.target as HTMLInputElement).checked; saves.saveSettings(settings); if (renderer) renderer.settings = settings; });
  document.getElementById('motion-setting')!.addEventListener('change', e => { settings.motion = (e.target as HTMLInputElement).checked; saves.saveSettings(settings); if (renderer) renderer.settings = settings; });
}
function openBag(acquisition: boolean): void {
  if (!session || actionLocked) return;
  const draft: BagBlock[] = structuredClone(session.state.skillBag).sort((a: BagBlock, b: BagBlock) => Number(!!b.isNew) - Number(!!a.isNew));
  const available = session.state.bagCells!;
  const cols = Math.max(...available.map(p => p.x)) + 1, rows = Math.max(...available.map(p => p.y)) + 1;
  const expanded = new Set(draft.filter(b => b.isNew).map(b => b.skillId));
  let active = draft[0]?.skillId ?? null;
  let rotation = draft.find(b => b.skillId === active)?.rotation ?? 0;
  let message = acquisition ? '手に入れたスキルを配置しよう。' : '未配置のスキルは閉じると消滅します。アイコンをドラッグして配置。';
  const editable = true;
  dialog(`<div class="bag-layout"><div class="bag-grid" id="bag-grid" role="grid" aria-label="レベルで拡張するスキルバッグ"></div><div class="bag-tools"><button id="close-bag" class="icon-button" aria-label="バッグの配置を保存して閉じる">×</button><button id="rotate" aria-label="選択ブロックを90度回転" ${editable ? '' : 'disabled'}>↻<small>回転</small></button><button id="unplace" ${editable ? '' : 'disabled'}>↥<small>外す</small></button><div id="shape-preview" aria-label="選択スキルの形"></div></div></div><div id="bag-message" class="bag-message" aria-live="polite"></div><div class="bag-scroll"><div id="bag-list" class="bag-list"></div></div>`, 'bag-modal');
  const grid = document.getElementById('bag-grid')!;
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`; grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`; grid.style.aspectRatio = `${cols}/${rows}`; grid.style.maxWidth = `${Math.min(260, 260 * cols / rows)}px`;
  document.getElementById('shape-preview')!.addEventListener('pointerdown', e => { if(active) beginDrag(e,active); });
  function drawBag(): void {
    grid.innerHTML = Array.from({ length: cols * rows }, (_, i) => `<button class="bag-cell ${available.some(p => p.x === i % cols && p.y === Math.floor(i / cols)) ? '' : 'locked-cell'}" data-cell="${i}" role="gridcell" aria-label="${i % cols + 1}列${Math.floor(i / cols) + 1}行" ${available.some(p => p.x === i % cols && p.y === Math.floor(i / cols)) ? '' : 'disabled'}></button>`).join('');
    for (const block of draft.filter(b => b.position)) {
      const def = SKILLS[block.skillId];
      const piece = document.createElement('div'); piece.className = `bag-piece ${block.skillId === active ? 'active' : ''}`; piece.dataset.block = block.skillId; piece.style.setProperty('--skill-color', ATTRIBUTE_COLORS[def.attribute]);
      const cells = shape(block.skillId, block.rotation), w = Math.max(...cells.map(c => c.x)) + 1, h = Math.max(...cells.map(c => c.y)) + 1;
      piece.style.cssText += `left:${block.position!.x * 100 / cols}%;top:${block.position!.y * 100 / rows}%;width:${w * 100 / cols}%;height:${h * 100 / rows}%;`;
      cells.forEach((c, i) => { const cell = document.createElement('span'); cell.className = 'piece-cell'; cell.style.cssText = `left:${c.x / w * 100}%;top:${c.y / h * 100}%;width:${100 / w}%;height:${100 / h}%;`; cell.innerHTML = i === 0 ? icons[block.skillId] : '·'; piece.append(cell); }); grid.append(piece);
    }
    document.getElementById('bag-message')!.textContent = message;
    document.getElementById('bag-list')!.innerHTML = draft.map(b => {
      const d = SKILLS[b.skillId];
      return `<section class="bag-entry" data-entry="${b.skillId}"><button data-bag-skill="${b.skillId}" class="bag-list-item ${active === b.skillId ? 'active' : ''}" style="--skill-color:${ATTRIBUTE_COLORS[d.attribute]}" aria-expanded="${expanded.has(b.skillId)}"><span data-drag-handle title="ドラッグして配置">${icons[b.skillId]}</span><span><strong>${d.name}</strong><small>${ATTRIBUTE_NAMES[d.attribute]} · 基礎Lv.${session!.state.skillLevels[b.skillId]} 連結${connectionBonus(draft, b.skillId)} · ダメージ×${connectionDamageMultiplier(draft, b.skillId).toFixed(2)}</small></span><small>${b.position ? '配置済' : '未配置'} ${expanded.has(b.skillId) ? '▴' : '▾'}</small>${b.isNew ? '<i class="new-badge">new</i>' : ''}</button><button class="reorder-handle" data-reorder="${b.skillId}" aria-label="${d.name}の順番をドラッグで変更">⠿</button><div class="bag-description ${expanded.has(b.skillId) ? 'expanded' : ''}"><div><p>${skillMpLabel(session!.state, b.skillId)} / CT ${d.cooldown} / Lv.${effectiveLevel(draft, session!.state.skillLevels, b.skillId)}</p><p>${skillDescription(session!.state,b.skillId,draft)}</p></div></div></section>`;
    }).join('') || '<p class="footnote">まだスキルを持っていません。</p>';
    document.querySelectorAll<HTMLButtonElement>('[data-bag-skill]').forEach(b => {
      b.addEventListener('click', () => { active = b.dataset.bagSkill as SkillId; if (expanded.has(active)) expanded.delete(active); else expanded.add(active); rotation = draft.find(p => p.skillId === active)!.rotation; message = `${SKILLS[active].name}を選択中。置きたいマスをタップ。`; syncSelection(); });
      if (editable) b.addEventListener('pointerdown', e => { if ((e.target as HTMLElement).closest('[data-drag-handle]')) beginDrag(e, b.dataset.bagSkill as SkillId); });
    });
    document.querySelectorAll<HTMLElement>('[data-reorder]').forEach(handle => handle.addEventListener('pointerdown', event => {
      if (event.button !== 0) return; event.preventDefault();
      const id = handle.dataset.reorder as SkillId;
      const source = handle.closest<HTMLElement>('.bag-entry')!;
      source.classList.add('reordering');
      let target: SkillId | undefined;
      const move = (e: PointerEvent) => {
        e.preventDefault();
        const entry = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-entry]');
        document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
        target = entry?.dataset.entry as SkillId | undefined;
        if (target !== id) entry?.classList.add('drop-target');
        const scroll = document.querySelector<HTMLElement>('.bag-scroll')!, r = scroll.getBoundingClientRect();
        if (e.clientY < r.top + 32) scroll.scrollTop -= 18; else if (e.clientY > r.bottom - 32) scroll.scrollTop += 18;
      };
      const cleanup = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish); document.removeEventListener('pointercancel', cancel); };
      const finish = () => { cleanup(); if (target && target !== id) { const from = draft.findIndex(b => b.skillId === id), to = draft.findIndex(b => b.skillId === target); draft.splice(to, 0, draft.splice(from, 1)[0]); } drawBag(); };
      const cancel = () => { cleanup(); drawBag(); };
      document.addEventListener('pointermove', move, { passive: false }); document.addEventListener('pointerup', finish); document.addEventListener('pointercancel', cancel);
    }));
    document.querySelectorAll<HTMLElement>('[data-block]').forEach(b => b.addEventListener('pointerdown', e => { active = b.dataset.block as SkillId; rotation = draft.find(p => p.skillId === active)!.rotation; if (editable) beginDrag(e, active); else drawBag(); }));
    grid.querySelectorAll<HTMLButtonElement>('[data-cell]').forEach(b => b.addEventListener('click', () => { if (editable && active) place(active, { x: Number(b.dataset.cell) % cols, y: Math.floor(Number(b.dataset.cell) / cols) }); }));

    syncSelection();
  }
  function syncSelection(): void {
    document.getElementById('bag-message')!.textContent = message;
    for (const entry of document.querySelectorAll<HTMLElement>('[data-entry]')) {
      const id = entry.dataset.entry as SkillId; entry.classList.toggle('active', id === active);
      const button = entry.querySelector<HTMLButtonElement>('[data-bag-skill]')!; button.classList.toggle('active', id === active); button.setAttribute('aria-expanded', String(expanded.has(id)));
      entry.querySelector('.bag-description')!.classList.toggle('expanded', expanded.has(id));
      const label = button.querySelector(':scope > small'); if (label) label.textContent = (draft.find(b => b.skillId === id)!.position ? '配置済 ' : '未配置 ') + (expanded.has(id) ? '▴' : '▾');
    }
    grid.querySelectorAll<HTMLElement>('[data-block]').forEach(el => el.classList.toggle('active', el.dataset.block === active));
    const preview = document.getElementById('shape-preview')!; preview.innerHTML = '';
    if (active) {
      const cells = shape(active, rotation), w = Math.max(...cells.map(c => c.x)) + 1, h = Math.max(...cells.map(c => c.y)) + 1;
      preview.style.width = `${w * 10}px`; preview.style.height = `${h * 10}px`;
      for (const c of cells) { const cell = document.createElement('i'); cell.style.cssText = `left:${c.x * 10}px;top:${c.y * 10}px;background:${ATTRIBUTE_COLORS[SKILLS[active].attribute]}`; preview.append(cell); }
    }
  }
  function place(id: SkillId, p: Point): void {
    if (validPlacement(draft, id, p, rotation, available)) { const block = draft.find(b => b.skillId === id)!; block.position = p; block.rotation = rotation; const bonus = connectionBonus(draft, id); message = bonus ? `${ATTRIBUTE_NAMES[SKILLS[id].attribute]}の連結${bonus}！ ダメージ×${connectionDamageMultiplier(draft, id).toFixed(2)}` : '配置しました。'; }
    else message = 'その場所には入りません。空いているマスへ置こう。';
    drawBag();
  }
  function beginDrag(event: PointerEvent, id: SkillId): void {
    if (event.button !== 0) return;
    active = id; rotation = draft.find(b => b.skillId === id)!.rotation;
    const start = { x: event.clientX, y: event.clientY }; let moving = false;
    // Keep the grabbed pixel offset, so an L-shaped piece does not jump under the finger.
    const cells = shape(id, rotation), unit = grid.getBoundingClientRect().width / cols;
    const w = Math.max(...cells.map(c => c.x)) + 1, h = Math.max(...cells.map(c => c.y)) + 1;
    const source = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-block]');
    const bounds = source?.getBoundingClientRect();
    const offset = bounds ? { x: start.x - bounds.left, y: start.y - bounds.top } : { x: unit / 2, y: unit / 2 };
    const ghost = document.createElement('div'); ghost.className = 'drag-ghost block-ghost'; ghost.style.setProperty('--skill-color', ATTRIBUTE_COLORS[SKILLS[id].attribute]);
    ghost.style.width = `${w * unit}px`; ghost.style.height = `${h * unit}px`;
    cells.forEach((c, i) => { const cell = document.createElement('span'); cell.className = 'piece-cell'; cell.style.cssText = `left:${c.x * unit}px;top:${c.y * unit}px;width:${unit}px;height:${unit}px`; cell.innerHTML = i ? '·' : icons[id]; ghost.append(cell); });
    const move = (e: PointerEvent) => { if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 7 && !moving) return; e.preventDefault(); moving = true; if (!ghost.isConnected) document.body.append(ghost); if (source) source.style.opacity = '.2'; ghost.style.left = `${e.clientX - offset.x}px`; ghost.style.top = `${e.clientY - offset.y}px`; };
    const finish = (e: PointerEvent) => {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish); document.removeEventListener('pointercancel', cancel); ghost.remove();
      if (source) source.style.opacity = '';
      if (moving) { e.preventDefault(); const r = grid.getBoundingClientRect(); place(id, { x: Math.round((e.clientX - offset.x - r.left) / unit), y: Math.round((e.clientY - offset.y - r.top) / unit) }); }
      else { message = `${SKILLS[id].name}を選択中。置きたいマスをタップ。`; drawBag(); }
    };
    const cancel = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish); document.removeEventListener('pointercancel', cancel); ghost.remove(); if (source) source.style.opacity = ''; };
    document.addEventListener('pointermove', move, { passive: false }); document.addEventListener('pointerup', finish); document.addEventListener('pointercancel', cancel);
  }
  on('rotate', () => {
    if (!active || !editable || !SKILLS[active].rotatable) return;
    const b = draft.find(b => b.skillId === active)!; rotation = (rotation + 1) % 4;
    if (b.position && !validPlacement(draft, active, b.position, rotation, available)) { b.position = null; message = '回転しました。空いているマスに置き直してください。'; }
    else message = '90度回転しました。';
    b.rotation = rotation; drawBag();
  });
  on('unplace', () => { if (active && editable) { draft.find(b => b.skillId === active)!.position = null; message = 'バッグから外しました。未配置のまま閉じると消滅します。'; drawBag(); } });
  on('close-bag', () => {
    const discarded = draft.filter(b => !b.position);
    if (discarded.length && !window.confirm('未配置のスキルは消滅します。\n' + discarded.map(b => SKILLS[b.skillId].name).join('、') + '\n破棄して閉じますか？')) return;
    for (const b of discarded) { session!.loseSkill(b.skillId); }
    if (discarded.length) session!.log(discarded.map(b => SKILLS[b.skillId].name).join('、') + 'は未配置のため消滅した。');
    if (editable) { session!.state.skillBag = draft.filter(b => b.position).map(b => ({ ...b, isNew: false })); session!.state.pendingBag = false; session!.rewardFullBag(); persist(); } if (selected && !draft.find(b => b.skillId === selected)?.position) selected = null; closeModal(); update(); });
  drawBag();
}
document.addEventListener('keydown', event => {
  if (screen !== 'game' || modal || event.repeat || actionLocked) return;
  const dirs: Record<string, Direction> = { ArrowUp: 'up', w: 'up', ArrowRight: 'right', d: 'right', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left' };
  if (dirs[event.key]) { event.preventDefault(); direction(dirs[event.key]); }
  else if (event.key === ' ') { event.preventDefault(); selected = null; act({ type: 'wait' }); }
  else if (event.key === 'Enter' && selected) { event.preventDefault(); castSelected(); }
  else if (/^[1-9]$/.test(event.key)) { const id = session!.state.skillBag.filter(b => b.position)[Number(event.key) - 1]?.skillId; if (id) selectSkill(id); }
  else if (event.key === 'Escape') { selected = null; update(); }
  else if (event.key === 'b') openBag(false);
  else if (event.key === 'm') fullMap();
});
document.addEventListener('pointerdown', () => sound.unlock(), { capture: true });
document.addEventListener('keydown', () => sound.unlock(), { capture: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'game') persist(); else if (!document.hidden) sound.unlock(); });
window.addEventListener('pageshow',()=>sound.unlock());
document.addEventListener('touchend',()=>sound.unlock(),{passive:true});
window.addEventListener('pagehide', () => { if (screen === 'game') persist(); });
home();
