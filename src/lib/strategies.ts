import { LucideIcon, Shield, TrendingUp, Skull, Crosshair, Target, Zap, LineChart } from "lucide-react";
import { OptimizationMode } from "@/types/calculator";

export interface StrategyDef {
    id: OptimizationMode;
    title: string;
    description: string;
    tip: string; // 초보자를 위한 친절한 팁
    icon: LucideIcon;
    color: string;
    recommendPriority: number; // 추천 우선순위 (낮을수록 먼저 추천)
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
        description: "어떤 결과가 나와도 최소 수익을 보장하는 배분",
        tip: "처음 사용한다면 이 전략 추천. 손해 없이 안정적",
        icon: Shield,
        color: "text-emerald-400",
        recommendPriority: 1,
        params: [],
    },
    {
        id: "hedge_breakeven_then_ev",
        title: "본전 확보",
        description: "투자금만큼은 돌려받고, 가능하면 수익도 챙김",
        tip: "잃기 싫을 때 선택. 본전 보장 후 추가 수익 추구",
        icon: TrendingUp,
        color: "text-blue-400",
        recommendPriority: 2,
        params: [],
    },
    {
        id: "ev_with_shortfall_penalty",
        title: "손실 패널티 균형",
        description: "기대값을 최대화하되 예산 미만 손실에 패널티를 부여",
        tip: "패널티가 높을수록 손실 회피 쪽으로 배분됩니다.",
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
        id: "beast_ev_under_maxloss",
        title: "고수익 추구",
        description: "손실 한도 내에서 평균 수익 최대화",
        tip: "일부 손실 감수 가능할 때. 수익 기대값 높임",
        icon: Skull,
        color: "text-red-500",
        recommendPriority: 4,
        params: [
            {
                key: "maxLossPct",
                label: "최대 손실률",
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
        title: "손실 확률 제한",
        description: "손해 볼 확률을 제한하고 그 안에서 수익 최대화",
        tip: "손실 확률 상한선 설정 후 최적 배분 계산",
        icon: Crosshair,
        color: "text-orange-400",
        recommendPriority: 3,
        params: [
            {
                key: "lossProbCap",
                label: "손실 확률 한도",
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
        title: "목표 금액 달성",
        description: "설정한 금액 이상 받을 확률을 최대화",
        tip: "특정 목표 금액이 있을 때 사용",
        icon: Target,
        color: "text-cyan-400",
        recommendPriority: 5,
        params: [
            {
                key: "targetT",
                label: "목표 금액",
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
        description: "K명에게만 집중 배분하는 단순 전략",
        tip: "특정 캐릭터에 몰빵하고 싶을 때",
        icon: Zap,
        color: "text-yellow-400",
        recommendPriority: 6,
        params: [
            {
                key: "kSparse",
                label: "집중할 캐릭터 수",
                type: "slider",
                min: 1,
                max: 5,
                step: 1,
                default: 2,
                suffix: "명",
                unit: "integer",
            },
        ],
    },
];
