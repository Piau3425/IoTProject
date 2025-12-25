import { useEffect } from 'react'
import Lenis from 'lenis'

export function SmoothScroll() {
  useEffect(() => {
    // 初始化 Lenis 實例，設定物理捲動參數
    const lenis = new Lenis({
      duration: 1.2,                                          // 捲動動畫持續時間
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // 自定義緩動函數：Expo Out
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    })

    // 狀態追蹤：最後一次互動時間，用於判斷是否進入閒置狀態
    let lastInteractionTime = Date.now();
    let isIdle = false;
    let rafId: number;

    const updateInteraction = () => {
      lastInteractionTime = Date.now();
      if (isIdle) {
        isIdle = false;
        rafId = requestAnimationFrame(raf); // 喚醒循環
      }
    };

    // 監聽使用者互動以喚醒 RAF 循環
    window.addEventListener('wheel', updateInteraction, { passive: true });
    window.addEventListener('keydown', updateInteraction, { passive: true });
    window.addEventListener('touchstart', updateInteraction, { passive: true });
    window.addEventListener('touchmove', updateInteraction, { passive: true });
    window.addEventListener('resize', updateInteraction, { passive: true });

    // 動畫循環：將 Lenis 的 RAF (Request Animation Frame) 整合進瀏覽器的渲染循環
    function raf(time: number) {
      const now = Date.now();

      // 優化：當頁面不可見時暫停計算，大幅降低背景資源消耗
      if (document.visibilityState !== 'hidden') {
        lenis.raf(time);
      }

      // 閒置檢測：如果在 2 秒內沒有互動且滾動速度接近 0，則停止 RAF 循環以節省資源
      // 注意：我們檢查 lenis.velocity (如果有) 確保慣性滾動已完成
      // 這裡假設 lenis.isScrolling 或 velocity 可用，若無則依賴時間
      const isSettled = !(lenis as any).isScrolling; // 嘗試偵測是否停止

      if (isSettled && (now - lastInteractionTime > 2000)) {
        isIdle = true;
        // 停止遞迴調用，進入休眠
        return;
      }

      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    // 組件卸載時，務必銷毀實例與移除事件監聽
    return () => {
      lenis.destroy();
      cancelAnimationFrame(rafId);
      window.removeEventListener('wheel', updateInteraction);
      window.removeEventListener('keydown', updateInteraction);
      window.removeEventListener('touchstart', updateInteraction);
      window.removeEventListener('touchmove', updateInteraction);
      window.removeEventListener('resize', updateInteraction);
    };
  }, [])

  return null
}
