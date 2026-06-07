"""
FIEWS — Script 02: Exploratory Data Analysis
=============================================
Produces 5 publication-quality charts saved to outputs/eda/

  Fig 1 — Food inflation timeline with regime annotations
  Fig 2 — Cross-correlation: which variables lead food CPI and by how many months
  Fig 3 — Correlation heatmap of all features
  Fig 4 — ACF of food CPI (persistence)
  Fig 5 — Driver decomposition: each variable vs food CPI, scatter with trend
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import matplotlib.patches as mpatches
import matplotlib.gridspec as gridspec
import seaborn as sns
from scipy import stats
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT    = Path(__file__).resolve().parent.parent
PANEL   = ROOT / "data" / "processed" / "fiews_panel.csv"
OUT_EDA = ROOT / "outputs" / "eda"
OUT_EDA.mkdir(parents=True, exist_ok=True)

# ── Style ─────────────────────────────────────────────────────────────────────
BACKGROUND  = "#0D1117"
SURFACE     = "#161B22"
BORDER      = "#30363D"
TEXT        = "#E6EDF3"
SUBTEXT     = "#8B949E"
ACCENT      = "#F0A500"       # amber
ACCENT2     = "#58A6FF"       # blue
ACCENT3     = "#3FB950"       # green
DANGER      = "#F85149"       # red
ELEVATED    = "#D29922"       # yellow

plt.rcParams.update({
    "figure.facecolor":  BACKGROUND,
    "axes.facecolor":    SURFACE,
    "axes.edgecolor":    BORDER,
    "axes.labelcolor":   TEXT,
    "axes.titlecolor":   TEXT,
    "xtick.color":       SUBTEXT,
    "ytick.color":       SUBTEXT,
    "text.color":        TEXT,
    "grid.color":        BORDER,
    "grid.linewidth":    0.6,
    "font.family":       "monospace",
    "legend.facecolor":  SURFACE,
    "legend.edgecolor":  BORDER,
    "legend.labelcolor": TEXT,
})

def save(fig, name):
    path = OUT_EDA / name
    fig.savefig(path, dpi=150, bbox_inches="tight", facecolor=BACKGROUND)
    plt.close(fig)
    print(f"  ✓ Saved: {name}")


# ── Load data ─────────────────────────────────────────────────────────────────
df = pd.read_csv(PANEL, parse_dates=["date"], index_col="date")
print(f"Panel loaded: {len(df)} rows | {df.index.min().date()} → {df.index.max().date()}")

cpi = df["food_cpi_yoy"].dropna()


# ══════════════════════════════════════════════════════════════════════════════
# FIG 1 — Food Inflation Timeline with Regime Annotations
# ══════════════════════════════════════════════════════════════════════════════
print("\n[1/5] Inflation timeline...")

regimes = [
    ("2016-01", "2017-12", "Naira Crisis\n+ Subsidy Cut",   DANGER),
    ("2020-03", "2021-03", "COVID-19\nShock",               ELEVATED),
    ("2022-01", "2023-06", "Ukraine War\n+ FX Shock",       ACCENT2),
    ("2023-06", "2024-06", "Subsidy Removal\nCrisis",       DANGER),
]

thresholds = [
    (15, "Elevated threshold",  ELEVATED, ":"),
    (25, "High-risk threshold", DANGER,   "--"),
]

fig, ax = plt.subplots(figsize=(14, 6))
fig.patch.set_facecolor(BACKGROUND)

# Shade regimes
for start, end, label, color in regimes:
    ax.axvspan(pd.Timestamp(start), pd.Timestamp(end),
               alpha=0.12, color=color, zorder=1)
    mid = pd.Timestamp(start) + (pd.Timestamp(end) - pd.Timestamp(start)) / 2
    ax.text(mid, cpi.max() * 0.97, label, ha="center", va="top",
            fontsize=7, color=color, alpha=0.85)

# Threshold lines
for val, lbl, color, ls in thresholds:
    ax.axhline(val, color=color, linewidth=1.1, linestyle=ls, alpha=0.7, zorder=2)
    ax.text(cpi.index[-1], val + 0.6, lbl, ha="right", fontsize=7.5,
            color=color, alpha=0.85)

# Risk fill
ax.fill_between(cpi.index, 25, cpi, where=(cpi > 25),
                alpha=0.20, color=DANGER, zorder=2, label="High risk zone")
ax.fill_between(cpi.index, 15, cpi, where=((cpi > 15) & (cpi <= 25)),
                alpha=0.15, color=ELEVATED, zorder=2, label="Elevated zone")

# Main line
ax.plot(cpi.index, cpi.values, color=ACCENT, linewidth=2.2, zorder=4)
ax.fill_between(cpi.index, cpi.values, alpha=0.07, color=ACCENT, zorder=3)

# Peak annotation
peak_date = cpi.idxmax()
ax.annotate(f"Peak: {cpi.max():.1f}%\n{peak_date.strftime('%b %Y')}",
            xy=(peak_date, cpi.max()),
            xytext=(peak_date - pd.DateOffset(months=14), cpi.max() - 3),
            arrowprops=dict(arrowstyle="->", color=DANGER, lw=1.2),
            fontsize=8, color=DANGER)

ax.set_title("Nigeria Food Inflation  ·  May 2012 – Apr 2026",
             fontsize=13, fontweight="bold", pad=14)
ax.set_ylabel("Year-on-Year %", fontsize=9)
ax.yaxis.set_major_formatter(mticker.FormatStrFormatter("%.0f%%"))
ax.grid(True, axis="y", alpha=0.4)
ax.set_xlim(cpi.index[0], cpi.index[-1])
ax.legend(fontsize=8, loc="upper left")

save(fig, "fig1_inflation_timeline.png")


# ══════════════════════════════════════════════════════════════════════════════
# FIG 2 — Cross-Correlation: Leading Indicators
# ══════════════════════════════════════════════════════════════════════════════
print("[2/5] Cross-correlation (lead-lag analysis)...")

indicators = {
    "FX Rate (NGN/USD)":          "fx_official",
    "FX 3m Change %":             "fx_chg_3m",
    "PMS Fuel Price":             "pms_price",
    "Diesel Price":               "diesel_price",
    "Fuel Shock 3m %":            "fuel_shock_3m",
    "FAO Food Index":             "fao_food_index",
    "FAO Cereals Index":          "cereals",
    "FAO Oils Index":             "oils",
    "Global Food Shock 3m":       "global_food_shock_3m",
    "Rainfall mm":                "rainfall_mm",
    "Rainfall Anomaly":           "rainfall_anomaly",
}

lags = range(-6, 13)   # negative = indicator leads CPI
results = {}

for label, col in indicators.items():
    if col not in df.columns:
        continue
    series = df[col].dropna()
    shared = cpi.index.intersection(series.index)
    c = cpi.loc[shared]
    s = series.loc[shared]
    corrs = []
    for lag in lags:
        if lag < 0:
            # indicator leads: shift indicator forward so it aligns with future CPI
            aligned_c = c.iloc[-lag:]
            aligned_s = s.iloc[:lag]
        elif lag == 0:
            aligned_c, aligned_s = c, s
        else:
            aligned_c = c.iloc[:-lag]
            aligned_s = s.iloc[lag:]
        n = min(len(aligned_c), len(aligned_s))
        if n < 20:
            corrs.append(np.nan)
            continue
        r, _ = stats.pearsonr(aligned_c.values[:n], aligned_s.values[:n])
        corrs.append(r)
    results[label] = corrs

# Find optimal lead lag per indicator
summary = []
for label, corrs in results.items():
    arr = np.array(corrs)
    # Best correlation at negative lags (indicator leads CPI)
    lead_corrs = arr[:7]   # lags -6 to 0
    best_idx = np.nanargmax(np.abs(lead_corrs))
    best_lag  = list(lags)[:7][best_idx]
    best_corr = lead_corrs[best_idx]
    summary.append((label, best_lag, best_corr))

summary.sort(key=lambda x: abs(x[2]), reverse=True)

fig, axes = plt.subplots(3, 4, figsize=(16, 10))
axes = axes.flatten()
fig.patch.set_facecolor(BACKGROUND)
fig.suptitle("Cross-Correlation: Leading Indicators vs Food CPI\n"
             "(Negative lag = indicator moves BEFORE inflation)",
             fontsize=12, fontweight="bold", y=1.01)

lag_list = list(lags)

for i, (label, col) in enumerate(indicators.items()):
    if i >= len(axes):
        break
    ax = axes[i]
    corrs = results.get(label, [np.nan]*len(lag_list))
    colors = [DANGER if c > 0 else ACCENT2 for c in corrs]
    # Highlight the leading zone
    for j, (lag, corr) in enumerate(zip(lag_list, corrs)):
        if np.isnan(corr):
            continue
        bar_color = ACCENT if lag < 0 else SUBTEXT
        if abs(corr) == max(abs(np.nan_to_num(corrs[:7]))):
            bar_color = DANGER if corr > 0 else ACCENT2
        ax.bar(lag, corr, color=bar_color, alpha=0.85, width=0.7)

    ax.axvline(0, color=BORDER, linewidth=0.8, linestyle="--")
    ax.axhline(0, color=BORDER, linewidth=0.5)
    ax.set_title(label, fontsize=8, color=TEXT, pad=4)
    ax.set_ylim(-1, 1)
    ax.set_xlabel("Lag (months)", fontsize=7, color=SUBTEXT)
    ax.tick_params(labelsize=7)
    ax.grid(True, alpha=0.3)

    # Find best lead
    lead_corrs = [corrs[j] for j, l in enumerate(lag_list) if l < 0]
    if lead_corrs and not all(np.isnan(lead_corrs)):
        best = max([(abs(c), c, l) for c, l in
                    zip(lead_corrs, [l for l in lag_list if l < 0])
                    if not np.isnan(c)])
        ax.text(0.05, 0.92, f"Best lead: {best[2]}m  r={best[1]:.2f}",
                transform=ax.transAxes, fontsize=6.5, color=ACCENT,
                va="top")

# Hide unused axes
for j in range(len(indicators), len(axes)):
    axes[j].set_visible(False)

plt.tight_layout()
save(fig, "fig2_cross_correlation.png")


# ══════════════════════════════════════════════════════════════════════════════
# FIG 3 — Correlation Heatmap
# ══════════════════════════════════════════════════════════════════════════════
print("[3/5] Correlation heatmap...")

heatmap_cols = [
    "food_cpi_yoy", "fx_official", "fx_chg_3m", "fx_chg_6m",
    "pms_price", "diesel_price", "fuel_shock_3m",
    "fao_food_index", "cereals", "oils", "global_food_shock_3m",
    "rainfall_mm", "rainfall_anomaly",
    "food_cpi_lag1", "food_cpi_lag3", "food_cpi_lag6",
]
col_labels = [
    "Food CPI YoY", "FX Rate", "FX Chg 3m", "FX Chg 6m",
    "PMS Price", "Diesel", "Fuel Shock 3m",
    "FAO Food", "FAO Cereals", "FAO Oils", "Global Food Shock",
    "Rainfall", "Rain Anomaly",
    "CPI Lag 1m", "CPI Lag 3m", "CPI Lag 6m",
]

avail = [c for c in heatmap_cols if c in df.columns]
avail_labels = [col_labels[heatmap_cols.index(c)] for c in avail]

corr = df[avail].corr()
corr.index   = avail_labels
corr.columns = avail_labels

fig, ax = plt.subplots(figsize=(13, 10))
fig.patch.set_facecolor(BACKGROUND)
ax.set_facecolor(SURFACE)

mask = np.triu(np.ones_like(corr, dtype=bool), k=1)

cmap = sns.diverging_palette(220, 20, as_cmap=True)
sns.heatmap(corr, mask=mask, cmap=cmap, vmin=-1, vmax=1, center=0,
            ax=ax, annot=True, fmt=".2f", annot_kws={"size": 7.5},
            linewidths=0.4, linecolor=BACKGROUND,
            cbar_kws={"shrink": 0.7})

ax.set_title("Feature Correlation Matrix  ·  FIEWS Panel",
             fontsize=12, fontweight="bold", pad=14)
ax.tick_params(labelsize=8.5, colors=TEXT)
ax.collections[0].colorbar.ax.tick_params(labelsize=8, colors=TEXT)

save(fig, "fig3_correlation_heatmap.png")


# ══════════════════════════════════════════════════════════════════════════════
# FIG 4 — ACF of Food CPI (Persistence)
# ══════════════════════════════════════════════════════════════════════════════
print("[4/5] ACF / persistence...")

def acf_manual(series, nlags=24):
    s = series.dropna()
    n = len(s)
    mean = s.mean()
    var  = ((s - mean)**2).sum() / n
    acf_vals = []
    for k in range(nlags + 1):
        cov = ((s[k:].values - mean) * (s[:n-k].values - mean)).sum() / n if k < n else 0
        acf_vals.append(cov / var if var > 0 else 0)
    return np.array(acf_vals)

acf_vals = acf_manual(cpi, nlags=24)
conf = 1.96 / np.sqrt(len(cpi))
lags_acf = np.arange(len(acf_vals))

fig, ax = plt.subplots(figsize=(12, 5))
fig.patch.set_facecolor(BACKGROUND)

ax.fill_between(lags_acf, -conf, conf, alpha=0.15, color=ACCENT2, label="95% CI")
for i, (lag, val) in enumerate(zip(lags_acf, acf_vals)):
    color = ACCENT if abs(val) > conf else SUBTEXT
    ax.bar(lag, val, color=color, alpha=0.85, width=0.6)

ax.axhline(0,    color=BORDER,  linewidth=0.8)
ax.axhline(conf, color=ACCENT2, linewidth=0.8, linestyle="--", alpha=0.6)
ax.axhline(-conf,color=ACCENT2, linewidth=0.8, linestyle="--", alpha=0.6)

# Annotate half-life (first lag where ACF < 0.5)
half_life = next((i for i, v in enumerate(acf_vals) if i > 0 and v < 0.5), None)
if half_life:
    ax.axvline(half_life, color=DANGER, linewidth=1.2, linestyle=":", alpha=0.8)
    ax.text(half_life + 0.3, 0.52, f"Half-life ≈ {half_life} months",
            fontsize=8, color=DANGER)

ax.set_title("Autocorrelation Function — Nigeria Food CPI\n"
             "How persistent is inflation? (Amber = statistically significant)",
             fontsize=11, fontweight="bold")
ax.set_xlabel("Lag (months)", fontsize=9)
ax.set_ylabel("Autocorrelation", fontsize=9)
ax.set_xlim(-0.5, 24.5)
ax.set_ylim(-0.3, 1.05)
ax.grid(True, axis="y", alpha=0.4)
ax.legend(fontsize=8)

save(fig, "fig4_acf_persistence.png")


# ══════════════════════════════════════════════════════════════════════════════
# FIG 5 — Key Driver Scatter Plots
# ══════════════════════════════════════════════════════════════════════════════
print("[5/5] Driver scatter plots...")

drivers = [
    ("fx_chg_3m",            "FX 3-Month Change (%)",      ACCENT),
    ("fuel_shock_3m",        "Fuel Shock 3-Month (%)",     DANGER),
    ("global_food_shock_3m", "Global Food Price Shock (%)", ACCENT2),
    ("rainfall_anomaly",     "Rainfall Anomaly",            ACCENT3),
    ("fx_chg_6m",            "FX 6-Month Change (%)",      ELEVATED),
    ("cereals_shock_3m",     "Global Cereals Shock (%)",   "#C778DD"),
]

fig, axes = plt.subplots(2, 3, figsize=(15, 9))
axes = axes.flatten()
fig.patch.set_facecolor(BACKGROUND)
fig.suptitle("Key Drivers vs Food Inflation  ·  Scatter + Trend",
             fontsize=12, fontweight="bold", y=1.01)

for i, (col, label, color) in enumerate(drivers):
    ax = axes[i]
    if col not in df.columns:
        ax.set_visible(False)
        continue

    x = df[col].dropna()
    shared = cpi.index.intersection(x.index)
    xv = x.loc[shared].values
    yv = cpi.loc[shared].values
    mask = ~(np.isnan(xv) | np.isnan(yv))
    xv, yv = xv[mask], yv[mask]

    r, p = stats.pearsonr(xv, yv)
    slope, intercept, *_ = stats.linregress(xv, yv)

    # Color by risk class
    risk_colors = [DANGER if y > 25 else ELEVATED if y > 15 else ACCENT3 for y in yv]
    ax.scatter(xv, yv, c=risk_colors, alpha=0.6, s=28, zorder=3, edgecolors="none")

    # Trend line
    x_line = np.linspace(xv.min(), xv.max(), 100)
    ax.plot(x_line, slope * x_line + intercept,
            color=color, linewidth=1.8, zorder=4, alpha=0.9)

    sig = "***" if p < 0.001 else "**" if p < 0.01 else "*" if p < 0.05 else "ns"
    ax.set_title(f"{label}", fontsize=8.5, color=TEXT)
    ax.set_xlabel(label, fontsize=7.5, color=SUBTEXT)
    ax.set_ylabel("Food CPI YoY %", fontsize=7.5, color=SUBTEXT)
    ax.text(0.97, 0.07, f"r = {r:.2f}  {sig}",
            transform=ax.transAxes, ha="right", fontsize=8,
            color=color, fontweight="bold")
    ax.grid(True, alpha=0.3)
    ax.tick_params(labelsize=7)

# Legend for risk classes
patches = [
    mpatches.Patch(color=DANGER,   label="High  (>25%)"),
    mpatches.Patch(color=ELEVATED, label="Elevated (15–25%)"),
    mpatches.Patch(color=ACCENT3,  label="Low  (<15%)"),
]
fig.legend(handles=patches, loc="lower center", ncol=3,
           fontsize=8.5, frameon=True, bbox_to_anchor=(0.5, -0.03))

plt.tight_layout()
save(fig, "fig5_driver_scatters.png")


# ══════════════════════════════════════════════════════════════════════════════
# PRINT EDA SUMMARY
# ══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 58)
print("  EDA Summary — Key Findings")
print("=" * 58)

print("\n  Top Leading Indicators (ranked by |correlation|):")
print(f"  {'Indicator':<30} {'Best Lead':>10} {'r':>8}")
print("  " + "-" * 50)
for label, lag, corr in summary[:8]:
    direction = "leads" if lag < 0 else "lags "
    print(f"  {label:<30} {abs(lag):>3}m {direction}  {corr:>+.3f}")

print(f"\n  Inflation Persistence:")
half_life = next((i for i, v in enumerate(acf_vals) if i > 0 and v < 0.5), "?")
print(f"  ACF half-life ≈ {half_life} months")
print(f"  Still significant at lag 12: {acf_vals[12]:.2f}")

print(f"\n  Risk Class Distribution:")
rc = df["risk_class"].value_counts()
total = rc.sum()
for cls, n in rc.items():
    print(f"  {cls:<12} {n:>4} months  ({100*n/total:.0f}%)")

print(f"\n  Outputs saved to: outputs/eda/")
print("=" * 58)
