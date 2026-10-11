"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR } from "@/lib/format";

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const compactINR = new Intl.NumberFormat("en-IN", { notation: "compact", style: "currency", currency: "INR", maximumFractionDigits: 1 });

export function RevenueChart({ series }: { series: { date: string; revenue: number; orders: number }[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#ECE8DC" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => shortDate.format(new Date(value))}
            tick={{ fill: "#7A7465", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(value: number) => compactINR.format(value / 100)}
            tick={{ fill: "#7A7465", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip
            formatter={(value, name) => (name === "revenue" ? [formatINR(Number(value)), "Revenue"] : [value, "Orders"])}
            labelFormatter={(label) => shortDate.format(new Date(String(label)))}
            contentStyle={{ borderRadius: 12, borderColor: "#ECE8DC" }}
          />
          <Area type="monotone" dataKey="revenue" stroke="#FFC727" strokeWidth={2.5} fill="#FFF3C4" fillOpacity={1} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
