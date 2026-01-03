import { STRATEGIES } from "@/lib/strategies";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { OptimizationMode } from "@/types/calculator";
import { Lock, Sparkles } from "lucide-react";
import { useMemo, useEffect } from "react";
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

// 간단한 기댓값 계산: 각 캐릭터에 전액 배팅했을 때 최대 기댓값
const calculateMaxExpectedValue = (budget: number, candidates: Candidate[]): number => {
    if (!candidates.length || budget <= 0) return 0;

    // EV 상한: 가장 높은 p*m 후보에 전액 배분하는 경우
    const theoreticalMaxEV = candidates.reduce((max, c) => {
        if (!Number.isFinite(c.p) || !Number.isFinite(c.m)) return max;
        return Math.max(max, c.p * budget * c.m);
    }, 0);

    return theoreticalMaxEV;
};

// 기댓값이 항상 음수인지 확인 (budget보다 EV가 낮으면 손해)
const isAlwaysLoss = (budget: number, candidates: Candidate[]): boolean => {
    if (!candidates.length || budget <= 0) return false;

    // 이론적 최대 기댓값 계산
    const maxEV = calculateMaxExpectedValue(budget, candidates);

    // 기댓값이 투자금보다 낮으면 손해
    return maxEV < budget;
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

    // 기댓값이 음수인 모드 잠금 여부 계산
    const lockedModes = useMemo(() => {
        if (!budget || !candidates || candidates.length === 0) {
            return new Set<OptimizationMode>();
        }

        const locked = new Set<OptimizationMode>();

        // 모든 후보의 배당이 1 미만인 경우 = 어떤 모드든 손해
        const allMultipliersLessThanOne = candidates.every((c) => c.m < 1);
        if (allMultipliersLessThanOne) {
            STRATEGIES.forEach((s) => locked.add(s.id));
            return locked;
        }

        // 기댓값 기반 잠금 (이론적 최대 EV < budget이면 손해)
        if (isAlwaysLoss(budget, candidates)) {
            // 모든 모드가 손해이므로 전부 잠금
            STRATEGIES.forEach((s) => locked.add(s.id));
        }

        return locked;
    }, [budget, candidates]);

    // 추천 모드 계산 (잠기지 않은 모드 중 우선순위가 가장 높은 것)
    const recommendedMode = useMemo(() => {
        const availableStrategies = STRATEGIES.filter((s) => !lockedModes.has(s.id));
        if (availableStrategies.length === 0) return null;

        // recommendPriority가 가장 낮은 (우선순위 높은) 전략 선택
        return availableStrategies.reduce((best, current) =>
            current.recommendPriority < best.recommendPriority ? current : best
        );
    }, [lockedModes]);

    // 현재 선택된 모드가 잠겼거나, 초기 상태일 때 추천 모드로 자동 전환
    useEffect(() => {
        if (recommendedMode && lockedModes.has(selectedMode)) {
            onSelectMode(recommendedMode.id);
        }
    }, [lockedModes, recommendedMode, selectedMode, onSelectMode]);

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

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {STRATEGIES.map((strategy) => {
                    const isSelected = selectedMode === strategy.id;
                    const isLocked = lockedModes.has(strategy.id);
                    const isRecommended = recommendedMode?.id === strategy.id;
                    const Icon = strategy.icon;

                    return (
                        <Card
                            key={strategy.id}
                            onClick={() => {
                                if (!isLocked) {
                                    onSelectMode(strategy.id);
                                }
                            }}
                            className={cn(
                                "transition-all relative",
                                isLocked
                                    ? "cursor-not-allowed opacity-60 bg-muted/30 border-muted"
                                    : "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
                                isSelected && !isLocked
                                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                                    : !isLocked && "hover:bg-muted/50 border-transparent bg-secondary/20"
                            )}
                        >
                            {/* 추천 뱃지 */}
                            {isRecommended && !isLocked && (
                                <div className="absolute -top-2 -right-2 z-20">
                                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] px-2 py-0.5 shadow-md">
                                        <Sparkles className="w-3 h-3 mr-1" />
                                        추천
                                    </Badge>
                                </div>
                            )}

                            {isLocked && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px] rounded-lg z-10">
                                    <div className="flex flex-col items-center gap-1 text-center px-3">
                                        <Lock className="w-5 h-5 text-destructive" />
                                        <span className="text-xs text-destructive font-medium">
                                            사용 불가
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                            배당률이 낮아서 잠김
                                        </span>
                                    </div>
                                </div>
                            )}
                            <CardHeader className="p-4">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <div
                                        className={cn(
                                            "p-2 rounded-lg bg-background",
                                            isSelected && !isLocked ? strategy.color : "text-muted-foreground"
                                        )}
                                    >
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <span className={isSelected && !isLocked ? "text-foreground" : "text-muted-foreground"}>
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
            {activeStrategy && !lockedModes.has(activeStrategy.id) && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                    <p className="text-primary/90">{activeStrategy.tip}</p>
                </div>
            )}

            {activeStrategy.params.length > 0 && !lockedModes.has(activeStrategy.id) && (
                <Card className="bg-muted/30 border-dashed">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                            {activeStrategy.title} 설정
                        </CardTitle>
                        <CardDescription className="text-xs">
                            슬라이더를 움직여서 원하는 값을 설정하세요
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

            {lockedModes.size > 0 && lockedModes.size === STRATEGIES.length && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                    <p className="font-semibold">모든 전략이 잠겼습니다</p>
                    <p className="text-xs mt-1 text-destructive/80">
                        현재 입력된 배당률로는 어떤 전략을 써도 손해입니다. 배당률을 확인해 주세요.
                    </p>
                    <p className="text-xs mt-2 text-muted-foreground">
                        배당률이 모두 1배 미만이면 투자할수록 손해입니다.
                    </p>
                </div>
            )}
        </div>
    );
}
