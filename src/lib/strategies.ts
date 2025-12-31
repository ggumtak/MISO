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
        title: "안전 우선",
        description: "어떤 결과에도 최소 지급을 최대한 지키는 배분이에요.",
        icon: Shield,
        color: "text-emerald-400",
        params: [],
    },
    {
        id: "hedge_breakeven_then_ev",
        title: "본전 지키기",
        description: "먼저 본전(B) 이상을 노리고, 가능하면 더 이득이 되게 골라요.",
        icon: TrendingUp,
        color: "text-blue-400",
        params: [],
    },
    {
        id: "beast_ev_under_maxloss",
        title: "모험 모드",
        description: "최악 손해 한도를 지키면서 평균 이득을 더 노려요.",
        icon: Skull,
        color: "text-red-500",
        params: [
            {
                key: "maxLossPct",
                label: "최악 손해 한도",
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
        title: "손해 확률 낮추기",
        description: "손해 날 확률을 제한하고 그 안에서 이득을 찾습니다.",
        icon: Crosshair,
        color: "text-orange-400",
        params: [
            {
                key: "lossProbCap",
                label: "손해 확률 한도",
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
        title: "목표 점수 맞추기",
        description: "목표 점수 이상을 받을 확률을 최대화합니다.",
        icon: Target,
        color: "text-cyan-400",
        params: [
            {
                key: "targetT",
                label: "목표 점수",
                type: "number",
                default: 500,
                suffix: "점",
                unit: "integer",
            },
        ],
    },
    {
        id: "sparse_k_focus",
        title: "소수 집중",
        description: "최대 K명에게만 몰아주는 단순 배분이에요.",
        icon: Zap,
        color: "text-yellow-400",
        params: [
            {
                key: "kSparse",
                label: "몰아줄 캐릭터 수(K)",
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
