import { Candidate, OptimizationResult } from "@/types/calculator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface AllocationListProps {
    result: OptimizationResult;
    candidates: Candidate[];
}

export function AllocationList({ result, candidates }: AllocationListProps) {
    const allocation = result.allocation ?? [];
    const payoutMap = new Map(
        (result.payoutByOutcome ?? []).map((item) => [item.name, item.payout])
    );
    const candidateMap = new Map(candidates.map((candidate) => [candidate.name, candidate]));
    const sorted = [...allocation].sort((a, b) => b.s - a.s);

    if (sorted.length === 0) {
        return (
            <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
                No allocation returned from the optimizer.
            </div>
        );
    }

    return (
        <div className="rounded-md border bg-card">
            <div className="p-4 border-b">
                <h3 className="font-semibold">Recommended Allocation Strategy</h3>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Candidate</TableHead>
                        <TableHead className="text-right">Votes (s)</TableHead>
                        <TableHead className="text-right">Multiplier</TableHead>
                        <TableHead className="text-right">If Wins (Payout)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sorted.map((item) => {
                        const candidate = candidateMap.get(item.name);
                        const payout = payoutMap.get(item.name);
                        const isZero = item.s === 0;
                        const multiplierText = Number.isFinite(candidate?.m)
                            ? `${candidate?.m.toFixed(2)}x`
                            : "--";
                        return (
                            <TableRow key={item.name} className={isZero ? "opacity-50" : ""}>
                                <TableCell className="font-medium">
                                    {item.name}
                                    {isZero && <Badge variant="secondary" className="ml-2 text-[10px] h-4">Skip</Badge>}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-primary">
                                    {item.s}
                                </TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">
                                    {multiplierText}
                                </TableCell>
                                <TableCell className="text-right font-mono text-teal-600">
                                    {Number.isFinite(payout)
                                        ? payout
                                        : Number.isFinite(candidate?.m)
                                            ? Math.floor(item.s * candidate!.m)
                                            : "--"}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
