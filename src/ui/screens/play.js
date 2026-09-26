// The game screen: fixed-timestep simulation, interpolated rendering, input, HUD.
import { html, $, fmt, fmtTime } from '../dom.js';
import { icon, CUR_ICON } from '../icons.js';
import { kbd } from '../components.js';
import { app, go, commit, toast } from '../app.js';
import {
  createGame, tick, queueTurn, useAbility, interval, timeLeft, summarize,
  phasing, slowed, abilityProgress, abilityReady, COMBO_WINDOW,
} from '../../core/engine.js';
import { createRenderer } from '../../render/renderer.js';
import { MODIFIERS } from '../../data/modes.js';
import { applyRun } from '../../meta/progression.js';

let teardown = null;

const KEYMAP = { ArrowUp: 0, KeyW: 0, ArrowDown: 1, KeyS: 1, ArrowLeft: 2, KeyA: 2, ArrowRight: 3, KeyD: 3 };

export const play = {
  id: 'play', title: 'In flight',
  render(app) {
    const run = app.pendingRun;
    if (!run) return html`<section class="play-empty"><p>No flight plan.</p><a class="btn primary" href="#/home">Back to the chart</a></section>`;
    const p = app.profile;
    const touch = p.settings.controls === 'dpad' || (p.settings.controls === 'auto' && matchMedia('(pointer: coarse)').matches);
    return html`
    <section class="play ${touch ? 'touch' : ''}">
      <aside class="hud hud-l">
        <div class="hud-score"><span class="label">Score</span><b id="h-score">0</b></div>
        <dl class="hud-stats">
          <div><dt>Best</dt><dd id="h-best">0</dd></div>
          <div><dt>Length</dt><dd id="h-len">0</dd></div>
          <div><dt id="h-tl">Time</dt><dd id="h-time">0:00</dd></div>
        </dl>
        <div class="hud-combo" id="h-combo"><div class="row-b"><span class="label">Combo</span><b id="h-cv">×1</b></div><span class="bar coral"><i id="h-cb"></i></span></div>
        <div class="hud-goal" id="h-goal"></div>
        ${run.modifier ? html`<p class="hud-mod"><b>${MODIFIERS[run.modifier].name}</b> ${MODIFIERS[run.modifier].desc}</p>` : ''}
      </aside>

      <div class="stage" id="stage">
        <div class="board" id="board">
          <canvas id="game" aria-label="Game board"></canvas>
          <div class="board-ov" id="ov" data-show=""></div>
          <p class="coach" id="coach" hidden></p>
        </div>
      </div>

      <aside class="hud hud-r">
        <button class="ability" id="ab" data-action="ability" aria-label="Use ability">
          <span class="ab-ring" id="ab-ring"></span>
          <span class="ab-txt"><b id="ab-name"></b><small id="ab-key">E / Shift</small></span>
        </button>
        <ul class="effects" id="fx-list" aria-live="polite"></ul>
        <div class="hud-btns">
          <button class="icon-btn" data-action="pause" aria-label="Pause">${icon('pause', 20)}</button>
          <button class="icon-btn" data-action="mute" aria-label="Toggle sound" id="mute-btn">${icon(p.settings.sfx > 0 ? 'volume' : 'mute', 20)}</button>
        </div>
      </aside>

      <nav class="pad" id="pad" aria-label="Direction pad">
        <button data-d="0" aria-label="Up">${icon('up', 24)}</button>
        <button data-d="2" aria-label="Left">${icon('left', 24)}</button>
        <button data-d="1" aria-label="Down">${icon('down', 24)}</button>
        <button data-d="3" aria-label="Right">${icon('chevron', 24)}</button>
        <button data-ab class="pad-ab" aria-label="Ability">${icon('bolt', 24)}</button>
      </nav>
    </section>`;
  },

  mount(root, app) {
    const run = app.pendingRun;
    if (!run) return;
    const p = app.profile;
    const canvas = $('#game', root), stage = $('#stage', root), board = $('#board', root), ov = $('#ov', root);
    const r = createRenderer(canvas);
    let s, state = 'countdown', acc = 0, last = performance.now(), raf = 0, deathAt = 0, countStart = 0, lastSec = 99, turns = 0;
    const bestKey = `${run.modeId}:${run.worldId}`;
    const best = p.best[bestKey] || 0;
    const H = {
      score: $('#h-score', root), best: $('#h-best', root), len: $('#h-len', root), time: $('#h-time', root), tl: $('#h-tl', root),
      cv: $('#h-cv', root), cb: $('#h-cb', root), combo: $('#h-combo', root), goal: $('#h-goal', root),
      ab: $('#ab', root), abRing: $('#ab-ring', root), abName: $('#ab-name', root), fx: $('#fx-list', root), coach: $('#coach', root),
    };
    const cache = {};
    const set = (k, el, v, prop = 'textContent') => { if (cache[k] !== v) { cache[k] = v; el[prop] = v; } };

    function newGame() {
      s = createGame(run);
      r.configure({ world: s.world, species: s.species, skinId: p.equipped.skin, trailId: p.equipped.trail, finaleId: p.equipped.finale, settings: p.settings });
      fit();
      H.abName.textContent = s.species.ability.name;
      H.best.textContent = fmt(best);
      H.tl.textContent = s.mode.timer ? 'Left' : 'Time';
      renderGoal();
      state = 'countdown'; countStart = performance.now(); acc = 0; lastSec = 99; turns = 0;
      showOv('');
      if (!p.flags.tutorialDone) { H.coach.hidden = false; H.coach.innerHTML = `Steer with arrows, WASD or swipe. <kbd>E</kbd> fires <b>${s.species.ability.name}</b>.`; }
      app.audio.startMusic(s.world.id);
    }

    function fit() {
      if (!s) return;
      const rect = stage.getBoundingClientRect();
      const px = Math.max(s.world.size * 10, Math.floor(Math.min(rect.width, rect.height) / s.world.size) * s.world.size);
      board.style.width = board.style.height = px + 'px';
      r.resize(px);
    }

    function renderGoal() {
      if (s.mode.id !== 'voyage') { H.goal.innerHTML = ''; return; }
      const g = s.world.stars, max = g[2];
      H.goal.innerHTML = `<span class="label">Star goals</span><span class="goal-track"><i id="goal-fill"></i>${g.map((v) => `<em style="left:${(v / max) * 100}%" title="${v}"></em>`).join('')}</span><small id="goal-txt"></small>`;
    }

    function showOv(kind) {
      ov.dataset.show = kind;
      if (kind === 'pause') {
        ov.innerHTML = `<div class="ov-panel"><p class="eyebrow">${s.world.name}</p><h2>Paused</h2>
          <div class="col"><button class="btn primary" data-action="resume">Resume <kbd>Space</kbd></button>
          <button class="btn quiet" data-action="restart">Restart <kbd>R</kbd></button>
          <button class="btn quiet" data-action="quit">Abandon run</button></div></div>`;
        ov.querySelector('.btn.primary').focus({ preventScroll: true });
      } else if (kind === 'count') {
        ov.innerHTML = `<div class="count" id="count">3</div>`;
      } else ov.innerHTML = '';
    }

    function pause() { if (state !== 'play') return; state = 'paused'; showOv('pause'); app.audio.stopMusic(); }
    function resume() { if (state !== 'paused') return; state = 'countdown'; countStart = performance.now() - 1200; showOv(''); app.audio.startMusic(s.world.id); }

    function turn(code) {
      if (state === 'paused') return;
      if (state !== 'play' && state !== 'countdown') return;
      if (queueTurn(s, code)) {
        turns++;
        if (turns > 3 && !H.coach.hidden) H.coach.hidden = true;
      }
    }
    function ability() {
      if (state !== 'play') return;
      if (useAbility(s)) { app.audio.play('ability', s.species.ability.id); haptic(18); }
    }
    const haptic = (ms) => { if (p.settings.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch { /* unsupported */ } };

    function handleEvents(ev) {
      r.onEvents(ev, s);
      for (const e of ev) {
        switch (e.type) {
          case 'eat': app.audio.play('eat', e.combo, e.item); if (e.item !== 'orb') haptic(10); break;
          case 'shield': app.audio.play('shield'); haptic(40); break;
          case 'revive': app.audio.play('revive'); haptic(60); break;
          case 'warp': app.audio.play('warp'); break;
          case 'stormWarn': app.audio.play('warn'); break;
          case 'strike': app.audio.play('strike'); break;
          case 'sever': app.audio.play('sever'); haptic(30); break;
          case 'rivalDown': app.audio.play('rivalDown'); haptic(30); break;
          case 'death': app.audio.play('die'); haptic(90); break;
          case 'finish': app.audio.play('finish'); break;
        }
      }
    }

    function finish() {
      state = 'done';
      app.audio.stopMusic();
      const summary = summarize(s);
      const before = { level: p.level, xp: p.xp, passXp: p.pass.xp, wallet: { ...p.wallet } };
      const result = commit((prof) => { const out = applyRun(prof, summary); prof.flags.tutorialDone = true; return out; }, { rerender: false });
      app.lastResult = { summary, result, before, run };
      go('results');
    }

    function hud(now) {
      set('score', H.score, fmt(s.score));
      set('len', H.len, String(s.snake.length));
      set('time', H.time, s.mode.timer ? fmtTime(Math.max(0, timeLeft(s)) + 999) : fmtTime(s.t));
      const hot = s.mode.timer && timeLeft(s) < 10000;
      if (cache.hot !== hot) { cache.hot = hot; H.time.classList.toggle('hot', hot); }
      if (s.score > best && best > 0 && !cache.beat) { cache.beat = true; H.score.classList.add('beat'); toast({ title: 'New personal best', body: 'Keep going.', tone: 'gold', icon: 'trophy', ms: 2000 }); }
      const cw = Math.max(0, 1 - (s.t - s.lastEat) / COMBO_WINDOW);
      const live = cw > 0 && s.combo > 1;
      set('cv', H.cv, '×' + (live ? s.combo : 1));
      if (cache.live !== live) { cache.live = live; H.combo.classList.toggle('live', live); }
      H.cb.style.transform = `scaleX(${live ? cw : 0})`;
      if (s.mode.id === 'voyage') {
        const fill = root.querySelector('#goal-fill');
        const max = s.world.stars[2];
        if (fill) fill.style.transform = `scaleX(${Math.min(1, s.score / max)})`;
        const next = s.world.stars.find((g) => s.score < g);
        set('goal', root.querySelector('#goal-txt'), next ? `${fmt(next - s.score)} to next star` : 'Three stars. Legendary.');
      }
      const prog = abilityProgress(s), ready = abilityReady(s) && state === 'play';
      H.abRing.style.setProperty('--p', prog.toFixed(3));
      if (cache.ready !== ready) { cache.ready = ready; H.ab.classList.toggle('ready', ready); }
      const active = s.t < s.ability.activeUntil;
      if (cache.active !== active) { cache.active = active; H.ab.classList.toggle('active', active); }
      // effect chips
      const chips = [];
      if (phasing(s)) chips.push(['phase', 'Phase', (s.effects.phase - s.t) / 6000]);
      if (slowed(s)) chips.push(['slow', 'Slow-mo', (s.effects.slow - s.t) / 6000]);
      if (s.t < s.effects.magnet) chips.push(['magnet', 'Magnet', (s.effects.magnet - s.t) / 8000]);
      if (s.shield) chips.push(['shield', `Shield ×${s.shield}`, 1]);
      if (s.species.passive.id === 'revive') chips.push(['revive', s.reviveUsed ? 'Rewind spent' : 'Rewind ready', s.reviveUsed ? 0 : 1]);
      const sig = chips.map((c) => c[0] + c[1]).join('|');
      if (cache.fxsig !== sig) {
        cache.fxsig = sig;
        H.fx.innerHTML = chips.map(([k, label]) => `<li class="fx fx-${k}"><span>${label}</span><span class="bar"><i data-fx="${k}"></i></span></li>`).join('');
      }
      for (const [k, , v] of chips) { const el = H.fx.querySelector(`[data-fx="${k}"]`); if (el) el.style.transform = `scaleX(${Math.max(0, Math.min(1, v))})`; }
    }

    function loop(now) {
      const dt = Math.min(50, now - last); last = now;
      if (state === 'countdown') {
        const k = now - countStart;
        const n = 3 - Math.floor(k / 400);
        if (ov.dataset.show !== 'count') showOv('count');
        const el = ov.querySelector('#count');
        if (el && el.dataset.n !== String(n)) { el.dataset.n = String(n); el.textContent = n > 0 ? n : 'Go'; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); app.audio.play('count', n > 0 ? n : 0); }
        if (k >= 1500) { state = 'play'; showOv(''); acc = 0; }
      } else if (state === 'play') {
        acc += dt;
        let iv = interval(s), guard = 0;
        while (acc >= iv && state === 'play' && guard++ < 4) {
          acc -= iv;
          const ev = tick(s);
          r.onStep(s);
          handleEvents(ev);
          if (s.over) { state = 'dying'; deathAt = now; break; }
          iv = interval(s);
        }
        if (s.mode.timer && state === 'play') {
          const sec = Math.ceil(timeLeft(s) / 1000);
          if (sec <= 5 && sec > 0 && sec !== lastSec) { lastSec = sec; app.audio.play('tick'); }
        }
      } else if (state === 'dying' && now - deathAt > 950) {
        finish();
        return;
      }
      const alpha = state === 'play' ? Math.min(1, acc / interval(s)) : 1;
      r.draw(s, alpha, now, dt, { deathAt });
      hud(now);
      raf = requestAnimationFrame(loop);
    }

    // input
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code in KEYMAP) { e.preventDefault(); turn(KEYMAP[e.code]); return; }
      if (e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyQ') { e.preventDefault(); ability(); return; }
      if (e.code === 'Space' || e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        if (state === 'play') pause(); else if (state === 'paused') resume();
        return;
      }
      if (e.code === 'KeyR' && (state === 'play' || state === 'paused')) newGame();
      if (e.code === 'KeyM') actions.mute();
    };
    let sx = null, sy = null;
    const onDown = (e) => { if (e.pointerType === 'mouse') return; sx = e.clientX; sy = e.clientY; };
    const onMove = (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 22) {
        turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : (dy > 0 ? 1 : 0));
        sx = e.clientX; sy = e.clientY;
      }
    };
    const onUp = () => { sx = null; };
    const onTap = (e) => {
      // Two-finger tap = ability on touch screens
      if (e.touches && e.touches.length === 2) ability();
    };
    const pad = $('#pad', root);
    const onPad = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      e.preventDefault();
      if (b.hasAttribute('data-ab')) ability(); else turn(Number(b.dataset.d));
    };
    const onBlur = () => pause();
    const onVis = () => { if (document.hidden) pause(); };

    document.addEventListener('keydown', onKey);
    stage.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    stage.addEventListener('touchstart', onTap, { passive: true });
    pad.addEventListener('pointerdown', onPad);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    const ro = new ResizeObserver(fit); ro.observe(stage);

    const actions = {
      ability: () => ability(),
      pause: () => pause(),
      resume: () => resume(),
      restart: () => newGame(),
      quit: () => { state = 'done'; app.audio.stopMusic(); go('home'); },
      mute: () => {
        commit((prof) => { const on = prof.settings.sfx > 0 || prof.settings.music > 0; prof.settings.sfx = on ? 0 : 0.8; prof.settings.music = on ? 0 : 0.45; }, { rerender: false });
        app.audio.setVolume({ sfx: p.settings.sfx, music: p.settings.music });
        if (p.settings.music > 0 && state === 'play') app.audio.startMusic(s.world.id);
        $('#mute-btn', root).innerHTML = icon(p.settings.sfx > 0 ? 'volume' : 'mute', 20).s;
      },
    };
    play.actions = actions;

    newGame();
    raf = requestAnimationFrame(loop);

    teardown = () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      stage.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      stage.removeEventListener('touchstart', onTap);
      pad.removeEventListener('pointerdown', onPad);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
      ro.disconnect();
      app.audio.stopMusic();
    };
  },
  unmount() { teardown?.(); teardown = null; },
  actions: {},
};
