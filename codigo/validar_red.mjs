/* T12 — Comprueba que la red escrita en JavaScript da los mismos resultados
 * que la de Python. Uso: node validar_red.mjs <app/pesos.json> <resultados/casos_prueba.json>
 */
import fs from "node:fs";
import { Red } from "../app/red.js";

const pesos = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const { casos } = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const red = new Red(pesos);

let maxDif = 0, clasesIguales = 0;
for (const c of casos) {
  const r = red.predecir(Float32Array.from(c.entrada));
  let claseEsperada = 0;
  for (let j = 1; j < c.salida.length; j++) if (c.salida[j] > c.salida[claseEsperada]) claseEsperada = j;
  if (r.clase === claseEsperada) clasesIguales++;
  for (let j = 0; j < c.salida.length; j++) {
    maxDif = Math.max(maxDif, Math.abs(r.probabilidades[j] - c.salida[j]));
  }
}

// Comprobación del entrenamiento: la pérdida debe bajar sobre un lote repetido
const sub = casos.slice(0, 8);
const X = sub.map((c) => Float32Array.from(c.entrada));
const Y = sub.map((c) => c.etiqueta_real);
const p0 = red.entrenarLote(X, Y, 0.0);        // tasa 0: no cambia nada
const antes = red.entrenarLote(X, Y, 0.05);
let despues = antes;
for (let i = 0; i < 15; i++) despues = red.entrenarLote(X, Y, 0.05);
red.restaurarOriginales();
const trasRestaurar = red.entrenarLote(X, Y, 0.0);

// Tolerancia: Python calcula en float64 y la versión del navegador en float32,
// así que se admite una diferencia del orden de 1e-4 en las probabilidades.
// Lo que debe coincidir siempre es la clase predicha.
const TOLERANCIA = 1e-4;

const informe = {
  casos: casos.length,
  clases_iguales: clasesIguales,
  diferencia_maxima_de_probabilidad: Number(maxDif.toExponential(3)),
  tolerancia: TOLERANCIA,
  nota: "Python usa float64 y el navegador float32; por eso no son idénticos al bit.",
  entrenamiento: {
    perdida_inicial: Number(antes.toFixed(6)),
    perdida_tras_16_pasos: Number(despues.toFixed(6)),
    baja: despues < antes,
  },
  restaurar_originales_funciona: Math.abs(trasRestaurar - p0) < 1e-6,
};
console.log(JSON.stringify(informe, null, 1));
const ok = clasesIguales === casos.length && maxDif < TOLERANCIA &&
  informe.entrenamiento.baja && informe.restaurar_originales_funciona;
fs.writeFileSync(process.argv[4] || "/dev/null", JSON.stringify({ ...informe, ok }, null, 1));
if (!ok) { console.error("FALLO: la red en JavaScript no coincide con la de Python"); process.exit(1); }
console.log("OK: coincide con Python");
