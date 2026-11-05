# T05 · Definición formal del problema

## 1. Contexto
Perder una materia tiene costos académicos y personales. Si se pudiera identificar a tiempo qué estudiantes están en riesgo y qué factores pesan más, se podría actuar antes (tutorías, acompañamiento). Este proyecto construye una app web que estima ese riesgo con una red neuronal y explica qué variables influyen más.

## 2. Pregunta de investigación
¿Qué tan bien puede una red neuronal predecir si un estudiante pierde una materia a partir de sus características personales, familiares y de hábitos, y cuáles de esas variables influyen más en la predicción?

## 3. Formulación
- Entrada: vector x con las 30 variables del dataset (excluyendo G1, G2 y G3).
- Salida: y = 1 si G3 < 10 (pierde), y = 0 si G3 >= 10 (aprueba). Umbral del sistema portugués: 10 sobre 20.
- Se busca una función f(x) = P(y = 1 | x), implementada como perceptrón multicapa, y una medida de importancia I(v) para cada variable v.

## 4. Dos escenarios
- Escenario A (diagnóstico): con G1 y G2 como entradas. Sirve de contraste; se espera mucha precisión porque G2 casi determina G3.
- Escenario B (predicción temprana, escenario principal): sin G1 ni G2. Es el útil de verdad, porque avisa antes de que haya notas.

## 5. Datos
- Fuente: UCI Student Performance (Cortez, 2008), CC BY 4.0, doi 10.24432/C5TG7T.
- Base provisional: student-mat.csv (395 estudiantes, 0 nulos; 130 pierden). La decisión final se toma en T06.
- Referencia de dificultad: clasificar siempre "aprueba" acierta 265 de 395 (67.08%); la red debe superar esto y también al modelo de regresión logística.

## 6. Hipótesis (a contrastar, no a confirmar)
- H1: en el escenario B, failures (materias perdidas antes) es una de las variables de mayor importancia.
- H2: en el escenario A, la importancia se concentra casi toda en G2 y G1.
- H3: la red neuronal supera al modelo base en recall de la clase "pierde", pero la mejora puede ser pequeña dado el tamaño del dataset.
- H4: la importancia por ablación y por permutación coincide en las variables del extremo superior, aunque no en todo el orden.

## 7. Métricas de éxito
- Principal: recall y F1 de la clase "pierde" (no detectar a un estudiante en riesgo cuesta más que una falsa alarma), más accuracy como apoyo.
- Importancia de variables: caída promedio del desempeño sobre varias semillas, con su dispersión.

## 8. Alcance y límites
- Dentro: modelo, análisis de importancia, grafo de prerrequisitos de Ciencia de Datos, app web local sin APIs.
- Fuera: recoger datos propios, causalidad, uso real en decisiones sobre estudiantes.
- Limitaciones a declarar: datos de colegio en Portugal, no de universidad; tamaño pequeño; importancia no es causalidad.

## 9. Matemática discreta presente
- El objetivo es un predicado booleano sobre el estudiante (y = 1 si G3 < 10).
- Con n = 30 variables hay 2^30 = 1073741824 subconjuntos posibles; probar todos es inviable, por eso se usa ablación de una en una (30 entrenamientos) como aproximación.
- Variables binarias y reglas lógicas del tipo (failures > 0) AND (higher = no) -> riesgo.
- Prerrequisitos de las materias como relación de orden parcial (T12).
