import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EPS = 1e-9;
const NEG = Number.NEGATIVE_INFINITY;
const POS = Number.POSITIVE_INFINITY;

type CandidateInput = { name: string; p: number; m: string | number };
type OptimizeRequest = {
    budget: number;
    candidates: CandidateInput[];
    rounding: string;
    mode: string;
    params?: Record<string, unknown>;
};

type CandidateData = { name: string; p: number; numer: bigint; denom: bigint };

function jsonError(notes: string[], status = 400) {
    return NextResponse.json({ status: "error", notes }, { status });
}

function gcd(a: bigint, b: bigint) {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;
    while (y !== 0n) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}

function parseMultiplier(raw: string | number) {
    const text = typeof raw === "number" ? raw.toString() : raw.trim();
    if (!text) return null;
    if (/[eE]/.test(text)) {
        const asNumber = Number(text);
        if (!Number.isFinite(asNumber)) return null;
        return parseMultiplier(asNumber.toString());
    }
    const match = text.match(/^(-)?(\d+)(?:\.(\d+))?$/);
    if (!match) return null;
    const sign = match[1] ? -1n : 1n;
    const whole = match[2] ?? "0";
    const frac = match[3] ?? "";
    const numerStr = `${whole}${frac}`;
    if (!numerStr) return null;
    let numer = BigInt(numerStr) * sign;
    const denom = frac.length ? 10n ** BigInt(frac.length) : 1n;
    if (numer <= 0n) return null;
    const divisor = gcd(numer, denom);
    numer /= divisor;
    return { numer, denom: denom / divisor };
}

function buildPayoutTable(numer: bigint, denom: bigint, budget: number) {
    const payouts = new Array<number>(budget + 1);
    for (let s = 0; s <= budget; s += 1) {
        payouts[s] = Number((BigInt(s) * numer) / denom);
    }
    return payouts;
}

function maskProbabilities(probabilities: number[]) {
    const count = 1 << probabilities.length;
    const totals = new Float64Array(count);
    for (let mask = 1; mask < count; mask += 1) {
        const bit = mask & -mask;
        const idx = Math.log2(bit);
        totals[mask] = totals[mask ^ bit] + probabilities[idx];
    }
    return totals;
}

function optimizeAllWeather(payouts: number[][], probabilities: number[], budget: number) {
    const n = payouts.length;
    const choices: Int32Array[] = [];
    let prevMin = new Float64Array(budget + 1);
    let prevEV = new Float64Array(budget + 1);
    prevMin.fill(NEG);
    prevEV.fill(NEG);
    prevMin[0] = POS;
    prevEV[0] = 0;

    for (let i = 0; i < n; i += 1) {
        const nextMin = new Float64Array(budget + 1);
        const nextEV = new Float64Array(budget + 1);
        const choice = new Int32Array(budget + 1);
        nextMin.fill(NEG);
        nextEV.fill(NEG);
        choice.fill(-1);

        for (let b = 0; b <= budget; b += 1) {
            let bestMin = NEG;
            let bestEV = NEG;
            let bestS = -1;
            for (let s = 0; s <= b; s += 1) {
                const prevBudget = b - s;
                const prevMinVal = prevMin[prevBudget];
                if (prevMinVal === NEG) continue;
                const payout = payouts[i][s];
                const candidateMin = Math.min(prevMinVal, payout);
                const candidateEV = prevEV[prevBudget] + probabilities[i] * payout;
                if (
                    candidateMin > bestMin + EPS ||
                    (Math.abs(candidateMin - bestMin) <= EPS && candidateEV > bestEV + EPS)
                ) {
                    bestMin = candidateMin;
                    bestEV = candidateEV;
                    bestS = s;
                }
            }
            if (bestS >= 0) {
                nextMin[b] = bestMin;
                nextEV[b] = bestEV;
                choice[b] = bestS;
            }
        }

        choices[i] = choice;
        prevMin = nextMin;
        prevEV = nextEV;
    }

    if (prevMin[budget] === NEG) return null;

    const allocation = new Array<number>(n).fill(0);
    let remaining = budget;
    for (let i = n - 1; i >= 0; i -= 1) {
        const s = choices[i][remaining];
        if (s < 0) return null;
        allocation[i] = s;
        remaining -= s;
    }
    return allocation;
}

function optimizeEVWithMinPayout(
    payouts: number[][],
    probabilities: number[],
    budget: number,
    minPayout: number | null
) {
    const n = payouts.length;
    const choices: Int32Array[] = [];
    let prevEV = new Float64Array(budget + 1);
    prevEV.fill(NEG);
    prevEV[0] = 0;

    for (let i = 0; i < n; i += 1) {
        const nextEV = new Float64Array(budget + 1);
        const choice = new Int32Array(budget + 1);
        nextEV.fill(NEG);
        choice.fill(-1);

        for (let b = 0; b <= budget; b += 1) {
            let bestEV = NEG;
            let bestS = -1;
            for (let s = 0; s <= b; s += 1) {
                const prevBudget = b - s;
                const prevVal = prevEV[prevBudget];
                if (prevVal === NEG) continue;
                const payout = payouts[i][s];
                if (minPayout !== null && payout < minPayout) continue;
                const candidateEV = prevVal + probabilities[i] * payout;
                if (candidateEV > bestEV + EPS) {
                    bestEV = candidateEV;
                    bestS = s;
                }
            }
            if (bestS >= 0) {
                nextEV[b] = bestEV;
                choice[b] = bestS;
            }
        }

        choices[i] = choice;
        prevEV = nextEV;
    }

    if (prevEV[budget] === NEG) return null;

    const allocation = new Array<number>(n).fill(0);
    let remaining = budget;
    for (let i = n - 1; i >= 0; i -= 1) {
        const s = choices[i][remaining];
        if (s < 0) return null;
        allocation[i] = s;
        remaining -= s;
    }
    return allocation;
}

function optimizeEVUnderLossCap(
    payouts: number[][],
    probabilities: number[],
    budget: number,
    lossCap: number
) {
    const n = payouts.length;
    const maskCount = 1 << n;
    const totalStates = (budget + 1) * maskCount;
    const choices: Int32Array[] = [];
    let prev = new Float64Array(totalStates);
    prev.fill(NEG);
    prev[0] = 0;

    for (let i = 0; i < n; i += 1) {
        const next = new Float64Array(totalStates);
        const choice = new Int32Array(totalStates);
        next.fill(NEG);
        choice.fill(-1);
        const bit = 1 << i;

        for (let prevBudget = 0; prevBudget <= budget; prevBudget += 1) {
            const prevOffset = prevBudget * maskCount;
            for (let prevMask = 0; prevMask < maskCount; prevMask += 1) {
                const prevVal = prev[prevOffset + prevMask];
                if (prevVal === NEG) continue;
                for (let s = 0; s <= budget - prevBudget; s += 1) {
                    const payout = payouts[i][s];
                    const newBudget = prevBudget + s;
                    const loss = payout < budget ? bit : 0;
                    const newMask = prevMask | loss;
                    const idx = newBudget * maskCount + newMask;
                    const candidateEV = prevVal + probabilities[i] * payout;
                    if (candidateEV > next[idx] + EPS) {
                        next[idx] = candidateEV;
                        choice[idx] = s;
                    }
                }
            }
        }

        choices[i] = choice;
        prev = next;
    }

    const maskLoss = maskProbabilities(probabilities);
    let bestMask = -1;
    let bestEV = NEG;
    const finalOffset = budget * maskCount;
    for (let mask = 0; mask < maskCount; mask += 1) {
        if (maskLoss[mask] > lossCap + EPS) continue;
        const value = prev[finalOffset + mask];
        if (value > bestEV + EPS) {
            bestEV = value;
            bestMask = mask;
        }
    }

    if (bestMask < 0) return null;

    const allocation = new Array<number>(n).fill(0);
    let remaining = budget;
    let mask = bestMask;
    for (let i = n - 1; i >= 0; i -= 1) {
        const idx = remaining * maskCount + mask;
        const s = choices[i][idx];
        if (s < 0) return null;
        allocation[i] = s;
        remaining -= s;
        mask &= ~(1 << i);
    }
    return allocation;
}

function optimizeMaximizeProbTarget(
    payouts: number[][],
    probabilities: number[],
    budget: number,
    target: number
) {
    const n = payouts.length;
    const maskCount = 1 << n;
    const totalStates = (budget + 1) * maskCount;
    const choices: Int32Array[] = [];
    let prevEV = new Float64Array(totalStates);
    let prevMin = new Float64Array(totalStates);
    prevEV.fill(NEG);
    prevMin.fill(NEG);
    prevEV[0] = 0;
    prevMin[0] = POS;

    for (let i = 0; i < n; i += 1) {
        const nextEV = new Float64Array(totalStates);
        const nextMin = new Float64Array(totalStates);
        const choice = new Int32Array(totalStates);
        nextEV.fill(NEG);
        nextMin.fill(NEG);
        choice.fill(-1);
        const bit = 1 << i;

        for (let prevBudget = 0; prevBudget <= budget; prevBudget += 1) {
            const prevOffset = prevBudget * maskCount;
            for (let prevMask = 0; prevMask < maskCount; prevMask += 1) {
                const prevVal = prevEV[prevOffset + prevMask];
                if (prevVal === NEG) continue;
                const prevMinVal = prevMin[prevOffset + prevMask];
                for (let s = 0; s <= budget - prevBudget; s += 1) {
                    const payout = payouts[i][s];
                    const newBudget = prevBudget + s;
                    const hit = payout >= target ? bit : 0;
                    const newMask = prevMask | hit;
                    const idx = newBudget * maskCount + newMask;
                    const candidateEV = prevVal + probabilities[i] * payout;
                    const candidateMin = Math.min(prevMinVal, payout);
                    const currentEV = nextEV[idx];
                    if (
                        candidateEV > currentEV + EPS ||
                        (Math.abs(candidateEV - currentEV) <= EPS &&
                            candidateMin > nextMin[idx] + EPS)
                    ) {
                        nextEV[idx] = candidateEV;
                        nextMin[idx] = candidateMin;
                        choice[idx] = s;
                    }
                }
            }
        }

        choices[i] = choice;
        prevEV = nextEV;
        prevMin = nextMin;
    }

    const maskHits = maskProbabilities(probabilities);
    const finalOffset = budget * maskCount;
    let bestMask = -1;
    let bestProb = NEG;
    let bestEV = NEG;
    let bestMin = NEG;
    for (let mask = 0; mask < maskCount; mask += 1) {
        const idx = finalOffset + mask;
        const ev = prevEV[idx];
        if (ev === NEG) continue;
        const prob = maskHits[mask];
        if (prob > bestProb + EPS) {
            bestProb = prob;
            bestEV = ev;
            bestMin = prevMin[idx];
            bestMask = mask;
        } else if (Math.abs(prob - bestProb) <= EPS) {
            if (ev > bestEV + EPS || (Math.abs(ev - bestEV) <= EPS && prevMin[idx] > bestMin + EPS)) {
                bestProb = prob;
                bestEV = ev;
                bestMin = prevMin[idx];
                bestMask = mask;
            }
        }
    }

    if (bestMask < 0) return null;

    const allocation = new Array<number>(n).fill(0);
    let remaining = budget;
    let mask = bestMask;
    for (let i = n - 1; i >= 0; i -= 1) {
        const idx = remaining * maskCount + mask;
        const s = choices[i][idx];
        if (s < 0) return null;
        allocation[i] = s;
        remaining -= s;
        mask &= ~(1 << i);
    }
    return allocation;
}

function optimizeSparseKFocus(
    payouts: number[][],
    probabilities: number[],
    budget: number,
    maxK: number
) {
    const n = payouts.length;
    const kMax = Math.max(1, Math.min(maxK, n));
    const totalStates = (budget + 1) * (kMax + 1);
    const choices: Int32Array[] = [];
    let prev = new Float64Array(totalStates);
    prev.fill(NEG);
    prev[0] = 0;

    for (let i = 0; i < n; i += 1) {
        const next = new Float64Array(totalStates);
        const choice = new Int32Array(totalStates);
        next.fill(NEG);
        choice.fill(-1);

        for (let prevBudget = 0; prevBudget <= budget; prevBudget += 1) {
            const prevOffset = prevBudget * (kMax + 1);
            for (let prevK = 0; prevK <= kMax; prevK += 1) {
                const prevVal = prev[prevOffset + prevK];
                if (prevVal === NEG) continue;
                for (let s = 0; s <= budget - prevBudget; s += 1) {
                    const newBudget = prevBudget + s;
                    const newK = prevK + (s > 0 ? 1 : 0);
                    if (newK > kMax) continue;
                    const idx = newBudget * (kMax + 1) + newK;
                    const candidateEV = prevVal + probabilities[i] * payouts[i][s];
                    if (candidateEV > next[idx] + EPS) {
                        next[idx] = candidateEV;
                        choice[idx] = s;
                    }
                }
            }
        }

        choices[i] = choice;
        prev = next;
    }

    let bestK = -1;
    let bestEV = NEG;
    for (let k = 0; k <= kMax; k += 1) {
        const value = prev[budget * (kMax + 1) + k];
        if (value > bestEV + EPS) {
            bestEV = value;
            bestK = k;
        }
    }

    if (bestK < 0) return null;

    const allocation = new Array<number>(n).fill(0);
    let remaining = budget;
    let k = bestK;
    for (let i = n - 1; i >= 0; i -= 1) {
        const idx = remaining * (kMax + 1) + k;
        const s = choices[i][idx];
        if (s < 0) return null;
        allocation[i] = s;
        remaining -= s;
        if (s > 0) k -= 1;
    }
    return allocation;
}

function buildResult(
    candidates: CandidateData[],
    payouts: number[][],
    allocation: number[],
    budget: number,
    targetT?: number
) {
    let G = POS;
    let EV = 0;
    let P_loss = 0;
    let P_ge_T = 0;
    const payoutByOutcome = [];
    const allocationList = [];

    for (let i = 0; i < candidates.length; i += 1) {
        const payout = payouts[i][allocation[i]];
        payoutByOutcome.push({ name: candidates[i].name, payout });
        allocationList.push({ name: candidates[i].name, s: allocation[i] });
        G = Math.min(G, payout);
        EV += candidates[i].p * payout;
        if (payout < budget) {
            P_loss += candidates[i].p;
        }
        if (targetT !== undefined && payout >= targetT) {
            P_ge_T += candidates[i].p;
        }
    }

    const metrics: Record<string, number> = {
        G: Number.isFinite(G) ? G : 0,
        EV,
        EP: EV - budget,
        P_loss,
    };
    if (targetT !== undefined) {
        metrics.P_ge_T = P_ge_T;
    }

    return { allocation: allocationList, payoutByOutcome, metrics };
}

export async function POST(request: Request) {
    const backendBaseUrl = process.env.BACKEND_BASE_URL;
    if (backendBaseUrl) {
        const body = await request.text();
        try {
            const response = await fetch(`${backendBaseUrl}/api/optimize`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body,
                cache: "no-store",
            });

            const responseBody = await response.text();
            const contentType = response.headers.get("content-type") ?? "application/json";

            return new NextResponse(responseBody, {
                status: response.status,
                headers: { "Content-Type": contentType },
            });
        } catch (error) {
            console.error("Optimize proxy failed:", error);
            return NextResponse.json(
                {
                    status: "error",
                    notes: ["Unable to reach optimization backend."],
                },
                { status: 502 }
            );
        }
    }

    let parsed: OptimizeRequest;
    try {
        parsed = (await request.json()) as OptimizeRequest;
    } catch {
        return jsonError(["Invalid JSON payload."]);
    }

    if (!parsed || typeof parsed !== "object") {
        return jsonError(["Invalid request payload."]);
    }

    const { budget, candidates, rounding, mode } = parsed;
    const params = (parsed.params ?? {}) as Record<string, unknown>;

    if (!Number.isInteger(budget) || budget <= 0) {
        return jsonError(["Budget must be a positive integer."]);
    }

    if (!Array.isArray(candidates) || candidates.length === 0) {
        return jsonError(["At least one candidate is required."]);
    }

    if (rounding !== "floor") {
        return jsonError(["Only floor rounding is supported."]);
    }

    const notes: string[] = [];
    const nameSet = new Set<string>();
    const candidateData: CandidateData[] = [];

    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== "object") {
            return jsonError(["Candidate entries must be objects."]);
        }
        const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
        if (!name) {
            return jsonError(["Candidate name is required."]);
        }
        if (nameSet.has(name)) {
            notes.push(`Duplicate candidate name detected: ${name}.`);
        }
        nameSet.add(name);

        const p = candidate.p;
        if (!Number.isFinite(p) || p < 0) {
            return jsonError([`Invalid probability for ${name}.`]);
        }

        const ratio = parseMultiplier(candidate.m);
        if (!ratio) {
            return jsonError([`Invalid multiplier for ${name}.`]);
        }

        candidateData.push({ name, p, numer: ratio.numer, denom: ratio.denom });
    }

    let sumP = candidateData.reduce((sum, c) => sum + c.p, 0);
    if (params.normalizeProb === true) {
        if (sumP > 0) {
            candidateData.forEach((c) => {
                c.p = c.p / sumP;
            });
            notes.push("Probabilities normalized to sum to 1.");
            sumP = 1;
        }
    } else if (sumP > 1.5 && sumP <= 100.5) {
        candidateData.forEach((c) => {
            c.p = c.p / 100;
        });
        notes.push("Probabilities interpreted as percent inputs.");
        sumP = candidateData.reduce((sum, c) => sum + c.p, 0);
    }

    if (Math.abs(sumP - 1) > 0.01) {
        notes.push(`Probabilities sum to ${sumP.toFixed(4)}. Using values as-is.`);
    }

    const payouts = candidateData.map((candidate) =>
        buildPayoutTable(candidate.numer, candidate.denom, budget)
    );
    const probabilities = candidateData.map((candidate) => candidate.p);

    let allocation: number[] | null = null;
    let status: "ok" | "infeasible" = "ok";
    let targetT: number | undefined;

    switch (mode) {
        case "all_weather_maximin": {
            allocation = optimizeAllWeather(payouts, probabilities, budget);
            break;
        }
        case "hedge_breakeven_then_ev": {
            allocation = optimizeEVWithMinPayout(payouts, probabilities, budget, budget);
            if (!allocation) {
                status = "infeasible";
                notes.push("No solution satisfies G >= B. Returning all-weather fallback.");
                allocation = optimizeAllWeather(payouts, probabilities, budget);
            }
            break;
        }
        case "beast_ev_under_maxloss": {
            let maxLossPct = Number(params.maxLossPct);
            if (!Number.isFinite(maxLossPct)) {
                return jsonError(["maxLossPct is required."]);
            }
            if (maxLossPct > 1 && maxLossPct <= 100) {
                maxLossPct /= 100;
                notes.push("maxLossPct interpreted as percent.");
            }
            if (maxLossPct < 0 || maxLossPct > 1) {
                return jsonError(["maxLossPct must be between 0 and 1."]);
            }
            const minG = Math.floor(budget * (1 - maxLossPct));
            allocation = optimizeEVWithMinPayout(payouts, probabilities, budget, minG);
            if (!allocation) {
                status = "infeasible";
                notes.push("No allocation satisfies the max loss constraint.");
            }
            break;
        }
        case "ev_under_lossprob_cap": {
            let cap = Number(params.lossProbCap);
            if (!Number.isFinite(cap)) {
                return jsonError(["lossProbCap is required."]);
            }
            if (cap > 1 && cap <= 100) {
                cap /= 100;
                notes.push("lossProbCap interpreted as percent.");
            }
            if (cap < 0 || cap > 1) {
                return jsonError(["lossProbCap must be between 0 and 1."]);
            }
            allocation = optimizeEVUnderLossCap(payouts, probabilities, budget, cap);
            if (!allocation) {
                status = "infeasible";
                notes.push("No allocation satisfies the loss probability cap.");
            }
            break;
        }
        case "maximize_prob_ge_target": {
            const rawTarget = Number(params.targetT);
            if (!Number.isFinite(rawTarget)) {
                return jsonError(["targetT is required."]);
            }
            if (!Number.isInteger(rawTarget) || rawTarget < 0) {
                return jsonError(["targetT must be a non-negative integer."]);
            }
            targetT = rawTarget;
            allocation = optimizeMaximizeProbTarget(payouts, probabilities, budget, targetT);
            break;
        }
        case "sparse_k_focus": {
            const rawK = Number(params.kSparse);
            if (!Number.isFinite(rawK)) {
                return jsonError(["kSparse is required."]);
            }
            if (!Number.isInteger(rawK) || rawK < 1) {
                return jsonError(["kSparse must be an integer >= 1."]);
            }
            allocation = optimizeSparseKFocus(payouts, probabilities, budget, rawK);
            if (!allocation) {
                status = "infeasible";
                notes.push("No allocation satisfies the sparsity constraint.");
            }
            break;
        }
        case "frontier_generate": {
            return jsonError(["frontier_generate is not supported in the bundled backend."], 400);
        }
        default: {
            return jsonError([`Unknown mode: ${mode}`], 400);
        }
    }

    if (!allocation) {
        return NextResponse.json(
            {
                status: "infeasible",
                notes,
            },
            { status: 200 }
        );
    }

    const result = buildResult(candidateData, payouts, allocation, budget, targetT);
    const responseBody: Record<string, unknown> = {
        status,
        allocation: result.allocation,
        payoutByOutcome: result.payoutByOutcome,
        metrics: result.metrics,
    };
    if (notes.length > 0) {
        responseBody.notes = notes;
    }

    return NextResponse.json(responseBody, { status: 200 });
}
