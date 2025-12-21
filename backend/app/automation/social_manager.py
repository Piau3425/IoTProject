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
from ..config import settings
from ..models import SocialPlatform, SystemState


class SocialManager:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.threads_context: Optional[BrowserContext] = None
        self.threads_state_file = Path("backend/browser_contexts/threads_state.json")

    async def shutdown(self):
        """清理所有資源"""
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
        """統一的平台憑證檢查方法"""
        if platform == SocialPlatform.DISCORD:
            return bool(settings.DISCORD_WEBHOOK_URL)
        elif platform == SocialPlatform.THREADS:
            has_api = bool(settings.THREADS_USER_ID and settings.THREADS_ACCESS_TOKEN)
            has_browser = self.threads_state_file.exists()
            return has_api or has_browser
        elif platform == SocialPlatform.GMAIL:
            return bool(settings.GMAIL_USER and settings.GMAIL_APP_PASSWORD)
        return False

    def get_login_status(self) -> dict[str, bool]:
        """檢查所有平台的登入狀態"""
        return {
            platform.value: self._check_platform_credentials(platform)
            for platform in SocialPlatform
        }

    def is_platform_logged_in(self, platform: SocialPlatform) -> bool:
        """檢查指定平台是否已登入/設定"""
        return self._check_platform_credentials(platform)

    async def send_shame_email(
        self, 
        message: str, 
        recipients: List[str],
        image_path: Optional[str] = None
    ) -> bool:
        """
        透過 Gmail SMTP 發送羞辱郵件（支援圖片附件）
        
        Args:
            message: 郵件內容
            recipients: 收件人郵箱列表
            image_path: 可選的圖片路徑
        """
        if not settings.GMAIL_USER or not settings.GMAIL_APP_PASSWORD:
            print("[SocialManager] Gmail 憑證未設定，跳過發送郵件")
            return False
            
        if not recipients:
            print("[SocialManager] 未指定收件人，跳過發送郵件")
            return False

        try:
            # 建立郵件
            msg = MIMEMultipart()
            msg['From'] = settings.GMAIL_USER
            msg['To'] = ', '.join(recipients)
            msg['Subject'] = "🚨 Focus Violation Alert 🚨"

            # 新增文字內容
            msg.attach(MIMEText(message, 'plain', 'utf-8'))

            # 附加圖片（如果提供）
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

            # 透過 Gmail SMTP 發送
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
        """初始化 Playwright 瀏覽器"""
        if not self.playwright:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(headless=True)
            print("[SocialManager] Playwright 瀏覽器已初始化")

    async def login_threads_browser(self, username: str, password: str) -> bool:
        """
        使用瀏覽器自動化登入 Threads（簡化版）
        
        ⚠️ 安全警告：
        此方法使用瀏覽器自動化，可能被 Instagram/Threads 偵測為機器人行為。
        建議僅用於測試環境或低頻使用。正式環境請使用官方 API (post_to_threads_api)。
        
        Args:
            username: Instagram/Threads 帳號（可以是用戶名或信箱）
            password: 密碼
        """
        print("\n" + "="*60)
        print("⚠️  安全警告：瀏覽器自動化登入")
        print("="*60)
        print("此方法可能被偵測為機器人，有帳號被限制的風險。")
        print("建議：僅用於測試，正式環境請使用官方 Threads API。")
        print("="*60 + "\n")
        
        try:
            await self._init_playwright()
            
            # 確保目錄存在
            self.threads_state_file.parent.mkdir(parents=True, exist_ok=True)
            
            print("[SocialManager] 正在登入 Threads...")
            
            # 建立新的瀏覽器環境
            context = await self.browser.new_context()
            page = await context.new_page()
            
            # 前往 Threads 登入頁面
            await page.goto("https://www.threads.net/login", wait_until="networkidle")
            await asyncio.sleep(2)
            
            # 填寫帳號密碼
            await page.fill('input[name="username"]', username)
            await page.fill('input[name="password"]', password)
            
            # 點擊登入按鈕
            await page.click('button[type="submit"]')
            await asyncio.sleep(5)
            
            # 檢查是否登入成功（檢查 URL 或特定元素）
            current_url = page.url
            if "login" not in current_url.lower():
                # 儲存登入狀態
                await context.storage_state(path=str(self.threads_state_file))
                await context.close()
                
                print("[SocialManager] ✅ Threads 登入成功！")
                print("[SocialManager] ⚠️  提醒：請盡快切換到官方 API 以降低風險")
                return True
            else:
                await context.close()
                print("[SocialManager] ❌ Threads 登入失敗，請檢查帳號密碼")
                return False
                
        except Exception as e:
            print(f"[SocialManager] ❌ Threads 登入錯誤: {e}")
            return False

    async def post_to_threads_browser(self, message: str, image_path: Optional[str] = None) -> bool:
        """
        使用瀏覽器自動化發文到 Threads（簡化版）
        
        ⚠️ 安全警告：
        此方法使用瀏覽器自動化，可能被偵測為機器人。
        建議使用官方 API (post_to_threads_api) 以確保帳號安全。
        
        Args:
            message: 貼文內容
            image_path: 可選的圖片路徑
        """
        print("[SocialManager] ⚠️  使用瀏覽器模式發文（有風險）")
        
        try:
            await self._init_playwright()
            
            if not self.threads_state_file.exists():
                print("[SocialManager] ❌ Threads 未登入，請先使用帳號密碼登入")
                return False
            
            print("[SocialManager] 正在使用瀏覽器發布 Threads 貼文...")
            
            # 使用已儲存的登入狀態
            context = await self.browser.new_context(
                storage_state=str(self.threads_state_file)
            )
            page = await context.new_page()
            
            # 前往 Threads 首頁
            await page.goto("https://www.threads.net/", wait_until="networkidle")
            await asyncio.sleep(2)
            
            # 點擊「新貼文」按鈕（可能需要根據實際 DOM 結構調整）
            try:
                # 嘗試多種可能的選擇器
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
                    # 如果沒有找到按鈕，嘗試直接訪問創建頁面
                    await page.goto("https://www.threads.net/new", wait_until="networkidle")
                
                await asyncio.sleep(2)
                
                # 填寫貼文內容
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
                
                # 如果有圖片，上傳圖片
                if image_path and Path(image_path).exists():
                    try:
                        file_input = await page.query_selector('input[type="file"]')
                        if file_input:
                            await file_input.set_input_files(str(image_path))
                            await asyncio.sleep(2)
                            print("[SocialManager] 已附加圖片")
                    except Exception as e:
                        print(f"[SocialManager] 圖片上傳失敗: {e}")
                
                # 點擊發布按鈕
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
                print("[SocialManager] ✅ Threads 貼文發布成功！")
                return True
                
            except Exception as e:
                await context.close()
                print(f"[SocialManager] ❌ 發布貼文時出錯: {e}")
                return False
                
        except Exception as e:
            print(f"[SocialManager] ❌ Threads 發文錯誤: {e}")
            return False

    async def post_to_threads_api(
        self, 
        message: str, 
        image_path: Optional[str] = None
    ) -> bool:
        """
        使用 Meta API 發文到 Threads（進階版，需要 API token）
        
        Args:
            message: 貼文內容
            image_path: 可選的圖片路徑（目前不支援）
        """
        if not settings.THREADS_USER_ID or not settings.THREADS_ACCESS_TOKEN:
            print("[SocialManager] Threads API 憑證未設定")
            return False

        try:
            base_url = "https://graph.threads.net/v1.0"
            
            # Step 1: Create container
            create_url = f"{base_url}/{settings.THREADS_USER_ID}/threads"
            create_params = {
                "media_type": "TEXT",
                "text": message,
                "access_token": settings.THREADS_ACCESS_TOKEN
            }
            
            print(f"[SocialManager] 正在建立 Threads 貼文容器...")
            create_response = await self.client.post(create_url, params=create_params)
            
            if create_response.status_code not in (200, 201):
                print(f"[SocialManager] ❌ 建立容器失敗: {create_response.status_code}")
                print(f"[SocialManager] Response: {create_response.text}")
                return False
            
            creation_data = create_response.json()
            creation_id = creation_data.get("id")
            
            if not creation_id:
                print(f"[SocialManager] ❌ 無法取得 creation_id: {creation_data}")
                return False
            
            # Step 2: Publish the container
            publish_url = f"{base_url}/{settings.THREADS_USER_ID}/threads_publish"
            publish_params = {
                "creation_id": creation_id,
                "access_token": settings.THREADS_ACCESS_TOKEN
            }
            
            print(f"[SocialManager] 正在發布 Threads 貼文...")
            publish_response = await self.client.post(publish_url, params=publish_params)
            
            if publish_response.status_code not in (200, 201):
                print(f"[SocialManager] ❌ 發布失敗: {publish_response.status_code}")
                print(f"[SocialManager] Response: {publish_response.text}")
                return False
            
            publish_data = publish_response.json()
            thread_id = publish_data.get("id")
            
            print(f"[SocialManager] ✅ Threads 貼文發布成功！Post ID: {thread_id}")
            return True
            
        except Exception as e:
            print(f"[SocialManager] ❌ Threads API 錯誤: {e}")
            return False

    async def post_to_threads(
        self, 
        message: str, 
        image_path: Optional[str] = None
    ) -> bool:
        """
        發布貼文到 Threads（自動選擇最佳方式）
        優先使用官方 API（安全、穩定），否則使用瀏覽器模式（有風險）
        """
        # 優先使用官方 API（推薦）
        if settings.THREADS_USER_ID and settings.THREADS_ACCESS_TOKEN:
            print("[SocialManager] 使用官方 API 發布 Threads 貼文（安全模式）")
            return await self.post_to_threads_api(message, image_path)
        
        # 備選：使用瀏覽器模式（有風險）
        elif self.threads_state_file.exists():
            print("[SocialManager] 使用瀏覽器模式發布（建議切換至 API）")
            return await self.post_to_threads_browser(message, image_path)
        
        else:
            print("[SocialManager] ❌ Threads 未設定，請先登入或設定 API token")
            return False

    async def post_to_discord(self, message: str) -> bool:
        """透過 Webhook 發布訊息到 Discord"""
        if not settings.DISCORD_WEBHOOK_URL:
            print("[SocialManager] Discord webhook URL 未設定，跳過發布")
            return False
        
        try:
            payload = {"content": message}
            response = await self.client.post(
                settings.DISCORD_WEBHOOK_URL,
                json=payload
            )
            
            if response.status_code in (200, 204):
                print(f"[SocialManager] ✅ 已成功發布到 Discord！")
                return True
            else:
                print(f"[SocialManager] ❌ Discord 發布失敗: {response.status_code}")
                print(f"[SocialManager] 回應: {response.text}")
                return False
                
        except Exception as e:
            print(f"[SocialManager] ❌ Discord 發布錯誤: {e}")
            return False

    async def execute_penalty(self, state: SystemState, hostage_path: Optional[str] = None):
        """
        在所有啟用的平台執行懲罰
        
        Args:
            state: 當前系統狀態（包含會話和懲罰設定）
            hostage_path: 可選的人質照片路徑（已棄用，改用多張照片系統）
        """
        if not state.penalty_settings:
            print("[SocialManager] 未設定懲罰配置")
            return
        
        enabled = state.penalty_settings.enabled_platforms
        if not enabled:
            print("[SocialManager] 未啟用任何懲罰平台")
            return
        
        print(f"\n[SocialManager] 🔥 正在 {len(enabled)} 個平台執行懲罰...")
        
        # 從已選取的照片中隨機選擇一張
        selected_image = await self._get_random_selected_image()
        if selected_image:
            print(f"[SocialManager] 📸 已選取隨機照片: {Path(selected_image).name}")
        else:
            print("[SocialManager] 📸 無選取的照片，將僅發送文字訊息")
        
        # 準備並行執行的任務
        tasks = []
        
        for platform in enabled:
            # 取得自訂訊息或使用預設訊息
            message = state.penalty_settings.custom_messages.get(
                platform.value,
                "🚨 專注違規偵測！ 🚨"
            )
            
            # 新增時間戳記（如果啟用）
            if state.penalty_settings.include_timestamp:
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                message = f"{message}\n\n⏰ 時間: {timestamp}"
            
            # 新增違規次數（如果啟用）
            if state.penalty_settings.include_violation_count and state.session:
                message = f"{message}\n\n🔢 違規 #{state.session.violations}"
            
            # 為每個平台建立對應的任務
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
                    self.post_to_discord(message)
                )
        
        # 並行執行所有懲罰任務
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            success_count = sum(1 for r in results if r is True)
            print(f"[SocialManager] 📊 懲罰執行完成: {success_count}/{len(tasks)} 成功")
        else:
            print("[SocialManager] 沒有有效的懲罰任務可執行")

    async def _get_random_selected_image(self) -> Optional[str]:
        """從已選取的照片中隨機選擇一張"""
        try:
            # 讀取 metadata 檔案
            metadata_file = Path("backend/hostage_evidence/metadata.json")
            if not metadata_file.exists():
                return None
            
            import json
            with open(metadata_file, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            # 篩選出已選取的照片
            selected_images = []
            for image_id, data in metadata.items():
                if data.get('selected', False):
                    image_path = Path("backend/hostage_evidence") / data['filename']
                    if image_path.exists():
                        selected_images.append(str(image_path))
            
            # 隨機選擇一張
            if selected_images:
                return random.choice(selected_images)
            
            return None
            
        except Exception as e:
            print(f"[SocialManager] 讀取照片選擇清單時發生錯誤: {e}")
            return None


    # 相容性方法（保留舊版介面）
    async def initialize(self):
        """初始化管理器（API 整合模式無需額外初始化）"""
        pass

    async def open_login_page(self, platform: SocialPlatform):
        """不需要開啟登入頁面（使用 API 驗證）"""
        print(f"[SocialManager] 直接 API 整合 - 請在 .env 檔案設定憑證")
        pass

    async def save_session(self, platform: SocialPlatform) -> bool:
        """檢查平台是否已設定"""
        return self.is_platform_logged_in(platform)

    async def logout_platform(self, platform: SocialPlatform) -> bool:
        """無法登出 API 憑證（需手動移除 .env 設定）"""
        return True


# 全域實例
social_manager = SocialManager()
