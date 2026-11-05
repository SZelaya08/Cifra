"""T08-T10 - Modelo base, red neuronal, comparacion de arquitecturas y evaluacion.

Uso: python3 -I entrenar.py <split_28x28.npz> <carpeta_salida>

T08  Modelo base: regresion logistica multinomial (referencia a superar).
T09  Red neuronal: compara arquitecturas y ajusta la mejor.
T10  Evaluacion: matriz de confusion, errores tipicos, curvas, calibracion.
Exporta ademas pesos.json para la app web (T12).
"""
import sys, json, time
import numpy as np

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from preparar_datos import aumentar, LADO, SEMILLA

from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.dummy import DummyClassifier
from sklearn.metrics import confusion_matrix, classification_report, accuracy_score
from sklearn.model_selection import train_test_split

np.random.seed(SEMILLA)


def cargar_split(ruta):
    d = np.load(ruta, allow_pickle=False)
    return (d["Xtr"].astype(np.float32) / 255.0, d["ytr"],
            d["Xte"].astype(np.float32) / 255.0, d["yte"])


def truncar(x, dec=4):
    f = 10 ** dec
    return int(x * f) / f


def main(ruta_split, salida):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    Xtr, ytr, Xte, yte = cargar_split(ruta_split)
    Xa, ya = aumentar(Xtr, ytr)          # 8,000 -> 40,000 (solo entrenamiento)
    res = {"semilla": SEMILLA, "n_train": int(len(ytr)), "n_train_aumentado": int(len(ya)),
           "n_test": int(len(yte))}

    # ---------- T08: referencias ----------
    print("== T08 referencias ==", flush=True)
    dummy = DummyClassifier(strategy="most_frequent").fit(Xtr, ytr)
    base_mayoritaria = accuracy_score(yte, dummy.predict(Xte))

    t = time.time()
    logreg = LogisticRegression(max_iter=1000, C=0.05)
    logreg.fit(Xtr, ytr)
    acc_lr = accuracy_score(yte, logreg.predict(Xte))
    res["base"] = {"mayoritaria": truncar(base_mayoritaria),
                   "regresion_logistica": truncar(acc_lr),
                   "segundos_regresion": truncar(time.time() - t, 1)}
    print("  mayoritaria", truncar(base_mayoritaria), " logistica", truncar(acc_lr), flush=True)

    # ---------- T09: comparacion de arquitecturas ----------
    # Se compara sobre una particion de validacion sacada del entrenamiento,
    # para no elegir la arquitectura mirando el conjunto de prueba.
    print("== T09 arquitecturas (validacion) ==", flush=True)
    itr, iva = train_test_split(np.arange(len(ytr)), test_size=0.2, stratify=ytr, random_state=SEMILLA)
    Xsub, ysub = aumentar(Xtr[itr], ytr[itr])
    Xva, yva = Xtr[iva], ytr[iva]

    arquitecturas = [(16,), (24,), (32,), (64,), (16, 16), (32, 16)]
    comp = []
    for h in arquitecturas:
        t = time.time()
        m = MLPClassifier(hidden_layer_sizes=h, alpha=1e-4, batch_size=128,
                          learning_rate_init=0.003, max_iter=60, random_state=SEMILLA)
        m.fit(Xsub, ysub)
        a = accuracy_score(yva, m.predict(Xva))
        n_par = sum(w.size for w in m.coefs_) + sum(b.size for b in m.intercepts_)
        comp.append({"capas": list(h), "val_accuracy": truncar(a), "parametros": int(n_par),
                     "segundos": truncar(time.time() - t, 1)})
        print("  ", h, truncar(a), n_par, flush=True)
    res["comparacion_arquitecturas"] = comp
    mejor = max(comp, key=lambda c: c["val_accuracy"])
    res["arquitectura_elegida"] = mejor

    # ---------- T09: ajuste de la mejor arquitectura ----------
    print("== T09 ajuste (validacion) ==", flush=True)
    h = tuple(mejor["capas"])
    rejilla = []
    for alpha in [1e-5, 1e-4, 1e-3]:
        for lr in [0.001, 0.003]:
            m = MLPClassifier(hidden_layer_sizes=h, alpha=alpha, batch_size=128,
                              learning_rate_init=lr, max_iter=60, random_state=SEMILLA)
            m.fit(Xsub, ysub)
            a = accuracy_score(yva, m.predict(Xva))
            rejilla.append({"alpha": alpha, "learning_rate_init": lr, "val_accuracy": truncar(a)})
            print("   alpha", alpha, "lr", lr, truncar(a), flush=True)
    res["rejilla"] = rejilla
    best = max(rejilla, key=lambda r: r["val_accuracy"])
    res["hiperparametros"] = best

    # ---------- Modelo final: todo el entrenamiento aumentado ----------
    print("== Modelo final ==", flush=True)
    t = time.time()
    final = MLPClassifier(hidden_layer_sizes=h, alpha=best["alpha"], batch_size=128,
                          learning_rate_init=best["learning_rate_init"], max_iter=200,
                          n_iter_no_change=12, random_state=SEMILLA, verbose=False)
    final.fit(Xa, ya)
    res["entrenamiento_final"] = {"iteraciones": int(final.n_iter_),
                                  "segundos": truncar(time.time() - t, 1),
                                  "perdida_final": truncar(final.loss_, 6)}

    # ---------- T10: evaluacion ----------
    pred = final.predict(Xte)
    proba = final.predict_proba(Xte)
    acc = accuracy_score(yte, pred)
    res["test"] = {"accuracy": truncar(acc),
                   "accuracy_entrenamiento": truncar(accuracy_score(ya, final.predict(Xa)))}
    cm = confusion_matrix(yte, pred)
    res["matriz_confusion"] = cm.tolist()
    rep = classification_report(yte, pred, output_dict=True, zero_division=0)
    res["por_clase"] = {str(c): {"precision": truncar(rep[str(c)]["precision"]),
                                 "recall": truncar(rep[str(c)]["recall"]),
                                 "f1": truncar(rep[str(c)]["f1-score"]),
                                 "n": int(rep[str(c)]["support"])} for c in range(10)}
    pares = []
    for i in range(10):
        for j in range(10):
            if i != j and cm[i, j] > 0:
                pares.append({"real": i, "predicho": j, "casos": int(cm[i, j])})
    pares.sort(key=lambda p: -p["casos"])
    res["pares_mas_confundidos"] = pares[:8]

    # Calibracion: con cada umbral, que fraccion se acepta y que exactitud tiene
    conf = proba.max(axis=1)
    cal = []
    for u in [0.5, 0.6, 0.7, 0.8, 0.9, 0.95]:
        sel = conf >= u
        cal.append({"umbral": u, "fraccion_aceptada": truncar(float(sel.mean())),
                    "accuracy_de_aceptadas": truncar(float(accuracy_score(yte[sel], pred[sel]))) if sel.any() else None})
    res["calibracion"] = cal

    # Exactitud por numero de cifras (modo tienda): probabilidad de leer bien k digitos seguidos
    res["lectura_de_k_cifras"] = {str(k): truncar(float(acc ** k)) for k in [1, 2, 3, 4, 5]}

    # ---------- T12: exportar pesos ----------
    pesos = {
        "formato": "mlp-densa",
        "lado": LADO,
        "entrada": int(final.coefs_[0].shape[0]),
        "capas": [int(c.shape[1]) for c in final.coefs_],
        "activacion_oculta": "relu",
        "activacion_salida": "softmax",
        "clases": [int(c) for c in final.classes_],
        "etiquetas": [str(c) for c in final.classes_],
        "accuracy_test": truncar(acc),
        "W": [[[round(float(v), 5) for v in fila] for fila in c] for c in final.coefs_],
        "b": [[round(float(v), 5) for v in bb] for bb in final.intercepts_],
    }
    json.dump(pesos, open(f"{salida}/pesos.json", "w"), separators=(",", ":"))

    # Casos de prueba para validar la version en JavaScript
    rng = np.random.default_rng(SEMILLA)
    ids = rng.choice(len(yte), 12, replace=False)
    casos = [{"entrada": [round(float(v), 5) for v in Xte[i]],
              "esperado_salida": [round(float(v), 8) for v in proba[i]],
              "etiqueta_real": int(yte[i])} for i in ids]
    json.dump(casos, open(f"{salida}/casos_prueba.json", "w"), separators=(",", ":"))

    # ---------- Figuras ----------
    fig, axs = plt.subplots(1, 3, figsize=(16, 4.6))
    axs[0].plot(final.loss_curve_, color="#2563eb")
    axs[0].set_title("Curva de pérdida del entrenamiento"); axs[0].set_xlabel("iteración"); axs[0].set_ylabel("pérdida")
    axs[0].grid(alpha=.3)
    im = axs[1].imshow(cm, cmap="Blues")
    axs[1].set_title(f"Matriz de confusión (exactitud {truncar(acc*100, 2)}%)")
    axs[1].set_xlabel("predicho"); axs[1].set_ylabel("real")
    axs[1].set_xticks(range(10)); axs[1].set_yticks(range(10))
    for i in range(10):
        for j in range(10):
            if cm[i, j]:
                axs[1].text(j, i, cm[i, j], ha="center", va="center", fontsize=7,
                            color="white" if cm[i, j] > cm.max() / 2 else "#1e3a8a")
    etiquetas = [str(c["capas"]) for c in comp]
    axs[2].barh(etiquetas, [c["val_accuracy"] for c in comp], color="#94a3b8")
    axs[2].barh([str(mejor["capas"])], [mejor["val_accuracy"]], color="#2563eb")
    axs[2].set_xlim(0.9, 1.0); axs[2].set_title("Exactitud en validación por arquitectura")
    axs[2].grid(alpha=.3, axis="x")
    fig.tight_layout(); fig.savefig(f"{salida}/t09_t10_resultados.png", dpi=110)

    # Lo que responde cada neurona de la primera capa oculta
    W0 = final.coefs_[0]
    n = min(W0.shape[1], 32)
    cols = 8; filas = int(np.ceil(n / cols))
    fig2, axs2 = plt.subplots(filas, cols, figsize=(cols * 1.25, filas * 1.35))
    lim = float(np.abs(W0).max())
    for k, ax in enumerate(np.array(axs2).ravel()):
        if k < n:
            ax.imshow(W0[:, k].reshape(LADO, LADO), cmap="RdBu_r", vmin=-lim, vmax=lim)
            ax.set_title(f"n{k}", fontsize=8)
        ax.axis("off")
    fig2.suptitle("Pesos de cada neurona oculta (rojo suma, azul resta)", fontsize=11)
    fig2.tight_layout(); fig2.savefig(f"{salida}/t09_neuronas.png", dpi=110)

    # Errores: que dibujos falla
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

    json.dump(res, open(f"{salida}/t08_t10_resumen.json", "w"), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in res.items() if k not in ("matriz_confusion", "rejilla")},
                     ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
