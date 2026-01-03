import { LucideIcon, Shield, TrendingUp, LineChart, Target } from "lucide-react";
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
        id: "all_weather_maximin",
        title: "안전 배분",
        description: "어떤 결과에서도 최소 지급액을 최대화하는 배분",
        tip: "손실 위험을 줄이고 싶을 때 기본으로 추천합니다.",
        icon: Shield,
        color: "text-emerald-400",
        recommendPriority: 1,
        params: [],
    },
    {
        id: "maximize_ev",
        title: "기대값 최대",
        description: "전체 기대값(EV)을 가장 크게 만드는 배분",
        tip: "장기적으로 평균 수익을 최우선으로 볼 때 적합합니다.",
        icon: TrendingUp,
        color: "text-blue-400",
        recommendPriority: 2,
        params: [],
    },
    {
        id: "ev_with_shortfall_penalty",
        title: "손실 패널티 균형",
        description: "기대값을 높이되 본전 미달 손실을 패널티로 조절",
        tip: "패널티를 올릴수록 손실 회피 쪽으로 이동합니다.",
        icon: LineChart,
        color: "text-teal-400",
        recommendPriority: 3,
        params: [
            {
                key: "shortfallPenalty",
                label: "손실 패널티",
                type: "slider",
                min: 0,
                max: 100,
                step: 5,
                default: 50,
                suffix: "%",
                unit: "percent",
            },
        ],
    },
    {
        id: "maximize_prob_ge_target",
        title: "목표 금액 확률",
        description: "목표 금액 이상을 받을 확률을 최대화",
        tip: "달성하고 싶은 목표 금액이 있을 때 사용하세요.",
        icon: Target,
        color: "text-cyan-400",
        recommendPriority: 4,
        params: [
            {
                key: "targetT",
                label: "목표 금액",
                type: "number",
                default: 500,
                suffix: "B",
                unit: "integer",
            },
        ],
    },
];
