"""T11b - Exporta los pesos de la regresion logistica como "plantillas".

Uso: python3 -I plantillas.py <split_28x28.npz> <carpeta_app>

Sirve para una comparacion que se ve muy bien en el panel: un modelo de una
sola capa aprende, para cada digito, una plantilla que se parece al digito;
la red con capas ocultas aprende trozos que por separado parecen ruido pero
juntos aciertan mas. Es el mismo argumento de AND/OR frente a XOR: con una
sola recta se llega hasta cierto punto.
"""
import sys, json
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from preparar_datos import LADO, SEMILLA


def main(ruta_split, app_dir):
    d = np.load(ruta_split, allow_pickle=False)
    Xtr = d["Xtr"].astype(np.float64) / 255.0; ytr = d["ytr"]
    Xte = d["Xte"].astype(np.float64) / 255.0; yte = d["yte"]

    m = LogisticRegression(max_iter=1000, C=0.05)
    m.fit(Xtr, ytr)
    acc = accuracy_score(yte, m.predict(Xte))

    salida = {
        "nota": "Pesos de una regresión logística (una sola capa, sin capas ocultas). "
                "Cada fila es la plantilla que el modelo aprendió para un dígito.",
        "lado": LADO,
        "accuracy_test": int(acc * 10000) / 10000,
        "plantillas": [[round(float(v), 4) for v in m.coef_[c]] for c in range(10)],
    }
    ruta = f"{app_dir}/plantillas.json"
    json.dump(salida, open(ruta, "w"), separators=(",", ":"))
    import os
    print(f"{ruta}  {os.path.getsize(ruta)} bytes  exactitud {salida['accuracy_test']}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
