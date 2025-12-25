/**
 * 語言文件索引
 * 匯出所有語言定義和類型
 */
import enTranslations from './en.json'
import zhTwTranslations from './zh-tw.json'

// 支援的語言代碼
export type LanguageCode = 'en' | 'zh-tw'

// 翻譯物件類型（使用英文作為基準）
export type Translations = typeof enTranslations

// 所有語言的翻譯資料
export const translations: Record<LanguageCode, Translations> = {
    'en': enTranslations,
    'zh-tw': zhTwTranslations as Translations
}

// 語言顯示名稱
export const languageNames: Record<LanguageCode, string> = {
    'en': 'English',
    'zh-tw': '繁體中文'
}

// 預設語言
export const defaultLanguage: LanguageCode = 'zh-tw'

// 取得所有可用語言
export const availableLanguages: LanguageCode[] = ['en', 'zh-tw']
