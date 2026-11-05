"""T11 - Componente de matematica discreta.

Uso: python3 -I discreta.py <split_28x28.npz> <carpeta_salida>

Calcula, sobre los datos reales del proyecto:
  1. Binarizacion: la imagen como matriz booleana de 28x28.
  2. Conteo: cuantas imagenes binarias existen y que fraccion minuscula es un digito.
  3. Distancia de Hamming dentro y entre clases, y un clasificador por vecino
     mas cercano en Hamming (referencia puramente discreta, sin aprendizaje).
  4. Operaciones booleanas entre imagenes (AND, OR, XOR) y su lectura.
  5. Clases de equivalencia: la relacion "tener la misma etiqueta" es de
     equivalencia y parte el conjunto en 10 clases.
  6. Logica y perceptrones: un perceptron resuelve AND y OR pero no XOR,
     y una capa oculta de dos neuronas si lo resuelve. Se verifica numericamente.
"""
import sys, json, itertools
import numpy as np

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from preparar_datos import LADO, SEMILLA

UMBRAL = 0.5


def binarizar(X, umbral=UMBRAL):
    return (X > umbral)


def hamming(A, B):
    """Distancia de Hamming entre conjuntos de imagenes binarias (matriz n x m)."""
    A = A.astype(np.uint8); B = B.astype(np.uint8)
    # |A xor B| = |A| + |B| - 2|A and B|
    return A.sum(1)[:, None] + B.sum(1)[None, :] - 2 * (A @ B.T)


def perceptron_logico(tabla, epocas=100, tasa=0.5):
    """Entrena un perceptron de umbral sobre una funcion booleana de 2 entradas.
    Devuelve si logro separar perfectamente y los pesos encontrados."""
    X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=float)
    y = np.array(tabla, dtype=float)
    w = np.zeros(2); b = 0.0
    for _ in range(epocas):
        errores = 0
        for xi, yi in zip(X, y):
            pred = 1.0 if (w @ xi + b) > 0 else 0.0
            if pred != yi:
                w += tasa * (yi - pred) * xi
                b += tasa * (yi - pred)
                errores += 1
        if errores == 0:
            return True, w.tolist(), b
    pred = ((X @ w + b) > 0).astype(float)
    return bool((pred == y).all()), w.tolist(), float(b)


def red_xor():
    """XOR escrito a mano con una capa oculta de 2 neuronas de umbral:
    XOR(p, q) = AND( OR(p,q), NOT AND(p,q) )."""
    X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=float)
    W1 = np.array([[1.0, -1.0], [1.0, -1.0]])   # neurona 1 = OR, neurona 2 = NAND
    b1 = np.array([-0.5, 1.5])
    W2 = np.array([[1.0], [1.0]]); b2 = np.array([-1.5])
    h = ((X @ W1 + b1) > 0).astype(float)
    o = ((h @ W2 + b2) > 0).astype(float).ravel()
    return o.tolist(), h.tolist()


def main(ruta_split, salida):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    d = np.load(ruta_split, allow_pickle=False)
    Xtr = d["Xtr"].astype(np.float32) / 255.0; ytr = d["ytr"]
    Xte = d["Xte"].astype(np.float32) / 255.0; yte = d["yte"]
    Btr, Bte = binarizar(Xtr), binarizar(Xte)
    res = {"umbral_binarizacion": UMBRAL, "lado": LADO}

    # --- 1 y 2: conteo ---
    n2 = LADO * LADO
    total = 2 ** n2
    res["conteo"] = {
        "pixeles": n2,
        "imagenes_binarias_posibles_exponente": n2,
        "imagenes_binarias_posibles_digitos_decimales": len(str(total)),
        "ejemplos_menores": {"8x8": "2^64", "10x10": "2^100", "28x28": "2^784"},
        "valor_2_elevado_100": str(2 ** 100),
        "imagenes_que_tenemos": int(len(ytr) + len(yte)),
    }
    # Fraccion del espacio que ocupan nuestras imagenes: 10^4 / 2^784
    res["conteo"]["fraccion_del_espacio_log10"] = float(np.log10(10000) - n2 * np.log10(2))

    # Restriccion real: todas las imagenes caben en una caja de 20x20 y tienen
    # entre 22 y 275 pixeles encendidos. Aun asi el espacio sigue siendo inmenso.
    tinta = Btr.sum(1)
    res["conteo"]["tinta_por_imagen"] = {"min": int(tinta.min()), "max": int(tinta.max()),
                                         "media": float(tinta.mean())}

    # --- 3: distancia de Hamming ---
    rng = np.random.default_rng(SEMILLA)
    sub = rng.choice(len(ytr), 1500, replace=False)
    S, ys = Btr[sub], ytr[sub]
    D = hamming(S, S)
    iu = np.triu_indices(len(ys), k=1)
    mismo = ys[iu[0]] == ys[iu[1]]
    res["hamming"] = {
        "media_misma_clase": float(D[iu][mismo].mean()),
        "media_distinta_clase": float(D[iu][~mismo].mean()),
        "minima_distinta_clase": int(D[iu][~mismo].min()),
        "maxima_misma_clase": int(D[iu][mismo].max()),
    }
    # Matriz 10x10 de distancia media entre clases
    M = np.zeros((10, 10))
    for i in range(10):
        for j in range(10):
            a, b = S[ys == i], S[ys == j]
            Dij = hamming(a, b)
            if i == j:
                iu2 = np.triu_indices(len(a), k=1)
                M[i, j] = Dij[iu2].mean()
            else:
                M[i, j] = Dij.mean()
    res["hamming"]["matriz_media_por_clase"] = [[float(v) for v in fila] for fila in M]
    fuera = M + np.eye(10) * 1e9
    res["hamming"]["clase_mas_cercana_a_cada_una"] = {
        str(i): {"clase": int(fuera[i].argmin()), "distancia": float(fuera[i].min())} for i in range(10)}

    # Clasificador por vecino mas cercano en Hamming (sin aprendizaje)
    ite = rng.choice(len(yte), 500, replace=False)
    Dte = hamming(Bte[ite], S)
    pred_h = ys[Dte.argmin(axis=1)]
    res["vecino_mas_cercano_hamming"] = {
        "n_prueba": int(len(ite)), "n_referencia": int(len(ys)),
        "accuracy": float((pred_h == yte[ite]).mean()),
        "nota": "Referencia puramente discreta: no aprende nada, solo compara pixel a pixel.",
    }

    # --- 4: operaciones booleanas ---
    i3 = int(np.where(ytr == 3)[0][0]); i8 = int(np.where(ytr == 8)[0][0])
    A, B = Btr[i3], Btr[i8]
    res["booleanas_3_vs_8"] = {
        "pixeles_en_el_3": int(A.sum()), "pixeles_en_el_8": int(B.sum()),
        "AND_comun": int((A & B).sum()), "OR_union": int((A | B).sum()),
        "XOR_diferencia": int((A ^ B).sum()),
        "jaccard": float((A & B).sum() / (A | B).sum()),
        "nota": "XOR es exactamente la distancia de Hamming entre las dos imagenes.",
    }
    assert (A ^ B).sum() == hamming(A[None, :], B[None, :])[0, 0]

    # --- 5: clases de equivalencia ---
    res["clases_equivalencia"] = {
        "relacion": "x ~ y si x e y representan el mismo digito",
        "es_reflexiva": True, "es_simetrica": True, "es_transitiva": True,
        "numero_de_clases": 10,
        "tamanos": {str(c): int((ytr == c).sum() + (yte == c).sum()) for c in range(10)},
        "nota": "La red aprende a decidir a que clase pertenece un dibujo nuevo.",
    }

    # --- 6: logica y perceptrones ---
    funciones = {"AND": [0, 0, 0, 1], "OR": [0, 1, 1, 1], "NAND": [1, 1, 1, 0], "XOR": [0, 1, 1, 0]}
    log = {}
    for nombre, tabla in funciones.items():
        ok, w, b = perceptron_logico(tabla)
        log[nombre] = {"separable_por_un_perceptron": ok, "pesos": [round(v, 3) for v in w],
                       "sesgo": round(float(b), 3), "tabla": tabla}
    salida_xor, ocultas = red_xor()
    log["XOR_con_capa_oculta"] = {"salida": salida_xor, "esperado": funciones["XOR"],
                                  "coincide": salida_xor == [float(v) for v in funciones["XOR"]],
                                  "activaciones_ocultas": ocultas,
                                  "construccion": "XOR(p,q) = AND( OR(p,q), NAND(p,q) )"}
    # Conteo de funciones booleanas de 2 variables y cuantas son separables
    todas = list(itertools.product([0, 1], repeat=4))
    separables = [t for t in todas if perceptron_logico(list(t))[0]]
    log["conteo_funciones_2_variables"] = {
        "total": len(todas), "linealmente_separables": len(separables),
        "no_separables": len(todas) - len(separables),
        "nota": "De las 16 funciones booleanas de dos variables, XOR y su negacion no son separables.",
    }
    res["logica_perceptrones"] = log

    # --- figura ---
    fig = plt.figure(figsize=(15, 8.5))
    gs = fig.add_gridspec(2, 3, hspace=0.33, wspace=0.25)

    ax = fig.add_subplot(gs[0, 0])
    im = ax.imshow(M, cmap="viridis")
    ax.set_title("Distancia de Hamming media entre dígitos", fontsize=11)
    ax.set_xticks(range(10)); ax.set_yticks(range(10))
    for i in range(10):
        for j in range(10):
            ax.text(j, i, int(M[i, j]), ha="center", va="center", fontsize=6,
                    color="white" if M[i, j] < M.max() * .7 else "black")
    fig.colorbar(im, ax=ax, fraction=.046)

    ax = fig.add_subplot(gs[0, 1])
    ax.hist(D[iu][mismo], bins=50, alpha=.75, label="misma clase", color="#2563eb")
    ax.hist(D[iu][~mismo], bins=50, alpha=.6, label="distinta clase", color="#f97316")
    ax.set_title("Distribución de la distancia de Hamming", fontsize=11)
    ax.set_xlabel("píxeles distintos"); ax.legend(); ax.grid(alpha=.3)

    ax = fig.add_subplot(gs[0, 2])
    partes = [A.reshape(LADO, LADO), B.reshape(LADO, LADO), (A & B).reshape(LADO, LADO),
              (A | B).reshape(LADO, LADO), (A ^ B).reshape(LADO, LADO)]
    ax.imshow(np.concatenate(partes, axis=1), cmap="gray_r")
    ax.set_title("Operaciones booleanas entre un 3 y un 8", fontsize=11)
    ax.set_xticks([LADO * k + LADO / 2 for k in range(5)])
    ax.set_xticklabels(["3", "8", "AND", "OR", "XOR"], fontsize=9); ax.set_yticks([])

    ax = fig.add_subplot(gs[1, 0])
    pts = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
    for nombre, color, mk in [("AND", "#2563eb", "o"), ("XOR", "#dc2626", "s")]:
        t = funciones[nombre]
        for p, v in zip(pts, t):
            ax.scatter(*p, s=170, marker=mk, facecolor=(color if v else "white"),
                       edgecolor=color, linewidth=1.8, zorder=3)
    w, b = log["AND"]["pesos"], log["AND"]["sesgo"]
    xs = np.linspace(-.3, 1.3, 10)
    if w[1] != 0:
        ax.plot(xs, -(w[0] * xs + b) / w[1], color="#2563eb", label="recta que separa AND")
    ax.set_xlim(-.3, 1.3); ax.set_ylim(-.3, 1.3); ax.grid(alpha=.3)
    ax.set_title("AND (círculos) se separa con una recta; XOR (cuadrados) no", fontsize=10)
    ax.legend(fontsize=8)

    ax = fig.add_subplot(gs[1, 1])
    medias = [Btr[ytr == c].mean(axis=0).reshape(LADO, LADO) for c in range(10)]
    ax.imshow(np.concatenate([np.concatenate(medias[:5], axis=1),
                              np.concatenate(medias[5:], axis=1)], axis=0), cmap="magma")
    ax.set_title("Frecuencia de encendido de cada píxel por clase", fontsize=11)
    ax.set_xticks([]); ax.set_yticks([])

    ax = fig.add_subplot(gs[1, 2]); ax.axis("off")
    texto = (
        f"Espacio de imágenes binarias de 28x28:\n  2^{n2} ≈ 10^{int(n2*np.log10(2))}\n\n"
        f"Imágenes que tenemos: {len(ytr)+len(yte)}\n"
        f"Fracción del espacio: 10^{int(res['conteo']['fraccion_del_espacio_log10'])}\n\n"
        f"Hamming media misma clase: {res['hamming']['media_misma_clase']:.2f}\n"
        f"Hamming media distinta clase: {res['hamming']['media_distinta_clase']:.2f}\n\n"
        f"Vecino más cercano en Hamming: {res['vecino_mas_cercano_hamming']['accuracy']*100:.2f}%\n"
        f"(sin aprender nada)\n\n"
        f"Funciones booleanas de 2 variables: 16\n"
        f"Separables por un perceptrón: {len(separables)}\n"
        f"No separables: {16-len(separables)} (XOR y XNOR)"
    )
    ax.text(0, .98, texto, va="top", family="monospace", fontsize=10)
    fig.savefig(f"{salida}/t11_discreta.png", dpi=110, bbox_inches="tight")

    json.dump(res, open(f"{salida}/t11_discreta.json", "w"), ensure_ascii=False, indent=1)
    resumen = {k: v for k, v in res.items() if k != "hamming"}
    resumen["hamming"] = {k: v for k, v in res["hamming"].items() if k != "matriz_media_por_clase"}
    print(json.dumps(resumen, ensure_ascii=False, indent=1)[:4000])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
