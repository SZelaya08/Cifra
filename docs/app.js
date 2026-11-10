/* app.js — Cifra: reconocedor de dígitos escritos a mano.
 *
 * Une todo: el lienzo táctil, la red, los tres modos (práctica, cuenta, libre)
 * y el panel que muestra la red por dentro. Todo ocurre en el navegador; no se
 * envía nada a ningún servidor.
 */

import { Red } from "./red.js";
import { entradasDesdeCanvas, leerTinta, hayTinta, LADO, binarizar, distanciaHamming } from "./preproceso.js";
import { Diagrama, dibujarRejillaNeuronas, dibujarComparacion, dibujarCalculo, dibujarDiscreta, dibujarCurva, pintarEntrada, num, pct } from "./panel.js";

const $ = (id) => document.getElementById(id);
const CLAVE_MUESTRAS = "cifra.muestras.v1";
const CLAVE_TEMA = "cifra.tema.v1";
const UMBRAL_DUDA = 0.80;      // por debajo, la lectura se marca como dudosa

const estado = {
  red: null,
  anclas: null,
  plantillas: null,
  modo: "practica",
  cifras: [],                  // [{entrada, caja, prediccion}]
  seleccion: null,
  panelAbierto: false,
  seccion: "capas",
  objetivo: null,
  aciertos: 0, intentos: 0, racha: 0,
  cuenta: [],
  muestras: [],                // [{entrada: number[], etiqueta}]
  curva: [],
  entrenando: false,
  soloActivas: true,
};

/* ===================== almacenamiento local ===================== */

function leerGuardado(clave, porDefecto) {
  try {
    const v = localStorage.getItem(clave);
    return v === null ? porDefecto : JSON.parse(v);
  } catch { return porDefecto; }
}
function guardar(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* modo privado */ }
}

/* ===================== tema ===================== */

function aplicarTema(tema) {
  if (tema) document.documentElement.setAttribute("data-tema", tema);
  else document.documentElement.removeAttribute("data-tema");
}
function temaActual() {
  const puesto = document.documentElement.getAttribute("data-tema");
  if (puesto) return puesto;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
}
$("btn-tema").addEventListener("click", () => {
  const nuevo = temaActual() === "oscuro" ? "claro" : "oscuro";
  aplicarTema(nuevo);
  guardar(CLAVE_TEMA, nuevo);
  recolorearTrazo();
  redibujarPanel();
});
aplicarTema(leerGuardado(CLAVE_TEMA, null));

/* ===================== lienzo ===================== */

const lienzo = $("lienzo");
const ctx = lienzo.getContext("2d", { willReadFrequently: true });
let dibujando = false, ultimo = null, hayTrazo = false;

function ajustarLienzo() {
  const rect = lienzo.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const datos = hayTrazo ? ctx.getImageData(0, 0, lienzo.width, lienzo.height) : null;
  const anchoAnterior = lienzo.width;
  lienzo.width = Math.max(1, Math.round(rect.width * dpr));
  lienzo.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (datos && anchoAnterior) {
    const tmp = document.createElement("canvas");
    tmp.width = datos.width; tmp.height = datos.height;
    tmp.getContext("2d").putImageData(datos, 0, 0);
    ctx.drawImage(tmp, 0, 0, lienzo.width, lienzo.height);
  }
}

function grosorTrazo() {
  const factor = Number($("grosor").value) / 100;      // 0.03 a 0.14
  return Math.max(3, lienzo.height * factor);
}

function colorTrazo() {
  return getComputedStyle(document.documentElement).getPropertyValue("--color-ink").trim();
}

/* El trazo ya dibujado guarda el color de tinta del tema anterior. Al cambiar
 * de tema se vuelve a teñir conservando la forma: se rellena todo el lienzo
 * con la tinta nueva, recortada por lo que ya estaba pintado. */
function recolorearTrazo() {
  if (!hayTrazo) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = colorTrazo();
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.restore();
}

function puntoDesde(e) {
  const rect = lienzo.getBoundingClientRect();
  const ex = lienzo.width / rect.width;
  const ey = lienzo.height / rect.height;
  return { x: (e.clientX - rect.left) * ex, y: (e.clientY - rect.top) * ey };
}

lienzo.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch" && e.isPrimary === false) return;
  lienzo.setPointerCapture(e.pointerId);
  dibujando = true;
  ultimo = puntoDesde(e);
  ctx.strokeStyle = colorTrazo();
  ctx.lineWidth = grosorTrazo();
  ctx.beginPath();
  ctx.arc(ultimo.x, ultimo.y, ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.fillStyle = colorTrazo();
  ctx.fill();
  hayTrazo = true;
  $("pista-lienzo").hidden = true;
  e.preventDefault();
});

lienzo.addEventListener("pointermove", (e) => {
  if (!dibujando) return;
  const p = puntoDesde(e);
  ctx.strokeStyle = colorTrazo();
  ctx.lineWidth = grosorTrazo();
  ctx.beginPath();
  ctx.moveTo(ultimo.x, ultimo.y);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ultimo = p;
  e.preventDefault();
});

function terminarTrazo(e) {
  if (!dibujando) return;
  dibujando = false;
  if (e && lienzo.hasPointerCapture?.(e.pointerId)) lienzo.releasePointerCapture(e.pointerId);
  reconocer();
}
lienzo.addEventListener("pointerup", terminarTrazo);
lienzo.addEventListener("pointercancel", terminarTrazo);
lienzo.addEventListener("pointerleave", terminarTrazo);

function borrarLienzo() {
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);
  hayTrazo = false;
  estado.cifras = [];
  $("pista-lienzo").hidden = false;
  $("guias").replaceChildren();
  mostrarLectura();
  redibujarPanel();
  actualizarBotonesGuardar();
}
$("btn-borrar").addEventListener("click", borrarLienzo);
$("grosor").addEventListener("input", () => { if (hayTrazo) reconocer(); });

/* ===================== reconocimiento ===================== */

function reconocer() {
  if (!estado.red) return;
  if (!hayTrazo || !hayTinta(leerTinta(lienzo))) { estado.cifras = []; mostrarLectura(); return; }
  const maxCifras = estado.modo === "practica" ? 1 : 8;
  const encontradas = entradasDesdeCanvas(lienzo, maxCifras);
  estado.cifras = encontradas.map((c) => ({ ...c, prediccion: estado.red.predecir(c.entrada) }));
  if (estado.cifras.length && !estado.seleccion) estado.seleccion = null;
  mostrarLectura();
  mostrarGuias();
  redibujarPanel();
  actualizarBotonesGuardar();
  if (estado.modo === "libre") mostrarCifrasDetectadas();
}

function numeroLeido() {
  return estado.cifras.map((c) => c.prediccion.etiqueta).join("");
}

function confianzaMinima() {
  if (!estado.cifras.length) return 0;
  return Math.min(...estado.cifras.map((c) => c.prediccion.confianza));
}

function mostrarLectura() {
  const hay = estado.cifras.length > 0;
  const registro = document.querySelector(".registro");
  // Sin dibujo el registro muestra qué falta y qué hacer, en vez de un hueco.
  registro.toggleAttribute("data-vacio", !hay);

  $("lectura").textContent = hay ? numeroLeido() : "";
  const conf = confianzaMinima();
  $("confianza").textContent = hay ? pct(conf) : "";
  const relleno = $("barra-confianza-relleno");
  relleno.style.transform = `scaleX(${hay ? Math.min(1, conf) : 0})`;
  relleno.toggleAttribute("data-duda", hay && conf < UMBRAL_DUDA);

  // El libro mayor: una fila por dígito, la probabilidad alineada al decimal.
  const cuerpo = $("probabilidades").tBodies[0];
  const probs = hay ? estado.cifras[estado.cifras.length - 1].prediccion.probabilidades : new Array(10).fill(0);
  const ganadora = hay ? probs.indexOf(Math.max(...probs)) : -1;
  if (cuerpo.children.length !== 10) {
    cuerpo.replaceChildren(...Array.from({ length: 10 }, (_, d) => {
      const tr = document.createElement("tr");
      tr.className = "prob";
      const th = document.createElement("th");
      th.scope = "row"; th.className = "prob-etiqueta"; th.textContent = d;
      const barra = document.createElement("td");
      barra.className = "prob-barra";
      const pista = document.createElement("span");
      const i = document.createElement("i");
      i.className = "prob-relleno";
      pista.appendChild(i); barra.appendChild(pista);
      const valor = document.createElement("td");
      valor.className = "prob-valor num";
      tr.append(th, barra, valor);
      return tr;
    }));
  }
  Array.from(cuerpo.children).forEach((tr, d) => {
    tr.classList.toggle("ganadora", d === ganadora);
    tr.querySelector(".prob-relleno").style.transform = `scaleX(${Math.max(0, Math.min(1, probs[d]))})`;
    tr.querySelector(".prob-valor").textContent = hay ? pct(probs[d]) : "";
  });

  let nota = "";
  if (hay && estado.cifras.length > 1) nota = `${estado.cifras.length} cifras detectadas. `;
  if (hay && conf < UMBRAL_DUDA) nota += "La red no está segura de alguna cifra: vale la pena revisarla.";
  $("nota-lectura").textContent = nota;
}

function mostrarGuias() {
  const guias = $("guias");
  guias.replaceChildren();
  if (estado.cifras.length < 2) return;
  const w = lienzo.width, h = lienzo.height;
  estado.cifras.forEach((c, i) => {
    const d = document.createElement("div");
    d.className = "caja-cifra";
    d.style.left = `${(c.caja.x0 / w) * 100}%`;
    d.style.top = `${(c.caja.y0 / h) * 100}%`;
    d.style.width = `${((c.caja.x1 - c.caja.x0 + 1) / w) * 100}%`;
    d.style.height = `${((c.caja.y1 - c.caja.y0 + 1) / h) * 100}%`;
    const s = document.createElement("span");
    s.textContent = c.prediccion.etiqueta;
    d.appendChild(s);
    guias.appendChild(d);
  });
}

function mostrarCifrasDetectadas() {
  const cont = $("cifras-detectadas");
  cont.replaceChildren();
  for (const c of estado.cifras) {
    const d = document.createElement("div");
    d.className = "cifra-detectada";
    const cv = document.createElement("canvas");
    pintarEntrada(cv, c.entrada);
    const b = document.createElement("b");
    b.textContent = c.prediccion.etiqueta;
    const s = document.createElement("small");
    s.textContent = pct(c.prediccion.confianza);
    d.append(cv, b, s);
    cont.appendChild(d);
  }
}

/* ===================== modos ===================== */

function cambiarModo(modo) {
  estado.modo = modo;
  for (const b of document.querySelectorAll(".pestana")) {
    b.setAttribute("aria-selected", String(b.dataset.modo === modo));
  }
  $("vista-practica").hidden = modo !== "practica";
  $("vista-cuenta").hidden = modo !== "cuenta";
  $("vista-libre").hidden = modo !== "libre";
  $("consigna").textContent = {
    practica: "Dibuja este número",
    cuenta: "Escribe un precio o una cantidad",
    libre: "Dibuja lo que quieras",
  }[modo];
  document.body.dataset.modo = modo;
  $("grosor").value = modo === "practica" ? 9 : 6;
  ajustarLienzo();
  borrarLienzo();
  if (modo === "practica" && estado.objetivo === null) nuevoObjetivo();
}
for (const b of document.querySelectorAll(".pestana")) {
  b.addEventListener("click", () => cambiarModo(b.dataset.modo));
}

/* --- práctica --- */
function nuevoObjetivo() {
  let d;
  do { d = Math.floor(Math.random() * 10); } while (d === estado.objetivo && Math.random() < 0.8);
  estado.objetivo = d;
  $("practica-objetivo").textContent = d;
  $("practica-mensaje").textContent = "Dibuja el número y toca Revisar.";
  $("practica-mensaje").className = "mensaje";
  borrarLienzo();
}
$("practica-otro").addEventListener("click", nuevoObjetivo);
$("practica-revisar").addEventListener("click", () => {
  if (!estado.cifras.length) {
    $("practica-mensaje").textContent = "Todavía no hay nada dibujado.";
    $("practica-mensaje").className = "mensaje";
    return;
  }
  const p = estado.cifras[0].prediccion;
  estado.intentos++;
  const m = $("practica-mensaje");
  if (p.clase === estado.objetivo) {
    estado.aciertos++; estado.racha++;
    m.textContent = `¡Bien! La red leyó un ${p.etiqueta} con ${pct(p.confianza)} de seguridad.`;
    m.className = "mensaje bien";
    setTimeout(nuevoObjetivo, 1200);
  } else if (p.confianza < UMBRAL_DUDA) {
    estado.racha = 0;
    m.textContent = `La red dudó: le pareció más un ${p.etiqueta} (${pct(p.confianza)}). Intenta trazos más gruesos y centrados.`;
    m.className = "mensaje casi";
  } else {
    estado.racha = 0;
    m.textContent = `La red leyó un ${p.etiqueta}, no un ${estado.objetivo}. Mira en el panel qué vio.`;
    m.className = "mensaje casi";
  }
  $("practica-aciertos").textContent = estado.aciertos;
  $("practica-intentos").textContent = estado.intentos;
  $("practica-racha").textContent = estado.racha;
});

/* --- cuenta --- */
/* Corrector de una cifra: una fila de botones del 0 al 9 bajo el renglón.
 * No se usa prompt() porque en el celular interrumpe y algunos navegadores
 * lo bloquean. */
function abrirCorrector(li, item, j) {
  li.querySelector(".corrector")?.remove();
  const caja = document.createElement("div");
  caja.className = "corrector";
  for (let d = 0; d < 10; d++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = d;
    b.setAttribute("aria-label", `Cambiar a ${d}`);
    b.addEventListener("click", () => {
      item.cifras[j] = { valor: String(d), confianza: 1, corregida: true };
      pintarCuenta();
    });
    caja.appendChild(b);
  }
  const cancelar = document.createElement("button");
  cancelar.type = "button";
  cancelar.className = "cancelar";
  cancelar.textContent = "×";
  cancelar.setAttribute("aria-label", "Cerrar sin cambiar");
  cancelar.addEventListener("click", () => caja.remove());
  caja.appendChild(cancelar);
  li.appendChild(caja);
  caja.querySelector("button").focus();
}

function pintarCuenta() {
  const lista = $("cuenta-lista");
  lista.replaceChildren();
  let total = 0;
  estado.cuenta.forEach((item, idx) => {
    const li = document.createElement("li");
    const cifras = document.createElement("div");
    cifras.className = "cifras";
    item.cifras.forEach((c, j) => {
      const b = document.createElement("button");
      b.className = "cifra" + (c.corregida ? " corregida" : c.confianza < UMBRAL_DUDA ? " dudosa" : "");
      b.type = "button";
      b.textContent = c.valor;
      b.title = `Seguridad ${pct(c.confianza)}. Toca para corregir.`;
      b.setAttribute("aria-label", `Cifra ${c.valor}, seguridad ${pct(c.confianza)}. Toca para corregirla.`);
      b.addEventListener("click", () => abrirCorrector(li, item, j));
      cifras.appendChild(b);
    });
    const valor = Number(item.cifras.map((c) => c.valor).join("")) || 0;
    total += valor;
    const quitar = document.createElement("button");
    quitar.className = "quitar";
    quitar.type = "button";
    quitar.textContent = "×";
    quitar.setAttribute("aria-label", `Quitar ${valor}`);
    quitar.addEventListener("click", () => { estado.cuenta.splice(idx, 1); pintarCuenta(); });
    li.append(cifras, quitar);
    lista.appendChild(li);
  });
  $("cuenta-total").textContent = total.toLocaleString("es-CO");

  const n = estado.cuenta.reduce((s, i) => s + i.cifras.length, 0);
  const acc = estado.red ? estado.red.accuracyTest : 0;
  $("cuenta-riesgo").textContent = n === 0 ? "" :
    `${n} cifras leídas. Con una exactitud de ${pct(acc)} por cifra, la probabilidad de que las ${n} estén bien es ${pct(acc ** n)}. Revisa las que queden subrayadas.`;
}
$("cuenta-agregar").addEventListener("click", () => {
  if (!estado.cifras.length) return;
  estado.cuenta.push({
    cifras: estado.cifras.map((c) => ({ valor: c.prediccion.etiqueta, confianza: c.prediccion.confianza })),
  });
  pintarCuenta();
  borrarLienzo();
});
$("cuenta-vaciar").addEventListener("click", () => { estado.cuenta = []; pintarCuenta(); });

/* ===================== panel ===================== */

let diagrama = null;

$("panel-boton").addEventListener("click", () => {
  estado.panelAbierto = !estado.panelAbierto;
  $("panel-boton").setAttribute("aria-expanded", String(estado.panelAbierto));
  $("panel-cuerpo").hidden = !estado.panelAbierto;
  if (estado.panelAbierto) redibujarPanel();
});

for (const b of document.querySelectorAll(".subpestana")) {
  b.addEventListener("click", () => {
    estado.seccion = b.dataset.seccion;
    for (const o of document.querySelectorAll(".subpestana")) {
      o.setAttribute("aria-selected", String(o === b));
    }
    for (const s of document.querySelectorAll(".seccion")) {
      s.hidden = s.dataset.seccion !== estado.seccion;
    }
    redibujarPanel();
  });
}

$("solo-activas").addEventListener("change", (e) => {
  estado.soloActivas = e.target.checked;
  redibujarPanel();
});

function cifraActual() {
  return estado.cifras.length ? estado.cifras[estado.cifras.length - 1] : null;
}

function seleccionar(sel) {
  estado.seleccion = sel;
  if (diagrama) diagrama.seleccion = sel;
  redibujarPanel();
}

function redibujarPanel() {
  if (!estado.red || !estado.panelAbierto) return;
  const cifra = cifraActual();
  // Recalcular para dejar las activaciones de esta cifra en la red
  const activaciones = cifra ? cifra.prediccion.activaciones : null;
  if (cifra) estado.red.adelante(cifra.entrada);

  if (estado.seccion === "capas") {
    if (!diagrama) {
      diagrama = new Diagrama($("diagrama"), estado.red);
      diagrama.alHacerClic = seleccionar;
    }
    diagrama.seleccion = estado.seleccion;
    diagrama.dibujar(activaciones);
    const l = $("leyenda-capas");
    l.replaceChildren();
    const partes = [
      ["Arquitectura", estado.red.capas.join(" → ")],
      ["Parámetros", estado.red.capas.slice(0, -1)
        .reduce((s, n, i) => s + n * estado.red.capas[i + 1] + estado.red.capas[i + 1], 0).toLocaleString("es-CO")],
      ["Activación oculta", "ReLU"],
      ["Salida", "softmax"],
    ];
    if (cifra) {
      let encendidas = 0;
      for (const v of activaciones[1]) if (v > 0) encendidas++;
      partes.push(["Neuronas encendidas en la capa 1", `${encendidas} de ${estado.red.capas[1]}`]);
    }
    for (const [k, v] of partes) {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      l.append(dt, dd);
    }
  }

  if (estado.seccion === "neuronas") {
    dibujarRejillaNeuronas($("rejilla-neuronas"), estado.red, activaciones,
      estado.soloActivas && !!activaciones, seleccionar, estado.seleccion);
    if ((estado.plantillas || estado.anclas) && !$("plantillas").children.length) {
      dibujarComparacion($("plantillas"), estado.anclas ? estado.anclas.promedios : null, estado.plantillas);
      if (estado.plantillas) $("plantillas-acc").textContent = pct(estado.plantillas.accuracy_test);
      $("plantillas-acc-red").textContent = pct(estado.red.accuracyTest);
    }
  }

  if (estado.seccion === "calculo") {
    dibujarCalculo($("calculo-contenido"), estado.red, estado.seleccion, !!cifra);
  }

  if (estado.seccion === "discreta") {
    dibujarDiscreta($("discreta-contenido"), estado.red, cifra ? cifra.entrada : null,
      estado.anclas, cifra ? cifra.prediccion.etiqueta : null);
  }

  if (estado.seccion === "entrenar") {
    dibujarCurva($("curva"), estado.curva);
  }
}

window.addEventListener("resize", () => {
  ajustarLienzo();
  if (estado.panelAbierto) redibujarPanel();
});

/* ===================== entrenar con dibujos propios ===================== */

function actualizarBotonesGuardar() {
  const hay = estado.cifras.length === 1;
  for (const b of $("guardar-botones").children) b.disabled = !hay;
}

function pintarMuestras() {
  const conteo = new Array(10).fill(0);
  for (const m of estado.muestras) conteo[m.etiqueta]++;
  const cont = $("muestras-conteo");
  cont.replaceChildren();
  conteo.forEach((n, d) => {
    const s = document.createElement("span");
    if (n > 0) s.className = "tiene";
    s.textContent = `${d}: ${n}`;
    cont.appendChild(s);
  });
  const total = estado.muestras.length;
  $("muestras-texto").textContent = total === 0
    ? "Todavía no has guardado ningún dibujo."
    : `${total} dibujo${total === 1 ? "" : "s"} guardado${total === 1 ? "" : "s"} en este dispositivo.`;
  $("btn-reentrenar").disabled = total < 3 || estado.entrenando;
}

function construirBotonesGuardar() {
  const cont = $("guardar-botones");
  cont.replaceChildren();
  for (let d = 0; d < 10; d++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = d;
    b.disabled = true;
    b.setAttribute("aria-label", `Guardar este dibujo como el número ${d}`);
    b.addEventListener("click", () => {
      const c = estado.cifras[0];
      if (!c) return;
      estado.muestras.push({ etiqueta: d, entrada: Array.from(c.entrada, (v) => Math.round(v * 255)) });
      if (estado.muestras.length > 400) estado.muestras.shift();
      guardar(CLAVE_MUESTRAS, estado.muestras);
      pintarMuestras();
      $("entrenar-mensaje").textContent = `Guardado como ${d}. Cuando tengas varios, toca Reentrenar.`;
    });
    cont.appendChild(b);
  }
}

$("btn-borrar-muestras").addEventListener("click", () => {
  estado.muestras = [];
  guardar(CLAVE_MUESTRAS, estado.muestras);
  pintarMuestras();
  $("entrenar-mensaje").textContent = "Dibujos borrados.";
});

$("btn-restaurar").addEventListener("click", () => {
  estado.red.restaurarOriginales();
  estado.curva = [];
  dibujarCurva($("curva"), estado.curva);
  reconocer();
  $("entrenar-mensaje").textContent = "La red volvió a los pesos originales.";
});

$("btn-reentrenar").addEventListener("click", async () => {
  if (estado.entrenando || estado.muestras.length < 3) return;
  estado.entrenando = true;
  $("btn-reentrenar").disabled = true;
  const msg = $("entrenar-mensaje");

  // Mezclar los dibujos propios con imágenes de referencia, para que la red
  // no olvide lo que ya sabía (olvido catastrófico).
  const propiosX = estado.muestras.map((m) => Float32Array.from(m.entrada, (v) => v / 255));
  const propiosY = estado.muestras.map((m) => m.etiqueta);
  const antesPropios = estado.red.exactitudSobre(propiosX, propiosY);
  const refX = [], refY = [];
  if (estado.anclas) {
    const porClase = Math.max(4, Math.ceil(estado.muestras.length / 10) * 2);
    for (let d = 0; d < 10; d++) {
      const lista = estado.anclas.porClase[d];
      for (let k = 0; k < Math.min(porClase, lista.length); k++) {
        refX.push(lista[(k * 7) % lista.length]); refY.push(d);
      }
    }
  }
  const antesRef = refX.length ? estado.red.exactitudSobre(refX, refY) : null;

  const X = [...propiosX, ...refX];
  const Y = [...propiosY, ...refY];
  const orden = X.map((_, i) => i);
  estado.curva = [];
  const EPOCAS = 12, LOTE = 16, TASA = 0.05;

  for (let e = 0; e < EPOCAS; e++) {
    for (let i = orden.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [orden[i], orden[j]] = [orden[j], orden[i]];
    }
    let suma = 0, lotes = 0;
    for (let k = 0; k < orden.length; k += LOTE) {
      const idx = orden.slice(k, k + LOTE);
      suma += estado.red.entrenarLote(idx.map((i) => X[i]), idx.map((i) => Y[i]), TASA);
      lotes++;
    }
    estado.curva.push(suma / Math.max(1, lotes));
    dibujarCurva($("curva"), estado.curva);
    msg.textContent = `Entrenando… vuelta ${e + 1} de ${EPOCAS}, pérdida ${num(estado.curva[e], 4)}`;
    await new Promise((r) => setTimeout(r, 0));
  }

  const despuesPropios = estado.red.exactitudSobre(propiosX, propiosY);
  const despuesRef = refX.length ? estado.red.exactitudSobre(refX, refY) : null;
  msg.textContent =
    `Listo. Con tus ${propiosX.length} dibujos pasó de ${pct(antesPropios)} a ${pct(despuesPropios)}` +
    (antesRef !== null ? `, y con las imágenes de referencia de ${pct(antesRef)} a ${pct(despuesRef)}.` : ".") +
    ` Los cambios no se guardan: al recargar la página vuelve la red original.`;
  estado.entrenando = false;
  pintarMuestras();
  reconocer();
});

/* ===================== anclas (imágenes de referencia) ===================== */

async function cargarAnclas() {
  const img = new Image();
  img.decoding = "async";
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error("no se pudo cargar anclas.png"));
    img.src = "anclas.png";
  });
  const porFila = img.width / LADO;            // 30
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const cc = c.getContext("2d", { willReadFrequently: true });
  cc.drawImage(img, 0, 0);
  const datos = cc.getImageData(0, 0, img.width, img.height).data;

  const porClase = Array.from({ length: 10 }, () => []);
  const todas = [], etiquetas = [];
  for (let d = 0; d < 10; d++) {
    for (let k = 0; k < porFila; k++) {
      const e = new Float32Array(LADO * LADO);
      for (let y = 0; y < LADO; y++) {
        for (let x = 0; x < LADO; x++) {
          const px = ((d * LADO + y) * img.width + (k * LADO + x)) * 4;
          e[y * LADO + x] = datos[px] / 255;
        }
      }
      porClase[d].push(e);
      todas.push(binarizar(e));
      etiquetas.push(d);
    }
  }
  const promedios = porClase.map((lista) => {
    const prom = new Float32Array(LADO * LADO);
    for (const e of lista) for (let i = 0; i < e.length; i++) prom[i] += e[i] / lista.length;
    return prom;
  });
  const prototipos = promedios.map((p) => binarizar(p, 0.35));
  return {
    porClase, promedios, prototipos, total: todas.length,
    vecinoMasCercano(b) {
      let mejor = 0, mejorD = Infinity;
      for (let i = 0; i < todas.length; i++) {
        const d = distanciaHamming(b, todas[i]);
        if (d < mejorD) { mejorD = d; mejor = i; }
      }
      return { clase: etiquetas[mejor], distancia: mejorD };
    },
  };
}

/* ===================== arranque ===================== */

async function iniciar() {
  const aviso = $("aviso-carga");
  try {
    const r = await fetch("pesos.json");
    if (!r.ok) throw new Error(`pesos.json respondió ${r.status}`);
    estado.red = new Red(await r.json());
  } catch (err) {
    aviso.textContent = `No se pudo cargar la red: ${err.message}. Si abriste el archivo directamente, hace falta un servidor (por ejemplo python3 -m http.server).`;
    aviso.className = "aviso error";
    return;
  }

  $("pie-arquitectura").textContent = estado.red.capas.join(" → ");
  $("pie-accuracy").textContent = pct(estado.red.accuracyTest);
  estado.curva = [];

  ajustarLienzo();
  construirBotonesGuardar();
  estado.muestras = leerGuardado(CLAVE_MUESTRAS, []);
  pintarMuestras();
  cambiarModo("practica");
  aviso.hidden = true;

  try {
    estado.anclas = await cargarAnclas();
  } catch {
    estado.anclas = null;      // el panel discreto y el reentrenamiento siguen, con menos cosas
  }
  try {
    const r = await fetch("plantillas.json");
    if (r.ok) estado.plantillas = await r.json();
  } catch {
    estado.plantillas = null;  // la comparación es opcional
  }
  if (estado.panelAbierto) redibujarPanel();
}

iniciar();
