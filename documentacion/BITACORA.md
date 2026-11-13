# Bitácora del proyecto – Matemáticas Discretas
Riesgo académico con red neuronal

Formato de cada entrada: Fecha · Tarea · Qué se hizo · Decisión y por qué · Resultado/evidencia · Archivos · Para el informe

---

## 2026-11-03 · T01 · Lluvia de ideas
- Qué se hizo: se evaluaron 11 propuestas con una red neuronal en página web, sin APIs.
- Decisión: quedaron 2 candidatas: (A) predictor de riesgo académico con análisis de variables, (B) reconocedor de dígitos dibujados.
- Por qué: ambas corren en el navegador y tienen matemática discreta explícita (órdenes parciales y combinatoria en A; matrices booleanas, Hamming y lógica/perceptrones en B).
- Para el informe: sección "Selección del problema", con criterios de viabilidad y relevancia.

## 2026-11-03 · T02 · Elección del dataset
- Decisión: dataset público UCI "Student Performance" (Cortez, 2008), doi 10.24432/C5TG7T, licencia CC BY 4.0.
- Por qué: evita encuestar personas; trae datos reales y limpios.
- Limitación a declarar: son estudiantes de colegio en Portugal, no universitarios.
- Para el informe: sección "Datos" con cita completa.

## 2026-11-03 · T03 · Descarga y descompresión
- Archivos: student+performance/student.zip, extraído en student+performance/extraido/ (student-mat.csv, student-por.csv, student.txt, student-merge.R). Separador ";".

## 2026-11-03 · T04 · Exploración inicial
- Matemáticas: 395 estudiantes, 0 nulos; con "pierde" = G3 < 10 pierden 130 (32.91%); 38 con G3 = 0.
- Portugués: 649 estudiantes, 0 nulos; pierden 100 (15.40%); 15 con G3 = 0.
- Hallazgos: G1 y G2 se relacionan muy fuerte con G3. Sin ellas, la variable más asociada es failures (materias perdidas antes).
- Decisión pendiente (T06): usar Matemáticas (clases más balanceadas) y entrenar con y sin G1/G2.
- Para el informe: tabla descriptiva y justificación de la variable objetivo.

## 2026-11-03 · T05 · Definición formal del problema
- Qué se hizo: se redactó PROBLEMA.md con pregunta de investigación, formulación (x de 30 variables, y = 1 si G3 < 10), dos escenarios, datos, hipótesis H1-H4, métricas y límites.
- Decisión: el escenario principal es B (sin G1/G2); el A sirve de contraste. Métrica principal: recall y F1 de la clase "pierde".
- Por qué: G2 casi determina G3, así que predecir con ella no aporta; y no detectar a un estudiante en riesgo cuesta más que una falsa alarma.
- Resultado: línea base de referencia con Matemáticas, clasificar siempre "aprueba" acierta 265 de 395 (67.08%).
- Archivos: PROBLEMA.md
- Para el informe: secciones "Planteamiento del problema", "Hipótesis" y "Alcance y limitaciones".

## 2026-11-03 · T06 (en curso) · Decisiones de la estudiante
- Decisión 1: se desarrollan los dos escenarios (con y sin G1/G2). Por qué: el modelo con G1/G2 permite una sustentación matemática de cómo esas dos variables afectan al modelo (correlación, R², dilución de la importancia de las demás).
- Decisión 2: los estudiantes con G3 = 0 se analizan aparte y se comparan con sus inasistencias.
- Decisión 3: se usan los dos datasets (Matemáticas y Portugués) por separado y se contrasta si coinciden, para conectarlo en las conclusiones.
- Decisión 4: un dashboard pequeño muestra la comparación de modelos, los ceros y la coincidencia entre datasets.
- Decisión 5 (cambia la app): la app no será solo un modelo. Será una app donde la persona registra sus hábitos y la app le dice qué cambiar para pasar la materia o subir sus notas.
- Implicación a registrar: solo se pueden recomendar variables modificables (horas de estudio, inasistencias, salidas, alcohol, tutorías, etc.). Edad o educación de los padres no son accionables. Las recomendaciones son asociaciones del modelo, no causalidad.
- Código: codigo/analisis_t06.py · Resultados: resultados/analisis_t06.json

## 2026-11-03 · T06 (resultados preliminares) · Comparación de modelos, ceros y datasets
Método: codigo/analisis_t06.py; modelos sin ajustar (regresión logística y red de 1 capa oculta de 16 neuronas); validación cruzada estratificada de 5 pliegues repetida 3 veces; importancia por permutación (caída de AUC) y ablación (escenario B). Cifras truncadas, no redondeadas.

Modelos (AUC / exactitud / recall de "pierde"):
- Matemáticas A (con G1 y G2): regresión 0.9755 / 91.89% / 87.17%; red 0.9488 / 86.41% / 76.92%.
- Matemáticas B (sin G1 ni G2): regresión 0.6732 / 68.69% / 36.41%; red 0.6253 / 65.23% / 43.58%. Siempre "aprueba": 67.08% de exactitud.
- Portugués A: regresión 0.9545 / 92.14% / 70.66%; red 0.9446 / 91.11% / 65.33%.
- Portugués B: regresión 0.7885 / 84.54% / 27.66%; red 0.7651 / 83.71% / 36.33%. Siempre "aprueba": 84.59%, que supera a ambos modelos en exactitud.
- Lectura: sin G1/G2 los modelos predicen poco; la red sin ajustar no supera a la regresión logística (H3 sin respaldo por ahora; se revisa en T09 con ajuste).

Estudiantes con G3 = 0:
- Matemáticas: 38 estudiantes, 100.00% con cero inasistencias (aprueban: 24.52%); 13 tienen G2 = 0.
- Portugués: 15 estudiantes, 100.00% con cero inasistencias (aprueban: 38.25%); 7 tienen G2 = 0.
- Interpretación (hipótesis a confirmar): a este grupo probablemente no se le registraron las inasistencias, quizá por abandono. La relación inasistencias-nota 0 sería un límite de los datos, no un hallazgo de comportamiento.

Coincidencia entre datasets (escenario B):
- Spearman de las importancias: 0.1439 (p = 0.4479). Única variable común en el top 5: failures.
- Top 5 por permutación: Matemáticas failures, studytime, schoolsup, goout, age; Portugués school, failures, higher, freetime, absences.
- H1 (failures entre las más importantes) tiene respaldo en ambos datasets; H4 solo coincide en failures.

Sustentación matemática de G1 y G2 (Matemáticas / Portugués):
- Correlación de G3 con G2: 0.9048 / 0.9185; con G1: 0.8014 / 0.8263; entre G1 y G2: 0.8521 / 0.8649.
- R² de G3 (validación cruzada, modelo lineal): solo G2 81.54% / 84.75%; G1 y G2 81.81% / 85.00%; las 30 variables sin G1 ni G2 2.55% / 24.63%; las 32 juntas 79.16% / 83.62%.
- Regla de una variable "G2 < 10 implica pierde": exactitud 91.89% / 89.67%; recall 93.84% / 89.00%.
- En el escenario A, G1 y G2 llevan 86.00% / 91.71% de la importancia por permutación.
- Interpretación: G1 y G2 son casi redundantes entre sí (multicolinealidad) y G2 domina; las demás variables quedan diluidas.

Archivos: resultados/analisis_t06.json, panel "Panel de riesgo académico" (dashboard publicado).
Pendiente en T06: decidir qué hacer con los ceros al entrenar (dejarlos, quitarlos o marcarlos) y qué dataset es el principal.
Para el informe: tablas de métricas, figura AUC por escenario, tabla de ceros, figura de importancia, sustentación de G1/G2.

---
# NUEVO PROYECTO desde 2026-11-04: reconocedor de dígitos dibujados
(Las entradas anteriores corresponden al proyecto de riesgo académico, en pausa.)

## 2026-11-04 · T03 · Cambio de proyecto
- Qué se hizo: se decidió dejar el predictor de riesgo académico y pasar al reconocedor de dígitos dibujados.
- Por qué: la estudiante no quedó convencida del aspecto de la app, y el proyecto de dígitos se presta mejor a una demo en vivo y a la parte matemática.
- Decisiones de diseño: uso táctil (dedo o Pencil; funciona también con mouse), panel contraíble para ver las neuronas, y mayor resolución que 8x8.
- Qué se conserva: lo del proyecto anterior queda en la carpeta como anexo opcional (PLAN_TODO_riesgo-academico-ARCHIVADO.md, PROBLEMA_riesgo-academico-ARCHIVADO.md, resultados/ y el panel publicado).
- Para el informe: sección "Selección del problema" con la comparación de las dos candidatas y las razones del cambio.

## 2026-11-04 · T04 · Dataset de 28x28
- Qué se hizo: se buscó un dataset de 28x28 descargable desde el entorno de trabajo. Los sitios oficiales de MNIST, Google, Hugging Face y OpenML estaban bloqueados; se obtuvo desde el paquete npm "mnist" (MIT), que trae 10,000 imágenes.
- Resultado: 10,000 imágenes de 28x28 con valores entre 0 y 1, entre 863 y 1127 por dígito. Prueba rápida con una red de 784-16-10 sin ajustar, 8,000 de entrenamiento y 2,000 de prueba: exactitud 90.3% con 28x28 y 91.9% con 14x14.
- Decisión pendiente (T06): resolución final (28x28 o 14x14). Entrenar la base en Python y llevar los pesos a la página; el reentrenamiento en el navegador solo con los dibujos nuevos.
- Advertencias: los dígitos originales son escritos con lápiz por adultos y estudiantes; los dibujos con dedo o Pencil serán distintos, por eso la app guarda dibujos propios para reentrenar. Son 10,000 de las 70,000 imágenes de MNIST.
- Archivos: datos/mnist10k.npz, datos/LEEME.md
- Para el informe: sección "Datos", con cita del paquete y de LeCun, Cortes y Burges.

## 2026-11-04 · T05 · Definición del problema real y formal
- Qué se hizo: se propuso la caja de tienda de barrio como problema real; la estudiante pidió sumar el uso de aprendizaje para niños. Se redactó PROBLEMA.md con dos casos de uso, pregunta de investigación, formulación, tres niveles de alcance, datos, hipótesis H1-H4, métricas y límites.
- Decisión (de la estudiante): el proyecto tiene dos usos con el mismo motor, tienda de barrio y aprendizaje para niños.
- Por qué: la tienda justifica el nivel de números y operaciones; el uso con niños justifica la retroalimentación y el panel de neuronas como explicación visual.
- Decisión de plantear el problema con honestidad: se presenta como alternativa rápida para quien no quiere teclear, no como solución a un vacío enorme, porque ya existen calculadoras y apps.
- Alcance: se entregan completos los niveles 1 y 2; el nivel 3 (operaciones con +, -, x, =) queda como ampliación.
- Archivos: PROBLEMA.md
- Para el informe: secciones "Planteamiento del problema", "Hipótesis" y "Alcance y limitaciones".

## 2026-11-04 · T06 · Decisiones de alcance (de la estudiante)
- Resolución: 28x28. Por qué: es el estándar, se ve mejor en el panel de neuronas y separa mejor los trazos gruesos de dedo o Pencil. Plan B: bajar a 14x14 si el reentrenamiento o la respuesta en el iPad van lentos (en la prueba rápida 14x14 acertó 91.9% frente a 90.3%).
- Alcance: niveles 1 y 2 completos (dígito suelto y números de varias cifras); el nivel 3 (operaciones con +, -, x, =) queda como bono si sobra tiempo.
- Capas ocultas: no se fija ahora; se decide comparando en T09 una capa de 16 neuronas frente a dos capas de 16, con los resultados.
- Para el informe: justificación de la resolución y del alcance, y comparación de arquitecturas en la sección de modelado.

## 2026-11-04 · T07 · Preparación de datos
- Qué se hizo: codigo/preparar_datos.py carga las 10,000 imágenes, las normaliza a [0, 1], revisa duplicados, parte train/test, define el aumento por desplazamientos y genera una revisión visual. Las funciones (cargar, partir, desplazar, aumentar) se reutilizan en T08 y T09.
- Partición: estratificada 80/20 con semilla 42: 8,000 de entrenamiento y 2,000 de prueba. Por clase, entrenamiento entre 690 (dígito 5) y 902 (dígito 1); prueba entre 173 y 225.
- Verificaciones: 0 duplicados exactos en las 10,000 imágenes; 0 índices compartidos entre train y test; 0 imágenes de prueba idénticas a una de entrenamiento. La imagen de revisión visual muestra las etiquetas correctas.
- Aumento: solo sobre entrenamiento, con desplazamientos de 1 píxel (izquierda, derecha, arriba, abajo); el entrenamiento pasa de 8,000 a 40,000 imágenes. No se guarda en disco; se genera al entrenar. La prueba nunca se aumenta.
- Hallazgo para el lienzo táctil (T13): en el dataset cada dígito cabe en una caja de a lo sumo 20x20 (alto medio 19.68, ancho medio 15.59) y su centro de masa queda cerca del centro de la imagen (fila 13.99, columna 14.00). El lienzo debe recortar el dibujo, escalarlo para que su lado mayor mida 20 píxeles y centrarlo por centro de masa en 28x28; si no se hace, los dibujos de dedo quedarán distintos a los datos de entrenamiento.
- Tinta: media de 103.97 píxeles por encima de 0.5 por imagen (entre 22 y 275).
- Archivos: codigo/preparar_datos.py, datos/split_28x28.npz, resultados/t07_resumen.json, resultados/t07_revision_visual.png
- Para el informe: sección "Preparación de datos" con la tabla de la partición, la figura de revisión visual y la justificación del preprocesado.

## 2026-11-04 · T06 · Decisiones de alcance (de la estudiante)
- Resolución: 28x28. Por qué: es el estándar, se ve mejor en el panel de neuronas y separa mejor los trazos gruesos de dedo o Pencil. Plan B: bajar a 14x14 si va lento en el iPad.
- Alcance: niveles 1 y 2 completos (dígito suelto y números de varias cifras); el nivel 3 (operaciones con +, -, x, =) queda como bono.
- Capas ocultas: no se fijaron; se decidieron comparando en T09.

## 2026-11-04 · T07 · Preparación de datos
- Qué se hizo: codigo/preparar_datos.py carga las 10,000 imágenes, normaliza a [0, 1], revisa duplicados, parte train/test, define el aumento y genera la revisión visual.
- Partición: estratificada 80/20 con semilla 42: 8,000 de entrenamiento y 2,000 de prueba. Por clase, entrenamiento entre 690 (dígito 5) y 902 (dígito 1).
- Verificaciones: 0 duplicados exactos; 0 índices compartidos; 0 imágenes de prueba idénticas a una de entrenamiento. La revisión visual confirma que las etiquetas corresponden.
- Aumento: solo sobre entrenamiento, desplazamientos de 1 píxel en las 4 direcciones; de 8,000 a 40,000 imágenes. La prueba nunca se aumenta.
- Hallazgo clave para el lienzo: en el dataset cada dígito cabe en una caja de a lo sumo 20x20 (alto medio 19.68, ancho medio 15.59) y su centro de masa cae casi en el centro de la imagen (fila 13.99, columna 14.00). El lienzo debe recortar, escalar a 20 px de lado mayor y centrar por centro de masa, o la red recibe algo que nunca vio.
- Archivos: codigo/preparar_datos.py, datos/split_28x28.npz, resultados/t07_resumen.json, resultados/t07_revision_visual.png

## 2026-11-04 · T08 · Modelo base
- Referencias sobre las 2,000 imágenes de prueba: decir siempre el dígito más común acierta 11.25%; una regresión logística multinomial (C=0.05), 90.45%.
- Para el informe: estas dos cifras son el listón que la red tiene que superar.

## 2026-11-04 · T09 · Red neuronal: arquitectura e hiperparámetros
- Método: la arquitectura se eligió con una partición de validación sacada del entrenamiento (no con el conjunto de prueba), para no contaminar la evaluación final.
- Primera comparación (aumento de 1 píxel): (16,) 93.43%; (24,) 93.93%; (32,) 94.68%; (64,) 94.75%; (16,16) 92.93%; (32,16) 95.25%. Ganó (32,16).
- Primer modelo final: exactitud de prueba 94.95%, con 99.27% en entrenamiento, es decir algo de sobreajuste.
- Segunda vuelta (codigo/mejorar.py) con aumento más fuerte: además de los 4 desplazamientos de 1 píxel, 4 copias con rotación de -12 a 12 grados, escala de 0.9 a 1.1 y desplazamiento de -2 a 2 píxeles. El entrenamiento pasa a 72,000 imágenes.
- Segunda comparación: (32,16) 95.37%; (64,32) 96.00%; (96,32) 95.68%; (128,48) 96.68%. Ganó (128,48).
- Modelo final: 784 - 128 - 48 - 10, ReLU en las ocultas y softmax en la salida, 107,162 parámetros, alpha 1e-5, tasa inicial 0.003, lotes de 256, 32 iteraciones.
- Resultado: exactitud de prueba 96.65% (antes 94.95%), una mejora de 1.70 puntos que vino del aumento de datos, no de un modelo más grande por sí solo.
- H1 (la red supera a la prueba rápida de 90.3%) y H4 quedan con respaldo; la red también supera a la regresión logística (90.45%).
- Archivos: codigo/entrenar.py, codigo/mejorar.py, resultados/t08_t10_resumen.json, resultados/t09b_mejora.json, resultados/t09_t10_resultados.png, resultados/t09_neuronas.png

## 2026-11-04 · T10 · Evaluación
- Exactitud de prueba 96.65%; en entrenamiento 99.70%.
- Recall por dígito: los más fáciles son el 1 y el 0; los más difíciles, el 2 y el 4.
- Pares más confundidos: 4 leído como 9 (7 casos), 2 como 7 (5), 5 como 3 (5), 8 como 6 (4). H3 (los errores se concentran en pares parecidos) queda con respaldo.
- Calibración: con umbral de seguridad 0.80 se aceptan el 98.75% de las lecturas y de esas acierta el 97.16%; con 0.95 se acepta el 97.75% y acierta el 97.64%. En la app el umbral de duda quedó en 0.80.
- Lectura de varias cifras: con 96.65% por cifra, la probabilidad de leer bien un número de 2 cifras es 93.41%, de 3 cifras 90.28%, de 4 cifras 87.25% y de 5 cifras 84.33%. Por eso el modo Cuenta marca las cifras dudosas en vez de confiarse.
- Archivos: resultados/t10_errores.png

## 2026-11-04 · T11 · Matemática discreta (con números del proyecto)
- Conteo: hay 2^784 matrices binarias de 28x28, un número de 237 cifras decimales (~10^236). Las 10,000 imágenes del dataset son una fracción de 10^-232 del total.
- Distancia de Hamming (umbral 0.5, 1,500 imágenes): media 111.33 entre dibujos del mismo dígito y 138.33 entre dígitos distintos. Hay traslape: la menor distancia entre clases distintas es 28 y la mayor dentro de una misma clase es 413.
- Clasificador por vecino más cercano en Hamming (sin aprender nada): 86.80% de exactitud sobre 500 imágenes con 1,500 de referencia. Es un buen contraste: el método discreto puro llega lejos pero se queda 9.85 puntos por debajo de la red.
- Operaciones booleanas entre un 3 y un 8: el 3 tiene 143 píxeles, el 8 tiene 117, comparten 76 (AND), la unión son 184 (OR) y difieren en 108 (XOR), que es exactamente su distancia de Hamming. Índice de Jaccard 0.41.
- Clases de equivalencia: la relación "x e y representan el mismo dígito" es reflexiva, simétrica y transitiva; parte el espacio en 10 clases.
- Lógica y perceptrones, comprobado numéricamente: un perceptrón de umbral aprende AND, OR y NAND pero no XOR. De las 16 funciones booleanas de dos variables, 14 son linealmente separables y 2 no (XOR y XNOR). XOR sí se resuelve con una capa oculta de dos neuronas: XOR(p,q) = AND(OR(p,q), NAND(p,q)), verificado contra su tabla de verdad.
- Archivos: codigo/discreta.py, resultados/t11_discreta.json, resultados/t11_discreta.png

## 2026-11-04 · T12 · Exportación y red en JavaScript
- Los pesos se guardan en listas planas con 4 decimales: 760 KB. Redondear a 4 decimales no cambia ninguna predicción (0 de 2,000) y la diferencia máxima de probabilidad es 0.00111984.
- La red se reescribió a mano en JavaScript (docs/red.js), con propagación hacia adelante y hacia atrás, sin librerías, para poder mostrar cada valor interno y reentrenar en la página.
- Validación contra Python (codigo/validar_red.mjs): las dos dan la misma clase en los 20 casos de control, con diferencia máxima de probabilidad de 1.6e-5. No son idénticas al bit porque Python usa float64 y el navegador float32; se dejó una tolerancia de 1e-4 y la clase predicha debe coincidir siempre.
- También se comprobó que entrenar baja la pérdida y que restaurar los pesos originales deja la red como estaba.
- Archivos: docs/red.js, docs/pesos.json, codigo/exportar.py, codigo/validar_red.mjs, resultados/t12_exportacion.json, resultados/t12_validacion_js.json

## 2026-11-04 · T13 · Lienzo táctil y preprocesado
- El preprocesado (docs/preproceso.js) lee la tinta del lienzo, separa los trazos en componentes conexas de 8 vecinos, junta las que se solapan horizontalmente (un dígito puede llevar varios trazos), descarta las motas, y para cada cifra recorta, escala a 20 px de lado mayor y centra por centro de masa en 28x28, siguiendo lo que se midió en T07.
- Corrección añadida: si al encoger quedan menos de 48 píxeles encendidos (el dataset tiene 104 de media), se engrosa el trazo. Sin esto, un trazo fino le llega a la red como algo que nunca vio.
- Validación sin navegador (codigo/validar_preproceso.mjs), con 300 imágenes de prueba dibujadas en un lienzo de 280x280 en distintas posiciones y tamaños:
  - entrada directa 96.33%; centrado 96.00%; pequeño 96.00%; corrido a una esquina 96.00%; corrido a la derecha 96.00%; grande 94.00% (ahí el dígito toca el borde y se recorta).
  - El preprocesado cuesta solo 0.33 puntos, y la lectura es casi independiente de dónde y de qué tamaño se dibuje.
  - Varias cifras: de 100 pruebas con 3 cifras, 99 se separaron correctamente en 3 y en 88 el número completo quedó bien leído, que es justo lo que predice 0.9665^3 = 90.28%.
- Archivos: docs/preproceso.js, codigo/validar_preproceso.mjs, resultados/t13_validacion_preproceso.json

## 2026-11-04 · T14-T16 · Panel de la red por dentro
- Capas: diagrama con la entrada como imagen y las tres capas como puntos que se encienden según la activación; al tocar una neurona se dibujan sus conexiones más fuertes (rojo si suman, azul si restan).
- Neuronas: los pesos de cada neurona de la primera capa como imagen de 28x28, normalizada con su propio máximo (con el máximo global se veían en blanco).
- Hallazgo honesto: los pesos no se parecen a dígitos, ni siquiera los de un modelo de una sola capa. Se agregó una comparación en el panel con la imagen promedio de cada dígito (que sí parece un dígito) y los pesos de la regresión logística (que no), explicando que los pesos no describen el dígito sino lo que lo distingue de los otros nueve. Se probó bajar la regularización para "limpiar" las plantillas (C de 0.05 a 0.0003) y casi no cambia la rugosidad (1.407 a 0.951) y sí cuesta exactitud (90.5% a 81.35%), así que se dejó la explicación en vez de forzar la imagen.
- Cálculo: la cuenta de la neurona seleccionada con los números del dibujo actual, término a término (entrada por peso), la suma, el sesgo y la activación (ReLU o softmax).
- Discreta: la matriz binaria del dibujo, el conteo 2^784, la distancia de Hamming a cada dígito, el vecino más cercano entre las 300 imágenes de referencia frente a lo que dice la red, las clases de equivalencia y la tabla de AND/OR/NAND/XOR.
- Archivos: docs/panel.js, docs/plantillas.json, codigo/plantillas.py

## 2026-11-04 · T17 · Guardar dibujos propios y reentrenar
- La app guarda dibujos propios en el navegador (localStorage, con try/catch para que no falle en modo privado) y reentrena con descenso de gradiente escrito a mano.
- Para evitar el olvido catastrófico, cada reentrenamiento mezcla los dibujos propios con imágenes de referencia: 300 dígitos del conjunto de entrenamiento guardados como mosaico PNG (docs/anclas.png, 48 KB; en JSON habría pesado varias veces más).
- Reporta la exactitud antes y después, tanto sobre los dibujos propios como sobre las de referencia, y se puede volver a la red original. Los cambios no se guardan al recargar.
- Archivos: codigo/anclas.py, docs/anclas.png

## 2026-11-04 · T19 · Pruebas de la app
- codigo/probar_app.mjs abre la app en un navegador real (Playwright), dibuja dígitos del conjunto de prueba sobre el lienzo y comprueba 26 cosas.
- Resultado: las 26 pasan. La app lee lo mismo que la red de Python en 25 de 25 casos; lee números de 3 cifras; el modo Cuenta suma y deja corregir una cifra; el modo Práctica lleva la cuenta de intentos; el reentrenamiento corre y reporta; y en pantalla de celular (iPhone 13), en tema claro y oscuro, no hay desplazamiento horizontal ni con el panel abierto.
- Dos cosas que la prueba encontró y se corrigieron: al principio la prueba pintaba los trazos tan gruesos que se volvían manchas (la app leía 1 de 25), y los pesos de las neuronas se veían en blanco por normalizarlos con el máximo global.
- En este entorno no hay salida a fonts.googleapis.com, así que las tipografías no cargan en las capturas; en el sitio publicado sí. La prueba ignora esos errores a propósito.
- Archivos: codigo/probar_app.mjs, resultados/t19_pruebas.json, capturas/

## 2026-11-04 · Organización del repositorio y primer commit
- La app quedó en docs/ porque GitHub Pages puede publicar esa carpeta sin configurar nada más. Se agregó docs/.nojekyll.
- El proyecto anterior de riesgo académico se movió a archivo-riesgo-academico/.
- Se agregó README.md con qué es, cómo verlo, cómo reproducir el entrenamiento, los resultados, la parte discreta y los límites.
- Falta por hacer: publicar en GitHub Pages (Settings -> Pages -> Deploy from a branch -> main -> /docs) y probarlo en el celular con dibujos de verdad, que es la prueba que de verdad importa.

## 2026-11-04 · Extra · Dos formas de ejecutarla sin GitHub
- Qué se hizo: codigo/un_solo_archivo.py arma Cifra-un-solo-archivo.html, que mete dentro del HTML el CSS, los cuatro archivos de JavaScript, los pesos, las plantillas y el mosaico de referencia como data URI. Pesa 0.95 MB y abre con doble clic, sin servidor y sin internet.
- Por qué hacía falta: la versión de docs/ usa módulos de JavaScript y fetch, y los navegadores bloquean las dos cosas con file://. La app ya avisaba de esto con un mensaje, pero no resolvía el caso de querer mostrarla sin montar nada.
- Verificación: las mismas 26 comprobaciones del T19, corridas sobre file:///…/Cifra-un-solo-archivo.html, pasan todas. Es la misma app; cambia solo el empaquetado.
- También se agregó servidor.bat, que levanta el servidor local en Windows y muestra las IP del computador para entrar desde el celular por Wi-Fi, con aviso sobre el Firewall. Tiene salida alterna si no encuentra Python.
- Archivos: Cifra-un-solo-archivo.html, servidor.bat, codigo/un_solo_archivo.py, resultados/t20_un_solo_archivo.json

## 2026-11-10 · Rediseño del frontend
- Motivo: la app funcionaba pero se veía genérica. Se rehízo la pantalla completa con la skill Hallmark, en modo rediseño sobre pantalla de aplicación.
- Registro de partida (sloplint): 45 incumplimientos de piso y 62 reflejos automáticos. Los peores: una columna centrada de tarjetas blancas con la misma receta, etiquetas en versalitas rastreadas, un azul de plantilla, emojis como iconos, puntos medios en el pie, y el lienzo (que es el tema de la página) reducido a un cuadro pálido dentro de una tarjeta vacía.
- Dirección: tema Almanac, repartido 2 de 3 candidatos. Es el registro de un libro de consulta: papel pizarra, tinta azul oscura, Hanken Grotesk sobre Newsreader, cifras en IBM Plex Mono alineadas al decimal, dos pesos de línea, esquinas rectas y una sola magenta. Se eligió porque esta app es, literalmente, una publicación de cifras y tablas.
- Composición nueva: taller de dos columnas. La hoja de escritura a la izquierda ocupa la página; el registro de lectura a la derecha, fijo al hacer scroll, muestra el número leído, la seguridad y los diez dígitos con su probabilidad como un libro mayor, con la fila ganadora en magenta. El panel y el pie van abajo, a todo el ancho. En celular se apila: hoja, registro, modo.
- Lo que se conservó: los 50 identificadores, las 6 clases y los 2 atributos de datos que consultan app.js, panel.js y las pruebas; los tres modos; las cinco secciones del panel. Verificado con el registro de sloplint: 1 de 1 enlaces, 2 de 2 campos, 3 de 3 anclas de script, 2 de 2 figuras.
- Lo que cambió a propósito: el h1 pasó de ser el nombre del producto a ser la tarea ("Dibuja este número"), porque en una pantalla de trabajo el encabezado es el trabajo; el nombre quedó en la marca.
- Tipografías alojadas en el repositorio (docs/tipografias/, 280 KB): la app ya no depende de Google Fonts y funciona sin internet, que es lo que prometía la versión de un solo archivo.
- Tres errores reales encontrados y corregidos durante el rediseño:
  1. Al cambiar de tema, el trazo ya dibujado se quedaba del color anterior y desaparecía. Ahora se vuelve a teñir conservando la forma.
  2. El filtro de motas medía el área contra el lienzo entero, así que al cambiar la proporción del lienzo se tragaba un "1". Ahora se mide contra el trazo más grande, lo que además lo hace independiente del tamaño con el que cada persona escriba. La separación de varias cifras subió de 99 a 100 sobre 100, y los números de tres cifras leídos completos de 88 a 89.
  3. Las pruebas importaban de ../app/, carpeta que dejó de existir cuando se renombró a docs/. Corregido.
- Mejoras de uso: el estado vacío dice qué falta y qué hacer en vez de mostrar un guion suelto; el libro mayor queda visible y apagado para enseñar la forma de lo que va a llegar; el número a copiar salió de la tipografía mono (su cero lleva un punto adentro que un niño copiaría) y pasó a la cara de títulos; el texto de la cuenta ya no habla de naranja, que era un color que el rediseño eliminó.
- Verificación: sloplint queda en 0 incumplimientos y 0 reflejos. Las 26 comprobaciones en navegador pasan, en escritorio y celular, claro y oscuro, y también sobre el archivo único. La red de JavaScript sigue coincidiendo con la de Python.
- Archivos: docs/index.html, docs/estilos.css, docs/tokens.css, docs/base.css, docs/app.js, docs/panel.js, docs/preproceso.js, docs/tipografias/, capturas/
