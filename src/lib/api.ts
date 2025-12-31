import { OptimizationRequest, OptimizationResult } from "@/types/calculator";

export async function optimizeDistribution(
    request: OptimizationRequest
): Promise<OptimizationResult> {
    const response = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
    });

    const payload = await response.text();
    let parsed: OptimizationResult | null = null;
    try {
        parsed = JSON.parse(payload) as OptimizationResult;
    } catch {
        parsed = null;
    }

    if (!response.ok) {
        return (
            parsed ?? {
                status: "error",
                notes: ["백엔드 오류 또는 응답 형식이 올바르지 않습니다."],
            }
        );
    }

    return (
        parsed ?? {
            status: "error",
            notes: ["백엔드 JSON 응답이 올바르지 않습니다."],
        }
    );
}
