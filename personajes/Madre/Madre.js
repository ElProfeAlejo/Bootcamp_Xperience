/**
 * PERSONAJE · Madre — marioneta 2D con deformación por malla a partir de las piezas del usuario
 * (mismo proceso que MissMargo; la capucha y el pelo largo van en la pieza de la cabeza).
 * Capas: capas.js (generado por preparar.py desde referencias/). Cargar capas.js antes que este archivo.
 * El cuello se dibuja como malla de triángulos unida a huesos (pecho, cuello, cabeza) con pesos suaves: se dobla al
 * girar la cabeza; va entre la espalda de la túnica y la túnica, y asoma por el escote. La cabeza también es malla: la
 * cara y la capucha giran con la cabeza y el pelo largo, por debajo de la barbilla, se queda poco a poco con el pecho.
 * Los brazos son las piezas enteras, van delante del torso (como en la referencia) y giran rígidos desde el hombro.
 *
 * MISMA API QUE EL CURADOR:
 *   await Personajes.Madre.listo;
 *   const pj = Personajes.Madre.crear();          // 600 × 940 unidades lógicas
 *   pj.dibujar(ctx, {brazo_derecho: 1, visema: 'C'});
 * Controles: x, y, escala, tiempo_segundos, brazo_izquierdo, brazo_derecho (0 reposo · 1 presentando), visema,
 * parpadeo, inclinacion_cabeza_grados, cejas, comportamiento (neutro, sorprenderse, reirse, llorar, pensando),
 * intensidad, tiempo_comportamiento, duracion_comportamiento. El mismo estado produce el mismo fotograma.
 */
(function (root) {
  'use strict';
  const D = root.CAPAS_Madre;
  if (!D) throw new Error('Falta capas.js: cárgalo antes de Madre.js');
  const C = D.capas;
  const ANCHO = 600, ALTO = 940;
  const [bx0, by0, bx1, by1] = D.caja;
  const K = (ALTO - 40) / (by1 - by0);                       // imagen de referencia → marco lógico
  const OX = ANCHO / 2 - (bx0 + bx1) / 2 * K, OY = 20 - by0 * K;

  // esqueleto (coordenadas de la imagen de referencia)
  const E = D.esqueleto, BARBILLA = E.barbilla;              // el cuello sigue a la cabeza por encima de la barbilla
  const P = { cuello: [E.eje, BARBILLA - 2], pecho: [E.eje, E.cinturon - 170], cadera: [E.eje, E.cinturon + 90],
              hombro_izq: D.hombros.brazo_izq, hombro_der: D.hombros.brazo_der };   // pivotes que calcula preparar.py

  const img = {};
  const listo = Promise.all(Object.entries(C).map(([k, c]) => new Promise(ok => {
    const i = new Image(); i.onload = ok; i.onerror = ok; i.src = c.png; img[k] = i;
  })));

  // ---------------------------------------------------------------- utilidades de transformación
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, Number(x) || 0));
  const suave = x => { const p = clamp(x); return p * p * (3 - 2 * p); };
  const I = [1, 0, 0, 1, 0, 0];                                                    // [a b c d e f]
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
                         m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const rotEn = (p, a) => { const c = Math.cos(a), s = Math.sin(a);
    return [c, s, -s, c, p[0] - c * p[0] + s * p[1], p[1] - s * p[0] - c * p[1]]; };
  const tras = (dx, dy) => [1, 0, 0, 1, dx, dy];
  const escEn = (p, sx, sy) => [sx, 0, 0, sy, p[0] - sx * p[0], p[1] - sy * p[1]];
  const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const mezcla = (ms, ws, x, y) => { let X = 0, Y = 0, S = 0;
    ms.forEach((m, i) => { if (ws[i] > 0) { const q = ap(m, x, y); X += q[0] * ws[i]; Y += q[1] * ws[i]; S += ws[i]; } });
    return [X / S, Y / S]; };

  // ajustes a mano (herramientas/editor.html, guardados en capas.js y ajustes.json): por pieza, desplazamiento, giro y
  // escala sobre su centro, en píxeles de la imagen de referencia. Se leen en cada fotograma (el editor los cambia en
  // vivo); las tres bocas se ajustan como una sola pieza ('boca') y la espalda de la túnica sigue al torso.
  function aj(k) {
    const clave = k.startsWith('boca_') ? 'boca' : k === 'espalda' ? 'torso' : k, a = (D.ajustes || {})[clave];
    if (!a) return I;
    const c = C[clave === 'boca' ? 'boca_1' : k], centro = [c.x + c.w / 2, c.y + c.h / 2], e = a.escala || 1;
    return mul(tras(a.dx || 0, a.dy || 0), mul(rotEn(centro, (a.giro || 0) * Math.PI / 180), escEn(centro, e, e)));
  }

  // ---------------------------------------------------------------- malla
  const MALLAS = {};
  function malla(k, cols, filas) {
    const c = C[k], v = [];
    for (let j = 0; j <= filas; j++) for (let i = 0; i <= cols; i++) v.push([c.x + c.w * i / cols, c.y + c.h * j / filas]);
    const t = [];
    for (let j = 0; j < filas; j++) for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i, b = a + 1, d = a + cols + 1, e = d + 1; t.push([a, b, e], [a, e, d]);
    }
    return { v, t };
  }
  function triangulo(ctx, im, s, d, ox, oy) {
    // afín que lleva el triángulo de la textura (s, en píxeles de la pieza) al destino (d)
    const [[x0, y0], [x1, y1], [x2, y2]] = s, [[u0, v0], [u1, v1], [u2, v2]] = d;
    const den = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(den) < 1e-6) return;
    const a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / den, b = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / den;
    const c = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / den, dd = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / den;
    const e = u0 - a * x0 - c * y0, f = v0 - b * x0 - dd * y0;
    // recorte ligeramente ampliado para que no se vean juntas entre triángulos
    // ampliación de ~1,5 píxeles de pantalla hacia fuera del centroide (cubre por completo las juntas)
    const T = ctx.getTransform(), px = 1.5 / Math.max(1e-3, Math.hypot(T.a, T.b));
    const cx = (u0 + u1 + u2) / 3, cy = (v0 + v1 + v2) / 3;
    const amp = p => { const dx = p[0] - cx, dy = p[1] - cy, n = Math.hypot(dx, dy) || 1; return [p[0] + dx / n * px * 1.8, p[1] + dy / n * px * 1.8]; };
    const [p0, p1, p2] = [amp(d[0]), amp(d[1]), amp(d[2])];
    ctx.save(); ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.closePath(); ctx.clip();
    ctx.transform(a, b, c, dd, e, f); ctx.drawImage(im, 0, 0); ctx.restore();
  }
  function dibujarMalla(ctx, k, deformar, cols = 8, filas = 10) {
    const im = img[k]; if (!im || !im.naturalWidth) return;
    const M = MALLAS[k + cols + 'x' + filas] || (MALLAS[k + cols + 'x' + filas] = malla(k, cols, filas)), c = C[k];
    const A = aj(k), dst = M.v.map(([x, y]) => deformar(...ap(A, x, y)));
    for (const [a, b, e] of M.t)
      triangulo(ctx, im, [[M.v[a][0] - c.x, M.v[a][1] - c.y], [M.v[b][0] - c.x, M.v[b][1] - c.y], [M.v[e][0] - c.x, M.v[e][1] - c.y]], [dst[a], dst[b], dst[e]]);
  }
  function dibujarRigida(ctx, k, m) {
    const im = img[k]; if (!im || !im.naturalWidth) return;
    ctx.save(); ctx.transform(...mul(m, aj(k))); ctx.drawImage(im, C[k].x, C[k].y); ctx.restore();
  }

  const BOCA = { X: 0, A: 0, B: 0, G: 0, F: 0, C: 1, E: 1, H: 1, D: 2 };
  const estadoInicial = Object.freeze({ x: 0, y: 0, escala: 1, tiempo_segundos: 0, brazo_izquierdo: 0, brazo_derecho: 0,
    visema: 'X', parpadeo: 0, inclinacion_cabeza_grados: 0, cejas: 0, comportamiento: 'neutro', intensidad: 1 });
  const comportamientos = Object.freeze({
    neutro: Object.freeze({ nombre: 'Base / controles manuales', descripcion: 'Sin actuación añadida.', duracion: 8 }),
    sorprenderse: Object.freeze({ nombre: 'Sorprenderse', descripcion: 'Ojos y cejas arriba, boca abierta y brazos que se abren.', duracion: 3.2 }),
    reirse: Object.freeze({ nombre: 'Reírse', descripcion: 'Boca abierta, ojos entrecerrados y rebote.', duracion: 4 }),
    llorar: Object.freeze({ nombre: 'Llorar', descripcion: 'Cabeza baja, cejas tristes y lágrimas.', duracion: 4.5 }),
    pensando: Object.freeze({ nombre: 'Pensando', descripcion: 'Mirada y cabeza ladeadas, cejas pensativas y brazos apenas separados.', duracion: 5 })
  });

  // ---------------------------------------------------------------- fotograma
  function pose(ctx, p) {
    const resp = Math.sin(p.time * 1.6), rebote = p.joy * Math.sin(p.actionTime * 13) * 2.4;
    // cuerpo: respira (el pecho sube un poco) y rebota con la risa
    const Tpecho = tras(0, -resp * 1.2 + rebote);
    const pesoPecho = y => suave((P.cadera[1] - y) / (P.cadera[1] - P.pecho[1]));      // 0 en la cadera, 1 en el pecho
    const cuerpo = (x, y) => mezcla([I, Tpecho], [1 - pesoPecho(y), pesoPecho(y)], x, y);

    // cabeza: gira en el cuello y asiente; el cuello se dobla repartiendo el giro
    const Tcuello = ap(Tpecho, ...P.cuello);
    const Tcab = mul(mul(tras(Tcuello[0] - P.cuello[0], Tcuello[1] - P.cuello[1] + p.nod), rotEn(P.cuello, p.cabeza)), I);

    // brazos: la pieza original entera y rígida (brazo de bloque, sin codo); solo gira desde el hombro
    const brazo = (lado, sube) => mul(Tpecho, rotEn(ap(aj('brazo_' + lado), ...P['hombro_' + lado]), (lado === 'izq' ? 1 : -1) * sube));
    dibujarRigida(ctx, 'piernas', I);
    dibujarRigida(ctx, 'espalda', Tpecho);                  // espalda de la túnica (el interior del escote)
    // cuello (detrás del torso): de la base (cuerpo) a la barbilla (cabeza)
    dibujarMalla(ctx, 'cuello', (x, y) => {
      const w = suave((BARBILLA + 10 - y) / 40);
      return mezcla([Tpecho, Tcab], [1 - w, w], x, y);
    }, 4, 8);
    dibujarRigida(ctx, 'torso', Tpecho);
    // brazos delante del torso; pensando: en su sitio, apenas separados del cuerpo
    dibujarRigida(ctx, 'brazo_izq', brazo('izq', p.izq * .62 + p.piensa * .08));
    dibujarRigida(ctx, 'brazo_der', brazo('der', p.der * .62 + p.piensa * .08));
    // cabeza con la capucha y el pelo largo: rígida con la cabeza hasta la barbilla; por debajo, el pelo pasa poco a
    // poco al pecho (las puntas no se despegan de los hombros al girar la cabeza)
    dibujarMalla(ctx, 'cabeza', (x, y) => {
      const w = suave((BARBILLA + 140 - y) / 140);
      return mezcla([Tpecho, Tcab], [1 - w, w], x, y);
    }, 10, 16);

    // cara (rígida sobre la cabeza)
    ctx.save(); ctx.transform(...Tcab);
    // ojos: parpadeo (se aplastan hacia el párpado superior) y sorpresa
    const cierre = Math.max(clamp(p.blink), p.joy * .75);
    for (const k of ['ojo_izq', 'ojo_der']) {
      const [ex, ey] = ap(aj(k), D.ojos[k][0], D.ojos[k][1]), [, , rx, ry] = D.ojos[k], abre = 1 - cierre * .92, crece = 1 + p.surprise * .12;
      const top = ey - ry * .55;
      dibujarRigida(ctx, k, mul(escEn([ex, top], crece, abre * crece), I));
      if (cierre > .55) {
        ctx.save(); ctx.strokeStyle = '#26160c'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.globalAlpha = suave((cierre - .55) / .3);
        const yl = top + (ey + ry - top) * abre;
        ctx.beginPath(); ctx.moveTo(ex - rx, yl); ctx.quadraticCurveTo(ex, yl + (p.joy > .3 ? -ry * .9 : 3), ex + rx, yl); ctx.stroke(); ctx.restore();
      }
    }
    // cejas
    const sube = p.brow * 7 + p.surprise * 12 + p.joy * 3;
    for (const [k, s] of [['ceja_izq', -1], ['ceja_der', 1]]) {
      const c = C[k], centro = ap(aj(k), c.x + c.w / 2, c.y + c.h / 2);
      dibujarRigida(ctx, k, mul(tras(0, -sube - (k === 'ceja_der' ? p.thought * 4 : 0)), rotEn(centro, s * (p.sad * .22 - p.thought * .06))));
    }
    // boca: tres expresiones reales, con fundido corto entre ellas
    const bi = p.boca;
    for (const k of [0, 1, 2]) {
      const a = clamp(1 - Math.abs(bi - k));
      if (a > .01) { ctx.save(); ctx.globalAlpha = a; dibujarRigida(ctx, 'boca_' + k, I); ctx.restore(); }
    }
    // lágrimas
    if (p.sad > 0) for (const [ex, ey] of ['ojo_izq', 'ojo_der'].map(k => ap(aj(k), D.ojos[k][0], D.ojos[k][1]))) {
      const ph = (p.actionTime * .75 + (ex % 7) / 7) % 1, ty = ey + 14 + ph * 50;
      ctx.save(); ctx.globalAlpha = p.sad * Math.sin(ph * Math.PI) * .9; ctx.fillStyle = '#b6e4f6';
      ctx.beginPath(); ctx.moveTo(ex, ty - 8); ctx.quadraticCurveTo(ex - 6, ty, ex, ty + 6); ctx.quadraticCurveTo(ex + 6, ty, ex, ty - 8); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }

  function crear() {
    function dibujar(ctx, estado = {}) {
      if (!ctx || typeof ctx.save !== 'function') throw new TypeError('Se necesita un contexto Canvas 2D.');
      const e = { ...estadoInicial, ...estado };
      const escala = Number(e.escala);
      if (!Number.isFinite(escala) || escala <= 0) throw new RangeError('escala debe ser positiva.');
      if (!Object.hasOwn(BOCA, e.visema)) throw new RangeError('Visema no reconocido: ' + e.visema);
      if (!Object.hasOwn(comportamientos, e.comportamiento)) throw new RangeError('Comportamiento no reconocido: ' + e.comportamiento);
      const dur = Number(e.duracion_comportamiento ?? comportamientos[e.comportamiento].duracion);
      const t = Number(e.tiempo_comportamiento ?? e.tiempo_segundos);
      const f = e.comportamiento === 'neutro' ? 0 : clamp(e.intensidad) * suave(t / Math.min(.45, dur * .2)) * suave((dur - t) / Math.min(.55, dur * .2));
      const sur = e.comportamiento === 'sorprenderse' ? f : 0, joy = e.comportamiento === 'reirse' ? f : 0;
      const sad = e.comportamiento === 'llorar' ? f : 0, tho = e.comportamiento === 'pensando' ? f : 0;
      const usar = (k, v) => Object.hasOwn(estado, k) ? Number(e[k]) || 0 : v;
      let boca = BOCA[e.visema];
      if (!Object.hasOwn(estado, 'visema') && f > .15) boca = sur ? 2 * f : joy ? 1 + f * (.6 + .4 * Math.sin(t * 13)) : boca;
      const tt = Number(e.tiempo_segundos) || 0;
      ctx.save(); ctx.translate(Number(e.x) || 0, Number(e.y) || 0); ctx.scale(escala, escala);
      ctx.translate(OX, OY); ctx.scale(K, K);
      pose(ctx, {
        time: tt, actionTime: Math.max(0, t),
        der: clamp(usar('brazo_derecho', sur * .55 + joy * .15)), izq: clamp(usar('brazo_izquierdo', sur * .5 + joy * .1)),
        piensa: Object.hasOwn(estado, 'brazo_derecho') ? 0 : tho,
        blink: clamp(usar('parpadeo', f > 0 && t % 3.4 > 3.28 ? 1 : 0)), brow: clamp(e.cejas),
        cabeza: usar('inclinacion_cabeza_grados', -3 * sur + joy * (-2 + Math.sin(t * 13) * 1.5) + sad * (5 + Math.sin(t * 5) * .5) - tho * 6) * Math.PI / 180,
        nod: Math.sin(tt * .9) * 1.2 + sad * 4,
        boca, surprise: sur, joy, sad, thought: tho
      });
      ctx.restore();
    }
    return Object.freeze({ dibujar, ancho: ANCHO, alto: ALTO });
  }

  // cara en el marco lógico: punto medio entre los ojos
  const [oi, od] = [D.ojos.ojo_izq, D.ojos.ojo_der];
  const cara = Object.freeze({ x: Math.round(OX + (oi[0] + od[0]) / 2 * K), y: Math.round(OY + (oi[1] + od[1]) / 2 * K) });
  // marco y ajustes, para el editor de piezas
  const marco = Object.freeze({ K, OX, OY, ajuste: aj });
  const api = Object.freeze({ nombre: 'Madre', cara, marco, crear, listo, estadoInicial, comportamientos, visemas: Object.freeze(Object.keys(BOCA)) });
  root.Personajes = root.Personajes || {};
  root.Personajes.Madre = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
