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
                notes: ["Backend error or malformed response."],
            }
        );
    }

    return (
        parsed ?? {
            status: "error",
            notes: ["Invalid JSON response from backend."],
        }
    );
}
