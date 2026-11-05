"""T17 - Genera el mosaico de imagenes de referencia (anclas) para el ajuste fino.

Uso: python3 -I anclas.py <split_28x28.npz> <carpeta_app>

Cuando la persona reentrena la red con sus propios dibujos, si solo se usaran
esos dibujos la red olvidaria lo aprendido (olvido catastrofico). Para evitarlo
la app mezcla cada lote con imagenes de referencia del conjunto de entrenamiento.
Se guardan como un mosaico PNG en escala de grises: 30 imagenes por digito,
una fila por digito, que la app lee con un canvas. Pesa mucho menos que un JSON.
"""
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from preparar_datos import LADO, SEMILLA

POR_CLASE = 30


def main(ruta_split, app_dir):
    d = np.load(ruta_split, allow_pickle=False)
    X = d["Xtr"]; y = d["ytr"]
    rng = np.random.default_rng(SEMILLA)
    filas = []
    for c in range(10):
        idx = np.where(y == c)[0]
        elegidos = rng.choice(idx, POR_CLASE, replace=False)
        filas.append(np.concatenate([X[i].reshape(LADO, LADO) for i in elegidos], axis=1))
    mosaico = np.concatenate(filas, axis=0).astype(np.uint8)
    img = Image.fromarray(mosaico, mode="L")
    ruta = f"{app_dir}/anclas.png"
    img.save(ruta, optimize=True)
    import os
    print(f"{ruta}  {mosaico.shape}  {os.path.getsize(ruta)} bytes  "
          f"({POR_CLASE} por dígito, fila = dígito)")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
