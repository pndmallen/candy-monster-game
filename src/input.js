// Keyboard (arrows / WASD + space) and pointer (touch or mouse:
// press/hold where you want to walk) input.
export function createInput(canvas) {
  const keys = new Set();
  let jumpQueued = false;
  const pointer = { active: false, x: 0, y: 0, id: null };

  const MOVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
  window.addEventListener('keydown', (e) => {
    if (MOVE_KEYS.includes(e.code)) { keys.add(e.code); e.preventDefault(); }
    if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && input.enabled) {
      if (e.code === 'Space') { jumpQueued = true; e.preventDefault(); }
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); pointer.active = false; });

  canvas.addEventListener('pointerdown', (e) => {
    if (!input.enabled) return;
    pointer.active = true;
    pointer.id = e.pointerId;
    pointer.x = e.clientX; pointer.y = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* */ }
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointer.active && e.pointerId === pointer.id) { pointer.x = e.clientX; pointer.y = e.clientY; }
  });
  const end = (e) => { if (e.pointerId === pointer.id) pointer.active = false; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const input = {
    enabled: true,
    pointer,
    keyVector() {
      let x = 0, z = 0;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
      if (keys.has('ArrowUp') || keys.has('KeyW')) z -= 1;
      if (keys.has('ArrowDown') || keys.has('KeyS')) z += 1;
      return { x, z };
    },
    queueJump() { jumpQueued = true; },
    consumeJump() { const j = jumpQueued; jumpQueued = false; return j; },
    reset() { keys.clear(); pointer.active = false; jumpQueued = false; },
  };
  return input;
}
