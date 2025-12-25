/**
 * 進階自定義游標 (AdvancedCursor)
 * 負責實作高品質、具備物理感的自定義游標特效。
 * 核心特色：
 * 1. 雙層架構：內圈紅點即時反應滑鼠位置，外圈圓環具備延遲追蹤與彈簧效果。
 * 2. 磁性吸引：當懸停於按鈕或連結時，外圈會自動「吸附」並包覆目標元素。
 * 3. 形態切換：在一般、懸停、點擊與文字輸入區域之間無縫切換視覺效果。
 */
import { useEffect, useState, useRef } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { cn } from '@/lib/utils'

export function AdvancedCursor() {
    // 滑鼠位置的原始動態數值 (High-performance Motion Values)
    const mouseX = useMotionValue(0)
    const mouseY = useMotionValue(0)

    // 定義外圈圓環的彈簧參數，產生有機的拖動感 (damping: 阻尼, stiffness: 剛性)
    const springConfig = { damping: 20, stiffness: 150, mass: 0.8 }

    // 互動狀態同步
    const [isHovering, setIsHovering] = useState(false)
    const [isClicking, setIsClicking] = useState(false)
    const [isText, setIsText] = useState(false)
    const [isSlider, setIsSlider] = useState(false) // 滑條互動時隱藏整個鼠標
    const [magnetPos, setMagnetPos] = useState<{ x: number, y: number, width: number, height: number } | null>(null)
    const [skewValue, setSkewValue] = useState(0)

    // 防抖邏輯：追蹤上一次懸停的可點擊元素，避免邊界處快速切換造成抖動
    const lastClickableRef = useRef<Element | null>(null)

    useEffect(() => {
        // 全域滑鼠移動監聽
        let rafId: number | null = null;
        let lastEvent: MouseEvent | null = null;

        const handleMouseMove = (e: MouseEvent) => {
            lastEvent = e;
            if (rafId) return;

            rafId = requestAnimationFrame(() => {
                if (lastEvent) {
                    mouseX.set(lastEvent.clientX);
                    mouseY.set(lastEvent.clientY);
                }
                rafId = null;
            });
        }

        /**
         * 隱藏邏輯：當滑鼠離開視窗或在 iframe 上時隱藏
         */
        const handleMouseLeave = () => {
            setIsHovering(false)
            setMagnetPos(null)
        }

        const handleMouseDown = () => setIsClicking(true)
        const handleMouseUp = () => setIsClicking(false)

        /**
         * 元素感應邏輯
         * 監聽全域事件來判斷目前滑鼠下方的元素類型，從而切換游標樣式。
         * 使用 lastClickableRef 追蹤上一次懸停的元素，避免在邊界快速切換造成抖動。
         */
        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement

            // 檢查是否為可點擊元素或互動重點
            const isClickable = target.closest('a, button, [role="button"], input, .interactive, [role="slider"], .radix-slider-thumb')
            const isTextInput = target.closest('input[type="text"], textarea, [contenteditable="true"]')

            // 檢查是否有自定義偏斜 (Skew) 屬性，用於特定 UI 的傾斜特效
            const skewTarget = target.closest('[data-cursor-skew]') as HTMLElement
            if (skewTarget) {
                const skew = skewTarget.getAttribute('data-cursor-skew')
                setSkewValue(parseInt(skew || '0'))
            } else {
                setSkewValue(0)
            }

            // 檢查是否為滑條元件 (slider)
            const isSliderElement = target.closest('[role="slider"], .radix-slider-thumb')

            if (isSliderElement) {
                // 滑條互動：完全隱藏自定義鼠標
                setIsSlider(true)
                setIsHovering(false)
                setIsText(false)
                setMagnetPos(null)
                lastClickableRef.current = null
                return
            }

            // 非滑條元素時，重置 isSlider 狀態
            setIsSlider(false)

            if (isTextInput) {
                // 文字區域：游標轉為細長垂直線
                setIsText(true)
                setIsHovering(false)
                setMagnetPos(null)
                lastClickableRef.current = null
            } else if (isClickable) {
                // 防抖：如果懸停的是同一個元素，不更新狀態
                if (lastClickableRef.current === isClickable) {
                    return
                }
                lastClickableRef.current = isClickable

                // 可點擊區：外圈放大
                setIsHovering(true)
                setIsText(false)

                /**
                 * 磁性吸附計算
                 * 計算目標元素的幾何中心，讓外圈圓環在視覺上「框住」該元素。
                 * 增加寬高限制檢查，但對明確標記 data-magnet 的元素放寬限制。
                 */
                const rect = isClickable.getBoundingClientRect()
                const forceMagnet = isClickable.hasAttribute('data-magnet')

                // 針對滑條元件 (slider thumb)，不啟用磁性吸附，以免拖曳時鼠標卡在原地
                const isSlider = isClickable.matches('[role="slider"], .radix-slider-thumb')

                // 放寬尺寸限制：寬度 < 1000 (原 600)，高度 < 600 (原 200)
                // 旨在支援大型上傳區域等 UI 元件
                // 且如果是 Slider，則強制不啟用磁性吸附 (magnetPos = null)
                if (!isSlider && (forceMagnet || (rect.width < 1000 && rect.height < 600))) {
                    // 檢查是否有自定義圓角設定
                    const radiusAttr = isClickable.getAttribute('data-cursor-radius')
                    const customRadius = radiusAttr ? parseInt(radiusAttr) : null

                    // 更新磁吸位置與狀態 (包含可能的自定義圓角)
                    setMagnetPos({
                        x: rect.left + rect.width / 2,
                        y: rect.top + rect.height / 2,
                        width: rect.width,
                        height: rect.height,
                        radius: customRadius // 將圓角資訊傳遞給 state
                    } as any) // 使用 as any 暫時繞過類型定義差異，稍後可擴充類型
                } else {
                    setMagnetPos(null)
                }
            } else {
                // 恢復預設狀態
                lastClickableRef.current = null
                setIsHovering(false)
                setIsText(false)
                setIsSlider(false)
                setMagnetPos(null)
            }
        }

        window.addEventListener('mousemove', handleMouseMove, { capture: true })
        // 增加 pointermove 以支援某些劫持了 mousemove 的元件 (如 Radix Slider)
        window.addEventListener('pointermove', handleMouseMove, { capture: true })
        window.addEventListener('mousedown', handleMouseDown)
        window.addEventListener('mouseup', handleMouseUp)
        document.addEventListener('mouseover', handleMouseOver)
        document.addEventListener('mouseleave', handleMouseLeave)

        return () => {
            window.removeEventListener('mousemove', handleMouseMove, { capture: true })
            window.removeEventListener('pointermove', handleMouseMove, { capture: true })
            window.removeEventListener('mousedown', handleMouseDown)
            window.removeEventListener('mouseup', handleMouseUp)
            document.removeEventListener('mouseover', handleMouseOver)
        }
    }, [mouseX, mouseY])

    /**
     * 磁性追蹤邏輯：
     * 我們使用額外的 targetX/Y。通常它們會跟隨 mouseX/Y，
     * 但當進入磁性區域時，會瞬間捕捉到 magnetPos 的中心點。
     */
    const targetX = useMotionValue(0)
    const targetY = useMotionValue(0)

    // 設定外圈跟隨彈簧數值
    const smoothX = useSpring(targetX, springConfig)
    const smoothY = useSpring(targetY, springConfig)

    // Event-driven update to reduce CPU usage (No continuous RAF loop)
    useEffect(() => {
        if (magnetPos) {
            targetX.set(magnetPos.x)
            targetY.set(magnetPos.y)
        }
    }, [magnetPos, targetX, targetY])

    useEffect(() => {
        const updateFromMouse = (val: number, isX: boolean) => {
            if (!magnetPos) {
                if (isX) targetX.set(val)
                else targetY.set(val)
            }
        }

        const unsubX = mouseX.on("change", (latest) => updateFromMouse(latest, true))
        const unsubY = mouseY.on("change", (latest) => updateFromMouse(latest, false))

        return () => {
            unsubX()
            unsubY()
        }
    }, [magnetPos, mouseX, mouseY, targetX, targetY])


    return (
        <>
            {/* 引導點 (Leading Dot)：始終 1:1 跟隨滑鼠，保證點選精準度 */}
            <motion.div
                className="fixed top-0 left-0 pointer-events-none z-[9999]"
                style={{
                    x: mouseX,
                    y: mouseY,
                    translateX: '-50%',
                    translateY: '-50%',
                    willChange: 'transform'
                }}
            >
                <div className={cn(
                    "rounded-full bg-neon-blue transition-all duration-200",
                    isClicking ? "w-1 h-1" : "w-1.5 h-1.5",
                    // 滑條互動時完全隱藏，懸停時隱藏內點讓視覺專注於外圈
                    isSlider || isHovering || isText ? "opacity-0" : "opacity-100"
                )} />
            </motion.div>

            {/* 互動外圈游標：負責展現彈簧動能、磁性吸附與變形 */}
            <motion.div
                className={cn(
                    "fixed top-0 left-0 pointer-events-none z-[9998] border flex items-center justify-center transition-colors duration-200",
                    // 滑條互動時完全隱藏整個外圈
                    isSlider ? "opacity-0" : "",
                    isText ? "border-transparent bg-white/20" :
                        isHovering ? "border-neon-yellow bg-transparent" :
                            "border-white/40 rounded-full"
                )
                }
                style={{
                    x: smoothX,
                    y: smoothY,
                    translateX: '-50%',
                    translateY: '-50%',
                    willChange: 'transform, width, height, border-radius', // 效能優化：提示瀏覽器提前分配 GPU 資源
                }}
                animate={{
                    // 根據是否有磁性吸附或文字輸入模式，調整寬高與圓角
                    width: isText ? 2 : magnetPos ? magnetPos.width + 12 : isHovering ? 48 : 24,
                    height: isText ? 24 : magnetPos ? magnetPos.height + 12 : isHovering ? 48 : 24,
                    // 優先使用自定義圓角 -> 預設磁吸圓角 12 -> 懸停圓形 24 -> 預設圓形 999
                    borderRadius: isText ? 1 : magnetPos ? ((magnetPos as any).radius ?? 12) : isHovering ? 24 : 999, // 文字模式為細長條
                    scale: isClicking ? 0.9 : 1,
                    skewX: skewValue, // 應用特殊傾斜
                }}
                transition={{
                    default: {
                        type: "spring",
                        visualDuration: 0.3,
                        bounce: 0.2
                    },
                    borderRadius: {
                        type: "tween",
                        // 動態過渡時效：吸附時要快，恢復球體時稍慢以維持柔順
                        duration: magnetPos ? 0.2 : (isHovering ? 0.15 : 0.4),
                        ease: "easeOut"
                    },
                    width: { duration: isText ? 0.15 : magnetPos ? 0.2 : 0.3 },
                    height: { duration: isText ? 0.15 : magnetPos ? 0.2 : 0.3 }
                }}
            >
                {/* 此處預留裝飾層擴充空間 */}
            </motion.div>
        </>
    )
}
