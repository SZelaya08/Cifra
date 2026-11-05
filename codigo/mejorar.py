"""T09b - Intento de mejora: aumento mas fuerte y arquitecturas mas grandes.

Uso: python3 -I mejorar.py <split_28x28.npz> <carpeta_salida>

El aumento del T07 solo desplazaba 1 pixel. Aqui se agregan rotaciones
pequenas y cambios de escala, que es lo que de verdad varia cuando una
persona dibuja con el dedo. Si el resultado supera al modelo anterior en
validacion, se reemplazan pesos.json y las figuras.
"""
import sys, json, time
import numpy as np
from scipy import ndimage

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from preparar_datos import LADO, SEMILLA, desplazar

from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
from sklearn.model_selection import train_test_split

rng = np.random.default_rng(SEMILLA)


def transformar(X, angulo, escala, dx, dy):
    """Rota, escala y desplaza cada imagen alrededor de su centro."""
    n = len(X)
    im = X.reshape(n, LADO, LADO)
    c = (LADO - 1) / 2.0
    th = np.deg2rad(angulo)
    # matriz inversa (ndimage mapea salida -> entrada)
    R = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]]) / escala
    off = np.array([c, c]) - R @ np.array([c + dy, c + dx])
    out = np.empty_like(im)
    for k in range(n):
        out[k] = ndimage.affine_transform(im[k], R, offset=off, order=1, mode="constant", cval=0.0)
    return np.clip(out.reshape(n, LADO * LADO), 0, 1)


def aumentar_fuerte(X, y, copias=4):
    """Original + copias con rotacion, escala y desplazamiento al azar,
    mas los 4 desplazamientos de 1 pixel del T07."""
    Xs, ys = [X, desplazar(X, -1, 0), desplazar(X, 1, 0), desplazar(X, 0, -1), desplazar(X, 0, 1)], [y] * 5
    for _ in range(copias):
        ang = float(rng.uniform(-12, 12))
        esc = float(rng.uniform(0.9, 1.1))
        dx = int(rng.integers(-2, 3)); dy = int(rng.integers(-2, 3))
        Xs.append(transformar(X, ang, esc, dx, dy)); ys.append(y)
    return np.concatenate(Xs).astype(np.float32), np.concatenate(ys)


def truncar(x, dec=4):
    f = 10 ** dec
    return int(x * f) / f


def main(ruta_split, salida):
    d = np.load(ruta_split, allow_pickle=False)
    Xtr = d["Xtr"].astype(np.float32) / 255.0; ytr = d["ytr"]
    Xte = d["Xte"].astype(np.float32) / 255.0; yte = d["yte"]

    itr, iva = train_test_split(np.arange(len(ytr)), test_size=0.2, stratify=ytr, random_state=SEMILLA)
    Xva, yva = Xtr[iva], ytr[iva]
    print("aumentando...", flush=True)
    t = time.time()
    Xsub, ysub = aumentar_fuerte(Xtr[itr], ytr[itr])
    print("  ", Xsub.shape, truncar(time.time() - t, 1), "s", flush=True)

    res = {"aumento": "4 desplazamientos de 1 pixel + 4 copias con rotacion (-12 a 12 grados), "
                      "escala (0.9 a 1.1) y desplazamiento (-2 a 2 pixeles)",
           "n_entrenamiento_aumentado_validacion": int(len(ysub))}
    comp = []
    for h in [(32, 16), (64, 32), (96, 32), (128, 48)]:
        t = time.time()
        m = MLPClassifier(hidden_layer_sizes=h, alpha=1e-5, batch_size=256,
                          learning_rate_init=0.003, max_iter=45, random_state=SEMILLA)
        m.fit(Xsub, ysub)
        a = accuracy_score(yva, m.predict(Xva))
        comp.append({"capas": list(h), "val_accuracy": truncar(a),
                     "parametros": int(sum(w.size for w in m.coefs_) + sum(b.size for b in m.intercepts_)),
                     "segundos": truncar(time.time() - t, 1)})
        print("  ", h, truncar(a), flush=True)
    res["comparacion"] = comp
    mejor = max(comp, key=lambda c: c["val_accuracy"])
    res["arquitectura_elegida"] = mejor
    h = tuple(mejor["capas"])

    print("final...", flush=True)
    Xa, ya = aumentar_fuerte(Xtr, ytr)
    res["n_entrenamiento_final"] = int(len(ya))
    t = time.time()
    final = MLPClassifier(hidden_layer_sizes=h, alpha=1e-5, batch_size=256,
                          learning_rate_init=0.003, max_iter=120, n_iter_no_change=10,
                          random_state=SEMILLA)
    final.fit(Xa, ya)
    pred = final.predict(Xte); proba = final.predict_proba(Xte)
    acc = accuracy_score(yte, pred)
    res["entrenamiento_final"] = {"iteraciones": int(final.n_iter_), "segundos": truncar(time.time() - t, 1),
                                  "perdida_final": truncar(final.loss_, 6)}
    res["test"] = {"accuracy": truncar(acc),
                   "accuracy_entrenamiento": truncar(accuracy_score(ya, final.predict(Xa)))}
    cm = confusion_matrix(yte, pred)
    res["matriz_confusion"] = cm.tolist()
    rep = classification_report(yte, pred, output_dict=True, zero_division=0)
    res["por_clase"] = {str(c): {"precision": truncar(rep[str(c)]["precision"]),
                                 "recall": truncar(rep[str(c)]["recall"]),
                                 "f1": truncar(rep[str(c)]["f1-score"]),
                                 "n": int(rep[str(c)]["support"])} for c in range(10)}
    pares = [{"real": i, "predicho": j, "casos": int(cm[i, j])}
             for i in range(10) for j in range(10) if i != j and cm[i, j] > 0]
    pares.sort(key=lambda p: -p["casos"])
    res["pares_mas_confundidos"] = pares[:8]
    conf = proba.max(axis=1)
    res["calibracion"] = [{"umbral": u, "fraccion_aceptada": truncar(float((conf >= u).mean())),
                           "accuracy_de_aceptadas": truncar(float(accuracy_score(yte[conf >= u], pred[conf >= u])))}
                          for u in [0.5, 0.6, 0.7, 0.8, 0.9, 0.95]]
    res["lectura_de_k_cifras"] = {str(k): truncar(float(acc ** k)) for k in [1, 2, 3, 4, 5]}
    res["curva_perdida"] = [truncar(v, 6) for v in final.loss_curve_]

    anterior = json.load(open(f"{salida}/t08_t10_resumen.json"))["test"]["accuracy"]
    res["accuracy_anterior"] = anterior
    res["mejora"] = truncar(acc - anterior)
    print("anterior", anterior, "nuevo", truncar(acc), flush=True)

    if acc > anterior:
        pesos = {"formato": "mlp-densa", "lado": LADO, "entrada": int(final.coefs_[0].shape[0]),
                 "capas": [int(c.shape[1]) for c in final.coefs_],
                 "activacion_oculta": "relu", "activacion_salida": "softmax",
                 "clases": [int(c) for c in final.classes_],
                 "etiquetas": [str(c) for c in final.classes_],
                 "accuracy_test": truncar(acc),
                 "curva_perdida": [truncar(v, 5) for v in final.loss_curve_],
                 "W": [[[round(float(v), 5) for v in fila] for fila in c] for c in final.coefs_],
                 "b": [[round(float(v), 5) for v in bb] for bb in final.intercepts_]}
        json.dump(pesos, open(f"{salida}/pesos.json", "w"), separators=(",", ":"))
        ids = rng.choice(len(yte), 12, replace=False)
        casos = [{"entrada": [round(float(v), 5) for v in Xte[i]],
                  "esperado_salida": [round(float(v), 8) for v in proba[i]],
                  "etiqueta_real": int(yte[i])} for i in ids]
        json.dump(casos, open(f"{salida}/casos_prueba.json", "w"), separators=(",", ":"))
        res["pesos_reemplazados"] = True

        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        fig, axs = plt.subplots(1, 3, figsize=(16, 4.6))
        axs[0].plot(final.loss_curve_, color="#2563eb")
        axs[0].set_title("Curva de pérdida del entrenamiento"); axs[0].set_xlabel("iteración")
        axs[0].set_ylabel("pérdida"); axs[0].grid(alpha=.3)
        axs[1].imshow(cm, cmap="Blues")
        axs[1].set_title(f"Matriz de confusión (exactitud {truncar(acc*100, 2)}%)")
        axs[1].set_xlabel("predicho"); axs[1].set_ylabel("real")
        axs[1].set_xticks(range(10)); axs[1].set_yticks(range(10))
        for i in range(10):
            for j in range(10):
                if cm[i, j]:
                    axs[1].text(j, i, cm[i, j], ha="center", va="center", fontsize=7,
                                color="white" if cm[i, j] > cm.max() / 2 else "#1e3a8a")
        et = [str(c["capas"]) for c in comp]
        axs[2].barh(et, [c["val_accuracy"] for c in comp], color="#94a3b8")
        axs[2].barh([str(mejor["capas"])], [mejor["val_accuracy"]], color="#2563eb")
        axs[2].set_xlim(0.93, 1.0); axs[2].set_title("Exactitud en validación por arquitectura")
        axs[2].grid(alpha=.3, axis="x")
        fig.tight_layout(); fig.savefig(f"{salida}/t09_t10_resultados.png", dpi=110)

        W0 = final.coefs_[0]; n = min(W0.shape[1], 32); cols = 8
        filas = int(np.ceil(n / cols))
        fig2, axs2 = plt.subplots(filas, cols, figsize=(cols * 1.25, filas * 1.35))
        lim = float(np.abs(W0).max())
        for k, ax in enumerate(np.array(axs2).ravel()):
            if k < n:
                ax.imshow(W0[:, k].reshape(LADO, LADO), cmap="RdBu_r", vmin=-lim, vmax=lim)
                ax.set_title(f"n{k}", fontsize=8)
            ax.axis("off")
        fig2.suptitle("Pesos de las primeras 32 neuronas ocultas (rojo suma, azul resta)", fontsize=11)
        fig2.tight_layout(); fig2.savefig(f"{salida}/t09_neuronas.png", dpi=110)

        err = np.where(pred != yte)[0][:24]
        if len(err):
            fig3, axs3 = plt.subplots(3, 8, figsize=(12, 5))
            for k, ax in enumerate(np.array(axs3).ravel()):
                if k < len(err):
                    i = err[k]
                    ax.imshow(Xte[i].reshape(LADO, LADO), cmap="gray_r")
                    ax.set_title(f"real {yte[i]} → {pred[i]}", fontsize=8)
                ax.axis("off")
            fig3.suptitle("Dibujos que la red clasifica mal", fontsize=11)
            fig3.tight_layout(); fig3.savefig(f"{salida}/t10_errores.png", dpi=110)
    else:
        res["pesos_reemplazados"] = False

    json.dump(res, open(f"{salida}/t09b_mejora.json", "w"), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in res.items() if k not in ("matriz_confusion", "curva_perdida")},
                     ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
