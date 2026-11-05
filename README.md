# Cifra — reconocedor de dígitos escritos a mano

Proyecto final de **Matemáticas Discretas** · Universidad del Norte · Barranquilla

Una página web donde se escribe un número a mano, con el dedo o el lápiz, y una
red neuronal lo lee. Trae un panel que deja ver la red por dentro mientras
trabaja: las neuronas que se encienden, los pesos de cada una, la cuenta con los
números reales y la parte de matemática discreta detrás de todo.

Todo corre en el navegador. No hay servidor, ni API, ni se envía nada a ninguna
parte.

## Los dos usos

- **Práctica** — la app pide un número, se dibuja y responde qué leyó. Pensado
  para que alguien que está aprendiendo a escribir números practique.
- **Cuenta** — se escribe un precio o una cantidad de varias cifras y se suma a
  una cuenta corriente, como la caja de una tienda de barrio. Las cifras de las
  que la red no está segura salen marcadas para revisarlas.
- **Libre** — se dibuja lo que sea y se mira cómo lo lee.

## Cómo verlo

Hay tres formas, de la más simple a la más completa.

**1. Doble clic, sin instalar nada.** Abrir `Cifra-un-solo-archivo.html`. Es la
misma app con todo adentro (estilos, código, pesos e imágenes), así que funciona
sin servidor y sin internet. Sirve para mostrarla en un computador prestado o
para entregarla como un archivo suelto.

**2. Servidor local, para probarla en el celular sin publicar nada.** En Windows,
doble clic a `servidor.bat`: abre la app en `http://localhost:8000` y muestra las
direcciones IP del computador. Desde el celular, conectado al mismo Wi-Fi, se
entra a `http://<esa-ip>:8000`. La primera vez Windows pregunta por el Firewall:
hay que permitir el acceso en redes privadas.

En Mac o Linux:

```bash
cd docs
python3 -m http.server 8000     # luego abrir http://localhost:8000
```

**3. GitHub Pages**, para tener un enlace que funcione desde cualquier parte:
Settings → Pages → Deploy from a branch → `main` → carpeta `/docs`.

Las formas 2 y 3 sirven la carpeta `docs/`, que usa módulos de JavaScript y por
eso necesita un servidor: abrir `docs/index.html` con doble clic no funciona.
Para eso está la versión de un solo archivo.

## Qué hay dentro

```
Cifra-un-solo-archivo.html   la app entera en un archivo, para abrir con doble clic
servidor.bat                 levanta el servidor local en Windows (para probar en el celular)

docs/            la app (es lo que publica GitHub Pages)
  index.html     estructura
  estilos.css    tema claro y oscuro
  red.js         la red: propagación hacia adelante y hacia atrás, escrita a mano
  preproceso.js  del trazo del dedo a la entrada de 28×28
  panel.js       el panel que muestra la red por dentro
  app.js         une todo: lienzo, modos y panel
  pesos.json     pesos entrenados en Python (784 → 128 → 48 → 10)
  anclas.png     300 dígitos de referencia para el reentrenamiento
  plantillas.json  pesos de un modelo de una sola capa, para comparar

codigo/          Python y pruebas
  preparar_datos.py    carga, normaliza, parte train/test y define el aumento
  entrenar.py          modelo base, comparación de arquitecturas y evaluación
  mejorar.py           aumento más fuerte y arquitecturas más grandes
  exportar.py          pesos al formato de la app y control de redondeo
  discreta.py          la parte de matemática discreta, con números reales
  plantillas.py        pesos del modelo de una sola capa
  anclas.py            el mosaico de dígitos de referencia
  un_solo_archivo.py   arma Cifra-un-solo-archivo.html a partir de docs/
  validar_red.mjs        la red de JavaScript contra la de Python
  validar_preproceso.mjs el preprocesado sobre imágenes reales
  probar_app.mjs         la app completa en un navegador

datos/           el dataset y la partición
resultados/      métricas, figuras y salidas de las pruebas
capturas/        capturas de la app
BITACORA.md      qué se hizo en cada paso y por qué
PLAN_TODO.md     el plan por tareas
PROBLEMA.md      el problema, las hipótesis y los límites
```

## Reproducir el entrenamiento

```bash
pip install numpy scipy scikit-learn pillow matplotlib
cd codigo
python3 -I preparar_datos.py ../datos/mnist10k.npz ../resultados
python3 -I entrenar.py ../datos/split_28x28.npz ../resultados
python3 -I mejorar.py  ../datos/split_28x28.npz ../resultados
python3 -I exportar.py ../datos/split_28x28.npz ../resultados ../docs
python3 -I discreta.py ../datos/split_28x28.npz ../resultados
python3 -I plantillas.py ../datos/split_28x28.npz ../docs
python3 -I anclas.py ../datos/split_28x28.npz ../docs
```

Las pruebas (necesitan Node y, la última, Playwright):

```bash
node validar_red.mjs ../docs/pesos.json ../resultados/casos_prueba.json
node validar_preproceso.mjs <casos.json> ../docs/pesos.json <salida.json>
node probar_app.mjs http://localhost:8000/index.html <casos.json> ../capturas <salida.json>
```

## Resultados

| | exactitud en el conjunto de prueba |
|---|---|
| Decir siempre el dígito más común | 11.25% |
| Vecino más cercano en distancia de Hamming (sin aprender nada) | 86.80% |
| Regresión logística (una sola capa) | 90.45% |
| Red 784 → 128 → 48 → 10 | **96.65%** |

Un número de varias cifras necesita acertar todas: con 96.65% por cifra, leer
bien un número de 3 cifras sale 90.28% de las veces y uno de 4 cifras, 87.25%.
Por eso el modo Cuenta marca las cifras dudosas en lugar de confiarse.

La red de la app es exactamente la misma que la de Python: las dos dan la misma
clase en los 20 casos de control, con diferencias de probabilidad del orden de
10⁻⁵, que vienen de que Python calcula en float64 y el navegador en float32.

## La matemática discreta

- El dibujo es una **matriz binaria** de 28×28; AND, OR y XOR entre dos dibujos
  dan la parte común, la unión y la diferencia.
- La **distancia de Hamming** es exactamente la cantidad de unos del XOR. Entre
  dibujos del mismo dígito vale 111.33 en promedio y entre dígitos distintos,
  138.33: se separan, pero se traslapan, y ahí es donde el método discreto puro
  falla y la red acierta.
- **Conteo:** hay 2⁷⁸⁴ matrices binarias de 28×28, más o menos 10²³⁶. Las 10 000
  imágenes del dataset son una fracción de 10⁻²³² del total.
- La relación «x e y representan el mismo dígito» es de **equivalencia**, y parte
  ese espacio en 10 clases.
- **Lógica y perceptrones:** de las 16 funciones booleanas de dos variables, 14
  las resuelve una sola neurona con umbral; XOR y XNOR no. XOR sí sale con una
  capa oculta de dos neuronas, porque XOR(p,q) = AND(OR(p,q), NAND(p,q)). Es el
  argumento de por qué esta red necesita capas ocultas, y está comprobado
  numéricamente en `codigo/discreta.py`.

## Los datos

10 000 dígitos escritos a mano de 28×28, del paquete npm
[`mnist`](https://github.com/cazala/mnist) de Juan Cazala (licencia MIT), que
los toma de la base MNIST de LeCun, Cortes y Burges. La partición es 8 000 para
entrenar y 2 000 para probar, estratificada, con semilla 42; no hay ninguna
imagen repetida entre las dos.

## Límites, dichos de frente

- Los dígitos del dataset los escribieron adultos y estudiantes con lápiz. Un
  trazo de dedo o de Pencil es más grueso y más tembloroso, así que la exactitud
  real puede ser menor que el 96.65%. Por eso la app deja guardar dibujos
  propios y reentrenar con ellos.
- Son 10 000 de las 70 000 imágenes de MNIST.
- El panel muestra lo que la red **hace**, no lo que «entiende». Cuando se dice
  que una neurona responde a cierto trazo, es una lectura de sus pesos, no una
  afirmación sobre lo que la neurona representa.
- El reentrenamiento en la página mezcla los dibujos propios con imágenes de
  referencia para que la red no olvide lo aprendido, pero son pocos ejemplos: es
  una demostración del mecanismo, no un entrenamiento serio. Los cambios no se
  guardan; al recargar vuelve la red original.
- Reconocer una cuenta completa con signos (+, −, ×, =) quedó fuera de este
  entregable.
