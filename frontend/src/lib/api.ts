/**
 * Focus Enforcer 的 API 客戶端封裝。
 * 提供了統一的錯誤處理機制、自動拆解後端回傳的 Response Wrapper，
 * 以及針對開發與生產環境的 Base URL 自動切換。
 */

/**
 * 標準 API 回傳結構介面。
 * 這裡定義了與後端 Fast API Schema 一致的封裝格式。
 */
export interface APIResponse<T = unknown> {
    success: boolean           // 操作是否成功
    data?: T                  // 實際業務資料
    message?: string          // 提示訊息或錯誤說明
    error?: boolean           // (相容性用) 是否出錯
    error_code?: string       // 機器可讀的錯誤代碼
    details?: Record<string, unknown> // 詳細的錯誤資訊
    // 分頁相關欄位
    total?: number
    page?: number
    has_more?: boolean
}

/**
 * 根據當前網址判斷 API 的基礎位址。
 * 若在 localhost 開發環境，則導向 8000 埠的後端伺服器。
 */
export const getApiBase = () => {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    return isDev ? 'http://localhost:8000' : ''
}

/**
 * 自定義 API 錯誤類別。
 * 封裝了後端傳回的具體錯誤代碼與細節，便於前端 UI 進行針對性提示。
 */
export class APIError extends Error {
    constructor(
        public message: string,
        public code?: string,
        public details?: Record<string, unknown>
    ) {
        super(message)
        this.name = 'APIError'
    }
}

/**
 * 統一處理 Fetch API 的回應流。
 * 負責檢查 HTTP 狀態碼、解析 JSON，以及根據業務邏輯判定是否拋出錯誤。
 */
async function handleResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type')
    const isJson = contentType && contentType.includes('application/json')

    // 處理非 2xx 的 HTTP 錯誤
    if (!response.ok) {
        if (isJson) {
            const errorData = await response.json()
            throw new APIError(
                errorData.message || response.statusText,
                errorData.error_code || errorData.detail, // FastAPI 預設將錯誤細節放在 detail 欄位
                errorData.details
            )
        }
        throw new APIError(response.statusText)
    }

    if (isJson) {
        const json = await response.json() as APIResponse<T>

        // 檢查業務邏輯層級的錯誤標記
        if (json.success === false || json.error === true) {
            throw new APIError(
                json.message || '發生未知的 API 錯誤',
                json.error_code,
                json.details
            )
        }

        // 自動解鎖並回傳 data 欄位 (新版 API 標準)
        if (json.data !== undefined) {
            return json.data
        }

        // 向下相容：若無 data 封裝，則根據結構決定是否回傳整個物件
        if (json.success === true && Object.keys(json).length <= 3) {
            // 處理僅含基礎成功狀態的回傳 (例如 {success: true, message: "ok"})
            return json as unknown as T
        }

        return json as unknown as T
    }

    // 非 JSON 回傳則直接取純文字
    return response.text() as unknown as T
}

/**
 * 匯出的 API 工具物件。
 */
export const api = {
    get: async <T>(endpoint: string): Promise<T> => {
        const res = await fetch(`${getApiBase()}${endpoint}`)
        return handleResponse<T>(res)
    },

    post: async <T>(endpoint: string, body?: unknown): Promise<T> => {
        const isFormData = body instanceof FormData
        const headers: Record<string, string> = {}

        // 若不是 FormData，預設採用 JSON 格式傳輸
        if (!isFormData) {
            headers['Content-Type'] = 'application/json'
        }

        const res = await fetch(`${getApiBase()}${endpoint}`, {
            method: 'POST',
            headers,
            body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
        })
        return handleResponse<T>(res)
    },

    delete: async <T>(endpoint: string): Promise<T> => {
        const res = await fetch(`${getApiBase()}${endpoint}`, {
            method: 'DELETE',
        })
        return handleResponse<T>(res)
    }
}
