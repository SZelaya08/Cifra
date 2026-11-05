"""T12 - Exporta los pesos en formato compacto para la app web y comprueba
que redondear no cambia las predicciones.

Uso: python3 -I exportar.py <split_28x28.npz> <carpeta_resultados> <carpeta_app>

Formato de pesos.json:
  capas: [n_entrada, n1, n2, ..., n_salida]
  W[k]: lista plana de n_k * n_{k+1} numeros, en orden fila por fila
        (fila i = pesos que salen de la neurona i de la capa k)
  b[k]: lista de n_{k+1} numeros
"""
import sys, json
import numpy as np

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from preparar_datos import LADO, SEMILLA

DECIMALES = 4


def relu(x):
    return np.maximum(x, 0.0)


def softmax(x):
    e = np.exp(x - x.max(axis=-1, keepdims=True))
    return e / e.sum(axis=-1, keepdims=True)


def adelante(X, Ws, bs):
    a = X
    for k in range(len(Ws)):
        z = a @ Ws[k] + bs[k]
        a = softmax(z) if k == len(Ws) - 1 else relu(z)
    return a


def truncar(x, dec=4):
    f = 10 ** dec
    return int(x * f) / f


def main(ruta_split, res_dir, app_dir):
    p = json.load(open(f"{res_dir}/pesos.json"))
    Ws = [np.array(w, dtype=np.float64) for w in p["W"]]
    bs = [np.array(b, dtype=np.float64) for b in p["b"]]

    d = np.load(ruta_split, allow_pickle=False)
    Xte = d["Xte"].astype(np.float64) / 255.0; yte = d["yte"]

    pred_completo = adelante(Xte, Ws, bs).argmax(1)
    acc_completo = float((pred_completo == yte).mean())

    Wr = [np.round(w, DECIMALES) for w in Ws]
    br = [np.round(b, DECIMALES) for b in bs]
    prob_r = adelante(Xte, Wr, br)
    pred_r = prob_r.argmax(1)
    acc_r = float((pred_r == yte).mean())

    informe = {
        "decimales": DECIMALES,
        "accuracy_pesos_completos": truncar(acc_completo),
        "accuracy_pesos_redondeados": truncar(acc_r),
        "predicciones_que_cambian": int((pred_completo != pred_r).sum()),
        "diferencia_maxima_de_probabilidad": truncar(float(np.abs(
            adelante(Xte, Ws, bs) - prob_r).max()), 8),
    }

    compacto = {
        "formato": "mlp-densa-plana",
        "lado": LADO,
        "capas": [int(Ws[0].shape[0])] + [int(w.shape[1]) for w in Ws],
        "activacion_oculta": "relu",
        "activacion_salida": "softmax",
        "etiquetas": p["etiquetas"],
        "accuracy_test": truncar(acc_r),
        "decimales": DECIMALES,
        "curva_perdida": p.get("curva_perdida", []),
        "W": [[float(v) for v in w.ravel()] for w in Wr],
        "b": [[float(v) for v in b] for b in br],
    }
    ruta = f"{app_dir}/pesos.json"
    json.dump(compacto, open(ruta, "w"), separators=(",", ":"))
    import os
    informe["bytes_pesos_json"] = os.path.getsize(ruta)

    # Casos de prueba con el formato que usara la version en JavaScript
    rng = np.random.default_rng(SEMILLA)
    ids = rng.choice(len(yte), 20, replace=False)
    casos = {"nota": "Salidas calculadas en Python con los pesos redondeados.",
             "casos": [{"entrada": [round(float(v), 5) for v in Xte[i]],
                        "salida": [round(float(v), 10) for v in prob_r[i]],
                        "etiqueta_real": int(yte[i])} for i in ids]}
    json.dump(casos, open(f"{res_dir}/casos_prueba.json", "w"), separators=(",", ":"))

    json.dump(informe, open(f"{res_dir}/t12_exportacion.json", "w"), ensure_ascii=False, indent=1)
    print(json.dumps(informe, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
