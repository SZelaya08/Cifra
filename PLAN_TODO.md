# Plan y to-do (Backlog / Todo / Doing / Completed)
Proyecto: Cifra — reconocedor de dígitos escritos a mano con red neuronal, panel contraíble de neuronas y uso táctil (iPad, celular o computador).
Metodología: CRISP-DM adaptado + componente de matemática discreta + bitácora por tarea.
(El proyecto anterior de riesgo académico quedó en archivo-riesgo-academico/)

## Completed
- T01 Lluvia de ideas y selección de candidatas (riesgo académico y reconocedor de dígitos)
- T02 Proyecto de riesgo académico explorado y puesto en pausa (queda como anexo opcional)
- T03 Decisión de cambiar al reconocedor de dígitos, con adaptación táctil y panel de neuronas
- T04 Dataset de 28x28 conseguido (10,000 imágenes tipo MNIST, paquete npm mnist, MIT) y probado
- T05 Problema definido: tienda de barrio y aprendizaje para niños (PROBLEMA.md)
- T06 Alcance decidido: 28x28, niveles 1 y 2 (el 3 de bono), capas ocultas por comparación
- T07 Datos preparados: partición 8000/2000, aumento y revisión visual
- T08 Modelo base: regresión logística 90.45% (decir siempre lo más común: 11.25%)
- T09 Red neuronal entrenada y ajustada: 784-128-48-10, exactitud de prueba 96.65%
- T10 Evaluación: matriz de confusión, pares confundidos (4-9, 2-7, 5-3), calibración y lectura de varias cifras
- T11 Matemática discreta con números reales: Hamming, conteo 2^784, equivalencia, lógica y XOR
- T12 Pesos exportados y red reescrita en JavaScript, validada contra Python
- T13 Lienzo táctil y preprocesado (recorte, escala a 20 px, centrado por masa), validado: cuesta solo 0.33 puntos
- T14 Panel etapa 1: activaciones y probabilidades
- T15 Panel etapa 2: grafo con pesos e imagen de cada neurona
- T16 Panel etapa 3: fórmulas con números reales y curva de entrenamiento
- T17 Guardar dibujos propios y reentrenar en la página, con imágenes de referencia
- T19 Pruebas en navegador: 26 de 26 comprobaciones pasan, en escritorio y celular, tema claro y oscuro
- Repositorio organizado (app en docs/), README.md y primer commit

## Doing
- T20 Publicar en GitHub Pages y probar en el celular con dibujos de verdad
      (Settings -> Pages -> Deploy from a branch -> main -> carpeta /docs)

## Todo
- T18 (bono) Ampliar a símbolos y operaciones (+, -, x, =): faltan muestras propias de cada signo
- T21 Informe: introducción, metodología, resultados, discusión y limitaciones
- T22 Sustentación: guion, demo en vivo y plan B

## Backlog
- Ajustar el grosor del trazo según lo que se vea al dibujar con el dedo en el celular
- Reentrenar con dibujos propios y medir cuánto sube la exactitud con letra real
- Si el reentrenamiento va lento en el celular, considerar bajar a 14x14

## Regla permanente
Al terminar cada tarea, registrar una entrada en BITACORA.md antes de pasar a la siguiente.
