import { LucideIcon, ScatterChart, Percent } from "lucide-react";
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
        id: "loss_limit",
        title: "손실 한도",
        description: "내가 감당할 손실 범위를 정하고, 그 안에서 최대한 벌기",
        tip: "예를 들어 '30%까지만 잃어도 돼'라고 하면, 5명 중 누가 이겨도 30%까지만 잃도록 맞추고 그 안에서 수익을 극대화해요.",
        icon: Percent,
        color: "text-orange-500",
        recommendPriority: 1,
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
    {
        id: "balanced_profit",
        title: "균형 수익",
        description: "기댓값이 높은 선수들에게 골고루 분배해서 안정적으로 수익 내기",
        tip: "확률 합이 100%라서 5명 중 1명만 당첨돼요. 기댓값이 높은 쪽에 분산해서 손실 폭을 줄이는 방식입니다.",
        icon: ScatterChart,
        color: "text-emerald-500",
        recommendPriority: 2,
        params: [],
    },
];
