"""
FIEWS - Food Inflation Early Warning System
Script 01: Data Collection

This script handles data collection from all sources.
Some sources are downloaded automatically (FAO, World Bank Pink Sheet).
Others require manual download — instructions are printed clearly.

Run this script once. It will:
1. Tell you exactly which files to download manually and where to put them
2. Load and standardize each source
3. Merge everything into one clean monthly panel
4. Save to: data/processed/fiews_panel.csv
"""

import os
import sys
import requests
import pandas as pd
import numpy as np
from pathlib import Path
from io import BytesIO
import warnings
warnings.filterwarnings("ignore")

# ── Paths ────────────────────────────────────────────────────────────────────
ROOT       = Path(__file__).resolve().parent.parent
RAW        = ROOT / "data" / "raw"
PROCESSED  = ROOT / "data" / "processed"
RAW.mkdir(parents=True, exist_ok=True)
PROCESSED.mkdir(parents=True, exist_ok=True)

START_DATE = "2010-01-01"
END_DATE   = "2024-12-01"
DATE_RANGE = pd.date_range(START_DATE, END_DATE, freq="MS")  # month-start

print("=" * 65)
print("  FIEWS Data Collection Pipeline")
print("=" * 65)


# ─────────────────────────────────────────────────────────────────────────────
# HELPER
# ─────────────────────────────────────────────────────────────────────────────

def status(label: str, ok: bool, n: int = 0):
    icon = "✓" if ok else "✗"
    detail = f"  ({n} rows)" if ok and n else ""
    print(f"  [{icon}] {label}{detail}")


def manual_download_notice(source, url, filename, columns_hint=""):
    print(f"""
  ┌─ MANUAL DOWNLOAD REQUIRED ──────────────────────────────────────
  │ Source  : {source}
  │ URL     : {url}
  │ Save to : data/raw/{filename}
  │ {columns_hint}
  └──────────────────────────────────────────────────────────────────""")


# ─────────────────────────────────────────────────────────────────────────────
# SOURCE 1 — FAO Food Price Index (auto-download)
# ─────────────────────────────────────────────────────────────────────────────

def collect_fao():
    print("\n[1/6] FAO Food Price Index")
    url = "https://www.fao.org/3/cb0996en/Food_price_indices_data_jul24.xlsx"
    path = RAW / "fao_food_price_index.xlsx"

    if not path.exists():
        try:
            r = requests.get(url, timeout=30)
            r.raise_for_status()
            path.write_bytes(r.content)
        except Exception:
            # Fallback: try the stable monthly CSV endpoint
            try:
                csv_url = "https://www.fao.org/worldfoodsituation/foodpricesindex/en/"
                manual_download_notice(
                    "FAO Food Price Index",
                    "https://www.fao.org/3/cb0996en/Food_price_indices_data_jul24.xlsx",
                    "fao_food_price_index.xlsx",
                    "Columns needed: Date, Food, Cereals, Vegetable Oils"
                )
                status("FAO Food Price Index", False)
                return None
            except Exception:
                pass

    try:
        df = pd.read_excel(path, sheet_name=0, header=2)
        # FAO layout: first column is month/year, then index columns
        df = df.rename(columns={df.columns[0]: "date"})
        df = df.dropna(subset=["date"])
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df = df.dropna(subset=["date"])
        df = df.set_index("date").sort_index()

        # Keep relevant columns
        keep = {}
        for col in df.columns:
            col_lower = str(col).lower()
            if "food" in col_lower and "fao_food_index" not in keep:
                keep["fao_food_index"] = col
            if "cereal" in col_lower and "fao_cereal_index" not in keep:
                keep["fao_cereal_index"] = col
            if "oil" in col_lower and "fao_oil_index" not in keep:
                keep["fao_oil_index"] = col

        result = df[[v for v in keep.values()]].copy()
        result.columns = list(keep.keys())
        result = result[START_DATE:END_DATE].resample("MS").mean()
        status("FAO Food Price Index", True, len(result))
        return result

    except Exception as e:
        status(f"FAO Food Price Index — parse error: {e}", False)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# SOURCE 2 — World Bank Commodity Price Data ("Pink Sheet") (auto-download)
# ─────────────────────────────────────────────────────────────────────────────

def collect_pink_sheet():
    print("\n[2/6] World Bank Pink Sheet (Commodity Prices)")
    url = "https://thedocs.worldbank.org/en/doc/5d903e848db1d1b83e0ec8f744e55570-0350012021/related/CMO-Historical-Data-Monthly.xlsx"
    path = RAW / "wb_pink_sheet.xlsx"

    if not path.exists():
        try:
            r = requests.get(url, timeout=60)
            r.raise_for_status()
            path.write_bytes(r.content)
        except Exception:
            manual_download_notice(
                "World Bank Commodity Prices (Pink Sheet)",
                "https://www.worldbank.org/en/research/commodity-markets",
                "wb_pink_sheet.xlsx",
                "Download 'Monthly Prices' sheet. Columns: Wheat, Rice, Maize, Palm Oil, Urea, DAP"
            )
            status("World Bank Pink Sheet", False)
            return None

    try:
        # Pink sheet: 'Monthly Prices' sheet, first few rows are metadata
        xf = pd.ExcelFile(path)
        sheet = "Monthly Prices" if "Monthly Prices" in xf.sheet_names else xf.sheet_names[0]
        df = pd.read_excel(path, sheet_name=sheet, header=4, index_col=0)
        df.index = pd.to_datetime(df.index, errors="coerce")
        df = df[df.index.notna()].sort_index()

        # Map commodity column names (Pink Sheet uses specific headers)
        col_map = {
            "Wheat, US HRW": "wheat_price_usd",
            "Wheat, US SRW": "wheat_price_usd",
            "Rice, Thai 5%": "rice_price_usd",
            "Maize": "maize_price_usd",
            "Palm oil": "palm_oil_price_usd",
            "Urea, E. Europe, bulk": "urea_price_usd",
            "DAP": "npk_price_usd",          # DAP is a key NPK fertilizer
        }

        found = {}
        for raw_col, clean_col in col_map.items():
            for df_col in df.columns:
                if raw_col.lower() in str(df_col).lower() and clean_col not in found:
                    found[clean_col] = df_col
                    break

        result = df[[v for v in found.values()]].copy()
        result.columns = list(found.keys())
        result = pd.to_numeric(result.stack(), errors="coerce").unstack()
        result = result[START_DATE:END_DATE].resample("MS").mean()
        status("World Bank Pink Sheet", True, len(result))
        return result

    except Exception as e:
        status(f"World Bank Pink Sheet — parse error: {e}", False)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# SOURCE 3 — CBN Exchange Rate (manual download)
# ─────────────────────────────────────────────────────────────────────────────

def collect_exchange_rate():
    print("\n[3/6] CBN Exchange Rate (NGN/USD)")
    path = RAW / "cbn_exchange_rate.csv"

    if not path.exists():
        manual_download_notice(
            "Central Bank of Nigeria — Exchange Rate",
            "https://www.cbn.gov.ng/rates/ExchRateByCurrency.asp",
            "cbn_exchange_rate.csv",
            "Select: USD | Monthly average | 2010–2024 | Download CSV"
        )
        # Generate simulated data so the pipeline doesn't break
        print("  → Using estimated exchange rate series (replace with real CBN data)")
        dates = DATE_RANGE
        # Approximate NGN/USD trajectory 2010–2024
        base = 150
        rates = []
        for i, d in enumerate(dates):
            year = d.year
            if year < 2015:
                r = 150 + i * 0.2
            elif year < 2017:
                r = 200 + (i - 60) * 1.5
            elif year < 2020:
                r = 305 + (i - 84) * 0.3
            elif year < 2023:
                r = 360 + (i - 120) * 0.8
            else:
                r = 460 + (i - 156) * 8
            rates.append(round(r + np.random.normal(0, 3), 2))
        df = pd.DataFrame({"date": dates, "fx_official": rates}).set_index("date")
        status("Exchange Rate (ESTIMATED — replace with CBN data)", True, len(df))
        return df

    try:
        df = pd.read_csv(path, parse_dates=["date"], index_col="date")
        df = df.rename(columns={df.columns[0]: "fx_official"})
        df["fx_official"] = pd.to_numeric(df["fx_official"], errors="coerce")
        df = df[START_DATE:END_DATE].resample("MS").mean()
        status("CBN Exchange Rate", True, len(df))
        return df
    except Exception as e:
        status(f"CBN Exchange Rate — parse error: {e}", False)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# SOURCE 4 — Nigeria Fuel Prices (manual download)
# ─────────────────────────────────────────────────────────────────────────────

def collect_fuel_prices():
    print("\n[4/6] Nigeria Fuel Prices (PMS / Diesel)")
    path = RAW / "nigeria_fuel_prices.csv"

    if not path.exists():
        manual_download_notice(
            "NBS / NNPC — Fuel Prices",
            "https://nigerianstat.gov.ng/elibrary/read/1241158",
            "nigeria_fuel_prices.csv",
            "Columns needed: date, pms_price, diesel_price (₦/litre)"
        )
        print("  → Using estimated fuel price series (replace with NBS data)")
        dates = DATE_RANGE
        pms, diesel = [], []
        for i, d in enumerate(dates):
            year = d.year
            # Approximate PMS price trajectory
            if year < 2012:
                p = 65
            elif year < 2016:
                p = 97
            elif year < 2020:
                p = 145
            elif year < 2023:
                p = 165
            else:
                p = 480 + (i - 156) * 5
            pms.append(round(p + np.random.normal(0, 2), 2))
            diesel.append(round(p * 1.6 + np.random.normal(0, 5), 2))

        df = pd.DataFrame({
            "date": dates,
            "pms_price": pms,
            "diesel_price": diesel
        }).set_index("date")
        status("Fuel Prices (ESTIMATED — replace with NBS data)", True, len(df))
        return df

    try:
        df = pd.read_csv(path, parse_dates=["date"], index_col="date")
        df["pms_price"]    = pd.to_numeric(df["pms_price"], errors="coerce")
        df["diesel_price"] = pd.to_numeric(df["diesel_price"], errors="coerce")
        df = df[START_DATE:END_DATE].resample("MS").mean()
        status("Fuel Prices", True, len(df))
        return df
    except Exception as e:
        status(f"Fuel Prices — parse error: {e}", False)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# SOURCE 5 — Rainfall (CHIRPS / World Bank) (manual download)
# ─────────────────────────────────────────────────────────────────────────────

def collect_rainfall():
    print("\n[5/6] Rainfall Data")
    path = RAW / "nigeria_rainfall.csv"

    if not path.exists():
        manual_download_notice(
            "CHIRPS Rainfall Data",
            "https://climateserv.servirglobal.net/",
            "nigeria_rainfall.csv",
            "Select: Nigeria bounding box | Monthly | 2010–2024 | Download CSV. Columns: date, rainfall_mm"
        )
        print("  → Using estimated seasonal rainfall series (replace with CHIRPS data)")
        dates = DATE_RANGE
        # Nigeria has two rainy seasons: April–July (south) and May–Sept
        monthly_avg = {1:8, 2:18, 3:52, 4:112, 5:168, 6:195, 7:182, 8:175,
                       9:192, 10:135, 11:38, 12:12}
        rain = []
        for d in dates:
            base = monthly_avg[d.month]
            anomaly = np.random.normal(0, base * 0.25)
            rain.append(max(0, round(base + anomaly, 1)))

        df = pd.DataFrame({"date": dates, "rainfall_mm": rain}).set_index("date")
        status("Rainfall (ESTIMATED — replace with CHIRPS data)", True, len(df))
        return df

    try:
        df = pd.read_csv(path, parse_dates=["date"], index_col="date")
        df["rainfall_mm"] = pd.to_numeric(df["rainfall_mm"], errors="coerce")
        df = df[START_DATE:END_DATE].resample("MS").mean()
        status("Rainfall", True, len(df))
        return df
    except Exception as e:
        status(f"Rainfall — parse error: {e}", False)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# SOURCE 6 — NBS Food CPI (manual download)
# ─────────────────────────────────────────────────────────────────────────────

def collect_food_cpi():
    print("\n[6/6] NBS Nigeria Food CPI")
    path = RAW / "nigeria_food_cpi.csv"

    if not path.exists():
        manual_download_notice(
            "National Bureau of Statistics — CPI Reports",
            "https://nigerianstat.gov.ng/elibrary?queries[term]=CPI",
            "nigeria_food_cpi.csv",
            "Columns needed: date (YYYY-MM-01), food_cpi_yoy (% year-on-year)"
        )
        print("  → Using NBS-aligned food CPI estimates (replace with official data)")
        # Approximate Nigeria food CPI YoY trajectory 2010–2024
        food_cpi_approx = {
            2010: [13.5,14.0,13.8,13.2,12.8,12.5,12.1,11.9,11.7,11.5,11.3,11.0],
            2011: [11.8,12.1,12.4,12.7,13.0,13.5,14.0,14.3,14.7,15.1,15.4,15.7],
            2012: [12.5,12.1,11.8,11.4,11.0,10.6,10.2,9.9,9.6,9.2,8.9,8.6],
            2013: [10.5,10.8,11.0,11.3,11.5,11.8,12.0,12.2,12.5,12.7,13.0,13.2],
            2014: [13.0,13.2,13.5,13.7,14.0,14.2,14.5,14.7,15.0,15.2,15.5,15.8],
            2015: [9.5,9.8,10.1,10.3,10.6,10.8,11.1,11.4,11.6,11.9,12.1,12.4],
            2016: [13.0,14.0,15.0,16.5,17.5,18.5,19.5,20.5,21.0,21.5,22.0,22.5],
            2017: [18.5,17.8,17.2,16.5,15.8,15.1,14.7,14.0,13.5,13.0,12.5,12.0],
            2018: [14.8,15.2,15.5,15.8,16.1,16.4,16.7,17.0,17.3,17.6,17.9,18.2],
            2019: [13.5,13.2,13.0,12.7,12.5,12.3,12.0,11.8,11.5,11.2,11.0,10.7],
            2020: [15.0,15.5,16.0,16.5,17.0,17.5,18.0,18.5,19.0,19.5,20.0,20.5],
            2021: [20.2,20.8,21.3,21.7,22.3,22.9,23.4,23.9,24.4,24.9,25.4,25.8],
            2022: [20.1,20.9,21.7,22.5,23.3,24.2,25.0,25.8,26.6,27.3,28.1,29.0],
            2023: [33.2,35.0,37.0,39.2,40.0,40.9,42.3,43.7,43.9,45.1,47.0,39.9],
            2024: [35.4,37.9,40.0,40.5,40.9,40.5,39.5,37.5,36.0,34.5,33.0,31.0],
        }

        rows = []
        for year, monthly in food_cpi_approx.items():
            for m, val in enumerate(monthly, 1):
                rows.append({"date": pd.Timestamp(year, m, 1), "food_cpi_yoy": val})

        df = pd.DataFrame(rows).set_index("date")
        df = df[START_DATE:END_DATE]
        status("Food CPI (ESTIMATED — replace with NBS data)", True, len(df))
        return df

    try:
        df = pd.read_csv(path, parse_dates=["date"], index_col="date")
        df["food_cpi_yoy"] = pd.to_numeric(df["food_cpi_yoy"], errors="coerce")
        df = df[START_DATE:END_DATE].resample("MS").mean()
        status("Food CPI", True, len(df))
        return df
    except Exception as e:
        status(f"Food CPI — parse error: {e}", False)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# MERGE ALL SOURCES
# ─────────────────────────────────────────────────────────────────────────────

def merge_all(sources: dict) -> pd.DataFrame:
    panel = pd.DataFrame(index=DATE_RANGE)
    panel.index.name = "date"

    for name, df in sources.items():
        if df is not None:
            panel = panel.join(df, how="left")

    return panel


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────────────────────

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    print("\n[+] Engineering features...")

    # ── Exchange rate features
    if "fx_official" in df.columns:
        df["fx_chg_3m"] = df["fx_official"].pct_change(3) * 100
        df["fx_chg_6m"] = df["fx_official"].pct_change(6) * 100
        df["fx_depreciation_flag"] = (df["fx_chg_3m"] > 10).astype(int)

    # ── Fuel shock features
    if "pms_price" in df.columns:
        df["fuel_shock_3m"]  = df["pms_price"].pct_change(3) * 100
        df["fuel_shock_flag"] = (df["fuel_shock_3m"] > 15).astype(int)

    if "diesel_price" in df.columns:
        df["diesel_shock_3m"] = df["diesel_price"].pct_change(3) * 100

    # ── Fertilizer shock
    if "urea_price_usd" in df.columns:
        df["fertilizer_shock_3m"] = df["urea_price_usd"].pct_change(3) * 100

    # ── Rainfall anomaly
    if "rainfall_mm" in df.columns:
        monthly_avg = df["rainfall_mm"].groupby(df.index.month).transform("mean")
        df["rainfall_anomaly"] = (df["rainfall_mm"] - monthly_avg) / monthly_avg
        df["drought_flag"]     = (df["rainfall_anomaly"] < -0.20).astype(int)

    # ── Global food shock
    if "fao_food_index" in df.columns:
        df["global_food_shock_3m"] = df["fao_food_index"].pct_change(3) * 100

    # ── Commodity momentum
    for col in ["wheat_price_usd", "rice_price_usd", "maize_price_usd", "palm_oil_price_usd"]:
        if col in df.columns:
            df[f"{col.replace('_price_usd','')}_mom_3m"] = df[col].pct_change(3) * 100

    # ── Target variable lags (food inflation persistence)
    if "food_cpi_yoy" in df.columns:
        for lag in [1, 3, 6, 12]:
            df[f"food_cpi_lag{lag}"] = df["food_cpi_yoy"].shift(lag)

        df["food_cpi_mom"] = df["food_cpi_yoy"].diff(1)

        # Forecast targets (shift backwards so t predicts t+3 and t+6)
        df["target_3m"] = df["food_cpi_yoy"].shift(-3)
        df["target_6m"] = df["food_cpi_yoy"].shift(-6)

        # Risk classification
        def classify(val):
            if pd.isna(val):   return np.nan
            if val < 15:       return "Low"
            elif val <= 25:    return "Elevated"
            else:              return "High"

        df["risk_class"] = df["food_cpi_yoy"].apply(classify)

    # ── Calendar features
    df["month"]           = df.index.month
    df["quarter"]         = df.index.quarter
    df["planting_season"] = df.index.month.isin([4, 5, 6]).astype(int)
    df["harvest_season"]  = df.index.month.isin([10, 11, 12]).astype(int)

    # Approximate Ramadan months (varies yearly — using a simplified flag)
    ramadan_months = {
        2010: 8, 2011: 8, 2012: 7, 2013: 7, 2014: 6,
        2015: 6, 2016: 6, 2017: 5, 2018: 5, 2019: 5,
        2020: 4, 2021: 4, 2022: 4, 2023: 3, 2024: 3
    }
    df["ramadan_flag"] = df.apply(
        lambda r: 1 if ramadan_months.get(r.name.year) == r.name.month else 0,
        axis=1
    )

    print(f"  → {df.shape[1]} columns, {df.shape[0]} rows")
    return df


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    sources = {
        "fao":          collect_fao(),
        "pink_sheet":   collect_pink_sheet(),
        "fx":           collect_exchange_rate(),
        "fuel":         collect_fuel_prices(),
        "rainfall":     collect_rainfall(),
        "food_cpi":     collect_food_cpi(),
    }

    print("\n[+] Merging sources...")
    panel = merge_all(sources)

    panel = engineer_features(panel)

    # Save
    out_path = PROCESSED / "fiews_panel.csv"
    panel.to_csv(out_path)

    print("\n" + "=" * 65)
    print("  Dataset Summary")
    print("=" * 65)
    print(f"  Rows       : {len(panel)}")
    print(f"  Columns    : {panel.shape[1]}")
    print(f"  Date range : {panel.index.min().date()} → {panel.index.max().date()}")
    print(f"  Missing %  :")
    missing = (panel.isnull().mean() * 100).sort_values(ascending=False)
    for col, pct in missing[missing > 0].items():
        print(f"    {col:<35} {pct:.1f}%")
    print(f"\n  Saved to: {out_path}")

    print("\n" + "=" * 65)
    print("  Manual Downloads Still Needed")
    print("=" * 65)
    needed = []
    if not (RAW / "nigeria_food_cpi.csv").exists():
        needed.append("1. NBS Food CPI  →  nigerianstat.gov.ng  →  data/raw/nigeria_food_cpi.csv")
    if not (RAW / "cbn_exchange_rate.csv").exists():
        needed.append("2. CBN Exchange Rate  →  cbn.gov.ng  →  data/raw/cbn_exchange_rate.csv")
    if not (RAW / "nigeria_fuel_prices.csv").exists():
        needed.append("3. NBS Fuel Prices  →  nigerianstat.gov.ng  →  data/raw/nigeria_fuel_prices.csv")
    if not (RAW / "nigeria_rainfall.csv").exists():
        needed.append("4. CHIRPS Rainfall  →  climateserv.servirglobal.net  →  data/raw/nigeria_rainfall.csv")

    if needed:
        for item in needed:
            print(f"  {item}")
        print("\n  Once downloaded, re-run this script.")
        print("  Estimated data with correct structure is already saved so you can proceed.")
    else:
        print("  All sources collected from official data.")

    print("=" * 65)
    return panel


if __name__ == "__main__":
    panel = main()
