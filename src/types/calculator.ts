export interface Candidate {
    id: string;
    name: string;
    p: number; // Internal probability (0-1)
    m: number; // Multiplier
    pInput: string; // User input for probability (percent)
    mInput: string; // User input for multiplier
}

export type OptimizationMode =
    | "balanced_profit"
    | "maximize_ev"
    | "loss_limit";

export interface OptimizationRequest {
    budget: number;
    candidates: { name: string; p: number; m: string | number }[];
    rounding: "floor";
    mode: OptimizationMode;
    params: Record<string, number>;
}

export interface OptimizationMetrics {
    G?: number;        // 최소 보장 (최악의 경우)
    EV?: number;       // 평균 예상 수익
    EP?: number;       // 예상 이익 (EV - B)
    P_loss?: number;   // 손해 볼 확률
    Var?: number;      // 분산
    P_ge_T?: number;   // 목표 달성 확률
    [key: string]: number | undefined;
}

export interface OptimizationResult {
    status: "ok" | "infeasible" | "error";
    allocation?: { name: string; s: number }[];
    payoutByOutcome?: { name: string; payout: number }[];
    metrics?: OptimizationMetrics;
    notes?: string[];
}
