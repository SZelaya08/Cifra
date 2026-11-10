"""Arma una version de la app en un solo archivo HTML, que abre con doble clic.

Uso: python3 -I un_solo_archivo.py <carpeta_docs> <salida.html>

La version normal (docs/) necesita un servidor, porque usa modulos de
JavaScript y fetch, y los navegadores bloquean las dos cosas cuando la pagina
se abre con file://. Esta version mete todo adentro del HTML: las hojas de
estilo (incluidas las que estilos.css importa), las tipografias, los cuatro
archivos de JavaScript, los pesos, las plantillas y el mosaico de imagenes de
referencia. Asi no hace falta nada mas, ni siquiera internet.

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


def juntar_css(docs, nombre, vistos=None):
    """Lee una hoja de estilo y pega en su lugar las que importa."""
    vistos = vistos if vistos is not None else set()
    if nombre in vistos:
        return ""
    vistos.add(nombre)
    texto = open(f"{docs}/{nombre}", encoding="utf-8").read()

    def reemplazo(m):
        return juntar_css(docs, m.group(1), vistos)

    return re.sub(r'@import\s+url\(\s*"\./([^"]+)"\s*\);', reemplazo, texto)


def incrustar_tipografias(css, docs):
    """Cambia cada url(tipografias/x.woff2) por el archivo en base64."""
    def reemplazo(m):
        ruta = f"{docs}/{m.group(1)}"
        if not os.path.exists(ruta):
            raise SystemExit(f"No encontré la tipografía {ruta}")
        datos = base64.b64encode(open(ruta, "rb").read()).decode()
        return f'url("data:font/woff2;base64,{datos}") format("woff2")'

    return re.sub(r'url\("(tipografias/[^"]+\.woff2)"\)\s*format\("woff2"\)', reemplazo, css)


def main(docs, salida):
    html = open(f"{docs}/index.html", encoding="utf-8").read()
    css = incrustar_tipografias(juntar_css(docs, "estilos.css"), docs)
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

    enlace = '<link rel="stylesheet" href="estilos.css">'
    if enlace not in html:
        raise SystemExit("No encontré el enlace a estilos.css en index.html")
    html = html.replace(enlace, f"<style>\n{css}\n</style>")

    script = '<script type="module" src="app.js"></script>'
    if script not in html:
        raise SystemExit("No encontré el script de app.js en index.html")
    html = html.replace(script, f'<script type="module">\n{datos}\n{js}\n</script>')

    open(salida, "w", encoding="utf-8").write(html)
    print(f"{salida}  {os.path.getsize(salida) / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
