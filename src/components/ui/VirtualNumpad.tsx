"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { Delete, CornerDownLeft, X } from "lucide-react";

interface VirtualNumpadProps {
    isOpen: boolean;
    onClose: () => void;
    onInput: (value: string) => void;
    onBackspace: () => void;
    onClear: () => void;
    onSubmit: () => void;
    currentValue: string;
    allowDecimal?: boolean;
    position?: { top: number; left: number };
}

export function VirtualNumpad({
    isOpen,
    onClose,
    onInput,
    onBackspace,
    onClear,
    onSubmit,
    currentValue,
    allowDecimal = true,
    position,
}: VirtualNumpadProps) {
    const numpadRef = useRef<HTMLDivElement>(null);

    // 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (numpadRef.current && !numpadRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, onClose]);

    // 햅틱 피드백 (진동)
    const vibrate = useCallback(() => {
        if ("vibrate" in navigator) {
            navigator.vibrate(10);
        }
    }, []);

    const handleNumberClick = (num: string) => {
        vibrate();
        onInput(num);
    };

    const handleBackspace = () => {
        vibrate();
        onBackspace();
    };

    const handleClear = () => {
        vibrate();
        onClear();
    };

    const handleSubmit = () => {
        vibrate();
        onSubmit();
        onClose();
    };

    if (!isOpen) return null;

    const buttons = [
        ["7", "8", "9"],
        ["4", "5", "6"],
        ["1", "2", "3"],
        [allowDecimal ? "." : "", "0", "←"],
    ];

    return (
        <div
            ref={numpadRef}
            className={cn(
                "fixed z-50 bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl p-3",
                "animate-in fade-in slide-in-from-bottom-2 duration-200"
            )}
            style={position ? { top: position.top, left: position.left } : undefined}
        >
            {/* 현재 값 표시 */}
            <div className="flex items-center justify-between mb-3 px-2">
                <span className="font-mono text-xl font-bold text-primary">
                    {currentValue || "0"}
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={onClose}
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>

            {/* 숫자 키패드 */}
            <div className="grid grid-cols-3 gap-2">
                {buttons.flat().map((btn, idx) => {
                    if (btn === "") return <div key={idx} />;
                    if (btn === "←") {
                        return (
                            <Button
                                key={idx}
                                variant="secondary"
                                className="h-12 w-14 text-lg font-semibold"
                                onClick={handleBackspace}
                            >
                                <Delete className="w-5 h-5" />
                            </Button>
                        );
                    }
                    return (
                        <Button
                            key={idx}
                            variant="outline"
                            className="h-12 w-14 text-xl font-bold hover:bg-primary/10 hover:border-primary/50 transition-all"
                            onClick={() => handleNumberClick(btn)}
                        >
                            {btn}
                        </Button>
                    );
                })}
            </div>

            {/* 하단 액션 버튼 */}
            <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                    variant="destructive"
                    className="h-10 text-sm"
                    onClick={handleClear}
                >
                    지우기
                </Button>
                <Button
                    className="h-10 text-sm bg-gradient-to-r from-teal-600 to-cyan-500"
                    onClick={handleSubmit}
                >
                    <CornerDownLeft className="w-4 h-4 mr-1" />
                    확인
                </Button>
            </div>
        </div>
    );
}

// 가상 키패드를 쉽게 사용하기 위한 훅
export function useVirtualNumpad() {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [currentValue, setCurrentValue] = useState("");
    const [allowDecimal, setAllowDecimal] = useState(true);
    const callbackRef = useRef<((value: string) => void) | null>(null);

    const open = useCallback(
        (
            inputElement: HTMLInputElement,
            initialValue: string,
            onChange: (value: string) => void,
            decimal: boolean = true
        ) => {
            const rect = inputElement.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 8,
                left: Math.max(8, rect.left - 20),
            });
            setCurrentValue(initialValue);
            setAllowDecimal(decimal);
            callbackRef.current = onChange;
            setIsOpen(true);
        },
        []
    );

    const close = useCallback(() => {
        setIsOpen(false);
        callbackRef.current = null;
    }, []);

    const handleInput = useCallback((char: string) => {
        setCurrentValue((prev) => {
            const newValue = prev + char;
            callbackRef.current?.(newValue);
            return newValue;
        });
    }, []);

    const handleBackspace = useCallback(() => {
        setCurrentValue((prev) => {
            const newValue = prev.slice(0, -1);
            callbackRef.current?.(newValue);
            return newValue;
        });
    }, []);

    const handleClear = useCallback(() => {
        setCurrentValue("");
        callbackRef.current?.("");
    }, []);

    return {
        isOpen,
        position,
        currentValue,
        allowDecimal,
        open,
        close,
        handleInput,
        handleBackspace,
        handleClear,
    };
}
