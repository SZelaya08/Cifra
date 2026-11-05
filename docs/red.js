/* red.js — Red neuronal densa: propagación hacia adelante y hacia atrás.
 *
 * Los pesos vienen de pesos.json, entrenados en Python (codigo/entrenar.py y
 * codigo/mejorar.py). Aquí se reimplementa la red a mano, sin librerías, para
 * poder mostrar cada valor interno en el panel y para reentrenarla en la página.
 *
 * Capas: [784, 128, 48, 10]. Ocultas con ReLU, salida con softmax.
 * W[k] es una lista plana de capas[k] * capas[k+1] números, fila por fila:
 * el peso de la neurona i de la capa k hacia la neurona j de la capa k+1
 * está en W[k][i * capas[k+1] + j].
 */

export class Red {
  constructor(pesos) {
    this.lado = pesos.lado;
    this.capas = pesos.capas;                 // [784, 128, 48, 10]
    this.etiquetas = pesos.etiquetas;
    this.accuracyTest = pesos.accuracy_test;
    this.curvaPerdidaOriginal = pesos.curva_perdida || [];
    this.W = pesos.W.map((w) => Float32Array.from(w));
    this.b = pesos.b.map((v) => Float32Array.from(v));
    this.nCapas = this.W.length;              // número de capas con pesos (3)
    this.pesosOriginales = this.clonar();
    // Memoria de trabajo: activaciones de cada capa (la 0 es la entrada)
    this.a = this.capas.map((n) => new Float32Array(n));
    this.z = this.capas.slice(1).map((n) => new Float32Array(n));
  }

  clonar() {
    return {
      W: this.W.map((w) => Float32Array.from(w)),
      b: this.b.map((v) => Float32Array.from(v)),
    };
  }

  restaurarOriginales() {
    this.W = this.pesosOriginales.W.map((w) => Float32Array.from(w));
    this.b = this.pesosOriginales.b.map((v) => Float32Array.from(v));
  }

  /* Propagación hacia adelante. Deja las activaciones en this.a y las sumas
   * ponderadas (antes de la activación) en this.z, para que el panel pueda
   * mostrarlas. Devuelve el vector de probabilidades. */
  adelante(entrada) {
    this.a[0].set(entrada);
    for (let k = 0; k < this.nCapas; k++) {
      const nIn = this.capas[k];
      const nOut = this.capas[k + 1];
      const W = this.W[k];
      const bk = this.b[k];
      const ent = this.a[k];
      const z = this.z[k];
      const sal = this.a[k + 1];
      z.set(bk);
      for (let i = 0; i < nIn; i++) {
        const v = ent[i];
        if (v === 0) continue;               // la mayoría de los píxeles son fondo
        const base = i * nOut;
        for (let j = 0; j < nOut; j++) z[j] += v * W[base + j];
      }
      if (k < this.nCapas - 1) {
        for (let j = 0; j < nOut; j++) sal[j] = z[j] > 0 ? z[j] : 0;   // ReLU
      } else {
        let max = -Infinity;
        for (let j = 0; j < nOut; j++) if (z[j] > max) max = z[j];
        let suma = 0;
        for (let j = 0; j < nOut; j++) { const e = Math.exp(z[j] - max); sal[j] = e; suma += e; }
        for (let j = 0; j < nOut; j++) sal[j] /= suma;                  // softmax
      }
    }
    return this.a[this.nCapas];
  }

  predecir(entrada) {
    const p = this.adelante(entrada);
    let clase = 0;
    for (let j = 1; j < p.length; j++) if (p[j] > p[clase]) clase = j;
    return {
      clase,
      etiqueta: this.etiquetas[clase],
      confianza: p[clase],
      probabilidades: Array.from(p),
      activaciones: this.a.map((v) => Float32Array.from(v)),
      sumas: this.z.map((v) => Float32Array.from(v)),
    };
  }

  /* Pesos que entran a la neurona j de la primera capa oculta, como imagen
   * de 28x28. Sirve para ver a qué responde cada neurona. */
  pesosDeNeuronaEntrada(j) {
    const nOut = this.capas[1];
    const W = this.W[0];
    const img = new Float32Array(this.capas[0]);
    for (let i = 0; i < this.capas[0]; i++) img[i] = W[i * nOut + j];
    return img;
  }

  /* Detalle del cálculo de una neurona, con los números de este dibujo.
   * Devuelve los términos que más aportan, para mostrar la fórmula. */
  detalleNeurona(capa, j, cuantos = 6) {
    const k = capa - 1;                       // índice en W
    const nIn = this.capas[k];
    const nOut = this.capas[k + 1];
    const W = this.W[k];
    const ent = this.a[k];
    const terminos = [];
    for (let i = 0; i < nIn; i++) {
      const w = W[i * nOut + j];
      const aporte = ent[i] * w;
      if (aporte !== 0) terminos.push({ i, entrada: ent[i], peso: w, aporte });
    }
    terminos.sort((p, q) => Math.abs(q.aporte) - Math.abs(p.aporte));
    const sumaTotal = terminos.reduce((s, t) => s + t.aporte, 0);
    return {
      capa, neurona: j,
      sesgo: this.b[k][j],
      suma: this.z[k][j],
      sumaSinSesgo: sumaTotal,
      activacion: this.a[k + 1][j],
      activacionNombre: k < this.nCapas - 1 ? "ReLU" : "softmax",
      nEntradasActivas: terminos.length,
      mayores: terminos.slice(0, cuantos),
    };
  }

  /* Un paso de descenso de gradiente sobre un lote.
   * X: array de Float32Array(784). Y: array de enteros 0..9.
   * Devuelve la pérdida media (entropía cruzada) del lote. */
  entrenarLote(X, Y, tasa) {
    const n = X.length;
    if (n === 0) return 0;
    const dW = this.W.map((w) => new Float32Array(w.length));
    const db = this.b.map((v) => new Float32Array(v.length));
    let perdida = 0;

    for (let m = 0; m < n; m++) {
      const p = this.adelante(X[m]);
      const objetivo = Y[m];
      perdida += -Math.log(Math.max(p[objetivo], 1e-12));

      // delta de la capa de salida: p - y  (softmax con entropía cruzada)
      let delta = new Float32Array(this.capas[this.nCapas]);
      for (let j = 0; j < delta.length; j++) delta[j] = p[j];
      delta[objetivo] -= 1;

      for (let k = this.nCapas - 1; k >= 0; k--) {
        const nIn = this.capas[k];
        const nOut = this.capas[k + 1];
        const ent = this.a[k];
        const gW = dW[k];
        const gb = db[k];
        for (let j = 0; j < nOut; j++) gb[j] += delta[j];
        for (let i = 0; i < nIn; i++) {
          const v = ent[i];
          if (v === 0) continue;
          const base = i * nOut;
          for (let j = 0; j < nOut; j++) gW[base + j] += v * delta[j];
        }
        if (k > 0) {
          const W = this.W[k];
          const zAnt = this.z[k - 1];
          const nuevo = new Float32Array(nIn);
          for (let i = 0; i < nIn; i++) {
            if (zAnt[i] <= 0) continue;       // derivada de ReLU
            let s = 0;
            const base = i * nOut;
            for (let j = 0; j < nOut; j++) s += W[base + j] * delta[j];
            nuevo[i] = s;
          }
          delta = nuevo;
        }
      }
    }

    const paso = tasa / n;
    for (let k = 0; k < this.nCapas; k++) {
      const W = this.W[k], gW = dW[k];
      for (let i = 0; i < W.length; i++) W[i] -= paso * gW[i];
      const b = this.b[k], gb = db[k];
      for (let j = 0; j < b.length; j++) b[j] -= paso * gb[j];
    }
    return perdida / n;
  }

  exactitudSobre(X, Y) {
    if (X.length === 0) return null;
    let bien = 0;
    for (let m = 0; m < X.length; m++) {
      if (this.predecir(X[m]).clase === Y[m]) bien++;
    }
    return bien / X.length;
  }
}
