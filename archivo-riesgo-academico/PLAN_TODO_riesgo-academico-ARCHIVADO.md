# Plan y to-do (Backlog / Todo / Doing / Completed)
Metodología: CRISP-DM adaptado + componente de matemática discreta + bitácora por tarea.

## Completed
- T01 Lluvia de ideas y selección de 2 candidatas
- T02 Elegir dataset público (UCI Student Performance) y revisar licencia
- T03 Descargar y descomprimir el dataset
- T04 Exploración inicial (dimensiones, nulos, tasa de "pierde", correlaciones)
- T05 Definir el problema formalmente (ver PROBLEMA.md)

## Doing
- T06 Decidir tratamiento: ambos datasets por separado, ceros en G3 aparte, escenarios con y sin G1/G2 (dashboard de comparación)

## Todo
- T07 Preparar datos: codificar categóricas, normalizar, partir train/test estratificado con semilla fija
- T08 Modelo base (regresión logística) como referencia

## Backlog
- T09 Red neuronal (MLP) en Python: entrenar y ajustar hiperparámetros
- T10 Evaluar: accuracy, precisión, recall, F1, matriz de confusión, validación cruzada
- T11 Importancia de variables: ablación y permutación, y comparar ambas; identificar variables modificables para la app
- T12 Sustentación matemática de G1/G2 (correlación, R², dilución) y matemática discreta: grafo de prerrequisitos de Ciencia de Datos (orden parcial, Hasse, orden topológico), relaciones, combinatoria 2^n, reglas lógicas
- T13 Exportar pesos del modelo a JSON
- T14 App web de hábitos: la persona registra sus hábitos y la app recomienda qué cambiar (solo variables modificables), con medidor de riesgo, gráfica de importancia y grafo
- T15 Probar la app (casos de prueba y comparación con Python)
- T16 Publicar (GitHub Pages)
- T17 Informe: introducción, metodología, resultados, discusión y limitaciones
- T18 Sustentación: diapositivas y ensayo

## Regla permanente
Al terminar cada tarea, registrar una entrada en BITACORA.md antes de pasar a la siguiente.
