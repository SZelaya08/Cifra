# Presentación de Cifra en Beamer

- `presentacion.tex` — la fuente. Compilar con `pdflatex presentacion.tex`
  (dos veces, para que cuadren los números de diapositiva).
- `presentacion.pdf` — la que se proyecta. 20 diapositivas, 16:9.
- `presentacion-con-notas.pdf` — la misma, con una página de notas del
  presentador después de cada diapositiva. Esta es para estudiar e imprimir,
  no para proyectar.
- `figuras/` y `capturas/` — tienen que quedar al lado del `.tex`.

Para regenerar la versión con notas: descomentar la línea
`\setbeameroption{show notes}` cerca del principio del `.tex` y compilar.

En Overleaf: subir el `.tex` y las dos carpetas manteniendo la estructura,
y compilar con pdfLaTeX.

El documento usa babel en español si está instalado; si no, compila igual.
