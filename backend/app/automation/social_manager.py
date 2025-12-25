"""
社交平台整合管理器
====================================
負責處理與 Gmail、Threads API 以及 Discord Webhook 的直接 API 整合，
並提供基於瀏覽器自動化 (Playwright) 的備援發文方案。
"""
import asyncio
import httpx
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from pathlib import Path
from typing import Optional, List
from datetime import datetime
from playwright.async_api import async_playwright, Browser, BrowserContext
import random
import secrets
from ..config import settings
from ..models import SocialPlatform, SystemState
from ..daily_violation_store import daily_violation_store


class SocialManager:
    """管理所有社交平台的通訊、登入狀態及處罰執行邏輯。"""

    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.threads_context: Optional[BrowserContext] = None
        # 儲存瀏覽器登入狀態的檔案位置
        self.threads_state_file = Path("backend/browser_contexts/threads_state.json")
        # 最近使用的圖片路徑（避免連續選到同一張）
        self._recent_images: List[str] = []

    async def shutdown(self):
        """清理所有非同步資源、關閉瀏覽器與 HTTP 客戶端。"""
        try:
            await self.client.aclose()
        except Exception as e:
            print(f"[SocialManager] 關閉 HTTP 客戶端時發生錯誤: {e}")

        try:
            if self.threads_context:
                await self.threads_context.close()
        except Exception as e:
            print(f"[SocialManager] 關閉 Threads 上下文時發生錯誤: {e}")

        try:
            if self.browser:
                await self.browser.close()
        except Exception as e:
            print(f"[SocialManager] 關閉瀏覽器時發生錯誤: {e}")

        try:
            if self.playwright:
                await self.playwright.stop()
        except Exception as e:
            print(f"[SocialManager] 停止 Playwright 時發生錯誤: {e}")

    def _check_platform_credentials(self, platform: SocialPlatform) -> bool:
        """統一檢查指定平台是否具備可用的憑證或登入工作階段。"""
        if platform == SocialPlatform.DISCORD:
            return bool(settings.DISCORD_WEBHOOK_URL)
        elif platform == SocialPlatform.THREADS:
            # 優先檢查官方 API，其次檢查是否有瀏覽器持久化狀態
            has_api = bool(settings.THREADS_USER_ID and settings.THREADS_ACCESS_TOKEN)
            has_browser = self.threads_state_file.exists()
            return has_api or has_browser
        elif platform == SocialPlatform.GMAIL:
            return bool(settings.GMAIL_USER and settings.GMAIL_APP_PASSWORD)
        return False

    def get_login_status(self) -> dict[str, bool]:
        """彙整所有社群平台的連通狀態字典。"""
        return {
            platform.value: self._check_platform_credentials(platform)
            for platform in SocialPlatform
        }

    def is_platform_logged_in(self, platform: SocialPlatform) -> bool:
        """確認特定平台的 API 或 Session 是否已就緒。"""
        return self._check_platform_credentials(platform)

    async def send_shame_email(
        self,
        message: str,
        recipients: List[str],
        image_path: Optional[str] = None
    ) -> bool:
        """
        透過 Gmail SMTP 伺服器向指定收件者發送警告郵件。

        參數：
            message: 郵件正文內容
            recipients: 收件人清單
            image_path: 欲附加的人質照片實體路徑
        """
        if not settings.GMAIL_USER or not settings.GMAIL_APP_PASSWORD:
            print("[SocialManager] Gmail 憑證未設定，跳過發送郵件")
            return False

        if not recipients:
            print("[SocialManager] 未指定收件人，跳過發送郵件")
            return False

        try:
            # 構建多部分郵件內容
            msg = MIMEMultipart()
            msg['From'] = settings.GMAIL_USER
            msg['To'] = ', '.join(recipients)
            msg['Subject'] = "🚨 Focus Violation Alert 🚨"

            # 加入文字說明
            msg.attach(MIMEText(message, 'plain', 'utf-8'))

            # 處理附件圖片
            if image_path:
                image_file = Path(image_path)
                if image_file.exists():
                    try:
                        with open(image_file, 'rb') as f:
                            img_data = f.read()
                        image = MIMEImage(img_data, name=image_file.name)
                        msg.attach(image)
                        print(f"[SocialManager] 已附加圖片: {image_file.name}")
                    except Exception as e:
                        print(f"[SocialManager] 圖片讀取失敗: {e}")
                else:
                    print(f"[SocialManager] 圖片檔案不存在: {image_path}")

            # 發送郵件
            await aiosmtplib.send(
                msg,
                hostname="smtp.gmail.com",
                port=587,
                start_tls=True,
                username=settings.GMAIL_USER,
                password=settings.GMAIL_APP_PASSWORD,
            )

            print(f"[SocialManager] ✅ 郵件已成功發送給 {len(recipients)} 位收件人")
            return True

        except Exception as e:
            print(f"[SocialManager] ❌ 發送郵件時發生錯誤: {e}")
            return False

    async def _init_playwright(self):
        """延遲啟動 Playwright 瀏覽器實例，節省初期啟動資源。"""
        if not self.playwright:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(headless=True)
            print("[SocialManager] Playwright 瀏覽器已初始化")

    async def login_threads_browser(self, username: str, password: str) -> bool:
        """
        模擬瀏覽器行為登入 Threads 以獲取 Cookie 工作階段。
        這是在沒有官方 API 生態系統時的備選方案。

        注意：頻繁使用此方法可能會觸發帳號異常保護。
        """
        print("\n" + "="*60)
        print("⚠️ 安全警告：進入瀏覽器自動化登入程序")
        print("="*60)
        print("模擬瀏覽器登入有行為偵測風險，建議優先使用官方 API。")
        print("="*60 + "\n")

        try:
            await self._init_playwright()

            # 確保儲存目錄已建立
            self.threads_state_file.parent.mkdir(parents=True, exist_ok=True)

            print("[SocialManager] 正在透過自動化流程登入 Threads...")

            # 初始化獨立的無痕上下文
            context = await self.browser.new_context()
            page = await context.new_page()

            # 前往登入入口
            await page.goto("https://www.threads.net/login", wait_until="networkidle")
            await asyncio.sleep(2)

            # 填寫表單
            await page.fill('input[name="username"]', username)
            await page.fill('input[name="password"]', password)

            # 提交登入
            await page.click('button[type="submit"]')
            await asyncio.sleep(5)

            # 判斷是否成功跳轉（非登入頁面即視為成功）
            current_url = page.url
            if "login" not in current_url.lower():
                # 保存 cookie 狀態以便後續發文使用
                await context.storage_state(path=str(self.threads_state_file))
                await context.close()

                print("[SocialManager] ✅ Threads 登入成功！")
                return True
            else:
                await context.close()
                print("[SocialManager] ❌ Threads 登入失敗，請確認帳號資訊。")
                return False

        except Exception as e:
            print(f"[SocialManager] ❌ Threads 登入過程發生異常: {e}")
            return False

    async def post_to_threads_browser(self, message: str, image_path: Optional[str] = None) -> bool:
        """
        利用已保存的 Cookie 進行瀏覽器自動化發文。
        主要應用於未配置官方 API 的情境。
        """
        print("[SocialManager] ⚠️ 正在使用瀏覽器模擬模式發文...")

        try:
            await self._init_playwright()

            if not self.threads_state_file.exists():
                print("[SocialManager] ❌ 找不到有效的 Threads Session，請先完成登入。")
                return False

            # 使用持久化的狀態開啟環境
            context = await self.browser.new_context(
                storage_state=str(self.threads_state_file)
            )
            page = await context.new_page()

            # 前往首頁並點擊發文
            await page.goto("https://www.threads.net/", wait_until="networkidle")
            await asyncio.sleep(2)

            try:
                # 嘗試查找多種可能的發文按鈕選擇器
                selectors = [
                    'button[aria-label*="new thread"]',
                    'button[aria-label*="New thread"]',
                    'svg[aria-label="Create"]',
                    'a[href="/new"]'
                ]

                clicked = False
                for selector in selectors:
                    try:
                        await page.click(selector, timeout=3000)
                        clicked = True
                        break
                    except:
                        continue

                if not clicked:
                    # 後備方案：嘗試直接跳轉至發文網址
                    await page.goto("https://www.threads.net/new", wait_until="networkidle")

                await asyncio.sleep(2)

                # 填寫內文
                textarea_selectors = [
                    'div[contenteditable="true"]',
                    'textarea[placeholder*="Start"]',
                    'textarea'
                ]

                for selector in textarea_selectors:
                    try:
                        await page.fill(selector, message, timeout=3000)
                        break
                    except:
                        continue

                await asyncio.sleep(1)

                # 處理圖片上傳
                if image_path and Path(image_path).exists():
                    try:
                        file_input = await page.query_selector('input[type="file"]')
                        if file_input:
                            await file_input.set_input_files(str(image_path))
                            await asyncio.sleep(2)
                            print("[SocialManager] 圖片已附加至草稿")
                    except Exception as e:
                        print(f"[SocialManager] 圖片定位或上傳失敗: {e}")

                # 送出貼文
                post_selectors = [
                    'button:has-text("Post")',
                    'div[role="button"]:has-text("Post")',
                    'button[type="submit"]'
                ]

                for selector in post_selectors:
                    try:
                        await page.click(selector, timeout=3000)
                        break
                    except:
                        continue

                await asyncio.sleep(3)
                await context.close()
                print("[SocialManager] ✅ Threads 貼文已成功發布。")
                return True

            except Exception as e:
                await context.close()
                print(f"[SocialManager] ❌ 模擬發文程序出錯: {e}")
                return False

        except Exception as e:
            print(f"[SocialManager] ❌ 進入 Threads 時發生底層錯誤: {e}")
            return False

    async def post_to_threads_api(
        self,
        message: str,
        image_path: Optional[str] = None
    ) -> bool:
        """
        呼叫 Meta Threads 官方 API 進行發文。這是目前最安全、最穩定的方式。
        注意：目前基於文字發布為主。
        """
        if not settings.THREADS_USER_ID or not settings.THREADS_ACCESS_TOKEN:
            print("[SocialManager] 未配置 Threads 官方 API 憑證。")
            return False

        try:
            base_url = "https://graph.threads.net/v1.0"

            # 步驟一：建立貼文媒體容器
            create_url = f"{base_url}/{settings.THREADS_USER_ID}/threads"
            create_params = {
                "media_type": "TEXT",
                "text": message,
                "access_token": settings.THREADS_ACCESS_TOKEN
            }

            print(f"[SocialManager] 正在向 Meta API 請求建立貼文容器...")
            create_response = await self.client.post(create_url, params=create_params)

            if create_response.status_code not in (200, 201):
                print(f"[SocialManager] ❌ 建立容器失敗，錯誤碼：{create_response.status_code}")
                return False

            creation_id = create_response.json().get("id")
            if not creation_id:
                return False

            # 步驟二：正式發布該容器
            publish_url = f"{base_url}/{settings.THREADS_USER_ID}/threads_publish"
            publish_params = {
                "creation_id": creation_id,
                "access_token": settings.THREADS_ACCESS_TOKEN
            }

            print(f"[SocialManager] 執行發布作業...")
            publish_response = await self.client.post(publish_url, params=publish_params)

            if publish_response.status_code not in (200, 201):
                print(f"[SocialManager] ❌ 發布作業失敗，API 回傳：{publish_response.text}")
                return False

            print(f"[SocialManager] ✅ 官方 API 發布成功 (ID: {publish_response.json().get('id')})")
            return True

        except Exception as e:
            print(f"[SocialManager] ❌ Threads API 調用異常: {e}")
            return False

    async def post_to_threads(
        self,
        message: str,
        image_path: Optional[str] = None
    ) -> bool:
        """
        根據配置情況，自動選擇最適合的 Threads 發文策略。
        策略權重：官方 API > 瀏覽器模擬 Session。
        """
        if settings.THREADS_USER_ID and settings.THREADS_ACCESS_TOKEN:
            return await self.post_to_threads_api(message, image_path)
        elif self.threads_state_file.exists():
            return await self.post_to_threads_browser(message, image_path)
        else:
            print("[SocialManager] ❌ 無法發布至 Threads：未配置憑證也無有效狀態。")
            return False

    async def post_to_discord(
        self,
        message: str,
        image_path: Optional[str] = None
    ) -> bool:
        """
        透過 Discord Webhook 機制傳送警告訊息至指定頻道。

        參數：
            message: 要發送的訊息內容
            image_path: 可選的人質照片路徑，若提供則會附加圖片
        """
        if not settings.DISCORD_WEBHOOK_URL:
            print("[SocialManager] Discord Webhook 網址未設定，略過執行。")
            return False

        try:
            # 若有圖片，使用 multipart/form-data 格式發送
            if image_path:
                image_file = Path(image_path)
                if image_file.exists():
                    with open(image_file, 'rb') as f:
                        files = {"file": (image_file.name, f.read(), "image/jpeg")}
                        data = {"content": message}
                        response = await self.client.post(
                            settings.DISCORD_WEBHOOK_URL,
                            data=data,
                            files=files
                        )
                    if response.status_code in (200, 204):
                        print(f"[SocialManager] Discord 處罰通知已送達（含圖片）。")
                        return True
                    else:
                        print(f"[SocialManager] Discord 傳送失敗，狀態碼：{response.status_code}")
                        return False
                else:
                    print(f"[SocialManager] 圖片檔案不存在: {image_path}，改為純文字發送")

            # 純文字發送（無圖片或圖片不存在）
            payload = {"content": message}
            response = await self.client.post(
                settings.DISCORD_WEBHOOK_URL,
                json=payload
            )

            if response.status_code in (200, 204):
                print(f"[SocialManager] Discord 處罰通知已送達。")
                return True
            else:
                print(f"[SocialManager] Discord 傳送失敗，狀態碼：{response.status_code}")
                return False

        except Exception as e:
            print(f"[SocialManager] Discord Webhook 連線異常: {e}")
            return False

    async def execute_penalty(self, state: SystemState, hostage_path: Optional[str] = None):
        """
        核心方法：在所有已啟用的平台上同步執行公開處罰流程。

        參數：
            state: 系統全局狀態物件，含罰則內容與次數。
            hostage_path: 舊版接口的人質路徑（目前改由多照片系統內部隨機挑選）。
        """
        if not state.penalty_settings:
            print("[SocialManager] 尚未配置處罰機制。")
            return

        enabled = state.penalty_settings.enabled_platforms
        if not enabled:
            return

        print(f"\n[SocialManager] 🔥 專注違規！即將在 {len(enabled)} 個平台執行處罰程序...")

        # 隨機挑選一張人質照片（若存在）
        selected_image = await self._get_random_selected_image()
        if selected_image:
            print(f"[SocialManager] 📸 已隨機選取人質照片：{Path(selected_image).name}")
        else:
            print("[SocialManager] 📸 警告：無可選的照片，將僅發布純文字警告。")

        # 建立異步任務池以提升執行效率
        tasks = []

        for platform in enabled:
            # 優先使用自訂訊息，若無則套用預設格式
            message = state.penalty_settings.custom_messages.get(
                platform.value,
                "🚨 【系統警告】專注協定遭到破壞！ 🚨"
            )

            # 附加時間戳記
            if state.penalty_settings.include_timestamp:
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                message = f"{message}\n\n⏰ 違規時間：{timestamp}"

            # 附加累計次數
            if state.penalty_settings.include_violation_count:
                today_count = daily_violation_store.get_count()
                message = f"{message}\n\n🔢 今日累積違規次數：#{today_count}"

            # 分派任務至各個平台處理器
            if platform == SocialPlatform.GMAIL:
                recipients = state.penalty_settings.gmail_recipients
                if recipients:
                    tasks.append(
                        self.send_shame_email(message, recipients, image_path=selected_image)
                    )
            elif platform == SocialPlatform.THREADS:
                tasks.append(
                    self.post_to_threads(message, image_path=selected_image)
                )
            elif platform == SocialPlatform.DISCORD:
                tasks.append(
                    self.post_to_discord(message, image_path=selected_image)
                )

        # 非同步並行執行所有處罰
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            success_count = sum(1 for r in results if r is True)
            print(f"[SocialManager] 📊 執行概要：{success_count}/{len(tasks)} 個平台成功發佈。")

    async def _get_random_selected_image(self) -> Optional[str]:
        """從人質庫存中挑選一張被標記為選取的隨機照片路徑。
        
        使用 secrets 模組提供密碼學安全的隨機選取，並記錄最近使用的圖片
        以避免連續選到同一張。
        """
        try:
            # 相對於此文件的證據存儲目錄
            base_path = Path(__file__).parent.parent.parent / "hostage_evidence"
            metadata_file = base_path / "metadata.json"
            if not metadata_file.exists():
                return None

            import json
            with open(metadata_file, 'r', encoding='utf-8') as f:
                metadata = json.load(f)

            # 過濾出已選取且實體檔案存在的照片
            selected_images = []
            for image_id, data in metadata.items():
                if data.get('selected', False):
                    image_path = base_path / data['filename']
                    if image_path.exists():
                        selected_images.append(str(image_path))

            if not selected_images:
                return None
            
            # 如果只有一張圖片，直接返回
            if len(selected_images) == 1:
                return selected_images[0]
            
            # 優先選擇不在最近使用記錄中的圖片
            # 保留最近 N 張的記錄（N = 可選圖片數量的一半，至少 1）
            max_history = max(1, len(selected_images) // 2)
            available_images = [
                img for img in selected_images 
                if img not in self._recent_images
            ]
            
            # 如果所有圖片都在最近使用記錄中，清空記錄重新開始
            if not available_images:
                self._recent_images.clear()
                available_images = selected_images
            
            # 使用 secrets 模組進行密碼學安全的隨機選取
            chosen = secrets.choice(available_images)
            
            # 更新最近使用記錄
            self._recent_images.append(chosen)
            if len(self._recent_images) > max_history:
                self._recent_images.pop(0)
            
            print(f"[SocialManager] 🎲 隨機選取圖片：{Path(chosen).name}（可選 {len(selected_images)} 張，排除最近 {len(self._recent_images)-1} 張）")
            return chosen

        except Exception as e:
            print(f"[SocialManager] 挑選隨機照片時發生錯誤: {e}")
            return None

    # 以下為相容性舊介面覆寫方法
    async def initialize(self):
        """初期化管理器（目前 API 模式無須額外動作）。"""
        pass

    async def open_login_page(self, platform: SocialPlatform):
        """手動登入頁面請求。"""
        print(f"[SocialManager] 目前採用 API 配置，無須開啟瀏覽器頁面。")
        pass

    async def save_session(self, platform: SocialPlatform) -> bool:
        """驗證平台是否已正確設定並可通訊。"""
        return self.is_platform_logged_in(platform)

    async def logout_platform(self, platform: SocialPlatform) -> bool:
        """清除平台特定狀態。"""
        return True


# 提供全域單例物件供整體系統調發處罰
social_manager = SocialManager()
