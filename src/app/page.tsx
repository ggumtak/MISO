"use client";

import { useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    CheckCircle2,
    Coins,
    Link2,
    Play,
    RefreshCcw,
    RotateCcw,
    Share2,
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
    createCandidate("1", "Candidate A", "50", "1.8"),
    createCandidate("2", "Candidate B", "30", "3.0"),
    createCandidate("3", "Candidate C", "10", "8.0"),
    createCandidate("4", "Candidate D", "5", "15.0"),
    createCandidate("5", "Candidate E", "5", "15.0"),
];

const SAMPLE_CANDIDATES: Candidate[] = [
    createCandidate("t1", "Favorite", "90", "1.2"),
    createCandidate("t2", "Dark Horse", "1", "50"),
    createCandidate("t3", "Mid Tier", "4", "20"),
    createCandidate("t4", "Long Shot", "1", "50"),
    createCandidate("t5", "Another Mid", "4", "20"),
];

const getBudgetError = (input: string) => {
    if (!input.trim()) return "Budget is required.";
    const value = Number(input);
    if (!Number.isFinite(value)) return "Budget must be a number.";
    if (!Number.isInteger(value)) return "Budget must be an integer.";
    if (value <= 0) return "Budget must be positive.";
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

export default function Home() {
    const [budgetInput, setBudgetInput] = useState("1000");
    const [candidates, setCandidates] = useState<Candidate[]>(
        () => DEFAULT_CANDIDATES.map((candidate) => ({ ...candidate }))
    );
    const [mode, setMode] = useState<OptimizationMode>("all_weather_maximin");
    const [modeParams, setModeParams] = useState<Record<string, number>>({});

    const [result, setResult] = useState<OptimizationResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState<Notice | null>(null);
    const [shareMessage, setShareMessage] = useState<string | null>(null);
    const [shareUrl, setShareUrl] = useState<string | null>(null);

    const activeStrategy = STRATEGIES.find((strategy) => strategy.id === mode);
    const budgetError = getBudgetError(budgetInput);
    const budgetValue = budgetError ? null : Number(budgetInput);

    const { candidateErrors, totalProbability, isProbabilityValid } = useMemo(() => {
        const errors: Record<string, { name?: string; p?: string; m?: string }> = {};

        candidates.forEach((candidate) => {
            const candidateError: { name?: string; p?: string; m?: string } = {};
            if (!candidate.name.trim()) {
                candidateError.name = "Name is required.";
            }
            if (!Number.isFinite(candidate.p) || candidate.p < 0 || candidate.p > 1) {
                candidateError.p = "Probability must be between 0 and 100%.";
            }
            if (!Number.isFinite(candidate.m) || candidate.m <= 0) {
                candidateError.m = "Multiplier must be positive.";
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
                        candidate.name ?? `Candidate ${index + 1}`,
                        pInput,
                        mInput
                    );
                });
                setCandidates(hydrated);
            }
        } catch (error) {
            console.warn("Failed to parse shared state.", error);
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
                title: "Fix the highlighted inputs before optimizing.",
                notes: ["Budget and candidate fields must be valid numbers."],
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
            const response = await optimizeDistribution(request);
            setResult(response);

            if (response.status === "ok") {
                setNotice(null);
            } else if (response.status === "infeasible") {
                setNotice({
                    type: "warning",
                    title: "No feasible solution under current constraints.",
                    notes: response.notes,
                });
            } else {
                setNotice({
                    type: "error",
                    title: "Optimization failed.",
                    notes: response.notes ?? ["Backend returned an error response."],
                });
            }
        } catch (error) {
            console.error(error);
            setNotice({
                type: "error",
                title: "Network error.",
                notes: ["Unable to reach optimization backend."],
            });
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        if (!canOptimize || budgetValue === null) {
            setShareMessage("Fix inputs before creating a share link.");
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
            setShareMessage("Share link copied to clipboard.");
            setShareUrl(null);
        } catch (error) {
            console.warn("Clipboard copy failed.", error);
            setShareMessage("Copy failed. Use the link below.");
            setShareUrl(url);
        }
    };

    const fillTemplate = () => {
        setBudgetInput("399");
        setCandidates(SAMPLE_CANDIDATES.map((candidate) => ({ ...candidate })));
        setMode("all_weather_maximin");
        setModeParams({});
        setResult(null);
        setNotice(null);
    };

    const showResults = result && (result.status === "ok" || result.status === "infeasible");

    const summary = useMemo(() => {
        if (!result?.metrics || budgetValue === null) return null;
        const parts: string[] = [];
        if (Number.isFinite(result.metrics.G)) {
            const g = result.metrics.G!;
            const diff = g - budgetValue;
            parts.push(`worst-case payout ${Math.floor(g)} (${diff >= 0 ? "+" : ""}${diff} vs B)`);
        }
        if (Number.isFinite(result.metrics.EV)) {
            parts.push(`expected value ${result.metrics.EV!.toFixed(1)}`);
        }
        if (Number.isFinite(result.metrics.P_loss)) {
            parts.push(`loss probability ${(result.metrics.P_loss! * 100).toFixed(1)}%`);
        }
        if (parts.length === 0) return null;
        return `This allocation targets ${parts.join(", ")}.`;
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
                            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                Terun Calc
                            </p>
                            <h1 className="font-display text-lg font-semibold">
                                Allocation Optimizer
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" onClick={fillTemplate}>
                            Load Sample
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleShare}>
                            <Share2 className="w-4 h-4 mr-2" /> Share Link
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
                            <h3 className="text-lg font-semibold">Strategy</h3>
                            <Badge variant="outline" className="text-muted-foreground">
                                Rounding: floor
                            </Badge>
                        </div>
                        <ModeSelector
                            selectedMode={mode}
                            onSelectMode={setMode}
                            modeParams={modeParams}
                            onUpdateParams={setModeParams}
                            candidateCount={candidates.length}
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
                            {loading ? "Optimizing..." : "Run Optimization"}
                        </Button>

                        {!canOptimize && (
                            <p className="text-xs text-muted-foreground">
                                Fix the highlighted inputs to enable optimization.
                            </p>
                        )}

                        {probabilityWarning && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5" />
                                <span>
                                    Probabilities sum to {((totalProbability ?? 0) * 100).toFixed(1)}%.
                                    The backend will use them as-is.
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
                                        Retry
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {showResults && budgetValue !== null && (
                    <div className="space-y-6 animate-fade-up">
                        <div className="flex items-center gap-3 border-b border-border/60 pb-4">
                            <h2 className="text-2xl font-display font-semibold">Results</h2>
                            {activeStrategy?.title && (
                                <Badge variant="outline" className="text-muted-foreground">
                                    {activeStrategy.title}
                                </Badge>
                            )}
                            {result?.status === "infeasible" && (
                                <Badge variant="destructive">Infeasible</Badge>
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
                                <p className="font-semibold text-foreground mb-2">Notes</p>
                                <ul className="list-disc pl-5 space-y-1">
                                    {result.notes.map((note, index) => (
                                        <li key={`${note}-${index}`}>{note}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </main>
    );
}
