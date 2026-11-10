/* preproceso.js — Convierte lo que la persona dibuja en la entrada que la red espera.
 *
 * Por qué hace falta: en los datos de entrenamiento cada dígito está recortado,
 * escalado para caber en una caja de 20x20 y centrado por su centro de masa
 * dentro de una imagen de 28x28 (ver resultados/t07_resumen.json: alto medio
 * 19.68 px, ancho medio 15.59 px, centro de masa en la fila 13.99 y la columna
 * 14.00). Un trazo de dedo sin este tratamiento le llega a la red como algo que
 * nunca vio, y falla aunque el modelo sea bueno.
 *
 * Pasos: leer la tinta → separar los trazos en grupos (una cifra por grupo) →
 * recortar, escalar a 20 px de lado mayor y centrar por centro de masa.
 */

export const LADO = 28;
export const CAJA = 20;          // lado mayor del dígito dentro de la imagen
const UMBRAL_TINTA = 0.12;       // por debajo se considera fondo
// Una mota se mide contra el trazo más grande que haya en el lienzo, no contra
// el lienzo entero: así da igual la proporción del lienzo y el tamaño con el
// que cada persona escriba. El piso absoluto descarta el punto de un toque suelto.
const AREA_MINIMA_RELATIVA = 0.06;
const AREA_MINIMA_ABSOLUTA = 0.0006;

/* Lee el canal alfa del lienzo como un mapa de tinta entre 0 y 1. */
export function leerTinta(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width: w, height: h } = canvas;
  const datos = ctx.getImageData(0, 0, w, h).data;
  const tinta = new Float32Array(w * h);
  for (let i = 0, p = 3; i < tinta.length; i++, p += 4) tinta[i] = datos[p] / 255;
  return { tinta, w, h };
}

export function hayTinta({ tinta }) {
  for (let i = 0; i < tinta.length; i++) if (tinta[i] > UMBRAL_TINTA) return true;
  return false;
}

/* Componentes conexas (8-vecinos) del mapa de tinta. Cada componente es un
 * trazo suelto; luego se juntan las que se solapan horizontalmente, porque un
 * mismo dígito puede dibujarse en varios trazos (un 4 o un 5, por ejemplo). */
export function separarCifras({ tinta, w, h }) {
  const visitado = new Uint8Array(w * h);
  const pila = new Int32Array(w * h);
  const grupos = [];

  for (let p0 = 0; p0 < tinta.length; p0++) {
    if (visitado[p0] || tinta[p0] <= UMBRAL_TINTA) continue;
    let tope = 0;
    pila[tope++] = p0;
    visitado[p0] = 1;
    let x0 = w, x1 = -1, y0 = h, y1 = -1, area = 0;
    while (tope > 0) {
      const p = pila[--tope];
      const x = p % w, y = (p / w) | 0;
      area++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (!visitado[q] && tinta[q] > UMBRAL_TINTA) { visitado[q] = 1; pila[tope++] = q; }
        }
      }
    }
    grupos.push({ x0, x1, y0, y1, area });
  }

  const mayor = grupos.reduce((m, g) => Math.max(m, g.area), 0);
  const minima = Math.max(AREA_MINIMA_ABSOLUTA * w * h, mayor * AREA_MINIMA_RELATIVA);
  let cajas = grupos.filter((g) => g.area >= minima);
  if (cajas.length === 0) cajas = grupos;          // si todo es pequeño, no descartar
  cajas.sort((a, b) => a.x0 - b.x0);

  // Juntar trazos del mismo dígito: se solapan en horizontal más de la mitad
  // del más estrecho, o están prácticamente pegados.
  const unidas = [];
  for (const c of cajas) {
    const u = unidas[unidas.length - 1];
    if (u) {
      const solape = Math.min(u.x1, c.x1) - Math.max(u.x0, c.x0);
      const ancho = Math.min(u.x1 - u.x0, c.x1 - c.x0) + 1;
      const separacion = c.x0 - u.x1;
      if (solape > 0.5 * ancho || separacion < 0.04 * w) {
        u.x0 = Math.min(u.x0, c.x0); u.x1 = Math.max(u.x1, c.x1);
        u.y0 = Math.min(u.y0, c.y0); u.y1 = Math.max(u.y1, c.y1);
        u.area += c.area;
        continue;
      }
    }
    unidas.push({ ...c });
  }
  return unidas;
}

/* Recorta la caja indicada, la escala para que su lado mayor mida 20 px y la
 * centra por centro de masa en una imagen de 28x28. Devuelve Float32Array(784). */
export function aEntrada({ tinta, w, h }, caja) {
  const { x0, x1, y0, y1 } = caja;
  const anchoC = x1 - x0 + 1;
  const altoC = y1 - y0 + 1;
  const escala = CAJA / Math.max(anchoC, altoC);
  const anchoD = Math.max(1, Math.round(anchoC * escala));
  const altoD = Math.max(1, Math.round(altoC * escala));

  // Remuestreo por área: cada píxel de destino promedia la región que le toca.
  const chico = new Float32Array(anchoD * altoD);
  for (let yd = 0; yd < altoD; yd++) {
    const ya = y0 + (yd * altoC) / altoD;
    const yb = y0 + ((yd + 1) * altoC) / altoD;
    for (let xd = 0; xd < anchoD; xd++) {
      const xa = x0 + (xd * anchoC) / anchoD;
      const xb = x0 + ((xd + 1) * anchoC) / anchoD;
      let suma = 0, peso = 0;
      for (let y = Math.floor(ya); y < Math.ceil(yb); y++) {
        if (y < 0 || y >= h) continue;
        const fy = Math.min(y + 1, yb) - Math.max(y, ya);
        if (fy <= 0) continue;
        for (let x = Math.floor(xa); x < Math.ceil(xb); x++) {
          if (x < 0 || x >= w) continue;
          const fx = Math.min(x + 1, xb) - Math.max(x, xa);
          if (fx <= 0) continue;
          suma += tinta[y * w + x] * fx * fy;
          peso += fx * fy;
        }
      }
      chico[yd * anchoD + xd] = peso > 0 ? suma / peso : 0;
    }
  }

  // Centro de masa del recorte escalado
  let masa = 0, cx = 0, cy = 0;
  for (let y = 0; y < altoD; y++) {
    for (let x = 0; x < anchoD; x++) {
      const v = chico[y * anchoD + x];
      masa += v; cx += x * v; cy += y * v;
    }
  }
  const centro = (LADO - 1) / 2;
  let desX = Math.round(centro - (masa > 0 ? cx / masa : (anchoD - 1) / 2));
  let desY = Math.round(centro - (masa > 0 ? cy / masa : (altoD - 1) / 2));
  // No dejar que el recorte se salga de la imagen de 28x28
  desX = Math.max(0, Math.min(desX, LADO - anchoD));
  desY = Math.max(0, Math.min(desY, LADO - altoD));

  const salida = new Float32Array(LADO * LADO);
  for (let y = 0; y < altoD; y++) {
    const yy = y + desY;
    if (yy < 0 || yy >= LADO) continue;
    for (let x = 0; x < anchoD; x++) {
      const xx = x + desX;
      if (xx < 0 || xx >= LADO) continue;
      salida[yy * LADO + xx] = Math.min(1, chico[y * anchoD + x]);
    }
  }
  return salida;
}

/* En los datos de entrenamiento cada dígito tiene en promedio 104 píxeles
 * encendidos (mínimo 22). Si alguien dibuja con un trazo muy fino, al encoger
 * a 28x28 quedan muchos menos y la red ve algo que no se parece a nada de lo
 * que aprendió. Esto engrosa el trazo hasta llegar a un mínimo razonable.
 * Es una corrección del preprocesado, no del modelo. */
const TINTA_MINIMA = 48;

export function engrosarSiHaceFalta(img, pasos = 2) {
  let actual = img;
  for (let p = 0; p < pasos; p++) {
    let encendidos = 0;
    for (let i = 0; i < actual.length; i++) if (actual[i] > 0.5) encendidos++;
    if (encendidos >= TINTA_MINIMA) break;
    const nuevo = Float32Array.from(actual);
    for (let y = 0; y < LADO; y++) {
      for (let x = 0; x < LADO; x++) {
        const i = y * LADO + x;
        let max = actual[i];
        if (x > 0) max = Math.max(max, actual[i - 1]);
        if (x < LADO - 1) max = Math.max(max, actual[i + 1]);
        if (y > 0) max = Math.max(max, actual[i - LADO]);
        if (y < LADO - 1) max = Math.max(max, actual[i + LADO]);
        nuevo[i] = Math.max(actual[i], max * 0.92);
      }
    }
    actual = nuevo;
  }
  return actual;
}

/* Lienzo completo → lista de entradas de 784 valores, una por cifra, de
 * izquierda a derecha. */
export function entradasDesdeCanvas(canvas, maxCifras = 8) {
  const mapa = leerTinta(canvas);
  if (!hayTinta(mapa)) return [];
  return separarCifras(mapa).slice(0, maxCifras).map((caja) => ({
    entrada: engrosarSiHaceFalta(aEntrada(mapa, caja)),
    caja,
  }));
}

/* La misma imagen vista como matriz booleana, para la parte de matemática
 * discreta: cada píxel es 0 o 1. */
export function binarizar(entrada, umbral = 0.5) {
  const b = new Uint8Array(entrada.length);
  for (let i = 0; i < entrada.length; i++) b[i] = entrada[i] > umbral ? 1 : 0;
  return b;
}

export function distanciaHamming(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}
