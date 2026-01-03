import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EPS = 1e-9;
const NEG = Number.NEGATIVE_INFINITY;
const POS = Number.POSITIVE_INFINITY;
const MIN_ALLOCATION = 10;
const MAX_PER_CANDIDATE = 1000; // 한 선수당 최대 투표 수

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

function isAllocationAllowed(value: number) {
    return value === 0 || (value >= MIN_ALLOCATION && value <= MAX_PER_CANDIDATE);
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
                if (!isAllocationAllowed(s)) continue;
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
                if (!isAllocationAllowed(s)) continue;
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

function optimizeExpectedUtility(
    payouts: number[][],
    probabilities: number[],
    budget: number,
    utility: (payout: number) => number
) {
    const n = payouts.length;
    const choices: Int32Array[] = [];
    let prevUtility = new Float64Array(budget + 1);
    let prevEV = new Float64Array(budget + 1);
    prevUtility.fill(NEG);
    prevEV.fill(NEG);
    prevUtility[0] = 0;
    prevEV[0] = 0;

    for (let i = 0; i < n; i += 1) {
        const nextUtility = new Float64Array(budget + 1);
        const nextEV = new Float64Array(budget + 1);
        const choice = new Int32Array(budget + 1);
        nextUtility.fill(NEG);
        nextEV.fill(NEG);
        choice.fill(-1);

        for (let b = 0; b <= budget; b += 1) {
            let bestUtility = NEG;
            let bestEV = NEG;
            let bestS = -1;
            for (let s = 0; s <= b; s += 1) {
                if (!isAllocationAllowed(s)) continue;
                const prevBudget = b - s;
                const prevUtilityVal = prevUtility[prevBudget];
                if (prevUtilityVal === NEG) continue;
                const payout = payouts[i][s];
                const util = utility(payout);
                if (!Number.isFinite(util)) continue;
                const candidateUtility = prevUtilityVal + probabilities[i] * util;
                const candidateEV = prevEV[prevBudget] + probabilities[i] * payout;
                if (
                    candidateUtility > bestUtility + EPS ||
                    (Math.abs(candidateUtility - bestUtility) <= EPS && candidateEV > bestEV + EPS)
                ) {
                    bestUtility = candidateUtility;
                    bestEV = candidateEV;
                    bestS = s;
                }
            }
            if (bestS >= 0) {
                nextUtility[b] = bestUtility;
                nextEV[b] = bestEV;
                choice[b] = bestS;
            }
        }

        choices[i] = choice;
        prevUtility = nextUtility;
        prevEV = nextEV;
    }

    if (prevUtility[budget] === NEG) return null;

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
                    if (!isAllocationAllowed(s)) continue;
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
                    if (!isAllocationAllowed(s)) continue;
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
                    if (!isAllocationAllowed(s)) continue;
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

function optimizeMaxProbFocus(candidates: CandidateData[], budget: number) {
    if (candidates.length === 0) return null;

    let bestIndex = 0;
    let bestP = candidates[0].p;
    let bestNumer = candidates[0].numer;
    let bestDenom = candidates[0].denom;

    for (let i = 1; i < candidates.length; i += 1) {
        const current = candidates[i];
        if (current.p > bestP + EPS) {
            bestIndex = i;
            bestP = current.p;
            bestNumer = current.numer;
            bestDenom = current.denom;
            continue;
        }
        if (Math.abs(current.p - bestP) <= EPS) {
            const left = current.numer * bestDenom;
            const right = bestNumer * current.denom;
            if (left > right) {
                bestIndex = i;
                bestP = current.p;
                bestNumer = current.numer;
                bestDenom = current.denom;
            }
        }
    }

    const allocation = new Array<number>(candidates.length).fill(0);
    allocation[bestIndex] = budget;
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
            console.error("최적화 프록시 실패:", error);
            return NextResponse.json(
                {
                    status: "error",
                    notes: ["최적화 서버에 연결할 수 없습니다."],
                },
                { status: 502 }
            );
        }
    }

    let parsed: OptimizeRequest;
    try {
        parsed = (await request.json()) as OptimizeRequest;
    } catch {
        return jsonError(["잘못된 JSON 요청입니다."]);
    }

    if (!parsed || typeof parsed !== "object") {
        return jsonError(["요청 형식이 올바르지 않습니다."]);
    }

    const { budget, candidates, rounding, mode } = parsed;
    const params = (parsed.params ?? {}) as Record<string, unknown>;

    if (!Number.isInteger(budget) || budget < MIN_ALLOCATION) {
        return jsonError([`투표권은 ${MIN_ALLOCATION} 이상이어야 합니다.`]);
    }

    if (!Array.isArray(candidates) || candidates.length === 0) {
        return jsonError(["캐릭터를 최소 1명 이상 입력해 주세요."]);
    }

    if (rounding !== "floor") {
        return jsonError(["내림(floor)만 지원합니다."]);
    }

    const notes: string[] = [];
    const nameSet = new Set<string>();
    const candidateData: CandidateData[] = [];

    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== "object") {
            return jsonError(["캐릭터 입력 형식이 올바르지 않습니다."]);
        }
        const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
        if (!name) {
            return jsonError(["캐릭터 이름을 입력해 주세요."]);
        }
        if (nameSet.has(name)) {
            notes.push(`중복된 캐릭터 이름이 있습니다: ${name}.`);
        }
        nameSet.add(name);

        const p = candidate.p;
        if (!Number.isFinite(p) || p < 0) {
            return jsonError([`${name}의 확률이 올바르지 않습니다.`]);
        }

        const ratio = parseMultiplier(candidate.m);
        if (!ratio) {
            return jsonError([`${name}의 배당 배율이 올바르지 않습니다.`]);
        }

        candidateData.push({ name, p, numer: ratio.numer, denom: ratio.denom });
    }

    let sumP = candidateData.reduce((sum, c) => sum + c.p, 0);
    if (params.normalizeProb === true) {
        if (sumP > 0) {
            candidateData.forEach((c) => {
                c.p = c.p / sumP;
            });
            notes.push("확률 합계를 1로 정규화했습니다.");
            sumP = 1;
        }
    } else if (sumP > 1.5 && sumP <= 100.5) {
        candidateData.forEach((c) => {
            c.p = c.p / 100;
        });
        notes.push("확률을 백분율 입력으로 해석했습니다.");
        sumP = candidateData.reduce((sum, c) => sum + c.p, 0);
    }

    if (Math.abs(sumP - 1) > 0.01) {
        notes.push(`확률 합계가 ${sumP.toFixed(4)}입니다. 입력값 그대로 계산합니다.`);
    }

    const payouts = candidateData.map((candidate) =>
        buildPayoutTable(candidate.numer, candidate.denom, budget)
    );
    const probabilities = candidateData.map((candidate) => candidate.p);

    let allocation: number[] | null = null;
    let status: "ok" | "infeasible" = "ok";
    let targetT: number | undefined;

    switch (mode) {
        case "max_prob_focus": {
            allocation = optimizeMaxProbFocus(candidateData, budget);
            break;
        }
        case "all_weather_maximin": {
            allocation = optimizeAllWeather(payouts, probabilities, budget);
            break;
        }
        case "maximize_ev": {
            allocation = optimizeEVWithMinPayout(payouts, probabilities, budget, null);
            break;
        }
        case "balanced_profit": {
            // 기댓값이 양수인 후보들에게 균등 분배 (기댓값 = p * m > 1)
            const positiveEVCandidates: number[] = [];
            for (let i = 0; i < candidateData.length; i++) {
                const ev = candidateData[i].p * Number(candidateData[i].numer) / Number(candidateData[i].denom);
                if (ev > 1) {
                    positiveEVCandidates.push(i);
                }
            }

            if (positiveEVCandidates.length === 0) {
                // 기댓값이 양수인 후보가 없으면 가장 높은 기댓값에 올인
                allocation = optimizeEVWithMinPayout(payouts, probabilities, budget, null);
                notes.push("기댓값이 1을 넘는 선수가 없어서 평균 수익 최대 모드로 계산했어요.");
            } else {
                // 기댓값이 양수인 후보들에게 균등 분배 (1000개 제한 고려)
                allocation = new Array(candidateData.length).fill(0);
                let remaining = budget;
                const perCandidate = Math.min(MAX_PER_CANDIDATE, Math.floor(budget / positiveEVCandidates.length));

                for (const idx of positiveEVCandidates) {
                    const amount = Math.min(perCandidate, remaining);
                    if (amount >= MIN_ALLOCATION) {
                        allocation[idx] = amount;
                        remaining -= amount;
                    }
                }

                // 남은 포인트를 기댓값 순으로 분배
                if (remaining > 0) {
                    const sorted = positiveEVCandidates
                        .map(i => ({ i, ev: candidateData[i].p * Number(candidateData[i].numer) / Number(candidateData[i].denom) }))
                        .sort((a, b) => b.ev - a.ev);

                    for (const { i } of sorted) {
                        const canAdd = Math.min(remaining, MAX_PER_CANDIDATE - allocation[i]);
                        if (canAdd > 0) {
                            allocation[i] += canAdd;
                            remaining -= canAdd;
                        }
                        if (remaining <= 0) break;
                    }
                }
            }
            break;
        }
        case "loss_limit": {
            // 손실 한도 설정 모드: 최대 손실률 내에서 EV 최대화
            let maxLossPercent = Number(params.maxLossPercent);
            if (!Number.isFinite(maxLossPercent)) {
                maxLossPercent = 30; // 기본값 30%
            }
            if (maxLossPercent > 1 && maxLossPercent <= 100) {
                maxLossPercent /= 100;
            }
            if (maxLossPercent < 0 || maxLossPercent > 1) {
                return jsonError(["손실 한도는 0~100% 범위여야 해요."]);
            }

            // 최악의 경우에도 (1 - maxLossPercent) * budget 이상 받도록
            const minPayout = Math.floor(budget * (1 - maxLossPercent));
            allocation = optimizeEVWithMinPayout(payouts, probabilities, budget, minPayout);

            if (!allocation) {
                notes.push("설정한 손실 한도 내에서는 해가 없어서, 평균 수익 최대 모드로 계산했어요.");
                allocation = optimizeEVWithMinPayout(payouts, probabilities, budget, null);
            }
            break;
        }
        case "hedge_breakeven_then_ev": {
            allocation = optimizeEVWithMinPayout(payouts, probabilities, budget, budget);
            if (!allocation) {
                status = "infeasible";
                notes.push("G ≥ B 조건을 만족하는 해가 없습니다. 올웨더 해로 대체합니다.");
                allocation = optimizeAllWeather(payouts, probabilities, budget);
            }
            break;
        }
        case "ev_with_shortfall_penalty": {
            let penalty = Number(params.shortfallPenalty);
            if (!Number.isFinite(penalty)) {
                return jsonError(["shortfallPenalty 값이 필요합니다."]);
            }
            if (penalty > 1 && penalty <= 100) {
                penalty /= 100;
                notes.push("shortfallPenalty를 백분율로 해석했습니다.");
            }
            if (penalty < 0 || penalty > 1) {
                return jsonError(["shortfallPenalty는 0~1 범위여야 합니다."]);
            }
            allocation = optimizeExpectedUtility(payouts, probabilities, budget, (payout) => {
                const shortfall = Math.max(0, budget - payout);
                return payout - penalty * shortfall;
            });
            break;
        }
        case "beast_ev_under_maxloss": {
            let maxLossPct = Number(params.maxLossPct);
            if (!Number.isFinite(maxLossPct)) {
                return jsonError(["maxLossPct 값이 필요합니다."]);
            }
            if (maxLossPct > 1 && maxLossPct <= 100) {
                maxLossPct /= 100;
                notes.push("maxLossPct를 백분율로 해석했습니다.");
            }
            if (maxLossPct < 0 || maxLossPct > 1) {
                return jsonError(["maxLossPct는 0~1 범위여야 합니다."]);
            }
            const minG = Math.floor(budget * (1 - maxLossPct));
            allocation = optimizeEVWithMinPayout(payouts, probabilities, budget, minG);
            if (!allocation) {
                status = "infeasible";
                notes.push("최악 손실 제약을 만족하는 해가 없습니다.");
            }
            break;
        }
        case "ev_under_lossprob_cap": {
            let cap = Number(params.lossProbCap);
            if (!Number.isFinite(cap)) {
                return jsonError(["lossProbCap 값이 필요합니다."]);
            }
            if (cap > 1 && cap <= 100) {
                cap /= 100;
                notes.push("lossProbCap을 백분율로 해석했습니다.");
            }
            if (cap < 0 || cap > 1) {
                return jsonError(["lossProbCap은 0~1 범위여야 합니다."]);
            }
            allocation = optimizeEVUnderLossCap(payouts, probabilities, budget, cap);
            if (!allocation) {
                status = "infeasible";
                notes.push("손실 확률 상한을 만족하는 해가 없습니다.");
            }
            break;
        }
        case "maximize_prob_ge_target": {
            const rawTarget = Number(params.targetT);
            if (!Number.isFinite(rawTarget)) {
                return jsonError(["targetT 값이 필요합니다."]);
            }
            if (!Number.isInteger(rawTarget) || rawTarget < 0) {
                return jsonError(["targetT는 0 이상의 정수여야 합니다."]);
            }
            targetT = rawTarget;
            allocation = optimizeMaximizeProbTarget(payouts, probabilities, budget, targetT);
            break;
        }
        case "sparse_k_focus": {
            const rawK = Number(params.kSparse);
            if (!Number.isFinite(rawK)) {
                return jsonError(["kSparse 값이 필요합니다."]);
            }
            if (!Number.isInteger(rawK) || rawK < 1) {
                return jsonError(["kSparse는 1 이상의 정수여야 합니다."]);
            }
            allocation = optimizeSparseKFocus(payouts, probabilities, budget, rawK);
            if (!allocation) {
                status = "infeasible";
                notes.push("집중(K) 제약을 만족하는 해가 없습니다.");
            }
            break;
        }
        case "frontier_generate": {
            return jsonError(["frontier_generate는 내장 백엔드에서 지원하지 않습니다."], 400);
        }
        default: {
            return jsonError([`지원하지 않는 모드입니다: ${mode}`], 400);
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
