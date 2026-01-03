"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    AlertTriangle,
    CheckCircle2,
    Coins,
    Link2,
    Play,
    RefreshCcw,
    RotateCcw,
    Share2,
    Undo2,
    Redo2,
    Keyboard,
    RotateCw,
} from "lucide-react";

import { BudgetInput } from "@/components/calculator/BudgetInput";
import { CandidateTable } from "@/components/calculator/CandidateTable";
import { ModeSelector } from "@/components/calculator/ModeSelector";
import { MetricsGrid } from "@/components/calculator/MetricsGrid";
import { AllocationList } from "@/components/calculator/AllocationList";
import { PayoutChart } from "@/components/calculator/PayoutChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Candidate,
    OptimizationMode,
    OptimizationRequest,
    OptimizationResult,
} from "@/types/calculator";
import { optimizeDistribution } from "@/lib/api";
import { STRATEGIES } from "@/lib/strategies";
import {
    formatProbabilityInput,
    parseMultiplierInput,
    parseProbabilityInput,
} from "@/lib/inputs";
import { cn } from "@/lib/utils";

type NoticeType = "error" | "warning" | "info";

interface Notice {
    type: NoticeType;
    title: string;
    notes?: string[];
}

interface SharePayload {
    budget: number;
    mode: OptimizationMode;
    params: Record<string, number>;
    candidates: { name: string; p: string; m: string }[];
}

const createCandidate = (id: string, name: string, pInput: string, mInput: string): Candidate => ({
    id,
    name,
    pInput,
    mInput,
    p: parseProbabilityInput(pInput),
    m: parseMultiplierInput(mInput),
});

const DEFAULT_CANDIDATES: Candidate[] = [
    createCandidate("1", "캐릭터 A", "50", "1.8"),
    createCandidate("2", "캐릭터 B", "30", "3.0"),
    createCandidate("3", "캐릭터 C", "10", "8.0"),
    createCandidate("4", "캐릭터 D", "5", "15.0"),
    createCandidate("5", "캐릭터 E", "5", "15.0"),
];

const SAMPLE_CANDIDATES: Candidate[] = [
    createCandidate("t1", "캐릭터 A", "90", "1.2"),
    createCandidate("t2", "캐릭터 B", "1", "50"),
    createCandidate("t3", "캐릭터 C", "4", "20"),
    createCandidate("t4", "캐릭터 D", "1", "50"),
    createCandidate("t5", "캐릭터 E", "4", "20"),
];

const MIN_ALLOCATION = 10;

const getBudgetError = (input: string) => {
    if (!input.trim()) return "투표권을 입력해 주세요.";
    const value = Number(input);
    if (!Number.isFinite(value)) return "투표권은 숫자여야 합니다.";
    if (!Number.isInteger(value)) return "투표권은 정수여야 합니다.";
    if (value < MIN_ALLOCATION) return `투표권은 ${MIN_ALLOCATION} 이상이어야 합니다.`;
    return null;
};

const buildRequestParams = (
    mode: OptimizationMode,
    params: Record<string, number>,
    candidateCount: number
) => {
    const strategy = STRATEGIES.find((item) => item.id === mode);
    if (!strategy) return {};

    const normalizedParams: Record<string, number> = {};
    strategy.params.forEach((param) => {
        let value = params[param.key] ?? param.default;
        if (!Number.isFinite(value)) value = param.default;
        if (param.unit === "percent") value = value / 100;
        if (param.unit === "integer") value = Math.round(value);
        if (param.key === "kSparse") {
            value = Math.max(1, Math.min(value, Math.max(1, candidateCount)));
        }
        normalizedParams[param.key] = value;
    });

    return normalizedParams;
};

const getStrategyTitle = (mode: OptimizationMode) =>
    STRATEGIES.find((item) => item.id === mode)?.title ?? mode;

const getValidEV = (result?: OptimizationResult | null) => {
    const ev = result?.metrics?.EV;
    return Number.isFinite(ev) ? ev! : null;
};

// 로컬 스토리지 키
const STORAGE_KEY = "terun-calculator-state";
const MAX_HISTORY = 15;

// 상태 타입
interface AppState {
    budgetInput: string;
    candidates: Candidate[];
    mode: OptimizationMode;
    modeParams: Record<string, number>;
}

export default function Home() {
    const [budgetInput, setBudgetInput] = useState("1000");
    const [candidates, setCandidates] = useState<Candidate[]>(
        () => DEFAULT_CANDIDATES.map((candidate) => ({ ...candidate }))
    );
    const [mode, setMode] = useState<OptimizationMode>("loss_limit");
    const [modeParams, setModeParams] = useState<Record<string, number>>({});

    const [result, setResult] = useState<OptimizationResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState<Notice | null>(null);
    const [shareMessage, setShareMessage] = useState<string | null>(null);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [showShortcuts, setShowShortcuts] = useState(false);

    // Undo/Redo 히스토리
    const [history, setHistory] = useState<AppState[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isUndoRedoRef = useRef(false);

    // 현재 상태를 히스토리에 저장
    const pushHistory = useCallback(() => {
        if (isUndoRedoRef.current) {
            isUndoRedoRef.current = false;
            return;
        }
        const currentState: AppState = {
            budgetInput,
            candidates: candidates.map(c => ({ ...c })),
            mode,
            modeParams: { ...modeParams },
        };
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(currentState);
            if (newHistory.length > MAX_HISTORY) newHistory.shift();
            return newHistory;
        });
        setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
    }, [budgetInput, candidates, mode, modeParams, historyIndex]);

    // Undo
    const handleUndo = useCallback(() => {
        if (historyIndex <= 0) return;
        isUndoRedoRef.current = true;
        const prevState = history[historyIndex - 1];
        if (prevState) {
            setBudgetInput(prevState.budgetInput);
            setCandidates(prevState.candidates.map(c => ({ ...c })));
            setMode(prevState.mode);
            setModeParams({ ...prevState.modeParams });
            setHistoryIndex(historyIndex - 1);
        }
    }, [history, historyIndex]);

    // Redo
    const handleRedo = useCallback(() => {
        if (historyIndex >= history.length - 1) return;
        isUndoRedoRef.current = true;
        const nextState = history[historyIndex + 1];
        if (nextState) {
            setBudgetInput(nextState.budgetInput);
            setCandidates(nextState.candidates.map(c => ({ ...c })));
            setMode(nextState.mode);
            setModeParams({ ...nextState.modeParams });
            setHistoryIndex(historyIndex + 1);
        }
    }, [history, historyIndex]);

    // 히스토리 저장 (디바운스)
    useEffect(() => {
        const timeout = setTimeout(pushHistory, 500);
        return () => clearTimeout(timeout);
    }, [budgetInput, candidates, mode, modeParams]);

    const activeStrategy = STRATEGIES.find((strategy) => strategy.id === mode);
    const budgetError = getBudgetError(budgetInput);
    const budgetValue = budgetError ? null : Number(budgetInput);

    const { candidateErrors, totalProbability, isProbabilityValid } = useMemo(() => {
        const errors: Record<string, { name?: string; p?: string; m?: string }> = {};

        candidates.forEach((candidate) => {
            const candidateError: { name?: string; p?: string; m?: string } = {};
            if (!candidate.name.trim()) {
                candidateError.name = "캐릭터 이름을 입력해 주세요.";
            }
            if (!Number.isFinite(candidate.p) || candidate.p < 0 || candidate.p > 1) {
                candidateError.p = "우승 확률은 0~100% 범위여야 합니다.";
            }
            if (!Number.isFinite(candidate.m) || candidate.m <= 0) {
                candidateError.m = "배당 배율은 0보다 커야 합니다.";
            }
            if (Object.keys(candidateError).length > 0) {
                errors[candidate.id] = candidateError;
            }
        });

        const allProbabilitiesValid = candidates.every(
            (candidate) =>
                Number.isFinite(candidate.p) && candidate.p >= 0 && candidate.p <= 1
        );
        const total = allProbabilitiesValid
            ? candidates.reduce((sum, candidate) => sum + candidate.p, 0)
            : null;
        const isValid = total !== null && Math.abs(total - 1) <= 0.01;

        return {
            candidateErrors: errors,
            totalProbability: total,
            isProbabilityValid: isValid,
        };
    }, [candidates]);

    const hasBlockingErrors =
        Boolean(budgetError) || Object.keys(candidateErrors).length > 0 || candidates.length === 0;

    const canOptimize = !hasBlockingErrors && budgetValue !== null;

    const probabilityWarning =
        totalProbability !== null && !isProbabilityValid && Object.keys(candidateErrors).length === 0;

    useEffect(() => {
        if (!shareMessage) return;
        const timeout = setTimeout(() => setShareMessage(null), 2500);
        return () => clearTimeout(timeout);
    }, [shareMessage]);

    // 로컬 스토리지에서 복원 (URL 파라미터가 없을 때만)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("data")) return; // URL 파라미터가 있으면 스킵

        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved) as Partial<AppState>;
                if (parsed.budgetInput) setBudgetInput(parsed.budgetInput);
                if (parsed.candidates?.length) {
                    setCandidates(parsed.candidates.map(c => ({
                        ...c,
                        p: parseProbabilityInput(c.pInput),
                        m: parseMultiplierInput(c.mInput),
                    })));
                }
                if (parsed.mode && STRATEGIES.some(s => s.id === parsed.mode)) {
                    setMode(parsed.mode);
                }
                if (parsed.modeParams) setModeParams(parsed.modeParams);
            }
        } catch (e) {
            console.warn("로컬 스토리지 복원 실패", e);
        }
    }, []);

    // 로컬 스토리지에 자동 저장 (디바운스)
    useEffect(() => {
        const timeout = setTimeout(() => {
            const state: AppState = { budgetInput, candidates, mode, modeParams };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }, 1000);
        return () => clearTimeout(timeout);
    }, [budgetInput, candidates, mode, modeParams]);

    // 키보드 단축키 (함수는 ref로 참조)
    const handleOptimizeRef = useRef<() => void>(() => { });
    const handleShareRef = useRef<() => void>(() => { });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
            const mod = isMac ? e.metaKey : e.ctrlKey;

            // Ctrl/Cmd + Enter: 최적화 실행
            if (mod && e.key === "Enter") {
                e.preventDefault();
                handleOptimizeRef.current();
                return;
            }

            // Ctrl/Cmd + S: 공유 링크
            if (mod && e.key === "s") {
                e.preventDefault();
                handleShareRef.current();
                return;
            }

            // Ctrl/Cmd + Z: Undo
            if (mod && !e.shiftKey && e.key === "z") {
                e.preventDefault();
                handleUndo();
                return;
            }

            // Ctrl/Cmd + Shift + Z 또는 Ctrl/Cmd + Y: Redo
            if (mod && (e.shiftKey && e.key === "z" || e.key === "y")) {
                e.preventDefault();
                handleRedo();
                return;
            }

            // Escape: 단축키 도움말 닫기
            if (e.key === "Escape") {
                setShowShortcuts(false);
            }

            // ?: 단축키 도움말 표시
            if (e.key === "?") {
                e.preventDefault();
                setShowShortcuts(prev => !prev);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleUndo, handleRedo]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const encoded = params.get("data");
        if (!encoded) return;

        try {
            const parsed = JSON.parse(decodeURIComponent(encoded)) as Partial<SharePayload>;
            if (typeof parsed.budget === "number" && Number.isInteger(parsed.budget) && parsed.budget > 0) {
                setBudgetInput(parsed.budget.toString());
            }
            if (parsed.mode && STRATEGIES.some((strategy) => strategy.id === parsed.mode)) {
                setMode(parsed.mode);
            }
            if (parsed.params && typeof parsed.params === "object") {
                const cleanParams: Record<string, number> = {};
                Object.entries(parsed.params).forEach(([key, value]) => {
                    if (typeof value === "number" && Number.isFinite(value)) {
                        cleanParams[key] = value;
                    }
                });
                setModeParams(cleanParams);
            }
            if (Array.isArray(parsed.candidates) && parsed.candidates.length > 0) {
                const hydrated = parsed.candidates.map((candidate, index) => {
                    const pInput = typeof candidate.p === "string" ? candidate.p : String(candidate.p ?? "0");
                    const mInput = typeof candidate.m === "string" ? candidate.m : String(candidate.m ?? "1");
                    return createCandidate(
                        `s-${index}`,
                        candidate.name ?? `캐릭터 ${index + 1}`,
                        pInput,
                        mInput
                    );
                });
                setCandidates(hydrated);
            }
        } catch (error) {
            console.warn("공유 데이터를 해석하지 못했습니다.", error);
        }
    }, []);

    const handleNormalizeProbabilities = () => {
        if (totalProbability === null || totalProbability <= 0) return;
        setCandidates((prev) =>
            prev.map((candidate) => {
                if (!Number.isFinite(candidate.p) || candidate.p < 0) return candidate;
                const normalized = candidate.p / totalProbability;
                return {
                    ...candidate,
                    p: normalized,
                    pInput: formatProbabilityInput(normalized),
                };
            })
        );
    };

    const handleOptimize = async () => {
        if (!canOptimize || budgetValue === null) {
            setNotice({
                type: "error",
                title: "강조된 입력을 먼저 수정해 주세요.",
                notes: ["투표권과 캐릭터 입력은 유효한 숫자여야 합니다."],
            });
            return;
        }

        const params = buildRequestParams(mode, modeParams, candidates.length);
        const request: OptimizationRequest = {
            budget: budgetValue,
            candidates: candidates.map((candidate) => ({
                name: candidate.name.trim(),
                p: candidate.p,
                m: candidate.mInput.trim(),
            })),
            rounding: "floor",
            mode,
            params,
        };

        setLoading(true);
        setNotice(null);
        setResult(null);
        setShareUrl(null);

        try {
            const buildRequest = (modeToUse: OptimizationMode): OptimizationRequest => ({
                ...request,
                mode: modeToUse,
                params: buildRequestParams(modeToUse, modeParams, candidates.length),
            });

            const modeOrder: OptimizationMode[] = [
                mode,
                ...STRATEGIES.map((strategy) => strategy.id).filter((id) => id !== mode),
            ];

            let selectedResponse: OptimizationResult | null = null;
            let selectedMode: OptimizationMode | null = null;
            let bestOk:
                | {
                    mode: OptimizationMode;
                    response: OptimizationResult;
                    ev: number;
                }
                | null = null;
            let lastError: OptimizationResult | null = null;
            let lastInfeasible: OptimizationResult | null = null;
            let initialStatus: OptimizationResult["status"] | null = null;
            let initialEV: number | null = null;
            let initialResponse: OptimizationResult | null = null;

            for (const modeId of modeOrder) {
                const response = await optimizeDistribution(buildRequest(modeId));

                if (modeId === mode) {
                    initialStatus = response.status;
                    initialEV = getValidEV(response);
                    initialResponse = response;
                }

                if (response.status === "infeasible") {
                    lastInfeasible = response;
                    continue;
                }
                if (response.status === "error") {
                    lastError = response;
                    continue;
                }

                const ev = getValidEV(response);
                if (ev === null) continue;

                if (!bestOk || ev > bestOk.ev) {
                    bestOk = { mode: modeId, response, ev };
                }

                if (ev >= budgetValue) {
                    selectedResponse = response;
                    selectedMode = modeId;
                    break;
                }
            }

            if (!selectedResponse) {
                if (initialResponse && initialResponse.status === "ok") {
                    setResult(initialResponse);
                    setNotice({
                        type: "warning",
                        title: "기대치가 본전(B) 아래입니다.",
                        notes: [
                            "현재 입력 기준으로는 어떤 모드도 기대치가 본전(B) 이상이 나오지 않습니다.",
                            "그래도 선택한 모드 기준으로 계산 결과를 표시합니다.",
                        ],
                    });
                    return;
                }

                if (bestOk) {
                    setResult(bestOk.response);
                    if (bestOk.mode !== mode) {
                        setMode(bestOk.mode);
                    }
                    setNotice({
                        type: "warning",
                        title: "선택한 모드 계산이 어려워 다른 모드 결과를 표시합니다.",
                        notes: [
                            `표시 모드: ${getStrategyTitle(bestOk.mode)}${Number.isFinite(bestOk.ev) ? ` (기대치 ${bestOk.ev.toFixed(1)})` : ""}`,
                            "현재 입력 기준으로는 어떤 모드도 기대치가 본전(B) 이상이 나오지 않습니다.",
                        ],
                    });
                    return;
                }

                if (lastInfeasible) {
                    setResult(lastInfeasible);
                    setNotice({
                        type: "warning",
                        title: "현재 제약으로는 가능한 해가 없습니다.",
                        notes: lastInfeasible.notes,
                    });
                    return;
                }

                if (lastError) {
                    setResult(lastError);
                    setNotice({
                        type: "error",
                        title: "최적화에 실패했습니다.",
                        notes: lastError.notes ?? ["서버에서 오류 응답이 왔습니다."],
                    });
                    return;
                }

                setNotice({
                    type: "error",
                    title: "최적화에 실패했습니다.",
                    notes: ["알 수 없는 오류가 발생했습니다."],
                });
                return;
            }

            setResult(selectedResponse);

            if (selectedMode && selectedMode !== mode) {
                const originalTitle = getStrategyTitle(mode);
                const nextTitle = getStrategyTitle(selectedMode);
                const nextEV = getValidEV(selectedResponse);
                const reason =
                    initialStatus === "infeasible"
                        ? "선택한 모드는 현재 조건에서 계산이 불가능했습니다."
                        : initialStatus === "error"
                            ? "선택한 모드 계산 중 오류가 발생했습니다."
                            : initialEV !== null
                                ? `선택한 모드 기대치가 본전(B)보다 낮았습니다. (${initialEV.toFixed(1)} < B ${budgetValue})`
                                : "선택한 모드의 기대치를 확인할 수 없습니다.";

                setMode(selectedMode);
                setNotice({
                    type: "info",
                    title: "기대치가 본전(B)보다 낮아 다른 모드로 전환했습니다.",
                    notes: [
                        `선택한 모드: ${originalTitle}`,
                        reason,
                        `전환 모드: ${nextTitle}${nextEV !== null ? ` (기대치 ${nextEV.toFixed(1)})` : ""}`,
                    ],
                });
            } else {
                setNotice(null);
            }
        } catch (error) {
            console.error(error);
            setNotice({
                type: "error",
                title: "네트워크 오류가 발생했습니다.",
                notes: ["최적화 서버에 연결할 수 없습니다."],
            });
        } finally {
            setLoading(false);
        }
    };

    // ref 업데이트 (키보드 단축키용)
    handleOptimizeRef.current = handleOptimize;

    const handleShare = async () => {
        if (!canOptimize || budgetValue === null) {
            setShareMessage("공유 링크를 만들려면 입력을 먼저 수정해 주세요.");
            return;
        }

        const payload: SharePayload = {
            budget: budgetValue,
            mode,
            params: Object.fromEntries(
                Object.entries(modeParams).filter(([, value]) => Number.isFinite(value))
            ),
            candidates: candidates.map((candidate) => ({
                name: candidate.name,
                p: candidate.pInput,
                m: candidate.mInput,
            })),
        };

        const encoded = encodeURIComponent(JSON.stringify(payload));
        const url = `${window.location.origin}?data=${encoded}`;
        window.history.replaceState(null, "", `?data=${encoded}`);

        try {
            await navigator.clipboard.writeText(url);
            setShareMessage("공유 링크를 복사했어요.");
            setShareUrl(null);
        } catch (error) {
            console.warn("클립보드 복사에 실패했습니다.", error);
            setShareMessage("복사에 실패했어요. 아래 링크를 사용하세요.");
            setShareUrl(url);
        }
    };

    // ref 업데이트 (키보드 단축키용)
    handleShareRef.current = handleShare;

    const fillTemplate = () => {
        setBudgetInput("399");
        setCandidates(SAMPLE_CANDIDATES.map((candidate) => ({ ...candidate })));
        setMode("loss_limit");
        setModeParams({});
        setResult(null);
        setNotice(null);
    };

    // 초기화 버튼
    const handleReset = () => {
        setBudgetInput("1000");
        setCandidates(DEFAULT_CANDIDATES.map((c) => ({ ...c })));
        setMode("loss_limit");
        setModeParams({});
        setResult(null);
        setNotice(null);
        localStorage.removeItem(STORAGE_KEY);
    };

    const showResults = result && (result.status === "ok" || result.status === "infeasible");

    const summary = useMemo(() => {
        if (!result?.metrics || budgetValue === null) return null;
        const parts: string[] = [];
        if (Number.isFinite(result.metrics.G)) {
            const g = result.metrics.G!;
            const diff = g - budgetValue;
            parts.push(`최악 시 지급 ${Math.floor(g)} (${diff >= 0 ? "+" : ""}${diff} / 총 투표권 B 대비)`);
        }
        if (Number.isFinite(result.metrics.EV)) {
            parts.push(`기댓값 ${result.metrics.EV!.toFixed(1)}`);
        }
        if (Number.isFinite(result.metrics.P_loss)) {
            parts.push(`손실 확률 ${(result.metrics.P_loss! * 100).toFixed(1)}%`);
        }
        if (parts.length === 0) return null;
        return `이 배분안은 ${parts.join(", ")}를 목표로 합니다.`;
    }, [result, budgetValue]);

    return (
        <main className="min-h-screen pb-20">
            <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl border border-primary/20 bg-primary/10 flex items-center justify-center">
                            <Coins className="text-primary w-5 h-5" />
                        </div>
                        <div className="leading-tight">
                            <p className="text-[10px] tracking-[0.2em] text-muted-foreground">
                                테일즈런너 설날 떡국 빨리 먹기 대회
                            </p>
                            <h1 className="font-display text-lg font-semibold">
                                캐릭터 투표 배분 계산기
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Undo/Redo 버튼 */}
                        <div className="hidden sm:flex items-center gap-1 mr-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleUndo}
                                disabled={historyIndex <= 0}
                                className="h-8 w-8 text-muted-foreground"
                                title="실행 취소 (Ctrl+Z)"
                            >
                                <Undo2 className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleRedo}
                                disabled={historyIndex >= history.length - 1}
                                className="h-8 w-8 text-muted-foreground"
                                title="다시 실행 (Ctrl+Shift+Z)"
                            >
                                <Redo2 className="w-4 h-4" />
                            </Button>
                        </div>
                        <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
                            <RotateCw className="w-4 h-4 mr-1" /> 초기화
                        </Button>
                        <Button variant="secondary" size="sm" onClick={fillTemplate}>
                            샘플 불러오기
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleShare}>
                            <Share2 className="w-4 h-4 mr-2" /> 공유 링크
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowShortcuts(prev => !prev)}
                            className="h-8 w-8 text-muted-foreground hidden sm:flex"
                            title="단축키 보기 (?)"
                        >
                            <Keyboard className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
                {shareMessage && (
                    <div className="max-w-6xl mx-auto px-4 pb-3 text-xs text-muted-foreground flex items-center gap-2">
                        <Link2 className="w-3.5 h-3.5" />
                        <span>{shareMessage}</span>
                    </div>
                )}
                {shareUrl && (
                    <div className="max-w-6xl mx-auto px-4 pb-4 text-xs text-muted-foreground">
                        <code className="break-all">{shareUrl}</code>
                    </div>
                )}
            </header>

            <section className="max-w-6xl mx-auto px-4 py-8 space-y-8">
                <Card className="bg-card/70 border-border/70">
                    <CardContent className="pt-6 text-sm text-muted-foreground space-y-3">
                        <p className="font-semibold text-foreground">
                            투표권 배분 계산기
                        </p>
                        <p className="text-xs">
                            각 캐릭터의 우승 확률과 배당률을 입력한 후, 원하는 전략을 선택하세요.
                        </p>
                        <div className="grid grid-cols-3 gap-4 pt-1 text-xs">
                            <div>
                                <p className="font-medium text-foreground">1. 투표권 입력</p>
                            </div>
                            <div>
                                <p className="font-medium text-foreground">2. 캐릭터 정보</p>
                            </div>
                            <div>
                                <p className="font-medium text-foreground">3. 전략 선택</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-8">
                    <div className="space-y-6 animate-fade-up">
                        <BudgetInput value={budgetInput} onChange={setBudgetInput} error={budgetError} />
                        <CandidateTable
                            candidates={candidates}
                            onUpdate={setCandidates}
                            errors={candidateErrors}
                            totalProbability={totalProbability}
                            isProbabilityValid={isProbabilityValid}
                            onNormalize={handleNormalizeProbabilities}
                        />
                    </div>

                    <div className="space-y-6 animate-fade-up" style={{ animationDelay: "120ms" }}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">전략 선택</h3>
                            <Badge variant="outline" className="text-muted-foreground">
                                소수점 버림
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground -mt-2">
                            배분 방식을 선택하세요.
                        </p>
                        <ModeSelector
                            selectedMode={mode}
                            onSelectMode={setMode}
                            modeParams={modeParams}
                            onUpdateParams={setModeParams}
                            candidateCount={candidates.length}
                            budget={budgetValue ?? undefined}
                            candidates={candidates.map((c) => ({ p: c.p, m: c.m }))}
                        />

                        <Button
                            className="w-full h-14 text-lg shadow-lg shadow-primary/10 bg-gradient-to-r from-teal-600 via-teal-500 to-cyan-500 hover:from-teal-500 hover:to-cyan-400 border-none"
                            size="lg"
                            onClick={handleOptimize}
                            disabled={loading || !canOptimize}
                        >
                            {loading ? (
                                <RotateCcw className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <Play className="mr-2 h-5 w-5 fill-current" />
                            )}
                            {loading ? "계산 중..." : "최적화 실행"}
                        </Button>

                        {!canOptimize && (
                            <p className="text-xs text-muted-foreground">
                                강조된 입력을 수정하면 실행할 수 있어요.
                            </p>
                        )}

                        {probabilityWarning && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5" />
                                <span>
                                    확률 합계가 {((totalProbability ?? 0) * 100).toFixed(1)}%입니다.
                                    입력값 그대로 계산됩니다.
                                </span>
                            </div>
                        )}

                        {notice && (
                            <div
                                className={cn(
                                    "rounded-lg border p-4 text-sm flex flex-col gap-2",
                                    notice.type === "error" &&
                                    "border-destructive/30 bg-destructive/10 text-destructive",
                                    notice.type === "warning" &&
                                    "border-amber-200 bg-amber-50 text-amber-900",
                                    notice.type === "info" &&
                                    "border-sky-200 bg-sky-50 text-sky-900"
                                )}
                            >
                                <div className="flex items-start gap-2">
                                    {notice.type === "error" && <AlertTriangle className="w-4 h-4 mt-0.5" />}
                                    {notice.type === "warning" && <AlertTriangle className="w-4 h-4 mt-0.5" />}
                                    {notice.type === "info" && <CheckCircle2 className="w-4 h-4 mt-0.5" />}
                                    <div className="flex-1">
                                        <p className="font-semibold">{notice.title}</p>
                                        {notice.notes && notice.notes.length > 0 && (
                                            <ul className="list-disc pl-5 mt-1 space-y-1">
                                                {notice.notes.map((note, index) => (
                                                    <li key={`${note}-${index}`}>{note}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                                {notice.type === "error" && canOptimize && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="self-start"
                                        onClick={handleOptimize}
                                    >
                                        <RefreshCcw className="w-3.5 h-3.5 mr-2" />
                                        재시도
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {showResults && budgetValue !== null && (
                    <div className="space-y-6 animate-fade-up">
                        <div className="flex items-center gap-3 border-b border-border/60 pb-4">
                            <h2 className="text-2xl font-display font-semibold">결과</h2>
                            {activeStrategy?.title && (
                                <Badge variant="outline" className="text-muted-foreground">
                                    {activeStrategy.title}
                                </Badge>
                            )}
                            {result?.status === "infeasible" && (
                                <Badge variant="destructive">불가능</Badge>
                            )}
                        </div>

                        <MetricsGrid result={result} budget={budgetValue} />

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <AllocationList result={result} candidates={candidates} />
                            <PayoutChart result={result} budget={budgetValue} />
                        </div>

                        {summary && (
                            <Card className="bg-secondary/40 border-none">
                                <CardContent className="pt-6">
                                    <p className="text-muted-foreground italic">{summary}</p>
                                </CardContent>
                            </Card>
                        )}

                        {result?.status === "ok" && result?.notes && result.notes.length > 0 && (
                            <div className="rounded-lg border border-border/60 bg-card p-4 text-sm text-muted-foreground">
                                <p className="font-semibold text-foreground mb-2">메모</p>
                                <ul className="list-disc pl-5 space-y-1">
                                    {result.notes.map((note, index) => (
                                        <li key={`${note}-${index}`}>{note}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                <footer className="pt-6 text-center text-xs text-muted-foreground">
                    제작: 껌딱
                </footer>
            </section>
        </main>
    );
}
