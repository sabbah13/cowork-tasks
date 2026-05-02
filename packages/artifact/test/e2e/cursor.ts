/**
 * Test-only cursor visualization. Injected before any artifact code runs
 * via `page.addInitScript(installCursor)`. Renders a soft orange dot that
 * follows the mouse and a click ripple on every pointerdown - so playback
 * videos clearly show what the "user" is doing.
 *
 * Lives entirely in the test harness; never shipped to production.
 */
export function installCursor(): void {
  const css = `
    .__e2e_cursor__ {
      position: fixed; top: 0; left: 0;
      width: 18px; height: 18px;
      margin-left: -9px; margin-top: -9px;
      background: rgba(217, 119, 87, 0.85);
      border: 2px solid #faf9f5;
      border-radius: 50%;
      pointer-events: none;
      z-index: 2147483647;
      box-shadow: 0 0 0 2px rgba(217, 119, 87, 0.25), 0 4px 12px rgba(20, 20, 19, 0.25);
      transition: transform 60ms linear;
      transform: translate3d(0, 0, 0);
    }
    .__e2e_ripple__ {
      position: fixed; top: 0; left: 0;
      width: 36px; height: 36px;
      margin-left: -18px; margin-top: -18px;
      background: transparent;
      border: 2px solid #d97757;
      border-radius: 50%;
      pointer-events: none;
      z-index: 2147483646;
      animation: __e2e_ripple_anim 480ms ease-out forwards;
    }
    @keyframes __e2e_ripple_anim {
      0%   { opacity: 1; transform: scale(0.4); }
      100% { opacity: 0; transform: scale(1.8); }
    }
  `;
  const install = () => {
    const style = document.createElement('style');
    style.id = '__e2e_cursor_style__';
    style.textContent = css;
    document.head.appendChild(style);

    const dot = document.createElement('div');
    dot.className = '__e2e_cursor__';
    dot.style.opacity = '0';
    document.body.appendChild(dot);
    return dot;
  };

  // addInitScript runs before <head>/<body> exist; defer until DOM is ready.
  let dot: HTMLDivElement;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      dot = install();
    });
  } else {
    dot = install();
  }
  // Stub for early events.
  // @ts-expect-error - dot may be undefined briefly

  const onMove = (ev: PointerEvent | MouseEvent) => {
    if (!dot) return;
    dot.style.opacity = '1';
    dot.style.transform = `translate3d(${ev.clientX}px, ${ev.clientY}px, 0)`;
  };
  const onDown = (ev: PointerEvent | MouseEvent) => {
    if (!document.body) return;
    const r = document.createElement('div');
    r.className = '__e2e_ripple__';
    r.style.transform = `translate3d(${ev.clientX}px, ${ev.clientY}px, 0)`;
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 600);
    if (dot) {
      dot.style.transform = `translate3d(${ev.clientX}px, ${ev.clientY}px, 0) scale(0.7)`;
      setTimeout(() => {
        if (dot) dot.style.transform = `translate3d(${ev.clientX}px, ${ev.clientY}px, 0)`;
      }, 100);
    }
  };

  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener(
    'pointerleave',
    () => {
      if (dot) dot.style.opacity = '0';
    },
    true,
  );
}
