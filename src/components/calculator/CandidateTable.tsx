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
import { Trash2, Plus, AlertTriangle, Wand2, GripVertical, X } from "lucide-react";
import { Candidate } from "@/types/calculator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { parseMultiplierInput, parseProbabilityInput } from "@/lib/inputs";
import { useState, useEffect, useCallback, useMemo } from "react";

interface CandidateTableProps {
    candidates: Candidate[];
    onUpdate: (candidates: Candidate[]) => void;
    errors: Record<string, { name?: string; p?: string; m?: string }>;
    totalProbability: number | null;
    isProbabilityValid: boolean;
    onNormalize: () => void;
}

// 기본 확률 프리셋 값
const DEFAULT_PROBABILITY_PRESETS = [1, 4, 5, 10, 70, 80, 90];

// 기본 배당 프리셋 값
const DEFAULT_MULTIPLIER_PRESETS = [1.2, 1.3, 1.5, 9, 17, 20, 50];

const DEFAULT_PAIR_PRESETS: Record<string, number> = {
    "90": 1.2,
    "80": 1.3,
    "70": 1.5,
    "10": 9,
    "5": 17,
    "4": 20,
    "1": 50,
};

// localStorage 키
const PROB_PRESETS_KEY = "terun-probability-presets";
const MULT_PRESETS_KEY = "terun-multiplier-presets";
const PAIR_PRESETS_KEY = "terun-preset-pairs";

const normalizePresetValue = (value: number) => {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 10000) / 10000;
};

const presetKey = (value: number) => {
    const normalized = normalizePresetValue(value);
    if (normalized === null) return null;
    return normalized % 1 === 0 ? normalized.toFixed(0) : normalized.toString();
};

const formatPresetValue = (value: number) => presetKey(value) ?? "";

const mergePresetList = (current: number[], extra: number[]) => {
    const map = new Map<string, number>();
    const add = (value: number) => {
        const key = presetKey(value);
        if (!key) return;
        if (!map.has(key)) {
            const normalized = normalizePresetValue(value);
            if (normalized !== null) map.set(key, normalized);
        }
    };
    current.forEach(add);
    extra.forEach(add);
    const merged = Array.from(map.values()).sort((a, b) => a - b);
    const isSame =
        merged.length === current.length && merged.every((value, index) => value === current[index]);
    return isSame ? current : merged;
};

const parsePresetList = (value: unknown) => {
    if (!Array.isArray(value)) return null;
    const parsed = value
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item));
    return parsed.length > 0 ? parsed : null;
};

const parsePairPresets = (value: unknown) => {
    if (!value || typeof value !== "object") return null;
    const output: Record<string, number> = {};
    Object.entries(value as Record<string, unknown>).forEach(([probKey, multValue]) => {
        const prob = Number(probKey);
        const mult = Number(multValue);
        const probKeyNormalized = presetKey(prob);
        const multNormalized = normalizePresetValue(mult);
        if (!probKeyNormalized || multNormalized === null) return;
        output[probKeyNormalized] = multNormalized;
    });
    return Object.keys(output).length > 0 ? output : null;
};

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

    // 커스텀 프리셋 상태
    const [pairPresets, setPairPresets] = useState<Record<string, number>>(DEFAULT_PAIR_PRESETS);
    const [probPresets, setProbPresets] = useState<number[]>(DEFAULT_PROBABILITY_PRESETS);
    const [multPresets, setMultPresets] = useState<number[]>(DEFAULT_MULTIPLIER_PRESETS);
    const [showAddProbPreset, setShowAddProbPreset] = useState<string | null>(null);
    const [showAddMultPreset, setShowAddMultPreset] = useState<string | null>(null);
    const [newPresetValue, setNewPresetValue] = useState("");

    // localStorage에서 프리셋 로드
    useEffect(() => {
        try {
            const savedProb = localStorage.getItem(PROB_PRESETS_KEY);
            const savedMult = localStorage.getItem(MULT_PRESETS_KEY);
            const savedPairs = localStorage.getItem(PAIR_PRESETS_KEY);
            let nextProb = DEFAULT_PROBABILITY_PRESETS;
            let nextMult = DEFAULT_MULTIPLIER_PRESETS;
            let nextPairs = parsePairPresets(DEFAULT_PAIR_PRESETS) ?? DEFAULT_PAIR_PRESETS;

            if (savedProb) {
                const parsed = parsePresetList(JSON.parse(savedProb));
                if (parsed) nextProb = parsed;
            }
            if (savedMult) {
                const parsed = parsePresetList(JSON.parse(savedMult));
                if (parsed) nextMult = parsed;
            }
            if (savedPairs) {
                const parsed = parsePairPresets(JSON.parse(savedPairs));
                if (parsed) nextPairs = { ...nextPairs, ...parsed };
            }

            setPairPresets(nextPairs);
            setProbPresets(mergePresetList(nextProb, Object.keys(nextPairs).map(Number)));
            setMultPresets(mergePresetList(nextMult, Object.values(nextPairs)));
        } catch (e) {
            console.warn("프리셋 로드 실패", e);
        }
    }, []);

    // 프리셋 변경 시 localStorage에 저장
    useEffect(() => {
        localStorage.setItem(PROB_PRESETS_KEY, JSON.stringify(probPresets));
    }, [probPresets]);

    useEffect(() => {
        localStorage.setItem(MULT_PRESETS_KEY, JSON.stringify(multPresets));
    }, [multPresets]);

    useEffect(() => {
        localStorage.setItem(PAIR_PRESETS_KEY, JSON.stringify(pairPresets));
    }, [pairPresets]);

    const pairByMultiplier = useMemo(() => {
        const output: Record<string, number> = {};
        Object.entries(pairPresets).forEach(([probKey, multValue]) => {
            const multKey = presetKey(multValue);
            const probValue = Number(probKey);
            const normalizedProb = normalizePresetValue(probValue);
            if (!multKey || normalizedProb === null) return;
            output[multKey] = normalizedProb;
        });
        return output;
    }, [pairPresets]);

    const rememberPair = useCallback((probPercent: number, multiplier: number) => {
        const normalizedProb = normalizePresetValue(probPercent);
        const normalizedMult = normalizePresetValue(multiplier);
        if (normalizedProb === null || normalizedMult === null) return;
        const key = presetKey(normalizedProb);
        if (!key) return;

        setPairPresets((prev) => {
            if (prev[key] === normalizedMult) return prev;
            return { ...prev, [key]: normalizedMult };
        });
        setProbPresets((prev) => mergePresetList(prev, [normalizedProb]));
        setMultPresets((prev) => mergePresetList(prev, [normalizedMult]));
    }, []);

    const maybeRememberPairFromCandidate = useCallback(
        (candidate: Candidate) => {
            const prob = parseProbabilityInput(candidate.pInput);
            const mult = parseMultiplierInput(candidate.mInput);
            if (!Number.isFinite(prob) || prob <= 0 || prob > 1) return;
            if (!Number.isFinite(mult) || mult <= 0) return;
            rememberPair(prob * 100, mult);
        },
        [rememberPair]
    );

    // 확률 프리셋 추가
    const addProbPreset = useCallback((value: string) => {
        const num = parseFloat(value);
        const normalized = normalizePresetValue(num);
        if (normalized === null || normalized <= 0 || normalized > 100) return;
        setProbPresets((prev) => mergePresetList(prev, [normalized]));
        setShowAddProbPreset(null);
        setNewPresetValue("");
    }, []);

    // 확률 프리셋 삭제
    const removeProbPreset = useCallback((value: number) => {
        const key = presetKey(value);
        if (!key) return;
        setProbPresets((prev) => prev.filter((item) => presetKey(item) !== key));
    }, []);

    // 배당 프리셋 추가
    const addMultPreset = useCallback((value: string) => {
        const num = parseFloat(value);
        const normalized = normalizePresetValue(num);
        if (normalized === null || normalized <= 0) return;
        setMultPresets((prev) => mergePresetList(prev, [normalized]));
        setShowAddMultPreset(null);
        setNewPresetValue("");
    }, []);

    // 배당 프리셋 삭제
    const removeMultPreset = useCallback((value: number) => {
        const key = presetKey(value);
        if (!key) return;
        setMultPresets((prev) => prev.filter((item) => presetKey(item) !== key));
    }, []);

    const updateCandidateFields = useCallback(
        (
            id: string,
            updates: { name?: string; pInput?: string; mInput?: string },
            rememberPair = false
        ) => {
            const nextCandidates = candidates.map((c) => {
                if (c.id !== id) return c;
                const nextCandidate = { ...c };
                if (updates.name !== undefined) nextCandidate.name = updates.name;
                if (updates.pInput !== undefined) {
                    nextCandidate.pInput = updates.pInput;
                    nextCandidate.p = parseProbabilityInput(updates.pInput);
                }
                if (updates.mInput !== undefined) {
                    nextCandidate.mInput = updates.mInput;
                    nextCandidate.m = parseMultiplierInput(updates.mInput);
                }
                return nextCandidate;
            });

            onUpdate(nextCandidates);

            if (rememberPair) {
                const updatedCandidate = nextCandidates.find((c) => c.id === id);
                if (updatedCandidate) maybeRememberPairFromCandidate(updatedCandidate);
            }
        },
        [candidates, onUpdate, maybeRememberPairFromCandidate]
    );

    const updateCandidate = useCallback(
        (id: string, field: "name" | "pInput" | "mInput", value: string) => {
            updateCandidateFields(id, { [field]: value } as { name?: string; pInput?: string; mInput?: string });
        },
        [updateCandidateFields]
    );

    const setProbabilityPreset = (id: string, preset: number) => {
        const key = presetKey(preset);
        const paired = key ? pairPresets[key] : undefined;
        if (paired !== undefined) {
            updateCandidateFields(id, {
                pInput: formatPresetValue(preset),
                mInput: formatPresetValue(paired),
            }, true);
            return;
        }
        updateCandidateFields(id, { pInput: formatPresetValue(preset) }, true);
    };

    const setMultiplierPreset = (id: string, preset: number) => {
        const key = presetKey(preset);
        const paired = key ? pairByMultiplier[key] : undefined;
        if (paired !== undefined) {
            updateCandidateFields(id, {
                mInput: formatPresetValue(preset),
                pInput: formatPresetValue(paired),
            }, true);
            return;
        }
        updateCandidateFields(id, { mInput: formatPresetValue(preset) }, true);
    };

    const handleProbFocus = useCallback((id: string) => {
        setFocusedCandidateId(id);
    }, []);

    const handleProbBlur = useCallback(
        (id: string, event: React.FocusEvent<HTMLDivElement>) => {
            const nextTarget = event.relatedTarget as Node | null;
            if (nextTarget && event.currentTarget.contains(nextTarget)) return;
            setFocusedCandidateId(null);
            setShowAddProbPreset(null);
            const candidate = candidates.find((item) => item.id === id);
            if (candidate) maybeRememberPairFromCandidate(candidate);
        },
        [candidates, maybeRememberPairFromCandidate]
    );

    const handleMultFocus = useCallback((id: string) => {
        setFocusedMultiplierId(id);
    }, []);

    const handleMultBlur = useCallback(
        (id: string, event: React.FocusEvent<HTMLDivElement>) => {
            const nextTarget = event.relatedTarget as Node | null;
            if (nextTarget && event.currentTarget.contains(nextTarget)) return;
            setFocusedMultiplierId(null);
            setShowAddMultPreset(null);
            const candidate = candidates.find((item) => item.id === id);
            if (candidate) maybeRememberPairFromCandidate(candidate);
        },
        [candidates, maybeRememberPairFromCandidate]
    );

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
                    베팅 대상
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
                            확률 자동 맞추기
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
                            <TableHead className="w-[35%]">이름</TableHead>
                            <TableHead className="w-[25%]">당첨 확률(%)</TableHead>
                            <TableHead className="w-[25%]">당첨 배율(x)</TableHead>
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
                                    <div
                                        className="space-y-1"
                                        onFocusCapture={() => handleProbFocus(candidate.id)}
                                        onBlurCapture={(event) => handleProbBlur(candidate.id, event)}
                                    >
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
                                        {/* 확률 프리셋 버튼 - 포커스 시 표시 */}
                                        {focusedCandidateId === candidate.id && (
                                            <div className="flex gap-1 flex-wrap animate-in fade-in slide-in-from-top-1 duration-150">
                                                {probPresets.map((preset: number) => (
                                                    <div key={preset} className="relative group">
                                                        <button
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
                                                        {/* 삭제 버튼 */}
                                                        <button
                                                            type="button"
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                removeProbPreset(preset);
                                                            }}
                                                            className="absolute -top-1 -right-1 w-3 h-3 bg-destructive text-white rounded-full text-[8px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                                        >
                                                            <X className="w-2 h-2" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {/* 프리셋 추가 버튼 */}
                                                {showAddProbPreset === candidate.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            value={newPresetValue}
                                                            onChange={(e) => setNewPresetValue(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    e.preventDefault();
                                                                    addProbPreset(newPresetValue);
                                                                }
                                                                if (e.key === "Escape") {
                                                                    setShowAddProbPreset(null);
                                                                    setNewPresetValue("");
                                                                }
                                                            }}
                                                            placeholder="%"
                                                            className="w-12 h-5 text-[10px] px-1 border rounded"
                                                            autoFocus
                                                        />
                                                        <button
                                                            type="button"
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                addProbPreset(newPresetValue);
                                                            }}
                                                            className="text-[10px] text-primary hover:underline"
                                                        >
                                                            추가
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            setShowAddProbPreset(candidate.id);
                                                            setNewPresetValue("");
                                                        }}
                                                        className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-dashed border-primary/50 text-primary hover:bg-primary/10 transition-all"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div
                                        className="space-y-1"
                                        onFocusCapture={() => handleMultFocus(candidate.id)}
                                        onBlurCapture={(event) => handleMultBlur(candidate.id, event)}
                                    >
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
                                        {/* 배당 프리셋 버튼 - 포커스 시 표시 */}
                                        {focusedMultiplierId === candidate.id && (
                                            <div className="flex gap-1 flex-wrap animate-in fade-in slide-in-from-top-1 duration-150">
                                                {multPresets.map((preset: number) => (
                                                    <div key={preset} className="relative group">
                                                        <button
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
                                                        {/* 삭제 버튼 */}
                                                        <button
                                                            type="button"
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                removeMultPreset(preset);
                                                            }}
                                                            className="absolute -top-1 -right-1 w-3 h-3 bg-destructive text-white rounded-full text-[8px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                                        >
                                                            <X className="w-2 h-2" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {/* 프리셋 추가 버튼 */}
                                                {showAddMultPreset === candidate.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            value={newPresetValue}
                                                            onChange={(e) => setNewPresetValue(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    e.preventDefault();
                                                                    addMultPreset(newPresetValue);
                                                                }
                                                                if (e.key === "Escape") {
                                                                    setShowAddMultPreset(null);
                                                                    setNewPresetValue("");
                                                                }
                                                            }}
                                                            placeholder="x"
                                                            className="w-12 h-5 text-[10px] px-1 border rounded"
                                                            autoFocus
                                                        />
                                                        <button
                                                            type="button"
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                addMultPreset(newPresetValue);
                                                            }}
                                                            className="text-[10px] text-teal-600 hover:underline"
                                                        >
                                                            추가
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            setShowAddMultPreset(candidate.id);
                                                            setNewPresetValue("");
                                                        }}
                                                        className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-dashed border-teal-600/50 text-teal-600 hover:bg-teal-600/10 transition-all"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                )}
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
                    <span>확률을 모두 더하면 100%가 되어야 해요. 지금은: {totalDisplay}</span>
                </div>
            )}
            {hasFieldErrors && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>빨간색으로 표시된 부분을 수정해 주세요</span>
                </div>
            )}
        </div>
    );
}
