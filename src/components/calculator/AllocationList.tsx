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
    const allocationMap = new Map(allocation.map((item) => [item.name, item]));
    const ordered = [
        ...candidates
            .map((candidate) => allocationMap.get(candidate.name))
            .filter((item): item is { name: string; s: number } => Boolean(item)),
        ...allocation.filter((item) => !candidateMap.has(item.name)),
    ];

    if (ordered.length === 0) {
        return (
            <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
                최적화 결과 배분이 없습니다.
            </div>
        );
    }

    return (
        <div className="rounded-md border bg-card">
            <div className="p-4 border-b">
                <h3 className="font-semibold">추천 배분안</h3>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>캐릭터</TableHead>
                        <TableHead className="text-right">투표 배분(s)</TableHead>
                        <TableHead className="text-right">배당 배율</TableHead>
                        <TableHead className="text-right">우승 시 지급</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {ordered.map((item) => {
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
                                    {isZero && <Badge variant="secondary" className="ml-2 text-[10px] h-4">미배분</Badge>}
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
