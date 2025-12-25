/**
 * 進階動態數字組件 (AnimatedNumber)
 * 實作類似「吃角子老虎機」或「翻頁時鐘」的捲動數字特效。
 * 結合 GSAP 實現物理感的數字捲軸滾動，大幅提升數據展示的儀式感。
 */
import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import gsap from 'gsap';

interface AnimatedNumberProps {
  value: number;
  /** 小數點精度 */
  precision?: number;
  className?: string;
  /** 自定義格式化函數 */
  format?: (val: number) => string;
}

/**
 * 每一位數字的捲動單元
 * 內部包含 0-9 的垂直序列，透過調整 y 軸位移來顯示特定目標數字。
 */
const Digit = ({ char, height }: { char: string; height: number }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isNumber = !isNaN(parseInt(char));

  useEffect(() => {
    if (!containerRef.current || !isNumber) return;

    const targetIndex = parseInt(char);
    // 使用 GSAP 驅動捲軸位移，back.out 帶點回彈效果更具質感
    gsap.to(containerRef.current, {
      y: -targetIndex * height,
      duration: 0.8,
      ease: "back.out(1.7)",
    });
  }, [char, height, isNumber]);

  // 如果是非數字字元（如小數點），直接靜態顯示
  if (!isNumber) {
    return (
      <div
        style={{ height, lineHeight: `${height}px` }}
        className="flex items-center justify-center"
      >
        {char}
      </div>
    );
  }

  return (
    <div className="overflow-hidden relative" style={{ height, width: '0.6em' }}>
      <div ref={containerRef} className="flex flex-col items-center absolute w-full top-0 left-0">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <div
            key={n}
            style={{ height, lineHeight: `${height}px` }}
            className="flex items-center justify-center w-full"
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
};

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  precision = 0,
  className,
  format
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [digitHeight, setDigitHeight] = useState(0);
  const measureRef = useRef<HTMLDivElement>(null);

  // 初始掛載後測量單一字元的高度，以確保捲動位移計算精準
  useEffect(() => {
    if (measureRef.current) {
      setDigitHeight(measureRef.current.clientHeight);
    }
  }, []);

  // 格式化數值為字串供字元解析
  const formatted = format ? format(value) : value.toFixed(precision);
  const chars = formatted.split('');

  return (
    <div
      ref={containerRef}
      className={cn("flex flex-row items-center font-mono relative", className)}
    >
      {/* 隱藏的測量元素：僅用於在背景取得字體高度數據 */}
      <div
        ref={measureRef}
        className="absolute opacity-0 pointer-events-none"
        aria-hidden="true"
      >
        0
      </div>

      {/* 測量完成後解析字串，為每個字元派發 Digit 單元 */}
      {digitHeight > 0 && chars.map((char, index) => (
        <Digit key={index} char={char} height={digitHeight} />
      ))}

      {/* 測量前的後備顯示，防止畫面跳動 */}
      {digitHeight === 0 && <span>{formatted}</span>}
    </div>
  );
};

/**
 * 簡易緩動數字 (TweenNumber)
 * 若捲軸效果對版面影響太大，可使用此輕量版本。
 * 直接對文字內容進行數值插值 (Interpolation)。
 */
export const TweenNumber: React.FC<AnimatedNumberProps> = ({
  value,
  precision = 0,
  className,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    if (!ref.current) return;

    // 將數值變化的過程交給 GSAP 進行補間運算
    gsap.to(prevValue, {
      current: value,
      duration: 1,
      ease: "power3.out",
      onUpdate: () => {
        if (ref.current) {
          // 在每一幀更新 DOM 內容
          ref.current.innerText = prevValue.current.toFixed(precision);
        }
      },
    });
  }, [value, precision]);

  return <span ref={ref} className={className}>{value.toFixed(precision)}</span>;
};
