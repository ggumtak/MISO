import { LucideIcon, Shield, TrendingUp, LineChart, Target, Crosshair } from "lucide-react";
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
        id: "max_prob_focus",
        title: "확률 집중",
        description: "승률이 가장 높은 후보에 예산을 몰아주는 배분",
        tip: "손실을 감수하더라도 당첨 확률을 우선시합니다. 예: A 70%, B 20%면 예산 전부를 A에 배팅.",
        icon: Crosshair,
        color: "text-amber-500",
        recommendPriority: 1,
        params: [],
    },
    {
        id: "maximize_ev",
        title: "기대값 최대",
        description: "전체 기대값(EV)을 가장 크게 만드는 배분",
        tip: "장기 평균 수익을 최우선으로 봅니다. 예: EV가 높은 조합을 찾습니다.",
        icon: TrendingUp,
        color: "text-blue-400",
        recommendPriority: 2,
        params: [],
    },
    {
        id: "ev_with_shortfall_penalty",
        title: "손실 감점 배분",
        description: "기대값을 높이되 본전(B) 미달 금액에 감점을 줍니다.",
        tip: "감점 0%는 순수 기대값, 100%는 본전 미달 1B당 1B 감점. 예: 100B 부족하면 50%는 -50B처럼 계산.",
        icon: LineChart,
        color: "text-teal-400",
        recommendPriority: 3,
        params: [
            {
                key: "shortfallPenalty",
                label: "본전 미달 감점",
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
        tip: "예: 목표를 500B로 두고 500B 이상 받을 확률을 가장 크게 만듭니다.",
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
    {
        id: "all_weather_maximin",
        title: "안전 배분",
        description: "어떤 결과에서도 최소 지급액을 최대화하는 배분",
        tip: "손실 위험을 줄이고 싶을 때 사용합니다. 예: 최악 상황에서도 최소 지급을 높입니다.",
        icon: Shield,
        color: "text-emerald-400",
        recommendPriority: 5,
        params: [],
    },
];
