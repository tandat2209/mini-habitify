"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ComparisonPoint {
  date: string;
  previousDate: string;
  current: number | null;
  previous: number | null;
}
export function weekday(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function ComparisonChart({
  points,
  numeric = false,
  integers = false,
  height = 140,
  formatValue = (value) => String(value),
}: {
  points: ComparisonPoint[];
  numeric?: boolean;
  integers?: boolean;
  height?: number;
  formatValue?: (value: number) => string;
}) {
  const axes = (
    <>
      <CartesianGrid
        vertical={false}
        stroke="var(--border)"
        strokeDasharray="3 5"
      />
      <XAxis
        dataKey="date"
        tickFormatter={weekday}
        axisLine={false}
        tickLine={false}
        interval={0}
        tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
        tickMargin={10}
      />
      <YAxis
        allowDecimals={!integers}
        width={36}
        axisLine={false}
        tickLine={false}
        tickCount={3}
        tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
        domain={numeric ? ["auto", "auto"] : [0, "auto"]}
      />
      <Tooltip
        labelFormatter={(label) => weekday(String(label))}
        formatter={(value) => formatValue(Number(value))}
        contentStyle={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          color: "var(--foreground)",
          fontSize: 12,
        }}
        cursor={
          numeric
            ? { stroke: "var(--border)" }
            : { fill: "var(--muted)", opacity: 0.3 }
        }
      />
    </>
  );
  return (
    <div className="review-chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {numeric ? (
          <LineChart
            data={points}
            margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
            accessibilityLayer
          >
            {axes}
            <Line
              dataKey="previous"
              name="Last week"
              stroke="var(--muted-foreground)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="current"
              name="This week"
              stroke="var(--primary-ink, var(--primary))"
              strokeWidth={2.5}
              dot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        ) : (
          <BarChart
            data={points}
            margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
            barGap={3}
            accessibilityLayer
          >
            {axes}
            <Bar
              dataKey="previous"
              name="Last week"
              fill="var(--muted)"
              stroke="var(--muted-foreground)"
              strokeDasharray="2 2"
              maxBarSize={24}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="current"
              name="This week"
              fill="var(--primary)"
              maxBarSize={24}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function ChartData({
  points,
  formatValue = (value) => String(value),
}: {
  points: ComparisonPoint[];
  formatValue?: (value: number) => string;
}) {
  return (
    <details className="review-chart-data">
      <summary>Chart data</summary>
      <table>
        <caption className="sr-only">
          Daily values for this week and matching weekdays last week
        </caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">This week</th>
            <th scope="col">Previous date</th>
            <th scope="col">Last week</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <th scope="row">{point.date}</th>
              <td>
                {point.current === null ? "—" : formatValue(point.current)}
              </td>
              <td>{point.previousDate}</td>
              <td>
                {point.previous === null ? "—" : formatValue(point.previous)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
