/**
 * 形態轉換數字組件 (MorphingDigit)
 * 負責實作極度流暢、具備方向感與動態模糊的數字切換效果。
 * 優化目標：高頻更新的感測器數據或計時器顯示。
 * 特色：
 * 1. 自動偵測數值升降，決定數字是向上或向下捲動。
 * 2. 使用 Framer Motion 的 popLayout 模式實現平滑過渡。
 * 3. 固定寬度佈局，避免數字切換時發生水平晃動 (Layout Shift)。
 */
import React, { useRef } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, Transition } from 'framer-motion';

interface MorphingDigitProps {
    /** 欲顯示的數字或字元 (0-9 或 .) */
    value: number | string;
    /** 組件高度（像素），主要控制字體大小 */
    height?: number;
    /** 文字顏色 */
    color?: string;
    /** 裝飾用顏色 */
    accentColor?: string;
    /** 額外 CSS 類別 */
    className?: string;
    /** 行內樣式 */
    style?: React.CSSProperties;
    /** 強制指定捲動方向 (1: 向上, -1: 向下)，若不提供則自動計算 */
    forceDirection?: 1 | -1;
}

/**
 * 單個數字單元：實現具備模糊效果的方向性滑動過渡。
 */
export const MorphingDigit: React.FC<MorphingDigitProps> = ({
    value,
    height = 40,
    color = 'currentColor',
    className,
    style,
    forceDirection,
}) => {
    // 數值標準化處理
    const charValue = String(value);
    const isNumber = !isNaN(parseInt(charValue)) && charValue !== ' ';
    const currentInt = isNumber ? parseInt(charValue) : 0;

    // 使用 Ref 鎖定狀態，避免在 React 重新渲染時產生不一致的動畫方向
    // 存儲：{ value: 上次數值, direction: 捲動方向 }
    const stateRef = useRef({
        value: currentInt,
        direction: 1
    });

    // 若外部未強制指定方向，則根據數值增減自動計算行為
    if (forceDirection === undefined) {
        if (isNumber && currentInt !== stateRef.current.value) {
            if (currentInt > stateRef.current.value) {
                stateRef.current.direction = 1; // 增加：向上滑入
            } else {
                stateRef.current.direction = -1; // 減少：向下滑入
            }
            stateRef.current.value = currentInt;
        }
    }

    // 優先採用手動指定方向，否則使用運算結果
    const direction = forceDirection !== undefined ? forceDirection : stateRef.current.direction;

    // 定義物理運動參數：改用 tween 避免 spring 過沖產生負的 blur 值
    const transition: Transition = {
        type: "tween",
        duration: 0.2,
        ease: "easeOut",
    };

    // 非數字字元（如點號 '.'）：回傳靜態元素，不參與捲動動畫
    if (!isNumber) {
        return (
            <div
                className={cn("flex items-center justify-center relative select-none", className)}
                style={{
                    height,
                    lineHeight: `${height}px`,
                    fontSize: height * 0.8,
                    color,
                    ...style,
                }}
            >
                {charValue}
            </div>
        );
    }

    // 數字單元：結合 AnimatePresence 偵測 Key 變化觸發動畫
    return (
        <div
            className={cn("relative overflow-hidden flex items-center justify-center select-none", className)}
            style={{
                height,
                width: '0.65em', // 強制等寬佈局，避免數字間距隨字元改變而閃爍
                color,
                fontSize: height * 0.8,
                fontWeight: 600,
                ...style,
            }}
        >
            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                <motion.span
                    key={charValue} // 當 charValue 改變時，React 會視為新節點並執行 Entry/Exit 動畫
                    custom={direction}
                    variants={{
                        enter: (dir: number) => ({
                            y: dir > 0 ? '100%' : '-100%',
                            opacity: 0,
                            filter: 'blur(5px)', // 模擬運動模糊
                            scale: 0.5,
                        }),
                        center: {
                            y: '0%',
                            opacity: 1,
                            filter: 'blur(0px)',
                            scale: 1,
                        },
                        exit: (dir: number) => ({
                            y: dir > 0 ? '-100%' : '100%',
                            opacity: 0,
                            filter: 'blur(5px)',
                            scale: 0.5,
                        })
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={transition}
                    className="absolute inset-x-0 flex items-center justify-center tabular-nums h-full"
                    style={{ lineHeight: `${height}px` }}
                >
                    {charValue}
                </motion.span>
            </AnimatePresence>

            {/* 增加頂部的高光層，提升細膩的立體質感 */}
            <div
                className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/10 to-transparent pointer-events-none opacity-20"
            />
        </div>
    );
};

// ============================================================================
// 形態轉換數字序列組件 (MorphingNumber)
// 將多個單一數字單元 (MorphingDigit) 組合，由高階組件統一協調捲動方向。
// ============================================================================

interface MorphingNumberProps {
    value: number;
    precision?: number; // 小數點精度
    height?: number;
    color?: string;
    accentColor?: string;
    className?: string;
    style?: React.CSSProperties;
}

export const MorphingNumber: React.FC<MorphingNumberProps> = ({
    value,
    precision = 1,
    height = 40,
    color = 'currentColor',
    accentColor,
    className,
    style,
}) => {
    // 依據精度格式化字串
    const formatted = value.toFixed(precision);
    const chars = formatted.split('');

    // 全域方向判斷邏輯：確保整個數字序列（如 10.5 變為 11.0）的所有位元共享同一個動畫方向
    const stateRef = useRef({
        value: value,
        direction: 1 as 1 | -1
    });

    if (value !== stateRef.current.value) {
        if (value > stateRef.current.value) {
            stateRef.current.direction = 1;
        } else {
            stateRef.current.direction = -1;
        }
        stateRef.current.value = value;
    }

    const direction = stateRef.current.direction;

    return (
        <div
            className={cn("flex flex-row items-center font-mono", className)}
            style={{
                color,
                ...style,
            }}
        >
            {chars.map((char, index) => (
                <MorphingDigit
                    key={`${index}-${char === '.' ? 'dot' : 'num'}`}
                    value={char}
                    height={height}
                    color={color}
                    accentColor={accentColor}
                    className={char === '.' ? 'w-2' : undefined}
                    // 將共用的方向傳遞給所有子元
                    forceDirection={direction}
                />
            ))}
        </div>
    );
};

export default MorphingDigit;
