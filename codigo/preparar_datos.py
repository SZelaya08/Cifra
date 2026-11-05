"""T07 - Preparacion de datos del reconocedor de digitos (28x28).

Uso: python3 -I preparar_datos.py <mnist10k.npz> <carpeta_salida>

Hace:
  1. Carga las 10,000 imagenes (uint8 0-255) y las normaliza a [0, 1].
  2. Revisa duplicados exactos.
  3. Parte train/test estratificado (80/20, semilla fija).
  4. Define el aumento por desplazamientos (solo para entrenamiento).
  5. Calcula estadisticas utiles para el preprocesado del lienzo tactil.
  6. Genera una imagen de revision visual y un resumen en JSON.

Las funciones cargar, partir, desplazar y aumentar se reutilizan en T08 y T09.
"""
import sys, json, hashlib
import numpy as np

SEMILLA = 42
LADO = 28


def cargar(ruta):
    d = np.load(ruta, allow_pickle=False)
    return d["X"].astype(np.uint8), d["y"].astype(np.int64)


def normalizar(X_uint8):
    return (X_uint8.astype(np.float32) / 255.0)


def partir(X, y, prop_test=0.2, semilla=SEMILLA):
    """Particion estratificada. Devuelve indices de train y test."""
    from sklearn.model_selection import train_test_split
    idx = np.arange(len(y))
    itr, ite = train_test_split(idx, test_size=prop_test, stratify=y, random_state=semilla)
    return np.sort(itr), np.sort(ite)


def desplazar(X, dx, dy):
    """Desplaza cada imagen dx columnas y dy filas, rellenando con 0 (fondo)."""
    n = len(X)
    im = X.reshape(n, LADO, LADO)
    out = np.zeros_like(im)
    ys = slice(max(dy, 0), LADO + min(dy, 0))
    yo = slice(max(-dy, 0), LADO + min(-dy, 0))
    xs = slice(max(dx, 0), LADO + min(dx, 0))
    xo = slice(max(-dx, 0), LADO + min(-dx, 0))
    out[:, ys, xs] = im[:, yo, xo]
    return out.reshape(n, LADO * LADO)


DESPLAZAMIENTOS = [(-1, 0), (1, 0), (0, -1), (0, 1)]


def aumentar(X, y, desplazamientos=DESPLAZAMIENTOS):
    """Imagen original + una copia por desplazamiento. Solo para entrenamiento."""
    Xs, ys = [X], [y]
    for dx, dy in desplazamientos:
        Xs.append(desplazar(X, dx, dy))
        ys.append(y)
    return np.concatenate(Xs), np.concatenate(ys)


def caja(img01, umbral=0.1):
    """Alto y ancho de la caja que encierra los pixeles con tinta."""
    m = img01.reshape(LADO, LADO) > umbral
    if not m.any():
        return 0, 0
    filas = np.where(m.any(axis=1))[0]
    cols = np.where(m.any(axis=0))[0]
    return int(filas[-1] - filas[0] + 1), int(cols[-1] - cols[0] + 1)


def centro_masa(img01):
    im = img01.reshape(LADO, LADO)
    s = im.sum()
    if s == 0:
        return (np.nan, np.nan)
    yy, xx = np.mgrid[0:LADO, 0:LADO]
    return float((yy * im).sum() / s), float((xx * im).sum() / s)


def main(ruta_npz, salida):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    X8, y = cargar(ruta_npz)
    X = normalizar(X8)
    res = {"n": int(len(y)), "forma_imagen": [LADO, LADO], "semilla": SEMILLA}
    res["rango_original"] = [int(X8.min()), int(X8.max())]
    res["rango_normalizado"] = [float(X.min()), float(X.max())]
    res["por_clase_total"] = {int(c): int((y == c).sum()) for c in range(10)}

    # 2. duplicados exactos
    hashes = [hashlib.sha1(r.tobytes()).hexdigest() for r in X8]
    res["duplicados_exactos"] = int(len(hashes) - len(set(hashes)))

    # 3. particion
    itr, ite = partir(X, y)
    res["n_train"], res["n_test"] = int(len(itr)), int(len(ite))
    res["interseccion_indices"] = int(len(set(itr) & set(ite)))
    htr = set(hashes[i] for i in itr)
    res["imagenes_test_identicas_a_train"] = int(sum(hashes[i] in htr for i in ite))
    res["por_clase_train"] = {int(c): int((y[itr] == c).sum()) for c in range(10)}
    res["por_clase_test"] = {int(c): int((y[ite] == c).sum()) for c in range(10)}
    np.savez_compressed(f"{salida}/split_28x28.npz",
                        Xtr=X8[itr], ytr=y[itr], Xte=X8[ite], yte=y[ite], idx_train=itr, idx_test=ite)

    # 4. aumento (solo se mide; no se guarda)
    Xa, ya = aumentar(X[itr], y[itr])
    res["train_con_aumento"] = int(len(ya))

    # 5. estadisticas para el preprocesado del lienzo
    tinta = (X > 0.5).sum(axis=1)
    res["pixeles_con_tinta_por_imagen"] = {"media": float(tinta.mean()), "min": int(tinta.min()), "max": int(tinta.max())}
    cajas = np.array([caja(im) for im in X])
    res["caja_alto"] = {"media": float(cajas[:, 0].mean()), "max": int(cajas[:, 0].max())}
    res["caja_ancho"] = {"media": float(cajas[:, 1].mean()), "max": int(cajas[:, 1].max())}
    lado_max = cajas.max(axis=1)
    res["lado_mayor_caja_mas_frecuente"] = int(np.bincount(lado_max).argmax())
    cm = np.array([centro_masa(im) for im in X])
    res["centro_masa_fila_media"] = float(np.nanmean(cm[:, 0]))
    res["centro_masa_col_media"] = float(np.nanmean(cm[:, 1]))
    borde = np.zeros((LADO, LADO), bool)
    borde[:2, :] = borde[-2:, :] = borde[:, :2] = borde[:, -2:] = True
    res["imagenes_con_tinta_en_borde_2px"] = int(((X.reshape(-1, LADO, LADO) > 0.1) & borde).any(axis=(1, 2)).sum())

    # 6. revision visual
    rng = np.random.default_rng(SEMILLA)
    fig = plt.figure(figsize=(13, 9))
    gs = fig.add_gridspec(2, 2, width_ratios=[1.6, 1], height_ratios=[1.35, 1], hspace=0.28, wspace=0.12)

    ax = fig.add_subplot(gs[:, 0])
    filas = []
    for c in range(10):
        ids = rng.choice(np.where(y[itr] == c)[0], 12, replace=False)
        filas.append(np.concatenate([X[itr][i].reshape(LADO, LADO) for i in ids], axis=1))
    ax.imshow(np.concatenate(filas, axis=0), cmap="gray_r")
    ax.set_title("12 muestras de entrenamiento por dígito (0 arriba, 9 abajo)", fontsize=11)
    ax.set_xticks([]); ax.set_yticks([LADO * c + LADO / 2 for c in range(10)]); ax.set_yticklabels(range(10))

    ax2 = fig.add_subplot(gs[0, 1])
    medias = np.concatenate([np.concatenate([X[y == c].mean(axis=0).reshape(LADO, LADO) for c in range(5)], axis=1),
                             np.concatenate([X[y == c].mean(axis=0).reshape(LADO, LADO) for c in range(5, 10)], axis=1)], axis=0)
    ax2.imshow(medias, cmap="gray_r")
    ax2.set_title("Imagen promedio de cada dígito (0-4 arriba, 5-9 abajo)", fontsize=11)
    ax2.set_xticks([]); ax2.set_yticks([])

    ax3 = fig.add_subplot(gs[1, 1])
    uno = X[itr][np.where(y[itr] == 7)[0][0]][None, :]
    tiras = [uno] + [desplazar(uno, dx, dy) for dx, dy in DESPLAZAMIENTOS]
    ax3.imshow(np.concatenate([t.reshape(LADO, LADO) for t in tiras], axis=1), cmap="gray_r")
    ax3.set_title("Aumento: original y 4 desplazamientos de 1 píxel", fontsize=11)
    ax3.set_xticks([LADO * k + LADO / 2 for k in range(5)])
    ax3.set_xticklabels(["original", "izq.", "der.", "arriba", "abajo"], fontsize=9); ax3.set_yticks([])
    fig.savefig(f"{salida}/t07_revision_visual.png", dpi=110, bbox_inches="tight")

    json.dump(res, open(f"{salida}/t07_resumen.json", "w"), ensure_ascii=False, indent=1)
    print(json.dumps(res, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
