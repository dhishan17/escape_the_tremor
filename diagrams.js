"use strict";
/* diagrams.js: the two schematic SVG drawings (midbrain hotspot and coronal basal ganglia).
   Edit shapes or colours here. Each clickable midbrain region has a data-id. */
const midbrainSVG = () => {
  const outline = 'M260 70 C235 40 170 38 140 75 C105 115 70 175 70 235 C70 310 110 375 175 395 C215 408 245 390 260 360 C275 390 305 408 345 395 C410 375 450 310 450 235 C450 175 415 115 380 75 C350 38 285 40 260 70 Z';
  let k = 0;
  const half = () => `
    <g class="region" data-id="tectum" tabindex="0" role="button" aria-label="Region ${++k}"><ellipse cx="195" cy="98" rx="62" ry="34" fill="#d6cbea" stroke="#6e6488" stroke-width="1"/></g>
    <g class="region" data-id="red" tabindex="0" role="button" aria-label="Region ${++k}"><circle cx="200" cy="245" r="28" fill="#d9738f" stroke="#6e6488" stroke-width="1"/></g>
    <g class="region" data-id="crus" tabindex="0" role="button" aria-label="Region ${++k}"><path d="M92 290 C112 350 165 380 235 382" fill="none" stroke="#e7dccb" stroke-width="34" stroke-linecap="round"/><path d="M92 290 C112 350 165 380 235 382" fill="none" stroke="#a99a80" stroke-width="30" stroke-linecap="round" stroke-dasharray="1 5" opacity=".6"/></g>
    <g class="region" data-id="sn" tabindex="0" role="button" aria-label="Region ${++k}"><path d="M126 262 C146 318 186 344 232 352" fill="none" stroke="#3a2a24" stroke-width="22" stroke-linecap="round"/></g>`;
  const left = half();
  const right = half();
  return `<svg viewBox="0 0 520 440" role="group" aria-label="Schematic axial section of the midbrain with eight clickable regions">
    <defs><clipPath id="mbclip"><path d="${outline}"/></clipPath></defs>
    <text x="260" y="22" text-anchor="middle" class="fig-cap">DORSAL</text>
    <text x="260" y="432" text-anchor="middle" class="fig-cap">VENTRAL</text>
    <path d="${outline}" fill="#efe6ee"/>
    <g clip-path="url(#mbclip)">
      ${left}
      <g transform="translate(520 0) scale(-1 1)">${right}</g>
      <g class="region" data-id="pag" tabindex="0" role="button" aria-label="Region ${++k}"><circle cx="260" cy="165" r="44" fill="#c4b8dd" stroke="#6e6488" stroke-width="1"/><ellipse cx="260" cy="165" rx="13" ry="11" fill="#6d85b8"/></g>
      <g class="region" data-id="vta" tabindex="0" role="button" aria-label="Region ${++k}"><ellipse cx="260" cy="322" rx="21" ry="22" fill="#b79a86" stroke="#6e6488" stroke-width="1"/></g>
    </g>
    <path d="${outline}" fill="none" stroke="#6e6488" stroke-width="2" pointer-events="none"/>
  </svg>`;
};

const coronalSVG = () => {
  const bg = (markers) => `
    <path d="M292 118 Q322 96 348 120 Q340 140 322 148 Q306 170 292 158 Z" fill="#cfe0f0" stroke="#7d93ad" stroke-width="1"/>
    <ellipse cx="318" cy="222" rx="34" ry="46" fill="#d3cbe6" stroke="#6e6488" stroke-width="1.2"/>
    <ellipse cx="362" cy="135" rx="17" ry="28" fill="#a58bd3" stroke="#51408f" stroke-width="1.2"/>
    <ellipse cx="452" cy="205" rx="20" ry="58" fill="#8d76c8" stroke="#51408f" stroke-width="1.2"/>
    <ellipse cx="418" cy="212" rx="14" ry="38" fill="#e590ae" stroke="#8c2c58" stroke-width="1.2"/>
    <ellipse cx="396" cy="220" rx="10" ry="24" fill="#bd4a79" stroke="#8c2c58" stroke-width="1.2"/>
    <ellipse cx="352" cy="292" rx="17" ry="7" transform="rotate(-18 352 292)" fill="#2f8f83" stroke="#1d5c54" stroke-width="1.2"/>
    <path d="M300 346 C330 364 372 354 394 334" fill="none" stroke="#e5d9c8" stroke-width="20" stroke-linecap="round"/>
    <path d="M302 322 C327 336 360 331 385 316" fill="none" stroke="#3a2a24" stroke-width="13" stroke-linecap="round"/>
    ${markers || ''}`;
  const mk = (l, x, y, tx, ty) => `<g>${tx !== undefined ? `<line x1="${x}" y1="${y}" x2="${tx}" y2="${ty}" stroke="#1c1830" stroke-width="1.5"/>` : ''}<circle cx="${x}" cy="${y}" r="12" fill="#fff" stroke="#1c1830" stroke-width="2"/><text x="${x}" y="${y + 5}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-weight="700" font-size="14" fill="#1c1830">${l}</text></g>`;
  const markers = mk('A', 400, 98, 374, 120) + mk('B', 496, 150, 468, 172) + mk('C', 470, 292, 428, 246) +
    mk('D', 404, 284, 396, 243) + mk('E', 318, 222) + mk('F', 310, 288, 336, 291) + mk('G', 420, 336, 388, 318);
  return `<svg viewBox="0 0 560 420" role="img" aria-label="Schematic coronal section through the basal ganglia with seven lettered structures A to G on the right hemisphere">
    <path d="M280 40 C150 30 55 110 52 220 C50 310 110 370 200 380 L280 385 L360 380 C450 370 510 310 508 220 C505 110 410 30 280 40 Z" fill="#f6f1f4" stroke="#b7a9cc" stroke-width="12"/>
    <rect x="276" y="165" width="8" height="150" rx="4" fill="#cfe0f0"/>
    ${bg(markers)}
    <g transform="translate(560 0) scale(-1 1)">${bg('')}</g>
    <text x="280" y="408" text-anchor="middle" class="fig-cap">CORONAL SECTION · RIGHT HEMISPHERE LABELED</text>
  </svg>`;
};

