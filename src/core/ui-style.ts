/** Shared CSS for shell overlays (title, pause menu, debug). Plain strings: no build-time CSS needed. */
export const SHELL_CSS = `
html,body{margin:0;height:100%;background:#07070d;overflow:hidden}
#app{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
#app canvas{display:block;image-rendering:auto;cursor:none}
.mgb-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#f4f1ea;z-index:10}
.mgb-title{background:radial-gradient(ellipse at center,rgba(16,16,30,.92),rgba(5,5,12,.97));flex-direction:column;text-align:center;padding:48px}
.mgb-title h1{font-size:64px;margin:0 0 12px;letter-spacing:.5px}
.mgb-title p{font-size:26px;max-width:900px;margin:6px 0;color:#c9c5ff;line-height:1.35}
.mgb-title .feel{color:#ffd166}
.mgb-title .go{margin-top:44px;font-size:34px;font-weight:700;letter-spacing:3px;animation:mgb-pulse 1.1s ease-in-out infinite}
@keyframes mgb-pulse{50%{opacity:.35}}
.mgb-menu{background:rgba(5,5,12,.78)}
.mgb-panel{min-width:560px;padding:32px 40px;border-radius:20px;background:#15152a;border:2px solid #34345c;box-shadow:0 20px 60px rgba(0,0,0,.6)}
.mgb-panel h2{margin:0 0 20px;font-size:34px;color:#ffd166}
.mgb-item{font-size:30px;padding:12px 18px;border-radius:12px;margin:6px 0;display:flex;justify-content:space-between;gap:36px;border:3px solid transparent}
.mgb-item.on{background:#2b2b57;border-color:#ffd166}
.mgb-hint{margin-top:18px;font-size:20px;color:#8f8fb8}
.mgb-debug{position:fixed;left:8px;top:8px;z-index:20;margin:0;padding:8px 10px;background:rgba(0,0,0,.72);color:#9cff9c;
  font:14px/1.35 ui-monospace,Menlo,Consolas,monospace;border-radius:6px;pointer-events:none;white-space:pre}
.mgb-return{position:fixed;right:20px;bottom:20px;z-index:30;font:700 22px system-ui,sans-serif;color:#fff;background:#d94f6a;padding:10px 18px;border-radius:10px}
`;

export function injectStyle(css: string, id: string): void {
  if (document.getElementById(id)) return;
  const el = document.createElement('style');
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}
