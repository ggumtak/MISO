import { STRATEGIES } from "@/lib/strategies";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { OptimizationMode } from "@/types/calculator";
import { Sparkles } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";

interface Candidate {
    p: number; // 확률 (0~1)
    m: number; // 배당 배율
}

interface ModeSelectorProps {
    selectedMode: OptimizationMode;
    onSelectMode: (mode: OptimizationMode) => void;
    modeParams: Record<string, number>;
    onUpdateParams: (params: Record<string, number>) => void;
    candidateCount: number;
    budget?: number;
    candidates?: Candidate[];
}

type RiskReason = "multipliers" | "expected" | null;

// Return null if inputs are incomplete to avoid sticky locks while editing.
const getMaxExpectedRatio = (candidates: Candidate[]): number | null => {
    if (!candidates.length) return null;
    let maxRatio = 0;
    for (const candidate of candidates) {
        if (!Number.isFinite(candidate.p) || !Number.isFinite(candidate.m)) {
            return null;
        }
        if (candidate.p < 0 || candidate.m <= 0) return null;
        maxRatio = Math.max(maxRatio, candidate.p * candidate.m);
    }
    return maxRatio;
};

export function ModeSelector({
    selectedMode,
    onSelectMode,
    modeParams,
    onUpdateParams,
    candidateCount,
    budget,
    candidates,
}: ModeSelectorProps) {
    const activeStrategy = STRATEGIES.find((s) => s.id === selectedMode) || STRATEGIES[0];

    // 기대값 손해 위험 안내 (잠금은 하지 않음)
    const { riskReason, maxExpectedRatio } = useMemo(() => {
        if (!budget || budget <= 0 || !candidates || candidates.length === 0) {
            return { riskReason: null as RiskReason, maxExpectedRatio: null as number | null };
        }

        const maxRatio = getMaxExpectedRatio(candidates);
        if (maxRatio === null) {
            return { riskReason: null as RiskReason, maxExpectedRatio: null };
        }

        // 모든 후보의 배당이 1 미만인 경우 = 어떤 모드든 손해
        const allMultipliersLessThanOne = candidates.every((c) => c.m < 1);
        if (allMultipliersLessThanOne) {
            return { riskReason: "multipliers", maxExpectedRatio: maxRatio };
        }

        // 기댓값 기반 경고 (이론적 최대 EV < budget이면 손해)
        if (maxRatio < 1) {
            return { riskReason: "expected", maxExpectedRatio: maxRatio };
        }

        return { riskReason: null, maxExpectedRatio: maxRatio };
    }, [budget, candidates]);

    // 추천 모드 계산 (우선순위가 가장 높은 전략)
    const recommendedMode =
        STRATEGIES.length === 0
            ? null
            : STRATEGIES.reduce((best, current) =>
                current.recommendPriority < best.recommendPriority ? current : best
            );

    const handleParamChange = (key: string, value: number) => {
        onUpdateParams({
            ...modeParams,
            [key]: value,
        });
    };

    const formatParamValue = (value: number, unit?: "percent" | "integer" | "number") => {
        if (unit === "percent") return value.toFixed(0);
        if (unit === "integer") return Math.round(value).toString();
        return value.toString();
    };

    const riskSummary =
        riskReason === "multipliers"
            ? "모든 배율이 1배보다 낮아서, 어떻게 해도 손해예요."
            : riskReason === "expected"
                ? "지금 설정으로는 평균적으로 본전을 찾기 어려워요. 그래도 계산은 할 수 있어요!"
                : "";

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {STRATEGIES.map((strategy) => {
                    const isSelected = selectedMode === strategy.id;
                    const isRecommended = recommendedMode?.id === strategy.id;
                    const Icon = strategy.icon;

                    return (
                        <Card
                            key={strategy.id}
                            onClick={() => onSelectMode(strategy.id)}
                            className={cn(
                                "transition-all relative cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
                                isSelected
                                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                                    : "hover:bg-muted/50 border-transparent bg-secondary/20"
                            )}
                        >
                            {/* 추천 뱃지 */}
                            {isRecommended && (
                                <div className="absolute -top-2 -right-2 z-20">
                                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] px-2 py-0.5 shadow-md">
                                        <Sparkles className="w-3 h-3 mr-1" />
                                        추천
                                    </Badge>
                                </div>
                            )}
                            <CardHeader className="p-4">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <div
                                        className={cn(
                                            "p-2 rounded-lg bg-background",
                                            isSelected ? strategy.color : "text-muted-foreground"
                                        )}
                                    >
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <span className={isSelected ? "text-foreground" : "text-muted-foreground"}>
                                        {strategy.title}
                                    </span>
                                </CardTitle>
                                <CardDescription className="text-xs mt-2 line-clamp-2">
                                    {strategy.description}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    );
                })}
            </div>

            {/* 선택된 전략의 팁 표시 */}
            {activeStrategy && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                    <p className="text-primary/90">{activeStrategy.tip}</p>
                </div>
            )}

            {activeStrategy.params.length > 0 && (
                <Card className="bg-muted/30 border-dashed">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                            {activeStrategy.title} 세부 설정
                        </CardTitle>
                        <CardDescription className="text-xs">
                            슬라이더를 움직여서 원하는 값으로 조절하세요
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6 pt-4">
                        {activeStrategy.params.map((param) => {
                            const maxValue = param.key === "kSparse"
                                ? Math.max(1, candidateCount)
                                : param.max;
                            const unclampedValue = modeParams[param.key] ?? param.default;
                            const safeValue = Number.isFinite(unclampedValue) ? unclampedValue : param.default;
                            const currentValue = maxValue !== undefined
                                ? Math.min(safeValue, maxValue)
                                : safeValue;
                            const displayValue = formatParamValue(currentValue, param.unit);

                            return (
                                <div key={param.key} className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <label htmlFor={param.key} className="font-medium">
                                            {param.label}
                                        </label>
                                        <span className="font-mono text-primary font-semibold">
                                            {displayValue}
                                            {param.suffix}
                                        </span>
                                    </div>
                                    {param.type === "slider" ? (
                                        <input
                                            type="range"
                                            min={param.min}
                                            max={maxValue}
                                            step={param.step}
                                            value={currentValue}
                                            onChange={(e) => handleParamChange(param.key, parseFloat(e.target.value))}
                                            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                                        />
                                    ) : (
                                        <Input
                                            type="number"
                                            value={currentValue}
                                            onChange={(e) => handleParamChange(param.key, parseFloat(e.target.value))}
                                            className="max-w-[200px] font-mono"
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {riskReason && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-semibold">손해 볼 가능성이 높아요!</p>
                    <p className="text-xs mt-1 text-amber-900/80">{riskSummary}</p>
                    {maxExpectedRatio !== null && (
                        <p className="text-xs mt-2 text-amber-900/70">
                            최대 기대 수익률: {maxExpectedRatio.toFixed(2)}배
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
