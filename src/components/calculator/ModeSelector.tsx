import { STRATEGIES } from "@/lib/strategies";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { OptimizationMode } from "@/types/calculator";

interface ModeSelectorProps {
    selectedMode: OptimizationMode;
    onSelectMode: (mode: OptimizationMode) => void;
    modeParams: Record<string, number>;
    onUpdateParams: (params: Record<string, number>) => void;
    candidateCount: number;
}

export function ModeSelector({
    selectedMode,
    onSelectMode,
    modeParams,
    onUpdateParams,
    candidateCount,
}: ModeSelectorProps) {
    const activeStrategy = STRATEGIES.find((s) => s.id === selectedMode) || STRATEGIES[0];

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
                    const Icon = strategy.icon;
                    return (
                        <Card
                            key={strategy.id}
                            onClick={() => onSelectMode(strategy.id)}
                            className={cn(
                                "cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]",
                                isSelected
                                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                                    : "hover:bg-muted/50 border-transparent bg-secondary/20"
                            )}
                        >
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

            {activeStrategy.params.length > 0 && (
                <Card className="bg-muted/30 border-dashed">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                            {activeStrategy.title} Configuration
                        </CardTitle>
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
                                        <span className="font-mono text-primary">
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
        </div>
    );
}
