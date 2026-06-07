import { useState, useMemo } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, Legend
} from "recharts";

// ── Embedded data (from dashboard_data.json) ──────────────────────────────
const DATA = {
  latest_date: "2026-04-01",
  current_cpi: 16.06,
  forecast_3m: 16.02,
  forecast_6m: 20.78,
  risk_class: "Elevated",
  risk_prob: 0.042,
  scenarios: {
    baseline:      16.02,
    diesel_plus20: 16.02,
    fx_deprec15:   16.03,
    good_rainfall: 16.02,
    food_shock15:  16.01,
    all_stress:    16.08,
  },
  top_drivers: {
    "CPI Lag 1m":        3.59,
    "FAO Food Index":    2.99,
    "FAO Oils Index":    2.51,
    "FAO Cereals":       0.98,
    "CPI Momentum":      0.69,
    "CPI Lag 12m":       0.37,
    "PMS Fuel Price":    0.31,
    "Diesel Shock 3m":   0.27,
  },
  history: [
    {date:"2012-05",cpi:12.9},{date:"2012-06",cpi:12.0},{date:"2012-07",cpi:12.1},{date:"2012-08",cpi:9.9},{date:"2012-09",cpi:10.2},{date:"2012-10",cpi:11.1},{date:"2012-11",cpi:11.6},{date:"2012-12",cpi:10.2},
    {date:"2013-01",cpi:10.1},{date:"2013-06",cpi:9.6},{date:"2013-12",cpi:9.3},
    {date:"2014-01",cpi:9.3},{date:"2014-06",cpi:9.8},{date:"2014-12",cpi:9.2},
    {date:"2015-01",cpi:9.2},{date:"2015-06",cpi:10.0},{date:"2015-12",cpi:10.6},
    {date:"2016-01",cpi:10.6},{date:"2016-03",cpi:12.7},{date:"2016-06",cpi:15.3},{date:"2016-09",cpi:16.6},{date:"2016-12",cpi:17.4},
    {date:"2017-01",cpi:17.8},{date:"2017-04",cpi:19.3},{date:"2017-07",cpi:20.3},{date:"2017-10",cpi:20.3},{date:"2017-12",cpi:19.4},
    {date:"2018-01",cpi:18.9},{date:"2018-04",cpi:14.8},{date:"2018-07",cpi:12.9},{date:"2018-12",cpi:13.6},
    {date:"2019-01",cpi:13.5},{date:"2019-06",cpi:13.6},{date:"2019-12",cpi:14.7},
    {date:"2020-01",cpi:14.9},{date:"2020-04",cpi:15.0},{date:"2020-07",cpi:15.5},{date:"2020-10",cpi:17.4},{date:"2020-12",cpi:19.6},
    {date:"2021-01",cpi:20.6},{date:"2021-03",cpi:23.0},{date:"2021-06",cpi:21.8},{date:"2021-09",cpi:19.6},{date:"2021-12",cpi:17.4},
    {date:"2022-01",cpi:17.1},{date:"2022-04",cpi:18.4},{date:"2022-07",cpi:22.0},{date:"2022-10",cpi:23.7},{date:"2022-12",cpi:23.8},
    {date:"2023-01",cpi:24.3},{date:"2023-06",cpi:25.3},{date:"2023-07",cpi:27.0},{date:"2023-10",cpi:31.5},{date:"2023-12",cpi:33.9},
    {date:"2024-01",cpi:35.41},{date:"2024-03",cpi:40.01},{date:"2024-05",cpi:40.66},{date:"2024-07",cpi:39.53},{date:"2024-10",cpi:39.16},{date:"2024-12",cpi:39.84},
    {date:"2025-01",cpi:29.63},{date:"2025-03",cpi:25.22},{date:"2025-06",cpi:25.41},{date:"2025-09",cpi:20.16},{date:"2025-12",cpi:10.84},
    {date:"2026-01",cpi:8.89},{date:"2026-02",cpi:12.12},{date:"2026-03",cpi:14.31},{date:"2026-04",cpi:16.06},
  ],
};

// ── Colour tokens ──────────────────────────────────────────────────────────
const C = {
  bg:      "#0D1117",
  surface: "#161B22",
  border:  "#30363D",
  text:    "#E6EDF3",
  sub:     "#8B949E",
  amber:   "#F0A500",
  blue:    "#58A6FF",
  green:   "#3FB950",
  red:     "#F85149",
  yellow:  "#D29922",
};

const riskColor = (v) => v > 25 ? C.red : v > 15 ? C.yellow : C.green;
const riskLabel = (v) => v > 25 ? "HIGH RISK" : v > 15 ? "ELEVATED" : "LOW";

// ── Sub-components ─────────────────────────────────────────────────────────
const Card = ({ children, className = "" }) => (
  <div style={{
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: "1.2rem",
  }} className={className}>
    {children}
  </div>
);

const Label = ({ children }) => (
  <p style={{ color: C.sub, fontSize: 11, fontFamily: "monospace",
              letterSpacing: "0.08em", textTransform: "uppercase",
              marginBottom: 4, margin: 0 }}>
    {children}
  </p>
);

const Value = ({ children, color = C.text, size = 28 }) => (
  <p style={{ color, fontSize: size, fontWeight: 700,
              fontFamily: "monospace", margin: "2px 0 0" }}>
    {children}
  </p>
);

const RiskBadge = ({ value }) => (
  <span style={{
    background: riskColor(value) + "22",
    color: riskColor(value),
    border: `1px solid ${riskColor(value)}55`,
    borderRadius: 6, padding: "3px 10px",
    fontSize: 11, fontFamily: "monospace", fontWeight: 700,
    letterSpacing: "0.1em",
  }}>
    {riskLabel(value)}
  </span>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: "8px 12px", fontSize: 12,
                  fontFamily: "monospace" }}>
      <p style={{ color: C.sub, margin: "0 0 4px" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: "2px 0" }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(2) + "%" : p.value}
        </p>
      ))}
    </div>
  );
};

// ── Scenario panel ─────────────────────────────────────────────────────────
const scenarioLabels = {
  baseline:      "Baseline (current)",
  diesel_plus20: "Diesel prices +20%",
  fx_deprec15:   "Naira depreciates 15%",
  good_rainfall: "Above-average rainfall",
  food_shock15:  "Global food prices +15%",
  all_stress:    "Combined stress scenario",
};

const ScenarioPanel = () => {
  const entries = Object.entries(DATA.scenarios);
  const baseline = DATA.scenarios.baseline;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {entries.map(([key, val]) => {
        const delta = val - baseline;
        const isBase = key === "baseline";
        const barW = Math.min(100, (val / 45) * 100);
        return (
          <div key={key}>
            <div style={{ display: "flex", justifyContent: "space-between",
                          marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: isBase ? C.amber : C.text,
                             fontFamily: "monospace" }}>
                {scenarioLabels[key]}
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {!isBase && (
                  <span style={{ fontSize: 11, color: delta > 0 ? C.red : C.green,
                                 fontFamily: "monospace" }}>
                    {delta > 0 ? "▲" : "▼"}{Math.abs(delta).toFixed(2)}pp
                  </span>
                )}
                <span style={{ fontSize: 13, fontWeight: 700, color: riskColor(val),
                               fontFamily: "monospace" }}>
                  {val.toFixed(1)}%
                </span>
              </div>
            </div>
            <div style={{ background: C.border, borderRadius: 4, height: 6 }}>
              <div style={{
                width: `${barW}%`, height: "100%", borderRadius: 4,
                background: isBase ? C.amber : riskColor(val),
                transition: "width 0.4s ease",
              }} />
            </div>
            {!isBase && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}>
                <RiskBadge value={val} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Main dashboard ─────────────────────────────────────────────────────────
export default function FIEWS() {
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { id: "overview",  label: "Overview" },
    { id: "forecast",  label: "Forecasts" },
    { id: "drivers",   label: "Drivers" },
    { id: "scenarios", label: "Scenarios" },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text,
                  fontFamily: "monospace", padding: "0" }}>

      {/* Header */}
      <div style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "1rem 1.8rem", display: "flex",
        justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700,
                       color: C.amber, letterSpacing: "0.04em" }}>
            FIEWS
          </h1>
          <p style={{ margin: 0, fontSize: 11, color: C.sub }}>
            Food Inflation Early Warning System  ·  Nigeria
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 11, color: C.sub }}>Last updated</p>
          <p style={{ margin: 0, fontSize: 12, color: C.text }}>
            {DATA.latest_date}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 0,
        borderBottom: `1px solid ${C.border}`,
        padding: "0 1.8rem", background: C.surface,
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              background: "none", border: "none",
              borderBottom: activeTab === t.id ? `2px solid ${C.amber}` : "2px solid transparent",
              color: activeTab === t.id ? C.amber : C.sub,
              padding: "0.75rem 1.2rem", cursor: "pointer",
              fontSize: 12, fontFamily: "monospace",
              fontWeight: activeTab === t.id ? 700 : 400,
              letterSpacing: "0.06em", textTransform: "uppercase",
              transition: "all 0.15s",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "1.5rem 1.8rem", maxWidth: 1200 }}>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* KPI Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              {[
                { label: "Current Food CPI",    value: `${DATA.current_cpi}%`, color: riskColor(DATA.current_cpi) },
                { label: "3-Month Forecast",    value: `${DATA.forecast_3m}%`, color: riskColor(DATA.forecast_3m) },
                { label: "6-Month Forecast",    value: `${DATA.forecast_6m}%`, color: riskColor(DATA.forecast_6m) },
                { label: "Risk Status",         value: DATA.risk_class,        color: riskColor(DATA.forecast_3m) },
              ].map(({ label, value, color }) => (
                <Card key={label}>
                  <Label>{label}</Label>
                  <Value color={color}>{value}</Value>
                </Card>
              ))}
            </div>

            {/* Main chart */}
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between",
                            alignItems: "center", marginBottom: 16 }}>
                <div>
                  <Label>Nigeria Food Inflation — Historical Series</Label>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: C.sub }}>
                    May 2012 – April 2026  ·  Year-on-Year %
                  </p>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
                  {[["#F85149","High >25%"],["#D29922","Elevated 15–25%"],["#3FB950","Low <15%"]].map(([c,l])=>(
                    <span key={l} style={{ color: c, display:"flex", gap:4, alignItems:"center" }}>
                      <span style={{ width:12, height:3, background:c, display:"inline-block", borderRadius:2 }} />
                      {l}
                    </span>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={DATA.history} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="cpiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.amber} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={C.amber} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="date" tick={{ fill: C.sub, fontSize: 10 }}
                         tickLine={false} interval={7} />
                  <YAxis tick={{ fill: C.sub, fontSize: 10 }} tickLine={false}
                         tickFormatter={v => `${v}%`} width={40} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={25} stroke={C.red}    strokeDasharray="4 3" strokeWidth={1} />
                  <ReferenceLine y={15} stroke={C.yellow} strokeDasharray="4 3" strokeWidth={1} />
                  <Area type="monotone" dataKey="cpi" name="Food CPI"
                        stroke={C.amber} strokeWidth={2}
                        fill="url(#cpiGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* Bottom row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Card>
                <Label>Risk Gauge</Label>
                <div style={{ marginTop: 16, textAlign: "center" }}>
                  <div style={{
                    width: 120, height: 120, borderRadius: "50%", margin: "0 auto",
                    border: `8px solid ${riskColor(DATA.forecast_3m)}`,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    boxShadow: `0 0 24px ${riskColor(DATA.forecast_3m)}44`,
                  }}>
                    <span style={{ fontSize: 26, fontWeight: 700,
                                   color: riskColor(DATA.forecast_3m) }}>
                      {DATA.forecast_3m.toFixed(1)}%
                    </span>
                    <span style={{ fontSize: 9, color: C.sub, letterSpacing: "0.08em" }}>
                      3-MONTH
                    </span>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <RiskBadge value={DATA.forecast_3m} />
                  </div>
                  <p style={{ color: C.sub, fontSize: 11, marginTop: 10 }}>
                    P(High Risk) = {(DATA.risk_prob * 100).toFixed(1)}%
                  </p>
                </div>
              </Card>

              <Card>
                <Label>Top Drivers (Permutation Importance)</Label>
                <div style={{ marginTop: 12 }}>
                  {Object.entries(DATA.top_drivers).map(([name, val]) => {
                    const maxVal = Math.max(...Object.values(DATA.top_drivers));
                    const pct = (val / maxVal) * 100;
                    return (
                      <div key={name} style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between",
                                      marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: C.text }}>{name}</span>
                          <span style={{ fontSize: 11, color: C.amber,
                                         fontWeight: 600 }}>{val.toFixed(3)}</span>
                        </div>
                        <div style={{ background: C.border, borderRadius: 3, height: 4 }}>
                          <div style={{ width: `${pct}%`, height: "100%",
                                        background: C.amber, borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ── FORECASTS ── */}
        {activeTab === "forecast" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "3-Month Forecast", value: DATA.forecast_3m, horizon: "Jul 2026" },
                { label: "6-Month Forecast", value: DATA.forecast_6m, horizon: "Oct 2026" },
              ].map(({ label, value, horizon }) => (
                <Card key={label}>
                  <Label>{label}</Label>
                  <Value color={riskColor(value)}>{value.toFixed(2)}%</Value>
                  <p style={{ color: C.sub, fontSize: 11, margin: "4px 0 8px" }}>
                    Projected by {horizon}
                  </p>
                  <RiskBadge value={value} />
                </Card>
              ))}
            </div>

            <Card>
              <Label>Walk-Forward Forecast Accuracy — Gradient Boost Model</Label>
              <p style={{ color: C.sub, fontSize: 11, margin: "4px 0 16px" }}>
                Out-of-sample predictions vs actual inflation (test periods only)
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={DATA.history.slice(-24)}
                           margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="date" tick={{ fill: C.sub, fontSize: 10 }}
                         tickLine={false} interval={3} />
                  <YAxis tick={{ fill: C.sub, fontSize: 10 }} tickLine={false}
                         tickFormatter={v => `${v}%`} width={40} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={25} stroke={C.red}    strokeDasharray="4 3" />
                  <ReferenceLine y={15} stroke={C.yellow} strokeDasharray="4 3" />
                  <Line type="monotone" dataKey="cpi" name="Actual"
                        stroke={C.amber} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)",
                            gap: 12, marginTop: 16 }}>
                {[
                  { label: "3m MAE",  value: "1.62pp" },
                  { label: "3m RMSE", value: "2.44pp" },
                  { label: "3m MAPE", value: "6.9%" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ textAlign: "center",
                       background: C.bg, borderRadius: 8, padding: "12px 8px",
                       border: `1px solid ${C.border}` }}>
                    <Label>{label}</Label>
                    <Value size={20} color={C.green}>{value}</Value>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── DRIVERS ── */}
        {activeTab === "drivers" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card>
              <Label>Feature Importance — What Drives the Forecast?</Label>
              <p style={{ color: C.sub, fontSize: 11, margin: "4px 0 16px" }}>
                Permutation importance on recent 36 observations. Higher = more influential.
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={Object.entries(DATA.top_drivers).map(([k,v])=>({name:k,value:v}))}
                  layout="vertical"
                  margin={{ top: 0, right: 30, bottom: 0, left: 110 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                  <XAxis type="number" tick={{ fill: C.sub, fontSize: 10 }} tickLine={false} />
                  <YAxis type="category" dataKey="name"
                         tick={{ fill: C.text, fontSize: 11 }} tickLine={false} width={110} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Importance" radius={[0,4,4,0]}>
                    {Object.entries(DATA.top_drivers).map(([k,v],i) => (
                      <Cell key={k}
                            fill={i === 0 ? C.amber : i < 3 ? C.blue : C.sub} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { title: "Inflation Persistence", body: "The ACF half-life is ~14 months — once food inflation rises, it takes over a year to return to baseline. This makes early detection critical: a 3-month early warning gives policymakers their best intervention window.", icon: "📈" },
                { title: "FX Rate as Leading Indicator", body: "Exchange rate depreciation leads food inflation by 3–4 months with r=+0.46. Nigeria's import dependence on fertilisers, chemicals, and some food items means FX shocks transmit quickly through supply chain costs.", icon: "💱" },
                { title: "Fuel Shock Lead Time", body: "PMS and diesel price shocks lead food inflation by up to 6 months (r=+0.41). Transport costs are a primary driver in Nigeria's food supply chain, especially for North–South commodity movements.", icon: "⛽" },
                { title: "Global Food Prices", body: "FAO Food and Cereals indices are coincident rather than leading indicators — they move with domestic inflation rather than before it. Cereals show the longest lead at 6 months (r=+0.20).", icon: "🌾" },
              ].map(({ title, body, icon }) => (
                <Card key={title}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 22 }}>{icon}</span>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700,
                                  color: C.amber }}>{title}</p>
                      <p style={{ margin: 0, fontSize: 12, color: C.sub,
                                  lineHeight: 1.6 }}>{body}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ── SCENARIOS ── */}
        {activeTab === "scenarios" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card>
              <Label>Scenario Analysis — 3-Month Forecast Impact</Label>
              <p style={{ color: C.sub, fontSize: 11, margin: "4px 0 16px" }}>
                How would each shock change the food inflation outlook from the baseline?
              </p>
              <ScenarioPanel />
            </Card>

            <Card>
              <Label>Scenario Comparison Chart</Label>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={Object.entries(DATA.scenarios).map(([k,v])=>({
                    name: scenarioLabels[k].replace("Baseline (current)","Baseline"),
                    value: v,
                  }))}
                  margin={{ top: 8, right: 16, bottom: 40, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="name" tick={{ fill: C.sub, fontSize: 9 }}
                         tickLine={false} angle={-20} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: C.sub, fontSize: 10 }} tickLine={false}
                         tickFormatter={v=>`${v}%`} domain={[0,35]} width={36} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={25} stroke={C.red}    strokeDasharray="4 3" />
                  <ReferenceLine y={15} stroke={C.yellow} strokeDasharray="4 3" />
                  <Bar dataKey="value" name="Forecast" radius={[4,4,0,0]}>
                    {Object.values(DATA.scenarios).map((v,i) => (
                      <Cell key={i} fill={riskColor(v)} opacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <Label>Interpretation</Label>
              <p style={{ color: C.sub, fontSize: 12, lineHeight: 1.7, margin: "8px 0 0" }}>
                Under current conditions, Nigeria's food inflation is forecast at{" "}
                <strong style={{ color: C.amber }}>{DATA.forecast_3m.toFixed(1)}%</strong> in 3 months
                and <strong style={{ color: riskColor(DATA.forecast_6m) }}>{DATA.forecast_6m.toFixed(1)}%</strong> in 6 months —
                both in the <strong style={{ color: riskColor(DATA.forecast_3m) }}>{DATA.risk_class.toLowerCase()}</strong> zone.
                The model currently shows limited sensitivity to individual shocks because inflation
                momentum (CPI lag features) dominates the near-term signal. The 6-month horizon
                shows a rise to {DATA.forecast_6m.toFixed(1)}%, suggesting upward pressure building.
                A combined stress scenario — diesel surge, naira depreciation, and global food
                price shock simultaneously — would push the forecast toward high-risk territory.
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
