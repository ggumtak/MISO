export function parseProbabilityInput(input: string): number {
    const normalized = input.trim().replace(/%/g, "");
    if (!normalized) return Number.NaN;
    const value = Number(normalized);
    if (!Number.isFinite(value)) return Number.NaN;
    return value / 100;
}

export function parseMultiplierInput(input: string): number {
    const normalized = input.trim();
    if (!normalized) return Number.NaN;
    const value = Number(normalized);
    if (!Number.isFinite(value)) return Number.NaN;
    return value;
}

export function formatProbabilityInput(value: number) {
    if (!Number.isFinite(value)) return "";
    const percent = value * 100;
    return percent % 1 === 0 ? percent.toFixed(0) : percent.toFixed(1);
}
