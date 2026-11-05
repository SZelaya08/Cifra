/* panel.js — El panel que deja ver la red por dentro.
 *
 * Dibuja el diagrama de capas con las activaciones de este dibujo, la rejilla
 * de pesos de cada neurona, el cálculo con los números reales y la parte de
 * matemática discreta.
 */

import { LADO, binarizar, distanciaHamming } from "./preproceso.js";

const num = (v, d = 4) => {
  // Truncar, no redondear.
  const f = 10 ** d;
  const t = Math.trunc(v * f) / f;
  return t.toFixed(d);
};
const pct = (v) => `${num(v * 100, 2)}%`;

function color(nombre) {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}

/* ---------- imágenes de 28x28 ---------- */

export function pintarEntrada(canvas, entrada, lado = LADO) {
  canvas.width = lado; canvas.height = lado;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(lado, lado);
  const tinta = color("--tinta");
  const [r, g, b] = aRGB(tinta);
  for (let i = 0; i < entrada.length; i++) {
    const v = Math.max(0, Math.min(1, entrada[i]));
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = Math.round(v * 255);
  }
  ctx.clearRect(0, 0, lado, lado);
  ctx.putImageData(img, 0, 0);
}

/* Pesos como mapa divergente: rojo suma, azul resta. */
export function pintarPesos(canvas, pesos, lado = LADO, limite = null) {
  canvas.width = lado; canvas.height = lado;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(lado, lado);
  let lim = limite;
  if (lim === null) {
    lim = 0;
    for (let i = 0; i < pesos.length; i++) lim = Math.max(lim, Math.abs(pesos[i]));
  }
  if (lim === 0) lim = 1;
  for (let i = 0; i < pesos.length; i++) {
    const t = Math.max(-1, Math.min(1, pesos[i] / lim));
    let r, g, b;
    if (t >= 0) { r = 200; g = Math.round(225 - 185 * t); b = Math.round(220 - 190 * t); }
    else { const u = -t; r = Math.round(220 - 190 * u); g = Math.round(228 - 150 * u); b = 205; }
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function aRGB(cssColor) {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const ctx = c.getContext("2d");
  ctx.fillStyle = cssColor || "#000";
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

/* ---------- diagrama de capas ---------- */

export class Diagrama {
  constructor(canvas, red) {
    this.canvas = canvas;
    this.red = red;
    this.puntos = [];           // {capa, indice, x, y, r}
    this.seleccion = null;      // {capa, indice}
    this.alHacerClic = null;
    canvas.addEventListener("click", (e) => this.clic(e));
  }

  clic(e) {
    const rect = this.canvas.getBoundingClientRect();
    const escala = this.canvas.width / rect.width;
    const x = (e.clientX - rect.left) * escala;
    const y = (e.clientY - rect.top) * escala;
    let mejor = null, mejorD = Infinity;
    for (const p of this.puntos) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < mejorD && d < (p.r + 9) ** 2) { mejorD = d; mejor = p; }
    }
    if (mejor) {
      this.seleccion = { capa: mejor.capa, indice: mejor.indice };
      if (this.alHacerClic) this.alHacerClic(this.seleccion);
    }
  }

  dibujar(activaciones) {
    const red = this.red;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ancho = Math.max(300, this.canvas.parentElement.clientWidth);
    const alto = 300;
    this.canvas.width = ancho * dpr;
    this.canvas.height = alto * dpr;
    this.canvas.style.height = `${alto}px`;
    const ctx = this.canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ancho, alto);

    const cTinta = color("--tinta");
    const cTenue = color("--tinta-tenue");
    const cAcento = color("--acento");
    const cBorde = color("--borde");

    this.puntos = [];
    const margenX = 8;
    const columnas = red.capas.length;              // 4
    const anchoCol = (ancho - margenX * 2) / columnas;
    const nombres = ["entrada\n28×28", `oculta 1\n${red.capas[1]}`, `oculta 2\n${red.capas[2]}`, "salida\n10"];

    // --- capa de entrada: la imagen ---
    const ladoImg = Math.min(84, anchoCol - 14);
    const xImg = margenX + anchoCol / 2 - ladoImg / 2;
    const yImg = 46;
    if (activaciones) {
      const tmp = document.createElement("canvas");
      pintarEntrada(tmp, activaciones[0]);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, xImg, yImg, ladoImg, ladoImg);
    }
    ctx.strokeStyle = cBorde; ctx.lineWidth = 1;
    ctx.strokeRect(xImg + .5, yImg + .5, ladoImg, ladoImg);

    // --- capas de neuronas ---
    const geom = [];
    for (let capa = 1; capa < columnas; capa++) {
      const n = red.capas[capa];
      const cx = margenX + anchoCol * capa + anchoCol / 2;
      const area = { alto: 212, ancho: Math.min(anchoCol - 16, 120) };
      // La capa de salida va en una sola columna, para poder etiquetar cada dígito.
      const cols = capa === columnas - 1
        ? 1
        : Math.max(1, Math.round(Math.sqrt(n * area.ancho / area.alto)));
      const filas = Math.ceil(n / cols);
      const paso = Math.min(area.ancho / cols, area.alto / filas);
      const r = Math.max(2.1, Math.min(7, paso * 0.34));
      const x0 = cx - (cols * paso) / 2 + paso / 2;
      const y0 = 46 + (area.alto - filas * paso) / 2 + paso / 2;
      geom.push({ capa, n, cols, filas, paso, r, x0, y0 });
      for (let i = 0; i < n; i++) {
        const c = i % cols, f = Math.floor(i / cols);
        this.puntos.push({ capa, indice: i, x: x0 + c * paso, y: y0 + f * paso, r });
      }
    }

    // --- conexiones de la neurona seleccionada ---
    const sel = this.seleccion;
    if (sel && sel.capa >= 1) {
      const k = sel.capa - 1;
      const nOut = red.capas[sel.capa];
      if (sel.capa >= 2) {
        // pesos que entran desde la capa anterior
        const W = red.W[k];
        const nIn = red.capas[sel.capa - 1];
        const destino = this.puntos.find((p) => p.capa === sel.capa && p.indice === sel.indice);
        const pesos = [];
        for (let i = 0; i < nIn; i++) pesos.push({ i, w: W[i * nOut + sel.indice] });
        pesos.sort((a, b) => Math.abs(b.w) - Math.abs(a.w));
        const lim = Math.abs(pesos[0].w) || 1;
        for (const { i, w } of pesos.slice(0, 26)) {
          const origen = this.puntos.find((p) => p.capa === sel.capa - 1 && p.indice === i);
          if (!origen || !destino) continue;
          ctx.beginPath();
          ctx.moveTo(origen.x, origen.y);
          ctx.lineTo(destino.x, destino.y);
          ctx.strokeStyle = w > 0 ? "rgba(200,70,60,.55)" : "rgba(60,110,200,.55)";
          ctx.lineWidth = 0.4 + 2.2 * (Math.abs(w) / lim);
          ctx.stroke();
        }
      }
      if (sel.capa < columnas - 1) {
        // pesos que salen hacia la capa siguiente
        const Wn = red.W[sel.capa];
        const nSig = red.capas[sel.capa + 1];
        const origen = this.puntos.find((p) => p.capa === sel.capa && p.indice === sel.indice);
        const base = sel.indice * nSig;
        let lim = 0;
        for (let j = 0; j < nSig; j++) lim = Math.max(lim, Math.abs(Wn[base + j]));
        lim = lim || 1;
        for (let j = 0; j < nSig; j++) {
          const w = Wn[base + j];
          if (Math.abs(w) < lim * 0.25) continue;
          const destino = this.puntos.find((p) => p.capa === sel.capa + 1 && p.indice === j);
          if (!origen || !destino) continue;
          ctx.beginPath();
          ctx.moveTo(origen.x, origen.y);
          ctx.lineTo(destino.x, destino.y);
          ctx.strokeStyle = w > 0 ? "rgba(200,70,60,.4)" : "rgba(60,110,200,.4)";
          ctx.lineWidth = 0.4 + 1.8 * (Math.abs(w) / lim);
          ctx.stroke();
        }
      }
    }

    // --- puntos ---
    const maximos = {};
    if (activaciones) {
      for (let capa = 1; capa < columnas; capa++) {
        let m = 0;
        const a = activaciones[capa];
        for (let i = 0; i < a.length; i++) m = Math.max(m, a[i]);
        maximos[capa] = m || 1;
      }
    }
    const [ar, ag, ab] = aRGB(cAcento);
    for (const p of this.puntos) {
      const a = activaciones ? activaciones[p.capa][p.indice] / maximos[p.capa] : 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = a > 0.01
        ? `rgba(${ar},${ag},${ab},${0.18 + 0.82 * Math.min(1, a)})`
        : color("--papel-hundido");
      ctx.fill();
      if (a <= 0.01) { ctx.strokeStyle = cBorde; ctx.lineWidth = 1; ctx.stroke(); }
      if (sel && sel.capa === p.capa && sel.indice === p.indice) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = cTinta; ctx.lineWidth = 2; ctx.stroke();
      }
    }

    // --- etiquetas de la capa de salida ---
    const ultima = geom[geom.length - 1];
    if (ultima) {
      ctx.font = `500 11px ${getComputedStyle(document.body).getPropertyValue("--mono") || "monospace"}`;
      ctx.fillStyle = cTenue;
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      for (let i = 0; i < 10; i++) {
        const p = this.puntos.find((q) => q.capa === ultima.capa && q.indice === i);
        if (!p) continue;
        const esGanadora = activaciones &&
          activaciones[ultima.capa][i] === Math.max(...activaciones[ultima.capa]);
        ctx.fillStyle = esGanadora ? cAcento : cTenue;
        ctx.fillText(String(i), p.x + p.r + 5, p.y);
      }
    }

    // --- títulos de columna ---
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillStyle = cTenue;
    for (let c = 0; c < columnas; c++) {
      const cx = margenX + anchoCol * c + anchoCol / 2;
      const [l1, l2] = nombres[c].split("\n");
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.fillText(l1, cx, 10);
      ctx.font = "400 10.5px ui-monospace, monospace";
      ctx.fillText(l2, cx, 24);
    }
  }
}

/* ---------- rejilla de neuronas ---------- */

export function dibujarRejillaNeuronas(contenedor, red, activaciones, soloActivas, alSeleccionar, seleccion) {
  const n = red.capas[1];
  let indices = Array.from({ length: n }, (_, i) => i);
  if (soloActivas && activaciones) {
    indices.sort((a, b) => activaciones[1][b] - activaciones[1][a]);
    indices = indices.slice(0, 24);
  }
  const maxAct = activaciones ? Math.max(...activaciones[1], 1e-9) : 1;

  const frag = document.createDocumentFragment();
  for (const j of indices) {
    const div = document.createElement("div");
    div.className = "neurona";
    if (seleccion && seleccion.capa === 1 && seleccion.indice === j) div.classList.add("activa");
    div.tabIndex = 0;
    div.setAttribute("role", "button");
    const act = activaciones ? activaciones[1][j] : 0;
    div.setAttribute("aria-label", `Neurona ${j}, activación ${num(act, 2)}`);
    const c = document.createElement("canvas");
    // Cada neurona se normaliza con su propio máximo: si se usara el máximo de
    // toda la capa, las neuronas de pesos pequeños se verían en blanco.
    pintarPesos(c, red.pesosDeNeuronaEntrada(j));
    const medidor = document.createElement("div");
    medidor.className = "medidor";
    const i = document.createElement("i");
    i.style.width = `${Math.min(100, (act / maxAct) * 100)}%`;
    medidor.appendChild(i);
    const s = document.createElement("small");
    s.textContent = `n${j} · ${num(act, 1)}`;
    div.append(c, medidor, s);
    const activar = () => alSeleccionar({ capa: 1, indice: j });
    div.addEventListener("click", activar);
    div.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activar(); } });
    frag.appendChild(div);
  }
  contenedor.replaceChildren(frag);
}

/* Dos filas para comparar: arriba la imagen promedio de cada dígito, que sí se
 * parece a un dígito; abajo los pesos que aprende un modelo de una sola capa,
 * que no. Los pesos no son un retrato del dígito: son lo que lo distingue de
 * los otros nueve, y por eso se ven revueltos aunque el modelo funcione. */
export function dibujarComparacion(contenedor, promedios, plantillas) {
  contenedor.replaceChildren();
  const fila = (titulo, pintar) => {
    const cont = document.createElement("div");
    const h = document.createElement("p");
    h.className = "etiqueta-campo";
    h.textContent = titulo;
    const rejilla = document.createElement("div");
    rejilla.className = "plantillas";
    for (let d = 0; d < 10; d++) {
      const div = document.createElement("div");
      div.className = "plantilla";
      const c = document.createElement("canvas");
      pintar(c, d);
      const s = document.createElement("small");
      s.textContent = d;
      div.append(c, s);
      rejilla.appendChild(div);
    }
    cont.append(h, rejilla);
    return cont;
  };

  if (promedios) {
    contenedor.appendChild(fila("Imagen promedio de cada dígito",
      (c, d) => pintarEntrada(c, promedios[d])));
  }
  if (plantillas) {
    contenedor.appendChild(fila("Pesos de un modelo de una sola capa",
      (c, d) => pintarPesos(c, Float32Array.from(plantillas.plantillas[d]))));
  }
}

/* ---------- cálculo de una neurona ---------- */

export function dibujarCalculo(contenedor, red, seleccion, hayDibujo) {
  contenedor.replaceChildren();
  if (!seleccion) {
    const p = document.createElement("p");
    p.className = "nota";
    p.textContent = "Toca una neurona en Capas o en Neuronas para ver su cuenta.";
    contenedor.appendChild(p);
    return;
  }
  if (!hayDibujo) {
    const p = document.createElement("p");
    p.className = "nota";
    p.textContent = "Dibuja algo para que la cuenta tenga números.";
    contenedor.appendChild(p);
    return;
  }

  const d = red.detalleNeurona(seleccion.capa, seleccion.indice);
  const esSalida = seleccion.capa === red.capas.length - 1;

  const cabeza = document.createElement("div");
  cabeza.className = "calculo-cabeza";
  if (seleccion.capa === 1) {
    const c = document.createElement("canvas");
    pintarPesos(c, red.pesosDeNeuronaEntrada(seleccion.indice));
    cabeza.appendChild(c);
  }
  const textoCabeza = document.createElement("div");
  const h = document.createElement("h3");
  h.style.fontFamily = "var(--display)";
  h.style.fontSize = "16px";
  h.textContent = esSalida
    ? `Neurona de salida del dígito ${seleccion.indice}`
    : `Neurona ${seleccion.indice} de la capa oculta ${seleccion.capa}`;
  const sub = document.createElement("p");
  sub.className = "nota";
  sub.textContent = `Recibe ${red.capas[seleccion.capa - 1]} entradas, de las cuales ${d.nEntradasActivas} son distintas de cero en este dibujo.`;
  textoCabeza.append(h, sub);
  cabeza.appendChild(textoCabeza);
  contenedor.appendChild(cabeza);

  const f = document.createElement("div");
  f.className = "formula";
  const lineas = [];
  lineas.push(`suma = sesgo + Σ (entrada_i × peso_i)`);
  lineas.push(``);
  for (const t of d.mayores) {
    const nombre = seleccion.capa === 1 ? `píxel ${t.i}` : `n${t.i}`;
    lineas.push(`  ${nombre.padEnd(11)} ${num(t.entrada, 3).padStart(8)} × ${num(t.peso, 3).padStart(8)} = ${num(t.aporte, 4).padStart(9)}`);
  }
  if (d.nEntradasActivas > d.mayores.length) {
    lineas.push(`  …y ${d.nEntradasActivas - d.mayores.length} términos más`);
  }
  lineas.push(``);
  lineas.push(`  suma de los términos  = ${num(d.sumaSinSesgo)}`);
  lineas.push(`  sesgo                 = ${num(d.sesgo)}`);
  lineas.push(`  suma total            = ${num(d.suma)}`);
  lineas.push(``);
  if (esSalida) {
    lineas.push(`  softmax(suma) = ${num(d.activacion)}   → ${pct(d.activacion)} de probabilidad`);
  } else {
    lineas.push(`  ReLU(${num(d.suma)}) = max(0, ${num(d.suma)}) = ${num(d.activacion)}`);
    lineas.push(d.activacion > 0 ? `  La neurona se activa.` : `  La neurona queda apagada: no aporta nada a la siguiente capa.`);
  }
  f.textContent = lineas.join("\n");
  contenedor.appendChild(f);

  const caja = document.createElement("div");
  caja.className = "tabla-caja";
  const tabla = document.createElement("table");
  tabla.className = "tabla-terminos";
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>entrada</th><th>valor</th><th>peso</th><th>aporte</th></tr>";
  const tbody = document.createElement("tbody");
  for (const t of d.mayores) {
    const tr = document.createElement("tr");
    const nombre = seleccion.capa === 1
      ? `píxel ${t.i} (fila ${Math.floor(t.i / LADO)}, col ${t.i % LADO})`
      : `neurona ${t.i}`;
    for (const v of [nombre, num(t.entrada, 3), num(t.peso, 4), num(t.aporte, 4)]) {
      const td = document.createElement("td");
      td.textContent = v;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  tabla.append(thead, tbody);
  caja.appendChild(tabla);
  contenedor.appendChild(caja);
}

/* ---------- matemática discreta ---------- */

export function dibujarDiscreta(contenedor, red, entrada, anclas, prediccion) {
  contenedor.replaceChildren();
  const bloque = (titulo, ...hijos) => {
    const d = document.createElement("div");
    d.className = "bloque-discreto";
    const h = document.createElement("h3");
    h.textContent = titulo;
    d.append(h, ...hijos);
    return d;
  };
  const nota = (texto) => {
    const p = document.createElement("p");
    p.className = "nota";
    p.textContent = texto;
    return p;
  };

  if (!entrada) {
    contenedor.appendChild(nota("Dibuja un número para ver su matriz, su distancia de Hamming y el conteo."));
    return;
  }

  const b = binarizar(entrada);
  let encendidos = 0;
  for (let i = 0; i < b.length; i++) encendidos += b[i];

  // 1. matriz binaria
  const filas = [];
  for (let y = 0; y < LADO; y++) {
    let s = "";
    for (let x = 0; x < LADO; x++) s += b[y * LADO + x] ? "1" : "·";
    filas.push(s);
  }
  const pre = document.createElement("div");
  pre.className = "matriz-binaria";
  pre.textContent = filas.join("\n");
  contenedor.appendChild(bloque(
    "1 · El dibujo como matriz binaria",
    nota(`Con umbral 0.5, el dibujo es una matriz de 28×28 con ceros y unos. Tiene ${encendidos} píxeles encendidos de 784.`),
    pre,
  ));

  // 2. conteo
  const datos = document.createElement("div");
  datos.className = "datos-rejilla";
  const añadirDato = (valor, etiqueta) => {
    const d = document.createElement("div");
    d.className = "dato";
    const bb = document.createElement("b");
    bb.textContent = valor;
    const s = document.createElement("span");
    s.textContent = etiqueta;
    d.append(bb, s);
    datos.appendChild(d);
  };
  añadirDato("2^784", "matrices binarias de 28×28 posibles");
  añadirDato("≈ 10^236", "el mismo número en potencias de diez");
  añadirDato("10 000", "imágenes con las que se entrenó");
  añadirDato("≈ 10^-232", "fracción del total que vimos");
  contenedor.appendChild(bloque(
    "2 · Cuántos dibujos distintos caben",
    nota("Cada píxel se enciende o no, así que hay 2 elevado a 28×28 matrices posibles. Casi todas son ruido: los dibujos que parecen un dígito son una parte diminuta."),
    datos,
  ));

  // 3. Hamming contra los prototipos de cada dígito
  if (anclas && anclas.prototipos) {
    const distancias = anclas.prototipos.map((p, d) => ({ d, dist: distanciaHamming(b, p) }));
    distancias.sort((p, q) => p.dist - q.dist);
    const maxD = distancias[distancias.length - 1].dist || 1;
    const rank = document.createElement("div");
    rank.className = "ranking";
    for (let k = 0; k < distancias.length; k++) {
      const { d, dist } = distancias[k];
      const fila = document.createElement("div");
      fila.className = "ranking-fila" + (k === 0 ? " primera" : "");
      const sd = document.createElement("span"); sd.className = "d"; sd.textContent = d;
      const sb = document.createElement("span"); sb.className = "b";
      const i = document.createElement("i");
      i.style.width = `${(dist / maxD) * 100}%`;
      sb.appendChild(i);
      const sv = document.createElement("span"); sv.className = "v"; sv.textContent = dist;
      fila.append(sd, sb, sv);
      rank.appendChild(fila);
    }
    const vecino = anclas.vecinoMasCercano(b);
    const comparacion = nota(
      `Comparando solo píxel a píxel, el dígito más parecido es el ${distancias[0].d}. ` +
      `Con el vecino más cercano entre las ${anclas.total} imágenes de referencia sale ${vecino.clase}` +
      (prediccion !== null && prediccion !== undefined ? `, y la red dice ${prediccion}.` : ".")
    );
    contenedor.appendChild(bloque(
      "3 · Distancia de Hamming a cada dígito",
      nota("La distancia de Hamming cuenta en cuántos píxeles se diferencian dos matrices. Es lo mismo que contar los unos de su XOR. Aquí se compara tu dibujo con la imagen promedio de cada dígito."),
      rank,
      comparacion,
    ));
  }

  // 4. relación de equivalencia
  contenedor.appendChild(bloque(
    "4 · Clases de equivalencia",
    nota("La relación «x e y representan el mismo dígito» es reflexiva, simétrica y transitiva, así que parte todos los dibujos posibles en 10 clases. La red aprende a decidir en cuál cae un dibujo nuevo, sin haberlo visto jamás."),
  ));

  // 5. lógica y perceptrones
  const tabla = document.createElement("div");
  tabla.className = "formula";
  tabla.textContent = [
    "  p  q |  AND   OR  NAND  XOR",
    "  ----+------------------------",
    "  0  0 |   0    0    1     0",
    "  0  1 |   0    1    1     1",
    "  1  0 |   0    1    1     1",
    "  1  1 |   1    1    0     0",
    "",
    "  De las 16 funciones booleanas de dos variables,",
    "  14 las resuelve una sola neurona y 2 no: XOR y XNOR.",
    "",
    "  XOR(p,q) = AND( OR(p,q), NAND(p,q) )",
    "  Por eso esta red tiene capas ocultas: sin ellas",
    "  no podría combinar trazos que por separado no bastan.",
  ].join("\n");
  contenedor.appendChild(bloque(
    "5 · Por qué hacen falta capas ocultas",
    nota("Una neurona con umbral traza una recta y separa lo que queda a cada lado. AND y OR se separan con una recta; XOR no, porque sus dos casos verdaderos quedan en diagonal."),
    tabla,
  ));
}

/* ---------- curva de pérdida ---------- */

export function dibujarCurva(canvas, valores) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const ancho = canvas.clientWidth || 300;
  const alto = 110;
  canvas.width = ancho * dpr; canvas.height = alto * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, ancho, alto);
  if (!valores || valores.length === 0) {
    ctx.fillStyle = color("--tinta-tenue");
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("Aquí aparecerá la curva cuando reentrenes", ancho / 2, alto / 2);
    return;
  }
  const m = { t: 12, r: 44, b: 20, l: 10 };
  const max = Math.max(...valores), min = Math.min(...valores);
  const rango = max - min || 1;
  const x = (i) => m.l + (i / Math.max(1, valores.length - 1)) * (ancho - m.l - m.r);
  const y = (v) => m.t + (1 - (v - min) / rango) * (alto - m.t - m.b);

  ctx.strokeStyle = color("--borde"); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(m.l, alto - m.b); ctx.lineTo(ancho - m.r, alto - m.b); ctx.stroke();

  ctx.beginPath();
  valores.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.strokeStyle = color("--acento");
  ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x(valores.length - 1), y(valores[valores.length - 1]), 3.2, 0, Math.PI * 2);
  ctx.fillStyle = color("--acento"); ctx.fill();

  ctx.fillStyle = color("--tinta-suave");
  ctx.font = "500 11px ui-monospace, monospace";
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(num(valores[valores.length - 1], 3), x(valores.length - 1) + 6, y(valores[valores.length - 1]));
  ctx.textBaseline = "top";
  ctx.fillStyle = color("--tinta-tenue");
  ctx.fillText("pérdida", m.l, 2);
}

export { num, pct };
