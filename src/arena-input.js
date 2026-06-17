import { WEAPONS } from './arena-rules.js';

const MOVE_KEYS = new Set([' ', 'escape', 'h', 'j', 'k', 'l', 'w', 'a', 's', 'd']);

export function bindArenaInput(game) {
  game._keyDownHandler = (e) => {
    const key = e.key.toLowerCase();
    if (MOVE_KEYS.has(key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    game.keysDown.add(key);
    if (key === ' ' && game.running) game._shoot();
    if (key === 'escape') game.stop();
  };

  game._keyUpHandler = (e) => {
    const key = e.key.toLowerCase();
    if (MOVE_KEYS.has(key)) e.stopImmediatePropagation();
    game.keysDown.delete(key);
  };

  game._mouseMoveHandler = (e) => {
    game.mouseX = e.clientX;
    game.mouseY = e.clientY;
    const me = game.players.get(game.network.myId);
    if (me) me.angle = Math.atan2(game.mouseY - me.y, game.mouseX - me.x);
  };

  game._resizeHandler = () => game._resize();
  game._mouseDownHandler = (e) => {
    if (e.button === 0 && game.running) game._shoot();
  };

  document.addEventListener('keydown', game._keyDownHandler, true);
  document.addEventListener('keyup', game._keyUpHandler, true);
  game.el.addEventListener('mousemove', game._mouseMoveHandler);
  game.canvas.addEventListener('mousedown', game._mouseDownHandler);
  window.addEventListener('resize', game._resizeHandler);
  game.el.querySelector('#rpjs-arena-exit')?.addEventListener('click', () => game.stop());

  bindArenaTouchInput(game);
}

export function bindArenaTouchInput(game) {
  game._isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!game._isTouchDevice) return;

  const joystick = game.el.querySelector('#rpjs-arena-joystick');
  const knob = game.el.querySelector('#rpjs-arena-joystick-knob');
  const shootBtn = game.el.querySelector('#rpjs-arena-shoot-btn');
  const RADIUS = 55;

  const joyStart = (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    game._joystickTouchId = touch.identifier;
    const rect = joystick.getBoundingClientRect();
    game._joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const joyMove = (e) => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier !== game._joystickTouchId) continue;
      const dx = touch.clientX - game._joystickCenter.x;
      const dy = touch.clientY - game._joystickCenter.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 8) {
        const clamped = Math.min(d, RADIUS);
        game.touchDx = dx / d;
        game.touchDy = dy / d;
        knob.style.transform = `translate(calc(-50% + ${(dx / d) * clamped}px), calc(-50% + ${(dy / d) * clamped}px))`;
      } else {
        game.touchDx = 0;
        game.touchDy = 0;
        knob.style.transform = 'translate(-50%, -50%)';
      }
    }
  };

  const joyEnd = (e) => {
    for (const touch of e.changedTouches) {
      if (touch.identifier !== game._joystickTouchId) continue;
      game._joystickTouchId = null;
      game.touchDx = 0;
      game.touchDy = 0;
      knob.style.transform = 'translate(-50%, -50%)';
    }
  };

  joystick.addEventListener('touchstart', joyStart, { passive: false });
  joystick.addEventListener('touchmove', joyMove, { passive: false });
  joystick.addEventListener('touchend', joyEnd);
  joystick.addEventListener('touchcancel', joyEnd);

  shootBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    game._shoot();
    const me = game.players.get(game.network.myId);
    const weaponCfg = me ? game._weaponConfigFor(me) : WEAPONS.blaster;
    game._shootTouchInterval = setInterval(() => game._shoot(), weaponCfg.cooldown + 50);
  }, { passive: false });

  const stopShoot = () => {
    if (game._shootTouchInterval) {
      clearInterval(game._shootTouchInterval);
      game._shootTouchInterval = null;
    }
  };
  shootBtn.addEventListener('touchend', stopShoot);
  shootBtn.addEventListener('touchcancel', stopShoot);

  game._canvasTouchHandler = (e) => {
    e.preventDefault();
    for (const touch of e.touches) {
      if (touch.identifier === game._joystickTouchId) continue;
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      if (el && (el === shootBtn || joystick.contains(el))) continue;
      game.mouseX = touch.clientX;
      game.mouseY = touch.clientY;
      const me = game.players.get(game.network.myId);
      if (me) me.angle = Math.atan2(touch.clientY - me.y, touch.clientX - me.x);
      break;
    }
  };
  game.canvas.addEventListener('touchstart', game._canvasTouchHandler, { passive: false });
  game.canvas.addEventListener('touchmove', game._canvasTouchHandler, { passive: false });
}

export function unbindArenaInput(game) {
  document.removeEventListener('keydown', game._keyDownHandler, true);
  document.removeEventListener('keyup', game._keyUpHandler, true);
  if (game.el) game.el.removeEventListener('mousemove', game._mouseMoveHandler);
  if (game.canvas) game.canvas.removeEventListener('mousedown', game._mouseDownHandler);
  if (game.canvas && game._canvasTouchHandler) {
    game.canvas.removeEventListener('touchstart', game._canvasTouchHandler);
    game.canvas.removeEventListener('touchmove', game._canvasTouchHandler);
  }
  window.removeEventListener('resize', game._resizeHandler);
}

