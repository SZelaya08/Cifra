/* T13 — Comprueba el preprocesado del lienzo sin abrir un navegador.
 *
 * Toma imágenes reales del conjunto de prueba, las agranda a 280x280 como si
 * estuvieran dibujadas en el lienzo (y las corre, agranda y encoge para simular
 * que alguien no dibuja centrado), vuelve a pasarlas por el preprocesado y mide
 * si la red sigue acertando. Si el preprocesado está mal, la exactitud se cae.
 *
 * Uso: node validar_preproceso.mjs <casos.json> <pesos.json> <salida.json>
 */
import fs from "node:fs";
import { Red } from "../docs/red.js";
import { leerTinta, separarCifras, aEntrada, LADO } from "../docs/preproceso.js";

const LIENZO = 280;

/* Canvas falso: solo necesita devolver los datos del canal alfa. */
function canvasDesde(alfa, w, h) {
  const datos = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) datos[i * 4 + 3] = alfa[i];
  return { width: w, height: h, getContext: () => ({ getImageData: () => ({ data: datos }) }) };
}

/* Dibuja una imagen de 28x28 dentro de un lienzo grande, con la escala y la
 * posición que se indiquen (vecino más cercano, como un trazo grueso). */
function pintar(img28, { escala = 1, desX = 0, desY = 0 } = {}) {
  const alfa = new Uint8ClampedArray(LIENZO * LIENZO);
  const px = (LIENZO / LADO) * escala;              // tamaño de cada píxel original
  const margen = (LIENZO - LADO * px) / 2;
  for (let y = 0; y < LADO; y++) {
    for (let x = 0; x < LADO; x++) {
      const v = img28[y * LADO + x];
      if (v <= 0.01) continue;
      const xa = Math.round(margen + x * px + desX), ya = Math.round(margen + y * px + desY);
      for (let dy = 0; dy < Math.ceil(px); dy++) {
        const yy = ya + dy;
        if (yy < 0 || yy >= LIENZO) continue;
        for (let dx = 0; dx < Math.ceil(px); dx++) {
          const xx = xa + dx;
          if (xx < 0 || xx >= LIENZO) continue;
          alfa[yy * LIENZO + xx] = Math.max(alfa[yy * LIENZO + xx], Math.round(v * 255));
        }
      }
    }
  }
  return canvasDesde(alfa, LIENZO, LIENZO);
}

/* Pinta varias cifras seguidas, como un número de varias cifras. */
function pintarVarias(imgs) {
  const alfa = new Uint8ClampedArray(LIENZO * LIENZO);
  const n = imgs.length;
  const ancho = LIENZO / n;
  const px = (ancho * 0.75) / LADO;
  for (let k = 0; k < n; k++) {
    const img28 = imgs[k];
    const ox = k * ancho + ancho * 0.125;
    const oy = (LIENZO - LADO * px) / 2;
    for (let y = 0; y < LADO; y++) {
      for (let x = 0; x < LADO; x++) {
        const v = img28[y * LADO + x];
        if (v <= 0.01) continue;
        const xa = Math.round(ox + x * px), ya = Math.round(oy + y * px);
        for (let dy = 0; dy < Math.ceil(px); dy++) {
          for (let dx = 0; dx < Math.ceil(px); dx++) {
            const yy = ya + dy, xx = xa + dx;
            if (yy < 0 || yy >= LIENZO || xx < 0 || xx >= LIENZO) continue;
            alfa[yy * LIENZO + xx] = Math.max(alfa[yy * LIENZO + xx], Math.round(v * 255));
          }
        }
      }
    }
  }
  return canvasDesde(alfa, LIENZO, LIENZO);
}

const casos = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).casos;
const red = new Red(JSON.parse(fs.readFileSync(process.argv[3], "utf8")));

// --- Referencia: la entrada original, sin pasar por el lienzo ---
let directo = 0;
for (const c of casos) if (red.predecir(Float32Array.from(c.entrada)).clase === c.etiqueta_real) directo++;

// --- Una cifra, en distintas posiciones y tamaños ---
const variantes = [
  { nombre: "centrado", opts: {} },
  { nombre: "pequeño", opts: { escala: 0.45 } },
  { nombre: "grande", opts: { escala: 1.6 } },
  { nombre: "corrido a una esquina", opts: { escala: 0.6, desX: -70, desY: -60 } },
  { nombre: "corrido a la derecha", opts: { escala: 0.7, desX: 60, desY: 20 } },
];
const porVariante = {};
for (const v of variantes) {
  let bien = 0, unaCaja = 0;
  for (const c of casos) {
    const canvas = pintar(Float32Array.from(c.entrada), v.opts);
    const cajas = separarCifras(leerTinta(canvas));
    if (cajas.length === 1) unaCaja++;
    const mapa = leerTinta(canvas);
    const todas = separarCifras(mapa);
    if (todas.length === 0) continue;
    // Se toma la caja más grande, que es la cifra
    const caja = todas.reduce((a, b) => (b.area > a.area ? b : a));
    if (red.predecir(aEntrada(mapa, caja)).clase === c.etiqueta_real) bien++;
  }
  porVariante[v.nombre] = {
    accuracy: Number((bien / casos.length).toFixed(4)),
    detectadas_como_una_sola_cifra: `${unaCaja}/${casos.length}`,
  };
}

// --- Varias cifras seguidas: ¿las separa bien? ---
let separacionOk = 0, lecturaOk = 0, pruebas = 0;
for (let k = 0; k + 3 <= casos.length; k += 3) {
  const grupo = casos.slice(k, k + 3);
  const canvas = pintarVarias(grupo.map((c) => Float32Array.from(c.entrada)));
  const mapa = leerTinta(canvas);
  const cajas = separarCifras(mapa);
  pruebas++;
  if (cajas.length === 3) {
    separacionOk++;
    const leido = cajas.map((caja) => red.predecir(aEntrada(mapa, caja)).clase).join("");
    if (leido === grupo.map((c) => c.etiqueta_real).join("")) lecturaOk++;
  }
}

const informe = {
  casos: casos.length,
  accuracy_entrada_directa: Number((directo / casos.length).toFixed(4)),
  una_cifra_por_variante: porVariante,
  varias_cifras: {
    pruebas, separadas_en_3: separacionOk, numero_leido_completo_bien: lecturaOk,
  },
};
console.log(JSON.stringify(informe, null, 1));
fs.writeFileSync(process.argv[4] || "/dev/null", JSON.stringify(informe, null, 1));
