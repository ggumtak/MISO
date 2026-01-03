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
import { Trash2, Plus, AlertTriangle, Wand2, GripVertical } from "lucide-react";
import { Candidate } from "@/types/calculator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { parseMultiplierInput, parseProbabilityInput } from "@/lib/inputs";
import { useState, useRef, useCallback } from "react";

interface CandidateTableProps {
    candidates: Candidate[];
    onUpdate: (candidates: Candidate[]) => void;
    errors: Record<string, { name?: string; p?: string; m?: string }>;
    totalProbability: number | null;
    isProbabilityValid: boolean;
    onNormalize: () => void;
}

// 자주 사용되는 확률 프리셋 값
const PROBABILITY_PRESETS = [1, 2, 3, 4, 5, 10, 50, 70, 80, 90];

// 자주 사용되는 배당 프리셋 값
const MULTIPLIER_PRESETS = [1.5, 9, 17, 20, 50];

export function CandidateTable({
    candidates,
    onUpdate,
    errors,
    totalProbability,
    isProbabilityValid,
    onNormalize,
}: CandidateTableProps) {
    const [focusedCandidateId, setFocusedCandidateId] = useState<string | null>(null);
    const [focusedMultiplierId, setFocusedMultiplierId] = useState<string | null>(null);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

    const setProbabilityPreset = (id: string, preset: number) => {
        updateCandidate(id, "pInput", preset.toString());
    };

    const setMultiplierPreset = (id: string, preset: number) => {
        updateCandidate(id, "mInput", preset.toString());
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

    // 드래그 앤 드롭 핸들러
    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    const handleDragEnd = () => {
        // 드래그 시 이름은 고정하고 확률/배율 값만 스왑
        if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
            const newCandidates = [...candidates];
            const fromCandidate = candidates[draggedIndex];
            const toCandidate = candidates[dragOverIndex];

            // 확률과 배율 값만 교환 (이름은 유지)
            newCandidates[draggedIndex] = {
                ...fromCandidate,
                pInput: toCandidate.pInput,
                p: toCandidate.p,
                mInput: toCandidate.mInput,
                m: toCandidate.m,
            };
            newCandidates[dragOverIndex] = {
                ...toCandidate,
                pInput: fromCandidate.pInput,
                p: fromCandidate.p,
                mInput: fromCandidate.mInput,
                m: fromCandidate.m,
            };
            onUpdate(newCandidates);
        }
        setDraggedIndex(null);
        setDragOverIndex(null);
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
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead className="w-[35%]">캐릭터</TableHead>
                            <TableHead className="w-[25%]">우승 확률(%)</TableHead>
                            <TableHead className="w-[25%]">배당 배율(M)</TableHead>
                            <TableHead className="w-[10%]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {candidates.map((candidate, index) => (
                            <TableRow
                                key={candidate.id}
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                                className={cn(
                                    "transition-all duration-150",
                                    draggedIndex === index && "opacity-50 bg-primary/5",
                                    dragOverIndex === index && draggedIndex !== index && "border-t-2 border-primary"
                                )}
                            >
                                {/* 드래그 핸들 */}
                                <TableCell className="px-2">
                                    <div className="drag-handle p-1 rounded hover:bg-muted/50 text-muted-foreground">
                                        <GripVertical className="w-4 h-4" />
                                    </div>
                                </TableCell>
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
                                    <div className="space-y-1">
                                        <div className="relative">
                                            <Input
                                                value={candidate.pInput}
                                                onChange={(e) => updateCandidate(candidate.id, "pInput", e.target.value)}
                                                onFocus={() => setFocusedCandidateId(candidate.id)}
                                                onBlur={() => setTimeout(() => setFocusedCandidateId(null), 150)}
                                                inputMode="decimal"
                                                className={cn(
                                                    "font-mono text-right pr-8",
                                                    candidate.p === 0 ? "text-muted-foreground" : "text-primary",
                                                    errors[candidate.id]?.p ? "border-destructive text-destructive" : ""
                                                )}
                                            />
                                            <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span>
                                        </div>
                                        {/* 확률 프리셋 버튼 - 포커스 시 표시 */}
                                        {focusedCandidateId === candidate.id && (
                                            <div className="flex gap-1 flex-wrap animate-in fade-in slide-in-from-top-1 duration-150">
                                                {PROBABILITY_PRESETS.map((preset) => (
                                                    <button
                                                        key={preset}
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            setProbabilityPreset(candidate.id, preset);
                                                        }}
                                                        className={cn(
                                                            "px-1.5 py-0.5 text-[10px] font-medium rounded border transition-all",
                                                            "hover:bg-primary hover:text-primary-foreground hover:border-primary",
                                                            candidate.pInput === preset.toString()
                                                                ? "bg-primary text-primary-foreground border-primary"
                                                                : "bg-muted/50 text-muted-foreground border-border/50"
                                                        )}
                                                    >
                                                        {preset}%
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="space-y-1">
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={candidate.mInput}
                                                onChange={(e) => updateCandidate(candidate.id, "mInput", e.target.value)}
                                                onFocus={() => setFocusedMultiplierId(candidate.id)}
                                                onBlur={() => setTimeout(() => setFocusedMultiplierId(null), 150)}
                                                className={cn(
                                                    "font-mono text-right pr-8 text-teal-600",
                                                    errors[candidate.id]?.m ? "border-destructive text-destructive" : ""
                                                )}
                                            />
                                            <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">x</span>
                                        </div>
                                        {/* 배당 프리셋 버튼 - 포커스 시 표시 */}
                                        {focusedMultiplierId === candidate.id && (
                                            <div className="flex gap-1 flex-wrap animate-in fade-in slide-in-from-top-1 duration-150">
                                                {MULTIPLIER_PRESETS.map((preset) => (
                                                    <button
                                                        key={preset}
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            setMultiplierPreset(candidate.id, preset);
                                                        }}
                                                        className={cn(
                                                            "px-1.5 py-0.5 text-[10px] font-medium rounded border transition-all",
                                                            "hover:bg-teal-600 hover:text-white hover:border-teal-600",
                                                            candidate.mInput === preset.toString()
                                                                ? "bg-teal-600 text-white border-teal-600"
                                                                : "bg-muted/50 text-muted-foreground border-border/50"
                                                        )}
                                                    >
                                                        {preset}x
                                                    </button>
                                                ))}
                                            </div>
                                        )}
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
