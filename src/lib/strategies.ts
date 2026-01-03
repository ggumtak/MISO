import { LucideIcon, TrendingUp, ScatterChart, Percent } from "lucide-react";
import { OptimizationMode } from "@/types/calculator";

export interface StrategyDef {
    id: OptimizationMode;
    title: string;
    description: string;
    tip: string;
    icon: LucideIcon;
    color: string;
    recommendPriority: number;
    params: {
        key: string;
        label: string;
        type: "slider" | "number";
        min?: number;
        max?: number;
        step?: number;
        default: number;
        suffix?: string;
        unit?: "percent" | "integer" | "number";
    }[];
}

export const STRATEGIES: StrategyDef[] = [
    {
        id: "balanced_profit",
        title: "균형 수익",
        description: "기댓값이 높은 선수들에게 골고루 분배해서 안정적으로 수익 내기",
        tip: "90%, 80%, 70% 같은 높은 확률 선수들에게 분산 투자해요. 한 명이 져도 다른 쪽에서 커버!",
        icon: ScatterChart,
        color: "text-emerald-500",
        recommendPriority: 1,
        params: [],
    },
    {
        id: "maximize_ev",
        title: "최대 수익",
        description: "평균적으로 가장 많이 버는 곳에 집중 투자",
        tip: "기댓값이 제일 높은 선수(보통 90% 1.2배)에 올인! 장기적으론 최고 수익이지만 운 나쁘면 한 번에 날릴 수도.",
        icon: TrendingUp,
        color: "text-blue-500",
        recommendPriority: 2,
        params: [],
    },
    {
        id: "loss_limit",
        title: "손실 한도",
        description: "내가 감당할 손실 범위를 정하고, 그 안에서 최대한 벌기",
        tip: "예를 들어 '30%까지만 잃어도 돼'라고 하면, 최악의 경우에도 30%만 잃고 나머지 경우엔 수익을 극대화해요.",
        icon: Percent,
        color: "text-orange-500",
        recommendPriority: 3,
        params: [
            {
                key: "maxLossPercent",
                label: "최대 손실 허용",
                type: "slider",
                min: 0,
                max: 100,
                step: 5,
                default: 30,
                suffix: "%",
                unit: "percent",
            },
        ],
    },
];
