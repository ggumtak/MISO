import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, AlertTriangle, Wand2 } from "lucide-react";
import { Candidate } from "@/types/calculator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { parseMultiplierInput, parseProbabilityInput } from "@/lib/inputs";

interface CandidateTableProps {
    candidates: Candidate[];
    onUpdate: (candidates: Candidate[]) => void;
    errors: Record<string, { name?: string; p?: string; m?: string }>;
    totalProbability: number | null;
    isProbabilityValid: boolean;
    onNormalize: () => void;
}

export function CandidateTable({
    candidates,
    onUpdate,
    errors,
    totalProbability,
    isProbabilityValid,
    onNormalize,
}: CandidateTableProps) {
    const updateCandidate = (id: string, field: "name" | "pInput" | "mInput", value: string) => {
        onUpdate(
            candidates.map((c) => {
                if (c.id !== id) return c;

                if (field === "pInput") {
                    const p = parseProbabilityInput(value);
                    return { ...c, pInput: value, p };
                }

                if (field === "mInput") {
                    const m = parseMultiplierInput(value);
                    return { ...c, mInput: value, m };
                }

                return { ...c, name: value };
            })
        );
    };

    const removeCandidate = (id: string) => {
        onUpdate(candidates.filter((c) => c.id !== id));
    };

    const addCandidate = () => {
        onUpdate([
            ...candidates,
            {
                id: crypto.randomUUID(),
                name: `캐릭터 ${candidates.length + 1}`,
                p: 0,
                m: 2.0,
                pInput: "0",
                mInput: "2.0",
            },
        ]);
    };

    const totalDisplay = Number.isFinite(totalProbability ?? Number.NaN)
        ? `${((totalProbability ?? 0) * 100).toFixed(1)}%`
        : "--";
    const hasFieldErrors = Object.keys(errors).length > 0;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    캐릭터 목록
                    {!isProbabilityValid && (
                        <Badge variant="destructive" className="ml-2 animate-pulse">
                            확률 합계: {totalDisplay}
                        </Badge>
                    )}
                    {isProbabilityValid && (
                        <Badge variant="success" className="ml-2">
                            확률 합계: 100%
                        </Badge>
                    )}
                </h3>
                <div className="flex gap-2">
                    {!isProbabilityValid && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onNormalize}
                                disabled={!totalProbability || totalProbability <= 0}
                                className="h-8"
                            >
                                <Wand2 className="w-3 h-3 mr-2" />
                                자동 정규화
                            </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={addCandidate} className="h-8">
                        <Plus className="w-4 h-4 mr-2" /> 추가
                    </Button>
                </div>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40%]">캐릭터</TableHead>
                            <TableHead className="w-[25%]">우승 확률(%)</TableHead>
                            <TableHead className="w-[25%]">배당 배율(M)</TableHead>
                            <TableHead className="w-[10%]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {candidates.map((candidate) => (
                            <TableRow key={candidate.id}>
                                <TableCell>
                                    <Input
                                        value={candidate.name}
                                        onChange={(e) => updateCandidate(candidate.id, "name", e.target.value)}
                                        className={cn(
                                            "border-transparent focus:border-input hover:bg-muted/50",
                                            errors[candidate.id]?.name ? "border-destructive text-destructive" : ""
                                        )}
                                    />
                                </TableCell>
                                <TableCell>
                                    <div className="relative">
                                        <Input
                                            value={candidate.pInput}
                                            onChange={(e) => updateCandidate(candidate.id, "pInput", e.target.value)}
                                            inputMode="decimal"
                                            className={cn(
                                                "font-mono text-right pr-8",
                                                candidate.p === 0 ? "text-muted-foreground" : "text-primary",
                                                errors[candidate.id]?.p ? "border-destructive text-destructive" : ""
                                            )}
                                        />
                                        <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={candidate.mInput}
                                            onChange={(e) => updateCandidate(candidate.id, "mInput", e.target.value)}
                                            className={cn(
                                                "font-mono text-right pr-8 text-teal-600",
                                                errors[candidate.id]?.m ? "border-destructive text-destructive" : ""
                                            )}
                                        />
                                        <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">x</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeCandidate(candidate.id)}
                                        className="text-muted-foreground hover:text-destructive"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {!isProbabilityValid && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>확률 합계는 100%가 되어야 합니다. 현재: {totalDisplay}</span>
                </div>
            )}
            {hasFieldErrors && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>강조된 입력을 수정해 주세요.</span>
                </div>
            )}
        </div>
    );
}
