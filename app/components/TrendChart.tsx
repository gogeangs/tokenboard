"use client";

import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type DataPoint = {
  date: string;
  value?: number;
  forecast?: number;
};

type Props = {
  data: Array<{ date: string; value: number }>;
  forecast?: Array<{ date: string; value: number }>;
  budgetLine?: number | null;
};

export function TrendChart({ data, forecast, budgetLine }: Props) {
  // Merge actual trend with forecast for a continuous chart
  const merged: DataPoint[] = data.map((d) => ({ date: d.date, value: d.value }));

  if (forecast && forecast.length > 0) {
    // Add a bridge point: last actual data point duplicated as forecast start
    if (data.length > 0) {
      const lastActual = data[data.length - 1];
      merged.push({ date: lastActual.date, value: lastActual.value, forecast: lastActual.value });
    }
    for (const f of forecast) {
      merged.push({ date: f.date, forecast: f.value });
    }
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={merged} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
          <XAxis dataKey="date" fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#0f172a" strokeWidth={2} dot={false} name="Actual" connectNulls={false} />
          {forecast && forecast.length > 0 && (
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              name="Forecast"
              connectNulls={false}
            />
          )}
          {budgetLine != null && (
            <ReferenceLine y={budgetLine} stroke="#dc2626" strokeDasharray="4 4" label="Budget" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
