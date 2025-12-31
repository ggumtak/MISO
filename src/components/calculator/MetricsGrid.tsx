import { OptimizationResult } from "@/types/calculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, ShieldAlert, BadgeDollarSign, Activity } from "lucide-react";

interface MetricsGridProps {
    result: OptimizationResult;
    budget: number;
}

export function MetricsGrid({ result, budget }: MetricsGridProps) {
    const metrics = result.metrics ?? {};
    const G = metrics.G;
    const EV = metrics.EV;
    const EP = metrics.EP ?? (Number.isFinite(EV) ? EV! - budget : undefined);
    const P_loss = metrics.P_loss;
    const P_ge_T = metrics.P_ge_T;

    const profitWorst = Number.isFinite(G) ? G! - budget : undefined;
    const profitEV = Number.isFinite(EV) ? EV! - budget : undefined;

    const formatNumber = (value?: number, digits = 1) => {
        if (!Number.isFinite(value)) return "--";
        return value!.toFixed(digits);
    };

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card/50 border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">최악 시 지급(G)</CardTitle>
                    <ShieldAlert className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold font-mono">
                        {Number.isFinite(G) ? Math.floor(G!) : "--"}
                    </div>
                    <p
                        className={`text-xs ${
                            Number.isFinite(profitWorst) && profitWorst! >= 0
                                ? "text-emerald-500"
                                : "text-destructive"
                        }`}
                    >
                        {Number.isFinite(profitWorst)
                            ? `${profitWorst! >= 0 ? "+" : ""}${profitWorst!.toFixed(0)} (B 대비)`
                            : "결과 대기"}
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-card/50 border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">기댓값(EV)</CardTitle>
                    <TrendingUp className="h-4 w-4 text-blue-400" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold font-mono">{formatNumber(EV, 1)}</div>
                    <p
                        className={`text-xs ${
                            Number.isFinite(profitEV) && profitEV! >= 0
                                ? "text-emerald-500"
                                : "text-destructive"
                        }`}
                    >
                        {Number.isFinite(profitEV)
                            ? `${profitEV! >= 0 ? "+" : ""}${profitEV!.toFixed(1)} (B 대비)`
                            : "결과 대기"}
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-card/50 border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">기대 수익(EP)</CardTitle>
                    <BadgeDollarSign className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold font-mono">{formatNumber(EP, 1)}</div>
                    <p className="text-xs text-muted-foreground">EV - B</p>
                </CardContent>
            </Card>

            <Card className="bg-card/50 border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">손실 확률</CardTitle>
                    <Activity className="h-4 w-4 text-orange-400" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold font-mono">
                        {Number.isFinite(P_loss) ? `${(P_loss! * 100).toFixed(1)}%` : "--"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {budget} 미만 확률
                    </p>
                </CardContent>
            </Card>

            {P_ge_T !== undefined && (
                <Card className="bg-card/50 border-primary/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">목표 달성 확률</CardTitle>
                        <BadgeDollarSign className="h-4 w-4 text-cyan-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono">{(P_ge_T * 100).toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">
                            목표 지급액 이상 확률
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
