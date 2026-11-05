"""Arma una version de la app en un solo archivo HTML, que abre con doble clic.

Uso: python3 -I un_solo_archivo.py <carpeta_docs> <salida.html>

La version normal (docs/) necesita un servidor, porque usa modulos de
JavaScript y fetch, y los navegadores bloquean las dos cosas cuando la pagina
se abre con file://. Esta version mete todo adentro del HTML: el CSS, los
cuatro archivos de JavaScript, los pesos, las plantillas y el mosaico de
imagenes de referencia como data URI. Asi no hace falta nada mas.

Es exactamente la misma app; cambia solo la forma de empaquetarla.
"""
import sys, re, json, base64, os

ORDEN = ["preproceso.js", "red.js", "panel.js", "app.js"]


def limpiar_modulo(texto, nombre):
    """Quita los import y los export para poder pegar los cuatro archivos
    dentro de un mismo modulo, donde ya comparten el mismo ambito."""
    lineas = []
    for linea in texto.split("\n"):
        if re.match(r'^\s*import\s.*from\s+"\./[^"]+";\s*$', linea):
            continue                                  # import entre archivos
        if re.match(r'^\s*export\s*\{[^}]*\};\s*$', linea):
            continue                                  # export { a, b };
        linea = re.sub(r'^(\s*)export\s+(class|function|const|let|var|async)\b', r'\1\2', linea)
        lineas.append(linea)
    limpio = "\n".join(lineas)
    sobrante = re.findall(r'^\s*(?:import|export)\s', limpio, re.M)
    if sobrante:
        raise SystemExit(f"Quedaron {len(sobrante)} import/export sin quitar en {nombre}")
    return limpio


def main(docs, salida):
    html = open(f"{docs}/index.html", encoding="utf-8").read()
    css = open(f"{docs}/estilos.css", encoding="utf-8").read()
    pesos = open(f"{docs}/pesos.json", encoding="utf-8").read()
    plantillas = open(f"{docs}/plantillas.json", encoding="utf-8").read()
    anclas = base64.b64encode(open(f"{docs}/anclas.png", "rb").read()).decode()

    partes = []
    for nombre in ORDEN:
        partes.append(f"/* ===== {nombre} ===== */\n" +
                      limpiar_modulo(open(f"{docs}/{nombre}", encoding="utf-8").read(), nombre))
    js = "\n\n".join(partes)

    # Los tres fetch se cambian por los datos que ya vienen adentro.
    reemplazos = [
        ('const r = await fetch("pesos.json");\n    if (!r.ok) throw new Error(`pesos.json respondió ${r.status}`);\n    estado.red = new Red(await r.json());',
         'estado.red = new Red(PESOS_INCRUSTADOS);'),
        ('const r = await fetch("plantillas.json");\n    if (r.ok) estado.plantillas = await r.json();',
         'estado.plantillas = PLANTILLAS_INCRUSTADAS;'),
        ('img.src = "anclas.png";', 'img.src = ANCLAS_INCRUSTADAS;'),
    ]
    for viejo, nuevo in reemplazos:
        if viejo not in js:
            raise SystemExit(f"No encontré el fragmento para reemplazar:\n{viejo[:80]}…")
        js = js.replace(viejo, nuevo, 1)

    datos = (f"const PESOS_INCRUSTADOS = {pesos};\n"
             f"const PLANTILLAS_INCRUSTADAS = {plantillas};\n"
             f'const ANCLAS_INCRUSTADAS = "data:image/png;base64,{anclas}";\n')

    html = html.replace('<link rel="stylesheet" href="estilos.css">',
                        f"<style>\n{css}\n</style>")
    html = html.replace('<script type="module" src="app.js"></script>',
                        f'<script type="module">\n{datos}\n{js}\n</script>')
    # Las tipografías se dejan como están: si no hay internet, el navegador usa
    # las de reserva y la página se ve bien igual.

    open(salida, "w", encoding="utf-8").write(html)
    print(f"{salida}  {os.path.getsize(salida) / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
