export interface Candidate {
    id: string;
    name: string;
    p: number; // Internal probability (0-1)
    m: number; // Multiplier
    pInput: string; // User input for probability (percent)
    mInput: string; // User input for multiplier
}

export type OptimizationMode =
    | "all_weather_maximin"
    | "maximize_ev"
    | "ev_with_shortfall_penalty"
    | "maximize_prob_ge_target";

export interface OptimizationRequest {
    budget: number;
    candidates: { name: string; p: number; m: string | number }[];
    rounding: "floor";
    mode: OptimizationMode;
    params: Record<string, number>;
}

export interface OptimizationMetrics {
    G?: number;
    EV?: number;
    EP?: number;
    P_loss?: number;
    Var?: number;
    P_ge_T?: number;
    [key: string]: number | undefined;
}

export interface OptimizationResult {
    status: "ok" | "infeasible" | "error";
    allocation?: { name: string; s: number }[];
    payoutByOutcome?: { name: string; payout: number }[];
    metrics?: OptimizationMetrics;
    notes?: string[];
}
