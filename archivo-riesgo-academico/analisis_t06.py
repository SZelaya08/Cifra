"""T06 - Analisis comparativo preliminar (modelos sin ajustar).
Uso: python3 -I analisis_t06.py <carpeta_con_csv> <carpeta_salida> <mat|por|combinar> [principal|ablacion]
Se ejecuta por partes para que cada corrida sea corta; "combinar" une todo en analisis_t06.json.
Objetivo: y = 1 si G3 < 10. Escenario A = con G1 y G2; escenario B = sin G1 ni G2.
"""
import sys, json, warnings, site, os
sys.path.append(site.getusersitepackages())
import numpy as np, pandas as pd
from scipy.stats import spearmanr
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.model_selection import RepeatedStratifiedKFold, StratifiedShuffleSplit, cross_validate, cross_val_score, KFold
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
warnings.filterwarnings("ignore")

src, outdir, which = sys.argv[1], sys.argv[2], sys.argv[3]
part = sys.argv[4] if len(sys.argv) > 4 else "principal"
SEED = 42

def load(name):
    df = pd.read_csv(f"{src}/student-{name}.csv", sep=";")
    df["pierde"] = (df.G3 < 10).astype(int)
    return df

def pipe(cols_df, model):
    cat = cols_df.select_dtypes("object").columns.tolist()
    num = [c for c in cols_df.columns if c not in cat]
    pre = ColumnTransformer([("c", OneHotEncoder(drop="if_binary", handle_unknown="ignore"), cat),
                             ("n", StandardScaler(), num)])
    return Pipeline([("pre", pre), ("m", model)])

def models():
    return {
        "mayoritaria": DummyClassifier(strategy="most_frequent"),
        "regresion_logistica": LogisticRegression(max_iter=3000),
        "red_neuronal": MLPClassifier(hidden_layer_sizes=(16,), alpha=0.01, max_iter=1000, random_state=SEED),
    }

def feats(df, escenario):
    drop = ["G3", "pierde"] + (["G1", "G2"] if escenario == "B" else [])
    return df.drop(columns=drop)

def principal(name):
    df = load(name); y = df.pierde.values
    d = {"n": int(len(df)), "n_pierde": int(y.sum()), "n_aprueba": int((1 - y).sum()),
         "prop_pierde": float(y.mean()), "n_g3_cero": int((df.G3 == 0).sum())}
    cv = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=SEED)
    scoring = {"accuracy": "accuracy", "recall": "recall", "precision": "precision", "f1": "f1", "auc": "roc_auc"}
    d["modelos"] = {}
    for esc in ["A", "B"]:
        X = feats(df, esc); d["modelos"][esc] = {}
        for mname, m in models().items():
            r = cross_validate(pipe(X, m), X, y, cv=cv, scoring=scoring)
            d["modelos"][esc][mname] = {k: {"media": float(np.mean(r["test_" + k])), "desv": float(np.std(r["test_" + k]))} for k in scoring}
    # Estudiantes con G3 = 0
    grupos = {"cero (G3=0)": df[df.G3 == 0], "pierde sin cero (0<G3<10)": df[(df.G3 > 0) & (df.G3 < 10)], "aprueba (G3>=10)": df[df.G3 >= 10]}
    d["ceros"] = {}
    for g, s in grupos.items():
        d["ceros"][g] = {"n": int(len(s)), "abs_media": float(s.absences.mean()), "abs_mediana": float(s.absences.median()),
                         "prop_abs_cero": float((s.absences == 0).mean()), "failures_media": float(s.failures.mean()),
                         "G1_media": float(s.G1.mean()), "G2_media": float(s.G2.mean()),
                         "n_G2_cero": int((s.G2 == 0).sum()), "n_G1_cero": int((s.G1 == 0).sum())}
    # Importancia por permutacion (caida de AUC)
    d["importancia_perm"] = {}
    for esc in ["A", "B"]:
        X = feats(df, esc); acc = {c: [] for c in X.columns}
        sss = StratifiedShuffleSplit(n_splits=4, test_size=0.25, random_state=SEED)
        for tr, te in sss.split(X, y):
            p = pipe(X, models()["red_neuronal"]).fit(X.iloc[tr], y[tr])
            pi = permutation_importance(p, X.iloc[te], y[te], scoring="roc_auc", n_repeats=8, random_state=SEED)
            for c, v in zip(X.columns, pi.importances_mean): acc[c].append(float(v))
        d["importancia_perm"][esc] = {c: {"media": float(np.mean(v)), "desv": float(np.std(v))} for c, v in acc.items()}
    # Sustentacion matematica G1/G2
    s = {"corr_G3_G1": float(df.G3.corr(df.G1)), "corr_G3_G2": float(df.G3.corr(df.G2)), "corr_G1_G2": float(df.G1.corr(df.G2))}
    kf = KFold(5, shuffle=True, random_state=SEED)
    oh = pd.get_dummies(df.drop(columns=["G1", "G2", "G3", "pierde"]), drop_first=True).astype(float)
    sets = {"solo_G2": df[["G2"]], "G1_y_G2": df[["G1", "G2"]], "sin_G1_G2 (30 variables)": oh,
            "todas (32 variables)": pd.concat([oh, df[["G1", "G2"]]], axis=1)}
    s["r2_cv_G3"] = {k: float(np.mean(cross_val_score(LinearRegression(), v, df.G3, cv=kf, scoring="r2"))) for k, v in sets.items()}
    rule = (df.G2 < 10).astype(int)
    s["regla_G2_menor_10"] = {"accuracy": float((rule == y).mean()), "recall": float(((rule == 1) & (y == 1)).sum() / y.sum()),
                              "precision": float(((rule == 1) & (y == 1)).sum() / max(rule.sum(), 1))}
    pa = d["importancia_perm"]["A"]; tot = sum(max(v["media"], 0) for v in pa.values())
    s["peso_G1_G2_en_importancia_A"] = float(sum(max(pa[c]["media"], 0) for c in ["G1", "G2"]) / tot) if tot > 0 else None
    d["sustentacion_G1G2"] = s
    return d

def ablacion(name):
    df = load(name); y = df.pierde.values
    X = feats(df, "B"); cv2 = RepeatedStratifiedKFold(n_splits=5, n_repeats=1, random_state=SEED)
    f = lambda Z: float(np.mean(cross_val_score(pipe(Z, models()["red_neuronal"]), Z, y, cv=cv2, scoring="roc_auc")))
    base = f(X)
    return {"auc_base": base, "caida": {c: base - f(X.drop(columns=[c])) for c in X.columns}}

os.makedirs(outdir, exist_ok=True)
if which in ("mat", "por"):
    out = principal(which) if part == "principal" else ablacion(which)
    json.dump(out, open(f"{outdir}/parcial_{which}_{part}.json", "w"), ensure_ascii=False, indent=1)
    print("OK", which, part)
else:
    res = {"meta": {"semilla": SEED, "cv": "5-fold estratificado x 3 repeticiones (ablacion: 5-fold x 1)",
                    "red": "MLP 1 capa oculta de 16 neuronas, alpha=0.01 (sin ajustar; se ajusta en T09)",
                    "objetivo": "pierde = G3 < 10"}}
    for n in ["mat", "por"]:
        res[n] = json.load(open(f"{outdir}/parcial_{n}_principal.json"))
        res[n]["ablacion_B"] = json.load(open(f"{outdir}/parcial_{n}_ablacion.json"))
    cm = res["mat"]["importancia_perm"]["B"]; cp = res["por"]["importancia_perm"]["B"]
    cols = list(cm.keys()); rho = spearmanr([cm[c]["media"] for c in cols], [cp[c]["media"] for c in cols])
    top = lambda dct: [k for k, _ in sorted(dct.items(), key=lambda kv: -kv[1]["media"])[:5]]
    res["coincidencia_B"] = {"spearman_rho": float(rho.statistic), "p_valor": float(rho.pvalue),
                             "top5_mat": top(cm), "top5_por": top(cp), "top5_comunes": sorted(set(top(cm)) & set(top(cp)))}
    json.dump(res, open(f"{outdir}/analisis_t06.json", "w"), ensure_ascii=False, indent=1)
    print("OK combinado")
