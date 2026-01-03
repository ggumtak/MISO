import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface BudgetInputProps {
    value: string;
    onChange: (value: string) => void;
    error?: string | null;
}

export function BudgetInput({ value, onChange, error }: BudgetInputProps) {
    return (
        <Card className="w-full bg-gradient-to-br from-card to-secondary/10 border-border/70 shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-primary">
                    <Coins className="w-5 h-5" />
                    총 투표권 (B)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="relative">
                    <Input
                        type="number"
                        min={10}
                        step={1}
                        inputMode="numeric"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className={cn(
                            "text-4xl h-16 pl-6 font-mono font-bold bg-background/60 border-primary/20 focus-visible:ring-primary/50",
                            error ? "border-destructive text-destructive focus-visible:ring-destructive/40" : ""
                        )}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">
                        표
                    </div>
                </div>
                {error ? (
                    <p className="text-xs text-destructive mt-2 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {error}
                    </p>
                ) : (
                    <p className="text-xs text-muted-foreground mt-2">
                        보유한 투표권 총량을 입력하세요.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
