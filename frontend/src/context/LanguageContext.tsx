/**
 * 語言 Context (LanguageContext)
 * 提供多語言支援的 React Context，管理當前語言狀態和翻譯函數。
 * 語言偏好會儲存在 localStorage 中，重新整理後仍會保留。
 */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import {
    translations,
    defaultLanguage,
    type LanguageCode,
    type Translations,
    languageNames,
    availableLanguages
} from '@/language'

// localStorage 儲存鍵
const LANGUAGE_STORAGE_KEY = 'focus-enforcer-language'

// Context 值的類型定義
interface LanguageContextValue {
    /** 當前語言代碼 */
    currentLanguage: LanguageCode
    /** 切換語言 */
    setLanguage: (lang: LanguageCode) => void
    /** 翻譯函數，支援點號路徑 (e.g., 'header.title') */
    t: (key: string, replacements?: Record<string, string | number>) => string
    /** 當前語言的所有翻譯 */
    translations: Translations
    /** 所有可用語言 */
    availableLanguages: LanguageCode[]
    /** 語言顯示名稱對照 */
    languageNames: Record<LanguageCode, string>
}

// 建立 Context
const LanguageContext = createContext<LanguageContextValue | null>(null)

// Provider Props
interface LanguageProviderProps {
    children: ReactNode
    /** 可選的初始語言，若不提供則從 localStorage 或預設值取得 */
    initialLanguage?: LanguageCode
}

/**
 * 從巢狀物件中根據點號路徑取值
 * @param obj - 目標物件
 * @param path - 點號分隔的路徑 (e.g., 'header.title')
 * @returns 對應的值或 undefined
 */
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
    const keys = path.split('.')
    let current: unknown = obj

    for (const key of keys) {
        if (current === null || current === undefined || typeof current !== 'object') {
            return undefined
        }
        current = (current as Record<string, unknown>)[key]
    }

    return typeof current === 'string' ? current : undefined
}

/**
 * 語言 Provider 組件
 * 包裹應用程式根組件以提供多語言支援
 */
export function LanguageProvider({ children, initialLanguage }: LanguageProviderProps) {
    // 初始化語言：優先使用 prop → localStorage → 預設值
    const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(() => {
        if (initialLanguage) return initialLanguage

        try {
            const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
            if (stored && (stored === 'en' || stored === 'zh-tw')) {
                return stored as LanguageCode
            }
        } catch {
            // localStorage 不可用時忽略錯誤
        }

        return defaultLanguage
    })

    // 當前語言的翻譯資料
    const currentTranslations = translations[currentLanguage]

    // 儲存語言偏好到 localStorage
    useEffect(() => {
        try {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage)
        } catch {
            // localStorage 不可用時忽略錯誤
        }
    }, [currentLanguage])

    // 切換語言
    const setLanguage = useCallback((lang: LanguageCode) => {
        setCurrentLanguage(lang)
    }, [])

    /**
     * 翻譯函數
     * @param key - 翻譯鍵，支援點號路徑 (e.g., 'header.title')
     * @param replacements - 可選的替換參數，用於動態內容 (e.g., { max: 10 })
     * @returns 翻譯後的文字，若找不到則返回原始 key
     */
    const t = useCallback((key: string, replacements?: Record<string, string | number>): string => {
        const value = getNestedValue(currentTranslations as Record<string, unknown>, key)

        if (value === undefined) {
            console.warn(`[i18n] Missing translation for key: "${key}" in language: "${currentLanguage}"`)
            return key
        }

        // 若有替換參數，進行替換 (e.g., {max} → 10)
        if (replacements) {
            return Object.entries(replacements).reduce(
                (text, [placeholder, replacement]) =>
                    text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), String(replacement)),
                value
            )
        }

        return value
    }, [currentTranslations, currentLanguage])

    const contextValue: LanguageContextValue = {
        currentLanguage,
        setLanguage,
        t,
        translations: currentTranslations,
        availableLanguages,
        languageNames
    }

    return (
        <LanguageContext.Provider value={contextValue}>
            {children}
        </LanguageContext.Provider>
    )
}

/**
 * 使用語言 Context 的 Hook
 * @returns LanguageContextValue
 * @throws 若在 LanguageProvider 外使用會拋出錯誤
 */
export function useLanguage(): LanguageContextValue {
    const context = useContext(LanguageContext)

    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider')
    }

    return context
}

// 方便的單獨匯出
export { type LanguageCode, type Translations }
