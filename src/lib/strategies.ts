import { LucideIcon, Shield, TrendingUp, Skull, Crosshair, Target, Zap, LineChart } from "lucide-react";
import { OptimizationMode } from "@/types/calculator";

export interface StrategyDef {
    id: OptimizationMode;
    title: string;
    description: string;
    icon: LucideIcon;
    color: string;
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
        title: "올웨더 수비형",
        description: "최악의 지급(G)을 최대화해 손실을 최소화합니다.",
        icon: Shield,
        color: "text-emerald-400",
        params: [],
    },
    {
        id: "hedge_breakeven_then_ev",
        title: "원금 방어형",
        description: "손익분기(G ≥ B) 확보 후 기대값(EV)을 최대화합니다.",
        icon: TrendingUp,
        color: "text-blue-400",
        params: [],
    },
    {
        id: "beast_ev_under_maxloss",
        title: "야수 모드",
        description: "최악 손실 한도를 두고 EV를 최대화합니다.",
        icon: Skull,
        color: "text-red-500",
        params: [
            {
                key: "maxLossPct",
                label: "최악 손실 허용치",
                type: "slider",
                min: 0,
                max: 100,
                step: 5,
                default: 20,
                suffix: "%",
                unit: "percent",
            },
        ],
    },
    {
        id: "ev_under_lossprob_cap",
        title: "리스크 제어",
        description: "손실 확률을 제한하고 EV를 최대화합니다.",
        icon: Crosshair,
        color: "text-orange-400",
        params: [
            {
                key: "lossProbCap",
                label: "손실 확률 상한",
                type: "slider",
                min: 0,
                max: 50,
                step: 1,
                default: 10,
                suffix: "%",
                unit: "percent",
            },
        ],
    },
    {
        id: "maximize_prob_ge_target",
        title: "저격형",
        description: "목표 지급액 이상일 확률을 최대화합니다.",
        icon: Target,
        color: "text-cyan-400",
        params: [
            {
                key: "targetT",
                label: "목표 지급액",
                type: "number",
                default: 500,
                suffix: "점",
                unit: "integer",
            },
        ],
    },
    {
        id: "sparse_k_focus",
        title: "집중형",
        description: "최대 K명에게만 투표권을 배분합니다.",
        icon: Zap,
        color: "text-yellow-400",
        params: [
            {
                key: "kSparse",
                label: "최대 캐릭터 수(K)",
                type: "slider",
                min: 1,
                max: 5, // 후보 수에 따라 바꿔야 하지만 현재는 5로 고정합니다.
                step: 1,
                default: 2,
                suffix: "",
                unit: "integer",
            },
        ],
    },
];
