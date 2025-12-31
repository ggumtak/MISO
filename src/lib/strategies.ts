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
        title: "All Weather",
        description: "Maximize the worst-case payout (Absolute Defense).",
        icon: Shield,
        color: "text-emerald-400",
        params: [],
    },
    {
        id: "hedge_breakeven_then_ev",
        title: "Hedge Fund",
        description: "Secure principal (break-even) first, then maximize EV.",
        icon: TrendingUp,
        color: "text-blue-400",
        params: [],
    },
    {
        id: "beast_ev_under_maxloss",
        title: "Beast Mode",
        description: "Maximize EV, allowing a fixed % loss in worst case.",
        icon: Skull,
        color: "text-red-500",
        params: [
            {
                key: "maxLossPct",
                label: "Max Loss Tolerance",
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
        title: "Risk Control",
        description: "Maximize EV while keeping loss probability below X%.",
        icon: Crosshair,
        color: "text-orange-400",
        params: [
            {
                key: "lossProbCap",
                label: "Max Loss Probability",
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
        title: "Sniper",
        description: "Maximize probability of hitting a specific payout target.",
        icon: Target,
        color: "text-cyan-400",
        params: [
            {
                key: "targetT",
                label: "Target Payout",
                type: "number",
                default: 500,
                suffix: "pts",
                unit: "integer",
            },
        ],
    },
    {
        id: "sparse_k_focus",
        title: "Focused",
        description: "Bet on at most K candidates.",
        icon: Zap,
        color: "text-yellow-400",
        params: [
            {
                key: "kSparse",
                label: "Max Candidates (K)",
                type: "slider",
                min: 1,
                max: 5, // Should be dynamic based on N, but fix to 5 for now
                step: 1,
                default: 2,
                suffix: "",
                unit: "integer",
            },
        ],
    },
];
