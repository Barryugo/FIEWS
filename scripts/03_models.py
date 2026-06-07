"""
FIEWS — Script 03: Modelling Pipeline
======================================
Models trained for two forecast horizons:
  - 3-month ahead  (target_3m)
  - 6-month ahead  (target_6m)

Models:
  1. ARIMA          — classical time-series benchmark
  2. Ridge          — linear with regularisation
  3. Random Forest  — nonlinear ensemble
  4. Gradient Boost — strongest ML model

Outputs:
  - outputs/models/model_comparison.png   — MAE/RMSE bar chart
  - outputs/models/forecast_vs_actual.png — walk-forward predictions
  - outputs/models/feature_importance.png — RF + GBM top features
  - outputs/models/risk_scores.png        — probability of High-risk event
  - outputs/models/results_summary.csv    — numeric scores
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import warnings
warnings.filterwarnings("ignore")

from pathlib import Path
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error, mean_squared_error

# ── Paths ──────────────────────────────────────────────────────────────────
ROOT      = Path(__file__).resolve().parent.parent
PANEL     = ROOT / "data" / "processed" / "fiews_panel.csv"
OUT_MOD   = ROOT / "outputs" / "models"
OUT_MOD.mkdir(parents=True, exist_ok=True)

# ── Style ──────────────────────────────────────────────────────────────────
BG      = "#0D1117"
SURFACE = "#161B22"
BORDER  = "#30363D"
TEXT    = "#E6EDF3"
SUBTEXT = "#8B949E"
AMBER   = "#F0A500"
BLUE    = "#58A6FF"
GREEN   = "#3FB950"
RED     = "#F85149"
YELLOW  = "#D29922"

plt.rcParams.update({
    "figure.facecolor": BG, "axes.facecolor": SURFACE,
    "axes.edgecolor": BORDER, "axes.labelcolor": TEXT,
    "axes.titlecolor": TEXT, "xtick.color": SUBTEXT,
    "ytick.color": SUBTEXT, "text.color": TEXT,
    "grid.color": BORDER, "grid.linewidth": 0.6,
    "font.family": "monospace", "legend.facecolor": SURFACE,
    "legend.edgecolor": BORDER, "legend.labelcolor": TEXT,
})

def save(fig, name):
    path = OUT_MOD / name
    fig.savefig(path, dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close(fig)
    print(f"  ✓  {name}")

# ── Load ───────────────────────────────────────────────────────────────────
df = pd.read_csv(PANEL, parse_dates=["date"], index_col="date")
print(f"Panel: {len(df)} rows | {df.index.min().date()} → {df.index.max().date()}")

# ── Feature set ────────────────────────────────────────────────────────────
FEATURES = [
    "food_cpi_lag1", "food_cpi_lag3", "food_cpi_lag6", "food_cpi_lag12",
    "food_cpi_mom",
    "fx_official", "fx_chg_3m", "fx_chg_6m", "fx_depreciation_flag",
    "pms_price", "diesel_price", "fuel_shock_3m", "diesel_shock_3m", "fuel_shock_flag",
    "fao_food_index", "cereals", "oils",
    "global_food_shock_3m", "cereals_shock_3m", "oils_shock_3m",
    "rainfall_anomaly", "drought_flag",
    "month", "quarter", "planting_season", "harvest_season", "ramadan_flag",
]

available = [f for f in FEATURES if f in df.columns]

# ── Prepare datasets for each horizon ─────────────────────────────────────
def make_xy(target_col):
    subset = df[available + [target_col]].dropna()
    X = subset[available].values
    y = subset[target_col].values
    idx = subset.index
    return X, y, idx

# ── ARIMA (manual AR model using lag features only) ────────────────────────
# No statsmodels available — implement a clean AR(p) via Ridge on lag features

def arima_proxy(y_train, y_test, p=6):
    """AR(p) implemented as Ridge regression on lags."""
    def make_lags(series, p):
        rows = []
        for i in range(p, len(series)):
            rows.append(series[i-p:i][::-1])
        return np.array(rows), series[p:]

    X_tr, y_tr = make_lags(y_train, p)
    X_te, y_te = make_lags(y_test,  p)

    if len(X_tr) < 5:
        return np.full(len(y_te), np.mean(y_tr)), y_te

    scaler = StandardScaler()
    X_tr_s = scaler.fit_transform(X_tr)
    X_te_s = scaler.transform(X_te)

    model = Ridge(alpha=1.0)
    model.fit(X_tr_s, y_tr)
    preds = model.predict(X_te_s)
    return preds, y_te

# ── Walk-forward evaluation ────────────────────────────────────────────────
def walk_forward(X, y, idx, model_fn, n_splits=5):
    tscv = TimeSeriesSplit(n_splits=n_splits, test_size=12)
    all_preds, all_true, all_idx = [], [], []

    for train_ix, test_ix in tscv.split(X):
        X_tr, X_te = X[train_ix], X[test_ix]
        y_tr, y_te = y[train_ix], y[test_ix]

        model = model_fn()
        scaler = StandardScaler()
        X_tr_s = scaler.fit_transform(X_tr)
        X_te_s = scaler.transform(X_te)

        model.fit(X_tr_s, y_tr)
        preds = model.predict(X_te_s)

        all_preds.extend(preds)
        all_true.extend(y_te)
        all_idx.extend(idx[test_ix])

    return np.array(all_preds), np.array(all_true), np.array(all_idx)

def score(preds, true):
    mae  = mean_absolute_error(true, preds)
    rmse = np.sqrt(mean_squared_error(true, preds))
    mape = np.mean(np.abs((true - preds) / np.where(true == 0, 1, true))) * 100
    return mae, rmse, mape

# ── Run all models for both horizons ──────────────────────────────────────
print("\n[1/4] Training models...")

model_defs = {
    "Ridge":          lambda: Ridge(alpha=10.0),
    "Random Forest":  lambda: RandomForestRegressor(n_estimators=200, max_depth=6,
                                                     min_samples_leaf=3, random_state=42),
    "Gradient Boost": lambda: GradientBoostingRegressor(n_estimators=200, max_depth=4,
                                                         learning_rate=0.05,
                                                         min_samples_leaf=3, random_state=42),
}

results = {}   # {(model, horizon): (mae, rmse, mape, preds, true, idx)}

for horizon, target in [("3-month", "target_3m"), ("6-month", "target_6m")]:
    X, y, idx = make_xy(target)
    print(f"\n  Horizon: {horizon}  |  n={len(y)}")

    # ARIMA proxy
    split = int(len(y) * 0.7)
    ar_preds, ar_true = arima_proxy(y[:split], y[split:])
    mae, rmse, mape = score(ar_preds, ar_true)
    results[("ARIMA", horizon)] = (mae, rmse, mape, ar_preds, ar_true, idx[split + 6:])
    print(f"    ARIMA          MAE={mae:.2f}  RMSE={rmse:.2f}  MAPE={mape:.1f}%")

    # ML models
    for name, fn in model_defs.items():
        preds, true, pred_idx = walk_forward(X, y, idx, fn)
        mae, rmse, mape = score(preds, true)
        results[(name, horizon)] = (mae, rmse, mape, preds, true, pred_idx)
        print(f"    {name:<16} MAE={mae:.2f}  RMSE={rmse:.2f}  MAPE={mape:.1f}%")

# ── Save results CSV ───────────────────────────────────────────────────────
rows = []
for (model, horizon), (mae, rmse, mape, *_) in results.items():
    rows.append({"Model": model, "Horizon": horizon,
                 "MAE": round(mae, 3), "RMSE": round(rmse, 3), "MAPE": round(mape, 2)})
res_df = pd.DataFrame(rows).sort_values(["Horizon", "MAE"])
res_df.to_csv(OUT_MOD / "results_summary.csv", index=False)


# ══════════════════════════════════════════════════════════════════════════════
# FIG 1 — Model Comparison Bar Chart
# ══════════════════════════════════════════════════════════════════════════════
print("\n[2/4] Plotting model comparison...")

models_order = ["ARIMA", "Ridge", "Random Forest", "Gradient Boost"]
bar_colors   = [SUBTEXT, BLUE, AMBER, GREEN]
horizons     = ["3-month", "6-month"]
metric       = "MAE"

fig, axes = plt.subplots(1, 2, figsize=(13, 5.5))
fig.patch.set_facecolor(BG)
fig.suptitle("Model Comparison — Mean Absolute Error (lower = better)",
             fontsize=12, fontweight="bold")

for ax, horizon in zip(axes, horizons):
    vals = [results.get((m, horizon), (np.nan,))[0] for m in models_order]
    best_idx = int(np.nanargmin(vals))

    bars = ax.bar(models_order, vals, color=bar_colors, alpha=0.85, width=0.55)
    bars[best_idx].set_edgecolor(GREEN)
    bars[best_idx].set_linewidth(2.2)

    for bar, val in zip(bars, vals):
        if not np.isnan(val):
            ax.text(bar.get_x() + bar.get_width()/2, val + 0.1,
                    f"{val:.2f}", ha="center", va="bottom",
                    fontsize=9, color=TEXT, fontweight="bold")

    ax.set_title(f"{horizon} Forecast", fontsize=10, color=TEXT)
    ax.set_ylabel("MAE (percentage points)", fontsize=8)
    ax.set_ylim(0, max([v for v in vals if not np.isnan(v)]) * 1.25)
    ax.tick_params(labelsize=8)
    ax.grid(True, axis="y", alpha=0.4)
    ax.text(0.97, 0.96, "★ Best model", transform=ax.transAxes,
            ha="right", va="top", fontsize=7.5, color=GREEN)

plt.tight_layout()
save(fig, "fig1_model_comparison.png")


# ══════════════════════════════════════════════════════════════════════════════
# FIG 2 — Forecast vs Actual (best model per horizon)
# ══════════════════════════════════════════════════════════════════════════════
print("[3/4] Plotting forecast vs actual...")

fig, axes = plt.subplots(2, 1, figsize=(14, 10))
fig.patch.set_facecolor(BG)
fig.suptitle("Walk-Forward Forecast vs Actual  ·  Gradient Boost",
             fontsize=12, fontweight="bold")

actual_full = df["food_cpi_yoy"].dropna()

for ax, horizon, target in zip(axes, horizons, ["target_3m", "target_6m"]):
    _, _, _, preds, true, pred_idx = results[("Gradient Boost", horizon)]

    sort_order = np.argsort(pred_idx)
    pred_idx   = pred_idx[sort_order]
    preds      = preds[sort_order]
    true       = true[sort_order]

    # Risk bands
    ax.axhspan(25, ax.get_ylim()[1] if ax.get_ylim()[1] > 25 else 55,
               alpha=0.07, color=RED)
    ax.axhspan(15, 25, alpha=0.06, color=YELLOW)
    ax.axhline(25, color=RED,    linewidth=0.8, linestyle="--", alpha=0.5)
    ax.axhline(15, color=YELLOW, linewidth=0.8, linestyle="--", alpha=0.5)

    # Full actual series in background
    ax.plot(actual_full.index, actual_full.values,
            color=SUBTEXT, linewidth=1.2, alpha=0.5, label="Actual (full series)")

    # Walk-forward actual and predicted
    ax.plot(pred_idx, true,  color=AMBER, linewidth=2.0, label="Actual (test set)")
    ax.plot(pred_idx, preds, color=GREEN, linewidth=1.8,
            linestyle="--", label="Predicted")

    # Error shading
    ax.fill_between(pred_idx, true, preds,
                    alpha=0.15, color=RED,
                    where=(np.abs(preds - true) > 3), label="|Error| > 3pp")

    mae = mean_absolute_error(true, preds)
    rmse = np.sqrt(mean_squared_error(true, preds))
    ax.set_title(f"{horizon} Ahead  ·  MAE={mae:.2f}pp  RMSE={rmse:.2f}pp",
                 fontsize=10, color=TEXT)
    ax.set_ylabel("Food CPI YoY %", fontsize=8.5)
    ax.yaxis.set_major_formatter(mticker.FormatStrFormatter("%.0f%%"))
    ax.legend(fontsize=8, loc="upper left")
    ax.grid(True, axis="y", alpha=0.35)
    ax.set_xlim(actual_full.index[0], actual_full.index[-1])

plt.tight_layout()
save(fig, "fig2_forecast_vs_actual.png")


# ══════════════════════════════════════════════════════════════════════════════
# FIG 3 — Feature Importance
# ══════════════════════════════════════════════════════════════════════════════
print("[4/4] Feature importance...")

X3, y3, _ = make_xy("target_3m")
X6, y6, _ = make_xy("target_6m")

scaler = StandardScaler()

rf3 = RandomForestRegressor(n_estimators=300, max_depth=6,
                             min_samples_leaf=3, random_state=42)
rf3.fit(scaler.fit_transform(X3), y3)

gb3 = GradientBoostingRegressor(n_estimators=300, max_depth=4,
                                  learning_rate=0.05, min_samples_leaf=3, random_state=42)
gb3.fit(scaler.fit_transform(X3), y3)

feat_names = available
top_n = 14

fig, axes = plt.subplots(1, 2, figsize=(14, 7))
fig.patch.set_facecolor(BG)
fig.suptitle("Feature Importance  ·  3-Month Forecast Horizon",
             fontsize=12, fontweight="bold")

for ax, model, title, color in zip(
        axes,
        [rf3, gb3],
        ["Random Forest", "Gradient Boost"],
        [AMBER, GREEN]):

    imp = model.feature_importances_
    sorted_idx = np.argsort(imp)[-top_n:]
    names = [feat_names[i] for i in sorted_idx]
    vals  = imp[sorted_idx]

    bar_colors_feat = [color if v == vals.max() else
                       (color[:7] + "99") for v in vals]
    bars = ax.barh(names, vals, color=bar_colors_feat, alpha=0.88, height=0.65)

    # Label bars
    for bar, val in zip(bars, vals):
        ax.text(val + 0.001, bar.get_y() + bar.get_height()/2,
                f"{val:.3f}", va="center", fontsize=7.5, color=TEXT)

    ax.set_title(title, fontsize=10, color=TEXT)
    ax.set_xlabel("Importance Score", fontsize=8.5)
    ax.tick_params(labelsize=8)
    ax.grid(True, axis="x", alpha=0.3)
    ax.set_xlim(0, vals.max() * 1.22)

plt.tight_layout()
save(fig, "fig3_feature_importance.png")


# ══════════════════════════════════════════════════════════════════════════════
# FIG 4 — Risk Score (Probability of High-Risk Event)
# ══════════════════════════════════════════════════════════════════════════════

# Train a classifier version: P(inflation > 25% in 3 months)
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.calibration import CalibratedClassifierCV

X3c, y3c, idx3c = make_xy("target_3m")
y3_class = (y3c > 25).astype(int)   # 1 = High Risk

tscv = TimeSeriesSplit(n_splits=5, test_size=12)
all_probs, all_true_c, all_idx_c = [], [], []

for tr_ix, te_ix in tscv.split(X3c):
    if y3_class[tr_ix].sum() < 3:   # need some positive examples
        continue
    scaler_c = StandardScaler()
    X_tr_s = scaler_c.fit_transform(X3c[tr_ix])
    X_te_s = scaler_c.transform(X3c[te_ix])

    clf = GradientBoostingClassifier(n_estimators=200, max_depth=3,
                                      learning_rate=0.05, random_state=42)
    clf.fit(X_tr_s, y3_class[tr_ix])
    probs = clf.predict_proba(X_te_s)[:, 1]

    all_probs.extend(probs)
    all_true_c.extend(y3_class[te_ix])
    all_idx_c.extend(idx3c[te_ix])

all_probs  = np.array(all_probs)
all_true_c = np.array(all_true_c)
all_idx_c  = np.array(all_idx_c)

sort_order = np.argsort(all_idx_c)
all_idx_c  = all_idx_c[sort_order]
all_probs  = all_probs[sort_order]
all_true_c = all_true_c[sort_order]

fig, axes = plt.subplots(2, 1, figsize=(14, 9), gridspec_kw={"height_ratios": [3, 1]})
fig.patch.set_facecolor(BG)
fig.suptitle("Risk Score  ·  Probability of Food Inflation Exceeding 25% (3-Month Horizon)",
             fontsize=11, fontweight="bold")

ax1, ax2 = axes

# Risk probability line
ax1.fill_between(all_idx_c, 0, all_probs,
                 where=(all_probs >= 0.6), alpha=0.4, color=RED,   label="High risk (≥60%)")
ax1.fill_between(all_idx_c, 0, all_probs,
                 where=((all_probs >= 0.3) & (all_probs < 0.6)),
                 alpha=0.35, color=YELLOW, label="Moderate (30–60%)")
ax1.fill_between(all_idx_c, 0, all_probs,
                 where=(all_probs < 0.3), alpha=0.3, color=GREEN, label="Low (<30%)")

ax1.plot(all_idx_c, all_probs, color=AMBER, linewidth=2.0, zorder=4)
ax1.axhline(0.6, color=RED,    linewidth=0.9, linestyle="--", alpha=0.6)
ax1.axhline(0.3, color=YELLOW, linewidth=0.9, linestyle="--", alpha=0.6)
ax1.set_ylabel("P(Inflation > 25%)", fontsize=9)
ax1.set_ylim(0, 1.05)
ax1.yaxis.set_major_formatter(mticker.PercentFormatter(xmax=1))
ax1.legend(fontsize=8, loc="upper left")
ax1.grid(True, axis="y", alpha=0.35)

# Actual vs threshold (binary indicator)
ax2.bar(all_idx_c, all_true_c, width=20, color=RED, alpha=0.7, label="Actual High Risk")
ax2.set_ylim(-0.1, 1.5)
ax2.set_yticks([0, 1])
ax2.set_yticklabels(["Normal", "High Risk"], fontsize=7.5)
ax2.set_ylabel("Actual", fontsize=8)
ax2.grid(False)

for ax in axes:
    ax.set_xlim(all_idx_c[0], all_idx_c[-1])

plt.tight_layout()
save(fig, "fig4_risk_scores.png")


# ══════════════════════════════════════════════════════════════════════════════
# PRINT FINAL SUMMARY
# ══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  FIEWS Modelling — Results Summary")
print("=" * 60)
print(res_df.to_string(index=False))

print("\n  Best model by MAE:")
for horizon in horizons:
    sub = res_df[res_df.Horizon == horizon].nsmallest(1, "MAE")
    row = sub.iloc[0]
    print(f"    {horizon}:  {row.Model:<18} MAE={row.MAE:.2f}pp  RMSE={row.RMSE:.2f}pp")

print(f"\n  Outputs in: outputs/models/")
print("=" * 60)
