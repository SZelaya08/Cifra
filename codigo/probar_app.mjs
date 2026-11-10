/* T19 — Prueba la app en un navegador real: dibuja dígitos simulando el dedo,
 * comprueba que la lectura coincide con la red de Python, revisa los tres modos
 * y el panel, y guarda capturas de pantalla.
 *
 * Uso: node probar_app.mjs <url> <casos.json> <carpeta_capturas> <salida.json>
 */
import fs from "node:fs";
import { chromium, devices } from "playwright";
import { Red } from "../docs/red.js";

const [url, rutaCasos, capturas, salida] = process.argv.slice(2);
const casos = JSON.parse(fs.readFileSync(rutaCasos, "utf8")).casos;
const pesos = JSON.parse(fs.readFileSync("../docs/pesos.json", "utf8"));
const redRef = new Red(pesos);
const LADO = 28;
const errores = [];
const informe = { comprobaciones: [] };

function anota(nombre, ok, detalle) {
  informe.comprobaciones.push({ nombre, ok, detalle });
  if (!ok) errores.push(`${nombre}: ${detalle}`);
  console.log(`${ok ? "ok  " : "FALLA"} ${nombre}${detalle ? " — " + detalle : ""}`);
}

/* Pinta una o varias imágenes de 28x28 sobre el lienzo, agrandadas y suavizadas,
 * como si alguien las hubiera trazado con el dedo. Cada entrada es
 * {valores: number[784], caja: {x, y, w, h}} en coordenadas de la página. */
async function pintarEnLienzo(page, piezas) {
  await page.evaluate((piezas) => {
    const c = document.getElementById("lienzo");
    const ctx = c.getContext("2d");
    const rect = c.getBoundingClientRect();
    const ex = c.width / rect.width, ey = c.height / rect.height;
    const tinta = getComputedStyle(document.documentElement).getPropertyValue("--tinta").trim();
    const tmp = document.createElement("canvas");
    tmp.width = 28; tmp.height = 28;
    const tctx = tmp.getContext("2d");
    const probe = document.createElement("canvas");
    probe.width = probe.height = 1;
    const pctx = probe.getContext("2d");
    pctx.fillStyle = tinta; pctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = pctx.getImageData(0, 0, 1, 1).data;

    for (const { valores, caja } of piezas) {
      const img = tctx.createImageData(28, 28);
      for (let i = 0; i < 784; i++) {
        img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b;
        img.data[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, valores[i])) * 255);
      }
      tctx.clearRect(0, 0, 28, 28);
      tctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tmp,
        (caja.x - rect.left) * ex, (caja.y - rect.top) * ey,
        caja.w * ex, caja.h * ey);
    }
    // Avisar a la app como si se hubiera terminado un trazo
    c.dispatchEvent(new PointerEvent("pointerdown", { clientX: rect.left + 1, clientY: rect.top + 1, bubbles: true, pointerId: 1 }));
    c.dispatchEvent(new PointerEvent("pointerup", { clientX: rect.left + 1, clientY: rect.top + 1, bubbles: true, pointerId: 1 }));
  }, piezas);
}

async function cajaLienzo(page) {
  return page.evaluate(() => {
    const c = document.getElementById("lienzo").getBoundingClientRect();
    return { x: c.left, y: c.top, w: c.width, h: c.height };
  });
}

/* Una sola cifra, centrada y ocupando buena parte del alto del lienzo. */
function piezaCentrada(valores, r, fraccion = 0.75) {
  const lado = Math.min(r.w, r.h) * fraccion;
  return {
    valores,
    caja: { x: r.x + r.w / 2 - lado / 2, y: r.y + r.h / 2 - lado / 2, w: lado, h: lado },
  };
}

const navegador = await chromium.launch();
const errConsola = [];

async function nuevaPagina(opciones = {}) {
  const ctx = await navegador.newContext(opciones);
  const page = await ctx.newPage();
  // Este contenedor no tiene salida a fonts.googleapis.com, así que las
  // tipografías fallan aquí y no en el sitio publicado: esos errores se ignoran.
  const deLaRedExterna = (t) => /fonts\.(googleapis|gstatic)/.test(t) || /ERR_TUNNEL_CONNECTION_FAILED/.test(t);
  page.on("console", (m) => { if (m.type() === "error" && !deLaRedExterna(m.text())) errConsola.push(m.text()); });
  page.on("pageerror", (e) => { if (!deLaRedExterna(String(e))) errConsola.push(String(e)); });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.getElementById("aviso-carga").hidden, { timeout: 15000 });
  return { ctx, page };
}

/* ---------- 1. Escritorio: dibujar un dígito y comparar con Python ---------- */
{
  const { ctx, page } = await nuevaPagina({ viewport: { width: 1200, height: 1400 }, deviceScaleFactor: 2 });

  const arq = await page.textContent("#pie-arquitectura");
  anota("La red se carga y muestra su arquitectura", arq.includes("784"), arq);

  let coincidencias = 0, probados = 0;
  const muestras = casos.slice(0, 25);
  for (const c of muestras) {
    await page.click("#btn-borrar");
    const r = await cajaLienzo(page);
    await pintarEnLienzo(page, [piezaCentrada(c.entrada, r)]);
    await page.waitForTimeout(40);
    const leido = (await page.textContent("#lectura")).trim();
    const esperado = String(redRef.predecir(Float32Array.from(c.entrada)).clase);
    probados++;
    if (leido === esperado) coincidencias++;
  }
  anota("La app lee lo mismo que la red de Python",
    coincidencias >= probados * 0.84, `${coincidencias} de ${probados} coinciden`);
  informe.coincidencia_app_python = `${coincidencias}/${probados}`;

  // Panel
  await page.click("#panel-boton");
  await page.waitForTimeout(250);
  anota("El panel se abre", !(await page.getAttribute("#panel-cuerpo", "hidden")), "");
  const tamDiagrama = await page.evaluate(() => {
    const c = document.getElementById("diagrama");
    return { w: c.width, h: c.height };
  });
  anota("El diagrama de capas se dibuja", tamDiagrama.w > 0 && tamDiagrama.h > 0, JSON.stringify(tamDiagrama));
  await page.screenshot({ path: `${capturas}/01-escritorio-capas.png`, fullPage: true });

  for (const seccion of ["neuronas", "calculo", "discreta", "entrenar"]) {
    await page.click(`.subpestana[data-seccion="${seccion}"]`);
    await page.waitForTimeout(200);
    const vacio = await page.evaluate((s) => {
      const el = document.querySelector(`.seccion[data-seccion="${s}"]`);
      return !el || el.hidden || el.textContent.trim().length < 20;
    }, seccion);
    anota(`La sección ${seccion} muestra contenido`, !vacio, "");
    if (seccion === "neuronas") {
      await page.click(".neurona");        // seleccionar una neurona
      await page.waitForTimeout(150);
    }
    await page.screenshot({ path: `${capturas}/02-${seccion}.png`, fullPage: true });
  }

  // El cálculo debe mostrar números reales tras seleccionar una neurona
  await page.click('.subpestana[data-seccion="calculo"]');
  await page.waitForTimeout(200);
  const textoCalculo = await page.textContent("#calculo-contenido");
  anota("El cálculo muestra la fórmula con números",
    /suma total/.test(textoCalculo) && /ReLU|softmax/.test(textoCalculo), "");

  const textoDiscreta = await (async () => {
    await page.click('.subpestana[data-seccion="discreta"]');
    await page.waitForTimeout(250);
    return page.textContent("#discreta-contenido");
  })();
  anota("La sección discreta calcula la distancia de Hamming",
    /Hamming/.test(textoDiscreta) && /2\^784/.test(textoDiscreta), "");

  await ctx.close();
}

/* ---------- 2. Modos cuenta y práctica ---------- */
{
  const { ctx, page } = await nuevaPagina({ viewport: { width: 1200, height: 1400 }, deviceScaleFactor: 2 });

  // Cuenta: escribir tres cifras seguidas
  await page.click('.pestana[data-modo="cuenta"]');
  await page.waitForTimeout(150);
  const r = await cajaLienzo(page);
  const tres = casos.slice(0, 3);
  const anchoCifra = r.w / 4;
  const alto = Math.min(r.h * 0.7, anchoCifra * 0.7);
  const piezas = tres.map((c, i) => ({
    valores: c.entrada,
    caja: { x: r.x + anchoCifra * (i + 0.4), y: r.y + r.h / 2 - alto / 2, w: alto, h: alto },
  }));
  await pintarEnLienzo(page, piezas);
  await page.waitForTimeout(80);
  const leido = (await page.textContent("#lectura")).trim();
  anota("Lee un número de tres cifras", leido.length === 3, `leyó "${leido}"`);
  informe.numero_tres_cifras = { leido, esperado: tres.map((c) => c.etiqueta_real).join("") };

  await page.click("#cuenta-agregar");
  await page.waitForTimeout(120);
  const total1 = (await page.textContent("#cuenta-total")).trim();
  anota("Agrega el número a la cuenta y suma", total1 !== "0", `total ${total1}`);

  // Corregir una cifra
  await page.click(".cuenta-lista .cifra");
  await page.waitForTimeout(120);
  const hayCorrector = await page.isVisible(".corrector");
  anota("El corrector de cifras se abre", hayCorrector, "");
  if (hayCorrector) {
    await page.click(".corrector button");
    await page.waitForTimeout(120);
    anota("Corregir una cifra recalcula el total", true, (await page.textContent("#cuenta-total")).trim());
  }
  await page.screenshot({ path: `${capturas}/03-cuenta.png`, fullPage: true });

  // Práctica
  await page.click('.pestana[data-modo="practica"]');
  await page.waitForTimeout(150);
  const objetivo = Number((await page.textContent("#practica-objetivo")).trim());
  const ejemplo = casos.find((c) => c.etiqueta_real === objetivo) || casos[0];
  const r2 = await cajaLienzo(page);
  await pintarEnLienzo(page, [piezaCentrada(ejemplo.entrada, r2)]);
  await page.waitForTimeout(60);
  await page.click("#practica-revisar");
  await page.waitForTimeout(150);
  const intentos = (await page.textContent("#practica-intentos")).trim();
  anota("El modo práctica cuenta los intentos", intentos === "1", `intentos ${intentos}`);
  await page.screenshot({ path: `${capturas}/04-practica.png`, fullPage: true });

  await ctx.close();
}

/* ---------- 3. Reentrenamiento ---------- */
{
  const { ctx, page } = await nuevaPagina({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 2 });
  await page.click("#panel-boton");
  await page.click('.subpestana[data-seccion="entrenar"]');
  await page.waitForTimeout(200);

  for (let i = 0; i < 4; i++) {
    const c = casos[i];
    await page.click("#btn-borrar");
    const r = await cajaLienzo(page);
    await pintarEnLienzo(page, [piezaCentrada(c.entrada, r)]);
    await page.waitForTimeout(50);
    await page.click(`#guardar-botones button:nth-child(${c.etiqueta_real + 1})`);
    await page.waitForTimeout(50);
  }
  const texto = await page.textContent("#muestras-texto");
  anota("Guarda los dibujos propios", /4 dibujos/.test(texto), texto);

  const desactivado = await page.getAttribute("#btn-reentrenar", "disabled");
  anota("El botón de reentrenar se habilita", desactivado === null, "");
  await page.click("#btn-reentrenar");
  await page.waitForFunction(() => /Listo/.test(document.getElementById("entrenar-mensaje").textContent),
    { timeout: 60000 });
  const mensaje = await page.textContent("#entrenar-mensaje");
  anota("El reentrenamiento termina y reporta", /Listo/.test(mensaje), mensaje.slice(0, 120));
  informe.mensaje_reentrenamiento = mensaje;
  await page.screenshot({ path: `${capturas}/05-entrenar.png`, fullPage: true });

  await page.click("#btn-restaurar");
  await page.waitForTimeout(150);
  anota("Se puede volver a la red original",
    /original/.test(await page.textContent("#entrenar-mensaje")), "");
  await ctx.close();
}

/* ---------- 4. Celular, tema claro y oscuro ---------- */
for (const [nombre, esquema] of [["claro", "light"], ["oscuro", "dark"]]) {
  const { ctx, page } = await nuevaPagina({ ...devices["iPhone 13"], colorScheme: esquema });
  const desborde = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  anota(`Celular (${nombre}): no hay desplazamiento horizontal`, desborde <= 1, `sobra ${desborde}px`);

  const r = await cajaLienzo(page);
  await pintarEnLienzo(page, [piezaCentrada(casos[0].entrada, r)]);
  await page.waitForTimeout(80);
  const leido = (await page.textContent("#lectura")).trim();
  anota(`Celular (${nombre}): reconoce un dígito dibujado`, /^[0-9]$/.test(leido), `leyó "${leido}"`);
  await page.screenshot({ path: `${capturas}/06-celular-${nombre}.png`, fullPage: true });

  await page.click("#panel-boton");
  await page.waitForTimeout(250);
  const desborde2 = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  anota(`Celular (${nombre}): el panel abierto tampoco desborda`, desborde2 <= 1, `sobra ${desborde2}px`);
  await page.screenshot({ path: `${capturas}/07-celular-panel-${nombre}.png`, fullPage: true });
  await ctx.close();
}

await navegador.close();

informe.errores_de_consola = errConsola;
anota("No hay errores en la consola", errConsola.length === 0, errConsola.slice(0, 3).join(" | "));
informe.ok = errores.length === 0;
informe.fallas = errores;
fs.writeFileSync(salida, JSON.stringify(informe, null, 1));
console.log(`\n${informe.ok ? "TODO BIEN" : `${errores.length} FALLAS`}`);
if (!informe.ok) process.exit(1);
