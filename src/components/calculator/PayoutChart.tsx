"use client";

import { OptimizationResult } from "@/types/calculator";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
    ResponsiveContainer,
    Cell
} from "recharts";

interface PayoutChartProps {
    result: OptimizationResult;
    budget: number;
}

export function PayoutChart({ result, budget }: PayoutChartProps) {
    const data = (result.payoutByOutcome ?? []).map((item) => ({
        name: item.name,
        payout: item.payout,
        profit: item.payout - budget,
    }));

    if (data.length === 0) {
        return (
            <div className="w-full h-[300px] bg-card/30 rounded-xl border p-4 text-sm text-muted-foreground">
                결과가 생성되면 지급 그래프가 표시됩니다.
            </div>
        );
    }

    const maxPayout = Math.max(...data.map(d => d.payout), budget * 1.5);

    return (
        <div className="w-full h-[300px] bg-card/30 rounded-xl border p-4">
            <h3 className="font-semibold mb-4 text-sm text-muted-foreground">우승 시나리오별 지급</h3>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" vertical={false} />
                    <XAxis
                        dataKey="name"
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}`}
                        domain={[0, maxPayout]}
                    />
                    <Tooltip
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                const val = payload[0].value as number;
                                const profit = val - budget;
                                return (
                                    <div className="bg-background border rounded-lg p-2 shadow-xl text-xs">
                                        <p className="font-bold">{label}</p>
                                        <p className="text-muted-foreground">지급: {val}</p>
                                        <p className={profit >= 0 ? "text-emerald-500" : "text-destructive"}>
                                            수익: {profit > 0 ? "+" : ""}{profit}
                                        </p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <ReferenceLine y={budget} stroke="#0ea5a5" strokeDasharray="3 3" />
                    <Bar dataKey="payout" radius={[4, 4, 0, 0]}>
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.payout >= budget ? "#0f766e" : "#e76f51"}
                                fillOpacity={0.85}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-3">손익분기: {budget}</p>
        </div>
    );
}
