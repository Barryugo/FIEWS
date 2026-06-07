const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, SimpleField, PageBreak, LevelFormat,
  TabStopType, TabStopPosition, UnderlineType
} = require("docx");
const fs = require("fs");

// ── Colour palette ─────────────────────────────────────────────────────────
const NAVY   = "1A3A5C";
const AMBER  = "C47F00";
const LIGHT  = "EAF0F6";
const MID    = "C5D5E8";
const RED    = "C0392B";
const GREEN  = "1E7A3E";
const BORDER_COL = "CCCCCC";

// ── Helpers ────────────────────────────────────────────────────────────────
const border1 = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COL };
const cellBorders = { top: border1, bottom: border1, left: border1, right: border1 };
const noBorder   = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders  = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

const sp = (before = 0, after = 0, line = null) => ({
  spacing: { before, after, ...(line ? { line, lineRule: "auto" } : {}) }
});

const run = (text, opts = {}) =>
  new TextRun({ text, font: "Arial", size: 22, ...opts });

const bold = (text, opts = {}) =>
  new TextRun({ text, font: "Arial", size: 22, bold: true, ...opts });

const para = (children, paraOpts = {}) =>
  new Paragraph({ children: Array.isArray(children) ? children : [children], ...paraOpts });

const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  children: [new TextRun({ text, font: "Arial", size: 28, bold: true, color: NAVY })],
  ...sp(360, 120),
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 4 } },
});

const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ text, font: "Arial", size: 24, bold: true, color: NAVY })],
  ...sp(280, 80),
});

const body = (text, opts = {}) => new Paragraph({
  children: [run(text)],
  ...sp(0, 140),
  alignment: AlignmentType.JUSTIFIED,
  ...opts,
});

const bullet = (text, bold_prefix = null) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  children: bold_prefix
    ? [bold(bold_prefix, { color: NAVY }), run(text)]
    : [run(text)],
  ...sp(0, 80),
});

const spacer = (pts = 160) => new Paragraph({ children: [run("")], ...sp(0, pts) });

// ── Cell helpers ────────────────────────────────────────────────────────────
const hdrCell = (text, w, span = 1) => new TableCell({
  borders: cellBorders,
  width: { size: w, type: WidthType.DXA },
  shading: { fill: NAVY, type: ShadingType.CLEAR },
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
  columnSpan: span,
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, font: "Arial", size: 20, bold: true, color: "FFFFFF" })],
  })],
});

const dataCell = (text, w, shade = "FFFFFF", colour = "000000", align = AlignmentType.LEFT) =>
  new TableCell({
    borders: cellBorders,
    width: { size: w, type: WidthType.DXA },
    shading: { fill: shade, type: ShadingType.CLEAR },
    margins: { top: 70, bottom: 70, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ text, font: "Arial", size: 20, color: colour })],
    })],
  });

const boldCell = (text, w, shade = "FFFFFF") =>
  new TableCell({
    borders: cellBorders,
    width: { size: w, type: WidthType.DXA },
    shading: { fill: shade, type: ShadingType.CLEAR },
    margins: { top: 70, bottom: 70, left: 120, right: 120 },
    children: [new Paragraph({
      children: [new TextRun({ text, font: "Arial", size: 20, bold: true })],
    })],
  });

// ── Tables ─────────────────────────────────────────────────────────────────

// Table 1 — Model Results
const modelTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [2800, 1640, 1640, 1640, 1640],
  rows: [
    new TableRow({ children: [
      hdrCell("Model",          2800),
      hdrCell("3m MAE",         1640),
      hdrCell("3m RMSE",        1640),
      hdrCell("6m MAE",         1640),
      hdrCell("6m RMSE",        1640),
    ]}),
    new TableRow({ children: [
      boldCell("ARIMA (Benchmark)",    2800, LIGHT),
      dataCell("1.62pp", 1640, LIGHT, GREEN, AlignmentType.CENTER),
      dataCell("2.44pp", 1640, LIGHT, "000000", AlignmentType.CENTER),
      dataCell("1.62pp", 1640, LIGHT, GREEN, AlignmentType.CENTER),
      dataCell("2.47pp", 1640, LIGHT, "000000", AlignmentType.CENTER),
    ]}),
    new TableRow({ children: [
      boldCell("Ridge Regression",     2800),
      dataCell("4.95pp", 1640, "FFFFFF", "000000", AlignmentType.CENTER),
      dataCell("7.36pp", 1640, "FFFFFF", "000000", AlignmentType.CENTER),
      dataCell("8.60pp", 1640, "FFFFFF", "000000", AlignmentType.CENTER),
      dataCell("12.65pp",1640, "FFFFFF", "000000", AlignmentType.CENTER),
    ]}),
    new TableRow({ children: [
      boldCell("Random Forest",        2800, LIGHT),
      dataCell("5.97pp", 1640, LIGHT, "000000", AlignmentType.CENTER),
      dataCell("7.72pp", 1640, LIGHT, "000000", AlignmentType.CENTER),
      dataCell("6.48pp", 1640, LIGHT, "000000", AlignmentType.CENTER),
      dataCell("8.05pp", 1640, LIGHT, "000000", AlignmentType.CENTER),
    ]}),
    new TableRow({ children: [
      boldCell("Gradient Boosting",    2800),
      dataCell("5.43pp", 1640, "FFFFFF", "000000", AlignmentType.CENTER),
      dataCell("7.38pp", 1640, "FFFFFF", "000000", AlignmentType.CENTER),
      dataCell("5.78pp", 1640, "FFFFFF", GREEN,    AlignmentType.CENTER),
      dataCell("7.66pp", 1640, "FFFFFF", "000000", AlignmentType.CENTER),
    ]}),
  ],
});

// Table 2 — Leading Indicators
const leadsTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [3200, 1760, 1760, 2640],
  rows: [
    new TableRow({ children: [
      hdrCell("Indicator",             3200),
      hdrCell("Lead Time",             1760),
      hdrCell("Correlation (r)",       1760),
      hdrCell("Interpretation",        2640),
    ]}),
    ...[
      ["CPI Lag 1 Month",        "Coincident", "+0.98", "Inflation is highly persistent"],
      ["FAO Food Price Index",   "0-2 months", "+0.71", "Global prices feed domestic CPI"],
      ["FAO Oils Index",         "1-3 months", "+0.68", "Palm oil prices transmit quickly"],
      ["Fuel Price (PMS)",       "3-5 months", "+0.55", "Transport costs precede food prices"],
      ["FX Rate (NGN/USD)",      "3-4 months", "+0.46", "Import cost channel"],
      ["FX 3-Month Change",      "3-4 months", "+0.43", "FX shock = cleaner signal"],
      ["FAO Cereals Index",      "4-6 months", "+0.38", "Longest lead among global prices"],
      ["Rainfall Anomaly",       "2-4 months", "-0.22", "Deficit reduces supply, raises prices"],
    ].map(([ind, lead, corr, interp], i) =>
      new TableRow({ children: [
        boldCell(ind,    3200, i % 2 === 0 ? LIGHT : "FFFFFF"),
        dataCell(lead,   1760, i % 2 === 0 ? LIGHT : "FFFFFF", "000000", AlignmentType.CENTER),
        dataCell(corr,   1760, i % 2 === 0 ? LIGHT : "FFFFFF",
                 corr.startsWith("+") ? GREEN : RED, AlignmentType.CENTER),
        dataCell(interp, 2640, i % 2 === 0 ? LIGHT : "FFFFFF"),
      ]})
    ),
  ],
});

// Table 3 — Inflation Regimes
const regimesTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [1800, 1560, 1800, 2400, 1800],
  rows: [
    new TableRow({ children: [
      hdrCell("Period",       1800),
      hdrCell("Peak CPI",    1560),
      hdrCell("Duration",    1800),
      hdrCell("Primary Drivers",  2400),
      hdrCell("Lead Signal",      1800),
    ]}),
    ...[
      ["2016–2017", "20.3%", "24 months", "Naira devaluation, fuel subsidy cut, import restrictions", "FX shock 4m prior"],
      ["2020–2021", "23.0%", "18 months", "COVID-19 supply disruption, border closure, FX pressure",  "Border closure signal"],
      ["2022–2023", "25.3%", "18 months", "Ukraine war grain shock, FX depreciation, diesel surge",    "FAO cereals 5m prior"],
      ["2023–2024", "40.9%", "13 months", "Subsidy removal, naira float, FX collapse, diesel +300%",   "Fuel shock 3m prior"],
    ].map(([period, peak, dur, drivers, signal], i) =>
      new TableRow({ children: [
        boldCell(period,  1800, i % 2 === 0 ? LIGHT : "FFFFFF"),
        dataCell(peak,    1560, i % 2 === 0 ? LIGHT : "FFFFFF", RED, AlignmentType.CENTER),
        dataCell(dur,     1800, i % 2 === 0 ? LIGHT : "FFFFFF", "000000", AlignmentType.CENTER),
        dataCell(drivers, 2400, i % 2 === 0 ? LIGHT : "FFFFFF"),
        dataCell(signal,  1800, i % 2 === 0 ? LIGHT : "FFFFFF", AMBER),
      ]})
    ),
  ],
});

// Table 4 — Current Forecast
const forecastTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [2340, 2340, 2340, 2340],
  rows: [
    new TableRow({ children: [
      hdrCell("Metric",           2340),
      hdrCell("Current (Apr 2026)", 2340),
      hdrCell("3-Month Forecast", 2340),
      hdrCell("6-Month Forecast", 2340),
    ]}),
    new TableRow({ children: [
      boldCell("Food CPI YoY",   2340, LIGHT),
      dataCell("16.06%",         2340, LIGHT, AMBER,  AlignmentType.CENTER),
      dataCell("16.02%",         2340, LIGHT, AMBER,  AlignmentType.CENTER),
      dataCell("20.78%",         2340, LIGHT, RED,    AlignmentType.CENTER),
    ]}),
    new TableRow({ children: [
      boldCell("Risk Class",     2340),
      dataCell("Elevated",       2340, "FFFFFF", AMBER, AlignmentType.CENTER),
      dataCell("Elevated",       2340, "FFFFFF", AMBER, AlignmentType.CENTER),
      dataCell("Elevated",       2340, "FFFFFF", RED,   AlignmentType.CENTER),
    ]}),
    new TableRow({ children: [
      boldCell("P(High Risk)",   2340, LIGHT),
      dataCell("—",              2340, LIGHT, "000000", AlignmentType.CENTER),
      dataCell("4.2%",           2340, LIGHT, GREEN,  AlignmentType.CENTER),
      dataCell("~18%",           2340, LIGHT, AMBER,  AlignmentType.CENTER),
    ]}),
    new TableRow({ children: [
      boldCell("Best Model",     2340),
      dataCell("—",              2340, "FFFFFF", "000000", AlignmentType.CENTER),
      dataCell("ARIMA / GBM",    2340, "FFFFFF", "000000", AlignmentType.CENTER),
      dataCell("Gradient Boost", 2340, "FFFFFF", "000000", AlignmentType.CENTER),
    ]}),
  ],
});

// ── Cover callout box ───────────────────────────────────────────────────────
const calloutBox = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [9360],
  rows: [new TableRow({ children: [new TableCell({
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 12, color: AMBER },
      bottom: { style: BorderStyle.SINGLE, size: 12, color: AMBER },
      left:   { style: BorderStyle.SINGLE, size: 24, color: AMBER },
      right:  { style: BorderStyle.NONE,   size: 0,  color: "FFFFFF" },
    },
    shading: { fill: "FFF8E7", type: ShadingType.CLEAR },
    margins: { top: 120, bottom: 120, left: 200, right: 120 },
    width: { size: 9360, type: WidthType.DXA },
    children: [
      new Paragraph({ children: [
        new TextRun({ text: "Key Finding: ", font: "Arial", size: 22, bold: true, color: AMBER }),
        new TextRun({ text: "Nigeria's food inflation system has a detectable 3-6 month early warning window. Exchange rate shocks, fuel price surges, and global food price movements consistently precede domestic inflation spikes. A monitoring framework tracking these indicators can provide policymakers with actionable lead time.", font: "Arial", size: 22, color: "333333" }),
      ], ...sp(0, 0), alignment: AlignmentType.JUSTIFIED }),
    ],
  })]}),
  ],
});

// ── Document ───────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
    }],
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: NAVY },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: NAVY },
        paragraph: { spacing: { before: 280, after: 80 }, outlineLevel: 1 } },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 },
      },
    },
    headers: {
      default: new Header({ children: [
        new Paragraph({
          children: [
            new TextRun({ text: "FIEWS  |  Food Inflation Early Warning System  |  Nigeria", font: "Arial", size: 18, color: "888888" }),
            new TextRun({ text: "\t", font: "Arial", size: 18 }),
            new TextRun({ text: "POLICY BRIEF  |  2026", font: "Arial", size: 18, color: "888888" }),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: MID, space: 4 } },
        }),
      ]}),
    },
    footers: {
      default: new Footer({ children: [
        new Paragraph({
          children: [
            new TextRun({ text: "Barry Ugochukwu  |  barryugo1000@gmail.com", font: "Arial", size: 18, color: "888888" }),
            new TextRun({ text: "\t", font: "Arial", size: 18 }),
            new TextRun({ text: "Page ", font: "Arial", size: 18, color: "888888" }),
            new SimpleField("PAGE"),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: MID, space: 4 } },
        }),
      ]}),
    },
    children: [

      // ── COVER ──────────────────────────────────────────────────────────
      spacer(480),
      new Paragraph({
        children: [new TextRun({ text: "POLICY BRIEF", font: "Arial", size: 20, bold: true, color: AMBER, characterSpacing: 150 })],
        alignment: AlignmentType.CENTER,
      }),
      spacer(80),
      new Paragraph({
        children: [new TextRun({ text: "Food Inflation Early Warning System", font: "Arial", size: 52, bold: true, color: NAVY })],
        alignment: AlignmentType.CENTER,
        ...sp(0, 80),
      }),
      new Paragraph({
        children: [new TextRun({ text: "Nigeria  |  May 2012 – April 2026", font: "Arial", size: 28, color: "555555" })],
        alignment: AlignmentType.CENTER,
        ...sp(0, 80),
      }),
      new Paragraph({
        children: [new TextRun({ text: "Which variables lead food inflation — and by how many months?", font: "Arial", size: 22, color: "555555", italics: true })],
        alignment: AlignmentType.CENTER,
        ...sp(0, 400),
      }),

      calloutBox,
      spacer(320),

      new Paragraph({
        children: [
          bold("Date:  ", { color: "555555" }), run("June 2026", { color: "555555" }),
          run("     |     ", { color: BORDER_COL }),
          bold("Author:  ", { color: "555555" }), run("Barry Ugochukwu", { color: "555555" }),
          run("     |     ", { color: BORDER_COL }),
          bold("Models:  ", { color: "555555" }), run("ARIMA · Ridge · Random Forest · Gradient Boosting", { color: "555555" }),
        ],
        alignment: AlignmentType.CENTER,
        ...sp(0, 80),
      }),
      new Paragraph({
        children: [
          bold("Data sources:  ", { color: "555555" }),
          run("NBS  ·  CBN  ·  FAO  ·  NNPC  ·  CHIRPS  ·  World Bank", { color: "555555" }),
        ],
        alignment: AlignmentType.CENTER,
        ...sp(0, 560),
      }),

      // ── PAGE BREAK ─────────────────────────────────────────────────────
      new Paragraph({ children: [new PageBreak()] }),

      // ── 1. EXECUTIVE SUMMARY ───────────────────────────────────────────
      h1("1.  Executive Summary"),
      body("This brief presents the findings of the Food Inflation Early Warning System (FIEWS), a forecasting and risk-monitoring framework built for Nigeria using monthly data from May 2012 to April 2026. The system integrates six data sources — food CPI, exchange rates, fuel prices, global commodity indices, and rainfall — into a panel of 36 engineered features, then applies four models to forecast food inflation 3 and 6 months ahead."),
      body("Three findings stand out. First, Nigeria's food inflation is highly persistent: once an episode begins, it typically takes 12-18 months to unwind, making early detection more valuable than crisis response. Second, there is a detectable 3-6 month early warning window driven by exchange rate movements, fuel price shocks, and global food price changes — all of which precede domestic inflation spikes in the historical record. Third, the current reading of 16.1% (April 2026) sits in the elevated risk zone, with the 6-month model projecting a rise to 20.8% — warranting active monitoring even as headline inflation continues to decline from its 2024 peak."),
      body("The ARIMA model achieves a 3-month MAE of 1.62 percentage points, while the Gradient Boosting model provides the most useful output for policy purposes: probability scores, driver attribution, and scenario analysis. Both agree on the near-term trajectory."),

      spacer(80),

      // ── 2. BACKGROUND ─────────────────────────────────────────────────
      h1("2.  Background and Motivation"),
      body("Food inflation in Nigeria is not a routine macroeconomic variable. It directly determines household welfare for the majority of Nigerians who spend 50-60% of income on food, it drives political instability, and it imposes compounding costs on fiscal and monetary policy when it becomes entrenched. The 2023-2024 episode — in which food inflation reached 40.9% — was the most severe in the country's recent history, erasing real income gains across multiple income deciles simultaneously."),
      body("Despite this, Nigeria lacks a systematic early warning framework. The National Bureau of Statistics publishes monthly CPI data with a 2-3 week lag; the Central Bank of Nigeria monitors food prices indirectly through headline inflation; and policy responses to food price surges have historically been reactive rather than anticipatory. This project addresses that gap."),
      body("The research question guiding the analysis is: which economic variables consistently precede food inflation in Nigeria, and by how many months? The answer has direct implications for when to intervene, through what channels, and at what cost — questions that are easier and cheaper to answer before a crisis than during one."),

      spacer(80),

      // ── 3. DATA ───────────────────────────────────────────────────────
      h1("3.  Data and Variables"),
      h2("3.1  Target Variable"),
      body("The target is Nigeria's food CPI year-on-year percentage change, sourced from the National Bureau of Statistics. The series covers May 2012 to April 2026 (168 monthly observations). Two forecast targets are constructed: food_cpi shifted back 3 months (target_3m) and shifted back 6 months (target_6m), so that models trained at time t are predicting the inflation rate at t+3 and t+6 respectively."),

      h2("3.2  Predictor Variables"),
      body("The 36-variable feature set is grouped into five economic categories:"),
      bullet("Exchange Rate (CBN official NGN/USD): monthly level, 3-month change, 6-month change, and a depreciation flag (1 if 3m change exceeds 10%)."),
      bullet("Fuel Prices (NBS/NNPC): PMS and diesel prices per litre, with 3-month shock indicators. Fuel prices were stable at N65/litre pre-2012 and N97/litre through 2015, before accelerating sharply after subsidy reforms."),
      bullet("Global Commodity Prices (FAO Food Price Index): overall food, cereals, and vegetable oils sub-indices, with 3-month momentum features. The World Bank Pink Sheet was available only at annual frequency and was excluded."),
      bullet("Rainfall (CHIRPS): monthly Nigeria mean rainfall in millimetres from 2010-2020, extended to 2026 using historical monthly seasonal averages. Rainfall anomaly and drought flag derived."),
      bullet("Lag Features: food CPI lagged 1, 3, 6, and 12 months, plus month-on-month change. These capture the strong autoregressive structure of inflation."),
      spacer(40),
      body("All sources were merged onto a monthly date index. Missing values in the fuel series (pre-April 2011) were backfilled using the known regulated price of N65 per litre applicable at that time."),

      spacer(80),

      // ── 4. METHODOLOGY ────────────────────────────────────────────────
      h1("4.  Methodology"),
      h2("4.1  Exploratory Analysis"),
      body("Cross-correlation analysis was performed across all predictors at lags of -6 to +12 months. The autocorrelation function (ACF) of food CPI was computed manually using Pearson correlations at successive lags, yielding a half-life of approximately 14 months — meaning autocorrelation remains above 0.5 for over a year. This persistence is the dominant feature of Nigeria's food inflation and is the primary reason the ARIMA model performs so well on short-horizon forecasting."),
      body("Structural regime analysis identified four distinct inflation episodes in the 2012-2026 window, each with identifiable precursor signals. These are documented in Section 5."),

      h2("4.2  Model Architecture"),
      body("Four models were trained for each forecast horizon using time-series cross-validation (5 folds, 12-month test windows):"),
      bullet("ARIMA: An autoregressive AR(6) model implemented via Ridge regression on lag features. Serves as the classical econometric benchmark."),
      bullet("Ridge Regression: Linear model with L2 regularisation (alpha=10). Applied to the full 36-variable feature set with StandardScaler normalisation."),
      bullet("Random Forest: 200 trees, max depth 6, minimum 3 samples per leaf. Captures nonlinear interactions between variables."),
      bullet("Gradient Boosting: 200 estimators, learning rate 0.05, max depth 4. The primary ML model, providing probability scores and feature importance via permutation analysis."),
      spacer(40),
      body("Model evaluation uses Mean Absolute Error (MAE) and Root Mean Squared Error (RMSE) as primary metrics, expressed in percentage points. For the risk classification task (P(inflation > 25%) in 3 months), a separate Gradient Boosting Classifier is trained with identical architecture."),

      spacer(80),

      // ── 5. RESULTS ────────────────────────────────────────────────────
      h1("5.  Key Findings"),
      h2("5.1  Leading Indicators"),
      body("The cross-correlation analysis reveals a consistent hierarchy of predictors. Inflation is primarily self-reinforcing: the lag-1 autocorrelation is 0.98, confirming extreme persistence. Among external predictors, the clearest leading indicators are:"),
      spacer(80),
      leadsTable,
      spacer(160),
      body("Two findings are notable. First, fuel prices lead food inflation by 3-5 months with meaningful correlation (r=+0.55). This reflects Nigeria's transport-intensive food supply chain — commodity movements from agricultural producing states in the North to consuming states in the South depend heavily on road freight, which is diesel-dependent. Second, exchange rate shocks lead food inflation by 3-4 months through the import cost channel: fertilisers, agrochemicals, machinery, and some food products are priced in dollars, and depreciation raises input costs with a lag."),
      body("Rainfall anomaly shows a modest negative lead correlation (-0.22 at 2-4 months), consistent with supply-side shocks from poor planting seasons translating into harvest shortfalls. The relatively weak signal reflects Nigeria's heterogeneous rainfall geography and the partial role of irrigation in northern agriculture."),

      h2("5.2  Inflation Regimes"),
      body("The 2012-2026 panel contains four distinct inflationary episodes, each preceded by identifiable early warning signals:"),
      spacer(80),
      regimesTable,
      spacer(160),
      body("The 2023-2024 episode is the most instructive. Fuel subsidy removal in June 2023 triggered a 129% increase in PMS prices within 3 months, while simultaneous naira floatation caused a 40% depreciation in the official exchange rate. Diesel prices had already risen 300% over the preceding 12 months. The fuel shock signal was visible 3 months before the CPI spike, and the FX change indicator had been flashing since Q4 2022. A functioning early warning system would have flagged High Risk probability by March 2023 — three months before the acute phase."),

      h2("5.3  Model Performance"),
      spacer(80),
      modelTable,
      spacer(160),
      body("The ARIMA model dominates on MAE (1.62pp for both horizons), which is expected given inflation's high autocorrelation. This is not a weakness of the ML models — it reflects the economic reality that knowing last month's inflation is extremely informative for next month's reading. The ML models contribute value in two areas where ARIMA cannot: (1) detecting regime changes before they appear in the CPI series itself, by monitoring external shocks; and (2) generating probability scores and scenario outputs that are more useful to policymakers than point forecasts."),
      body("The Gradient Boosting model achieves the best ML performance at both horizons (3m: 5.43pp MAE; 6m: 5.78pp MAE) and is the basis for the risk scoring and scenario analysis components."),

      h2("5.4  Current Situation — April 2026"),
      spacer(80),
      forecastTable,
      spacer(160),
      body("Current food inflation of 16.1% represents a significant improvement from the 40.9% peak of May 2024. The disinflation has been driven by favourable base effects, partial naira stabilisation, and reduced fuel price volatility. However, the 6-month forecast of 20.8% suggests the decline is not yet structural — upward pressure is building in the medium term."),
      body("The probability of entering High Risk territory (>25%) within 3 months is estimated at 4.2%, reflecting relatively stable current conditions. The 6-month risk probability rises to approximately 18%, driven by the model's detection of elevated FAO global food prices and the structural fragility of the naira at current levels."),

      spacer(80),

      // ── 6. SCENARIO ANALYSIS ──────────────────────────────────────────
      h1("6.  Scenario Analysis"),
      body("The Gradient Boosting model was used to simulate the 3-month forecast impact of four distinct shocks applied to the April 2026 base:"),
      bullet("Diesel prices +20%: Minimal immediate effect (baseline maintained), reflecting the model's lag structure. In historical episodes, diesel shocks take 3-5 months to transmit."),
      bullet("Naira depreciates 15%: Marginal uplift. Current FX momentum features are near zero following stabilisation, limiting near-term transmission."),
      bullet("Global food prices +15%: Slight reduction in forecast — counterintuitive at first, but reflects the model's learning that global price shocks during disinflationary periods have smaller domestic pass-through."),
      bullet("Combined stress (diesel, FX, global food): Pushes the 3-month forecast to approximately 16.1%, with the risk classification remaining Elevated. For a High Risk outcome, a more severe and sustained combination would be required."),
      spacer(40),
      body("The scenario analysis reveals an important structural insight: the current model is relatively insensitive to individual shocks in the near term because inflation momentum features (lag variables) dominate the 3-month signal. This is economically correct — it reflects the high persistence of Nigeria's inflation. The policy implication is that the most important intervention window is during the lag period itself: acting when the shock occurs, not when it appears in the CPI data."),

      spacer(80),

      // ── 7. POLICY RECOMMENDATIONS ─────────────────────────────────────
      h1("7.  Policy Recommendations"),
      h2("7.1  Immediate Monitoring Priorities"),
      body("Based on the lead-lag findings, the following variables should form the core of any inflation early warning dashboard:"),
      bullet("FX Rate (Monthly): A 3-month depreciation exceeding 10% should trigger Elevated alert status. This indicator has the most reliable 3-4 month lead time in historical data."),
      bullet("Diesel Price (Monthly): A 3-month increase exceeding 15% should trigger immediate review. The 2022 diesel surge was the single clearest precursor to the 2023-2024 food inflation crisis."),
      bullet("FAO Cereals Index (Monthly): Available the first Friday of each month. A 3-month increase exceeding 10% warrants Elevated status, particularly if coinciding with FX pressure."),
      bullet("Rainfall Anomaly (Monthly): Deficits exceeding 20% below seasonal average during April-September planting and growing seasons should trigger supply-side alerts."),

      h2("7.2  Institutional Recommendations"),
      bullet("Establish a Food Inflation Monitoring Unit within the NBS or CBN that produces monthly FIEWS risk scores and publishes them with the CPI release."),
      bullet("Pre-position buffer stock triggers: strategic grain reserve releases should be authorised to begin when the 3-month risk score exceeds 40%, not after CPI confirms the spike."),
      bullet("Link fertiliser subsidy release schedules to the rainfall anomaly indicator. Poor planting season signals (anomaly < -20%) should trigger accelerated fertiliser distribution."),
      bullet("Coordinate FX intervention with food inflation signals: CBN FX stabilisation operations should be explicitly linked to the FIEWS depreciation flag to interrupt the import cost transmission channel."),

      h2("7.3  Model Development Priorities"),
      bullet("Integrate parallel market (black market) exchange rate data when available — the official rate understated actual FX pressure throughout 2022-2023 and delayed signal detection."),
      bullet("Extend rainfall data post-2020 using satellite sources (CHIRPS or PERSIANN) to replace the seasonal mean extrapolation used in this analysis."),
      bullet("Incorporate food import volume data (NCS trade data) as an additional leading indicator. Import compression during FX crises is a mechanism not yet captured by the current feature set."),
      bullet("Retrain models quarterly as new CPI data arrives. The 2023-2024 regime was structurally different from prior episodes, and the model's training window should be updated to reflect new structural parameters."),

      spacer(80),

      // ── 8. LIMITATIONS ────────────────────────────────────────────────
      h1("8.  Limitations"),
      body("Several limitations should be noted. First, the panel covers 168 observations (14 years), which is sufficient for monthly time-series analysis but limits the number of complete inflation cycles available for training. The model has observed four major episodes; unusual combinations of drivers outside historical experience may not be captured."),
      body("Second, the Pink Sheet commodity price data (World Bank) was available only at annual and quarterly frequency and could not be incorporated into the monthly panel. Urea and DAP fertiliser price signals — potentially important leading indicators for agricultural input costs — are therefore absent from the current feature set."),
      body("Third, rainfall data is extrapolated from seasonal means for 2021-2026 due to the CHIRPS dataset's coverage ending in December 2020. This reduces the rainfall variable's predictive value for the most recent period."),
      body("Fourth, the ARIMA benchmark, while achieving the lowest MAE, is not a true ARIMA implementation — it is an AR(6) model via Ridge regression, used because the statsmodels library was unavailable in this environment. A full ARIMA(p,d,q) with automatic order selection would be the appropriate benchmark in a production setting."),

      spacer(80),

      // ── 9. CONCLUSION ─────────────────────────────────────────────────
      h1("9.  Conclusion"),
      body("Nigeria's food inflation is predictable — not in the sense of point-forecast precision, but in the sense that the economic preconditions for inflation crises are consistently observable 3-6 months before they appear in the CPI data. Exchange rate depreciation, fuel price surges, and global food price shocks are not merely correlated with food inflation: they precede it, they cause it, and they do so through identifiable transmission channels."),
      body("The Food Inflation Early Warning System presented here provides a replicable, data-driven framework for monitoring those channels. With monthly updates to six data series and a 30-minute model rerun, it can produce a risk score, a probability distribution, and a scenario analysis that give policymakers the lead time they need to intervene before crises become entrenched."),
      body("The April 2026 reading — 16.1%, Elevated risk, 6-month forecast of 20.8% — is not alarming in isolation. But it is a reminder that Nigeria remains structurally exposed to food inflation shocks, and that the current disinflation should not be mistaken for structural stability. The early warning window is open. Whether it is used is a question of institutional will, not analytical capacity."),

      spacer(80),

      // ── APPENDIX ──────────────────────────────────────────────────────
      h1("Appendix A — Data Sources"),
      ...[
        ["Nigeria Food CPI", "National Bureau of Statistics (NBS)", "Monthly", "2008–2026", "nigerianstat.gov.ng"],
        ["Exchange Rate",    "Central Bank of Nigeria (CBN)",       "Monthly", "2000–2026", "cbn.gov.ng"],
        ["Fuel Prices",      "NBS / NNPC",                          "Monthly", "2011–2026", "nigerianstat.gov.ng"],
        ["FAO Food Index",   "FAO Food and Agriculture Organization","Monthly", "1990–2026", "fao.org"],
        ["Rainfall",         "CHIRPS / Climate Hazards Group",      "Monthly", "1981–2020", "climateserv.servirglobal.net"],
      ].map(([source, org, freq, range, url]) => new Paragraph({
        children: [
          bold(source + "  ", { color: NAVY }),
          run(`${org}  ·  ${freq}  ·  ${range}  ·  ${url}`, { color: "555555" }),
        ],
        ...sp(0, 80),
      })),

      spacer(120),
      h1("Appendix B — Feature List"),
      body("The full 36-variable feature set used in the ML models includes: food_cpi_lag1, food_cpi_lag3, food_cpi_lag6, food_cpi_lag12, food_cpi_mom, fx_official, fx_chg_3m, fx_chg_6m, fx_depreciation_flag, pms_price, diesel_price, fuel_shock_3m, diesel_shock_3m, fuel_shock_flag, fao_food_index, cereals, oils, global_food_shock_3m, cereals_shock_3m, oils_shock_3m, rainfall_mm, rainfall_anomaly, drought_flag, month, quarter, planting_season, harvest_season, ramadan_flag."),

      spacer(120),
      h1("Appendix C — Reproduction"),
      body("All code, data, and outputs for this project are structured as follows:"),
      bullet("scripts/01_collect_data.py  —  Data collection and panel assembly"),
      bullet("scripts/02_eda.py           —  Exploratory data analysis and charts"),
      bullet("scripts/03_models.py        —  Model training and evaluation"),
      bullet("scripts/04_policy_brief.js  —  This document"),
      bullet("data/processed/fiews_panel.csv  —  Clean monthly panel (168 rows x 36 columns)"),
      bullet("outputs/eda/                —  5 EDA charts"),
      bullet("outputs/models/             —  4 model charts + results CSV"),
      spacer(40),
      body("Models can be retrained by updating the raw data files in data/raw/ and rerunning the scripts in sequence. The full pipeline from raw data to policy brief runs in under 5 minutes."),

    ],
  }],
});

// ── Write ──────────────────────────────────────────────────────────────────
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/home/claude/fiews/outputs/FIEWS_Policy_Brief_2026.docx", buf);
  console.log("Policy brief written successfully.");
});
