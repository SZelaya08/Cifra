# T05 · Definición formal del problema (reconocedor de dígitos dibujados)

## 1. Contexto y problema real
Dos usos con el mismo motor:
- Caja de tienda de barrio: el tendero escribe a mano la cuenta (precios y cantidades) en el iPad o el celular y la app reconoce los números y suma. Se plantea como alternativa rápida para quien no quiere teclear, no como solución a un vacío enorme: ya existen calculadoras y apps.
- Aprendizaje para niños: se pide un número, el niño lo dibuja con el dedo o el Pencil y la app dice qué leyó y si coincide, con retroalimentación amable. El panel de neuronas muestra "lo que la app ve".
Diferencia de requisitos: en la tienda importa que no se equivoque ninguna cifra (un error cambia la cuenta); con niños importa el mensaje cuando la app no está segura, por lo que se usa un umbral de confianza.

## 2. Pregunta de investigación
¿Puede una red neuronal pequeña, implementada a mano en JavaScript y entrenada con dígitos de 28x28, reconocer en tiempo real dibujos hechos con dedo o Pencil con la exactitud suficiente para sumar una cuenta y dar retroalimentación a niños, y qué se ve dentro de la red mientras decide?

## 3. Formulación
- Entrada: imagen en escala de grises de n x n píxeles (n = 28 o 14, se decide en T06), valores entre 0 y 1.
- Salida: probabilidad para cada clase; nivel 1: 10 clases (0 a 9); nivel 3: 14 clases (10 dígitos y +, -, x, =).
- Modelo: perceptrón multicapa con una o dos capas ocultas; función softmax en la salida.

## 4. Niveles de alcance
- Nivel 1: un dígito suelto (modo niños y base de todo).
- Nivel 2: números de varias cifras, por ejemplo 1250 (hay que separar las cifras).
- Nivel 3: operaciones completas, por ejemplo 1250 + 800 (requiere muestras propias de +, -, x, =).
Plan: entregar completo el nivel 1 y 2; el 3 queda como ampliación si hay tiempo.

## 5. Datos
- Base: 10,000 imágenes de 28x28 (paquete npm "mnist", MIT, tomadas de MNIST; cita: LeCun, Cortes y Burges). Archivo datos/mnist10k.npz.
- Propios: dibujos con dedo o Pencil de la estudiante y sus hermanos, usados para evaluar aparte y para ajuste fino; símbolos +, -, x, = (unas 20 a 30 muestras cada uno).
- Prueba rápida inicial (red 784-16-10 sin ajustar): 90.3% con 28x28 y 91.9% con 14x14 en 2,000 imágenes de prueba.

## 6. Hipótesis (a contrastar)
- H1: con ajuste de hiperparámetros, la red supera la exactitud de la prueba rápida (90.3%) en el conjunto de prueba.
- H2: los dibujos propios con dedo o Pencil se reconocen peor que los del dataset y mejoran al reentrenar con muestras propias.
- H3: los errores se concentran en pares parecidos (4-9, 3-5, 7-1).
- H4: bajar de 28x28 a 14x14 no reduce de forma notable la exactitud.

## 7. Métricas de éxito
- Exactitud en el conjunto de prueba del dataset y, aparte, en los dibujos propios.
- Matriz de confusión y pares más confundidos.
- Calibración simple: con el umbral de confianza elegido, qué fracción de lecturas se aceptan y cuántas de ellas son correctas.
- Respuesta que se sienta inmediata en iPad, celular y computador.

## 8. Alcance y límites
- Dentro: modelo, app web táctil sin APIs, panel contraíble de neuronas, ajuste fino con dibujos propios, modos tienda y niños.
- Fuera: producto comercial, pruebas con tenderos o niños reales, reconocimiento de escritura corrida.
- Limitaciones a declarar: los dígitos originales los escribieron adultos y estudiantes con lápiz; solo 10,000 de las 70,000 imágenes de MNIST; símbolos propios con pocas muestras; el panel muestra lo que la red hace, no que "entienda".

## 9. Matemática discreta presente
- Imagen como matriz binaria o de niveles; operaciones booleanas entre imágenes.
- Distancia de Hamming entre dibujos.
- Conteo: 2^(n^2) imágenes binarias posibles (2^64 en 8x8, 2^100 en 10x10, 2^784 en 28x28); casi todas son ruido.
- Lógica y perceptrones: una neurona resuelve AND y OR pero no XOR; por eso hacen falta capas ocultas.
- Clases de equivalencia: los dibujos del mismo dígito forman una clase.
- Alfabeto finito {0..9, +, -, x, =} y cadenas válidas de una cuenta (lenguajes formales y relaciones), en el nivel 3.
