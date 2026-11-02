/* Display scaling: lay the desktop out at a virtual 1920x1080 and scale it to the viewport (0.7 to 1.0).
   Modes: auto (default), 1, 0.9, 0.8, 0.7. Phones (< 768 px) keep the mobile layout without scaling. */
(() => {
'use strict';
const KEY = 'vk_scale';
const get = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; } };
function apply() {
  const de = document.documentElement, b = document.body;
  if (!b) return;
  const vw = window.innerWidth, vh = window.innerHeight, m = get();
  let s = 1;
  if (vw >= 768) s = m === 'auto' ? Math.max(0.7, Math.min(1, Math.min(vw / 1920, vh / 1080))) : Math.max(0.7, Math.min(1, parseFloat(m) || 1));
  if (s >= 0.999) { de.style.zoom = ''; b.style.width = ''; b.style.height = ''; de.classList.remove('vk-scaled'); }
  else { de.style.zoom = String(s); b.style.width = (vw / s) + 'px'; b.style.height = (vh / s) + 'px'; de.classList.add('vk-scaled'); }
  de.style.setProperty('--vk-scale', String(s));
  window.VK_SCALE = s;
}
window.VK_DISPLAY = { get, set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} apply(); window.dispatchEvent(new Event('vk-display')); }, apply, modes: ['auto', '1', '0.9', '0.8', '0.7'] };
window.addEventListener('resize', apply);
document.addEventListener('DOMContentLoaded', apply);
apply();
const css = document.createElement('style');
/* keep small labels readable when scaled down (effective size about 11 px or more) */
css.textContent = `html.vk-scaled #icons{grid-template-rows:repeat(5,auto);row-gap:10px;grid-auto-columns:104px}html.vk-scaled .icon span{font-size:calc(11px / var(--vk-scale));line-height:1.15}html.vk-scaled #menubar,html.vk-scaled .win .tb b{font-size:calc(11.5px / var(--vk-scale))}html.vk-scaled .win .body{font-size:calc(11.5px / var(--vk-scale))}`;
document.head.append(css);
})();
