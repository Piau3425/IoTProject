/*
 * ============================================================================
 * THE FOCUS ENFORCER v1.0 - 專注執法者硬體控制器 (D1-mini 重構版)
 * ============================================================================
 * 
 * 【系統說明】
 * 此為 Wemos D1-mini (ESP8266) 硬體控制程式。
 * 實作完整狀態機架構、10 秒準備寬限期及 1602 LCD 顯示。
 * 透過 WebSocket 與後端伺服器進行即時通訊。
 * 
 * v1.0 核心功能：
 * - 狀態機架構: IDLE → PREPARING (10s) → FOCUSING → PAUSED/VIOLATION
 * - KY-033 紅外線反射式感測器中斷偵測 (盒蓋開關偵測)
 * - 1602 I2C LCD 即時狀態顯示
 * - LD2410 mmWave 雷達人體偵測
 * 
 * 【硬體接線指南 - D1-mini GPIO 分配表】
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ 模組              │ 功能       │ D1-mini │ GPIO  │ 備註                  │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │ 1602 LCD (I2C)    │ SDA        │ D2      │ GPIO4 │ I2C 資料線 (共用)     │
 * │                   │ SCL        │ D1      │ GPIO5 │ I2C 時脈線 (共用)     │
 * │                   │ VCC        │ 5V      │ -     │ 需 5V 供電            │
 * │                   │ GND        │ GND     │ -     │                       │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │ 紅外線感測器      │ DO         │ D3      │ GPIO0 │ 中斷腳位 (CHANGE)     │
 * │ (KY-033)          │ VCC        │ 3V3     │ -     │ 3.3V 供電             │
 * │                   │ GND        │ GND     │ -     │ 反射面=LOW            │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │ LD2410 mmWave     │ TX         │ D5      │ GPIO14│ SoftwareSerial RX     │
 * │                   │ RX         │ D6      │ GPIO12│ SoftwareSerial TX     │
 * │                   │ VCC        │ 5V      │ -     │ 需 5V 供電            │
 * │                   │ GND        │ GND     │ -     │                       │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │ 聲音感測器        │ AO         │ A0      │ ADC0  │ 類比輸入              │
 * │ (MAX9418)         │ VCC        │ 3V3/5V  │ -     │                       │
 * │                   │ GND        │ GND     │ -     │                       │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │ PN532 NFC 模組    │ SDA        │ D2      │ GPIO4 │ I2C 資料線 (共用)     │
 * │ (I2C 模式)        │ SCL        │ D1      │ GPIO5 │ I2C 時脈線 (共用)     │
 * │                   │ VCC        │ 3V3/5V  │ -     │                       │
 * │                   │ GND        │ GND     │ -     │                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 * 
 * 【KY-033 紅外線感測器邏輯】
 * - 偵測到反射面 (盒蓋關閉): DO = LOW  → 正常狀態
 * - 無反射/距離過遠 (盒蓋開啟): DO = HIGH → 觸發違規
 * - 有效偵測距離: 2~30mm (可透過電位器調整)
 * - 使用中斷偵測，確保即時響應
 * 
 * 【狀態機說明】
 *   ┌─────────┐   START_CMD    ┌───────────┐   10秒後   ┌──────────┐
 *   │  IDLE   │ ─────────────► │ PREPARING │ ─────────► │ FOCUSING │
 *   └─────────┘                └───────────┘            └──────────┘
 *        ▲                          │                        │
 *        │         CANCEL_CMD       │                        │ 違規
 *        │◄─────────────────────────┘                        ▼
 *        │                                             ┌───────────┐
 *        │◄────────── STOP_CMD ───────────────────────│ VIOLATION │
 *        │                                             └───────────┘
 *        │         PAUSE_CMD        ┌────────┐
 *        │◄─────────────────────────│ PAUSED │◄──── FOCUSING + PAUSE_CMD
 *                                   └────────┘
 */

#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SoftwareSerial.h>
#include <Adafruit_PN532.h>

// ============================================================================
// 版本資訊
// ============================================================================
#define FIRMWARE_VERSION "1.0.0"
#define HARDWARE_ID "D1MINI_FOCUS_001"

// ============================================================================
// WiFi 設定
// ============================================================================
const char* WIFI_SSID = "Andy";
const char* WIFI_PASS = "1QazxsW2";

// ============================================================================
// WebSocket 伺服器設定
// ============================================================================
const char* WS_HOST = "192.168.0.55";
const uint16_t WS_PORT = 8000;
const char* WS_PATH = "/ws/hardware";

// ============================================================================
// GPIO 腳位定義 - D1-mini (ESP8266)
// ============================================================================
// I2C 匯流排 (LCD 共用)
#define PIN_I2C_SDA     D2      // GPIO4  - I2C 資料線
#define PIN_I2C_SCL     D1      // GPIO5  - I2C 時脈線

// KY-033 紅外線感測器 (反射式, 中斷)
#define PIN_HALL        D3      // GPIO0  - KY-033 數位輸出 (DO) - 中斷腳位

// LD2410 mmWave 雷達 (SoftwareSerial)
#define PIN_RADAR_RX    D5      // GPIO14 - 雷達 TX → D1 RX
#define PIN_RADAR_TX    D6      // GPIO12 - 雷達 RX ← D1 TX

// MAX9418 聲音感測器
#define PIN_MIC         A0      // ADC0 - 類比輸入

// PN532 NFC 設定 (I2C)
#define PN532_IRQ       (2)     // 這裡暫不使用 IRQ，採輪詢模式
#define PN532_RESET     (3)     // 這裡暫不使用 RESET

// ============================================================================
// LCD 設定
// ============================================================================
#define LCD_ADDR        0x27    // PCF8574 I2C 地址 (常見: 0x27 或 0x3F)
#define LCD_COLS        16
#define LCD_ROWS        2

// ============================================================================
// 狀態機定義
// ============================================================================
enum SystemState {
    STATE_IDLE,         // 待機狀態 - 等待開始指令
    STATE_PREPARING,    // 準備中 - 10 秒寬限期
    STATE_FOCUSING,     // 專注中 - 監測違規行為
    STATE_PAUSED,       // 暫停中 - 暫時停止監測
    STATE_VIOLATION,    // 違規狀態 - 偵測到違規行為
    STATE_ERROR         // 錯誤狀態 - 系統異常
};

// 狀態名稱 (用於除錯輸出)
const char* STATE_NAMES[] = {
    "IDLE", "PREPARING", "FOCUSING", "PAUSED", "VIOLATION", "ERROR"
};

// ============================================================================
// 時間常數 (毫秒)
// ============================================================================
#define PREPARE_DURATION_MS     10000   // 準備寬限期: 10 秒
#define SENSOR_INTERVAL_MS      100     // 感測器讀取間隔: 100ms (10Hz)
#define LCD_UPDATE_INTERVAL_MS  250     // LCD 更新間隔: 250ms (4Hz)
#define HEARTBEAT_INTERVAL_MS   5000    // 心跳間隔: 5 秒
#define WIFI_RECONNECT_TIMEOUT  30000   // WiFi 重連超時: 30 秒
#define IR_DEBOUNCE_MS          50      // 紅外線感測器防抖動: 50ms

// ============================================================================
// 雷達防抖動設定
// ============================================================================
#define RADAR_DEBOUNCE_MS   3000    // 人體離開防抖動: 3 秒

// ============================================================================
// 全域變數 - 系統狀態
// ============================================================================
volatile SystemState currentState = STATE_IDLE;
SystemState previousState = STATE_IDLE;
unsigned long stateEnterTime = 0;           // 進入當前狀態的時間
unsigned long focusStartTime = 0;           // 專注開始時間
unsigned long totalFocusTime = 0;           // 累計專注時間

// ============================================================================
// 全域變數 - KY-033 紅外線感測器 (中斷相關)
// ============================================================================
volatile bool irTriggered = false;          // 中斷觸發旗標
volatile unsigned long irTriggerTime = 0;   // 觸發時間
bool boxOpen = false;                       // 盒蓋狀態 (true = 開啟)

// ============================================================================
// 全域變數 - 雷達偵測
// ============================================================================
bool radarPresence = false;                 // 雷達偵測到人體
bool radarRawReading = false;               // 原始雷達讀數
unsigned long radarLowStartTime = 0;        // 開始偵測到無人的時間

// ============================================================================
// 全域變數 - 聲音偵測
// ============================================================================
int micDb = 40;                             // 當前分貝值 (預設 40dB)

// ============================================================================
// 全域變數 - NFC 偵測
// ============================================================================
bool nfcDetected = false;                   // 是否偵測到 NFC 標籤
String nfcId = "";                          // 偵測到的 NFC ID

// ============================================================================
// 全域變數 - 網路與連線
// ============================================================================
bool isConnectedToBackend = false;
unsigned long lastSensorRead = 0;
unsigned long lastLcdUpdate = 0;
unsigned long lastHeartbeat = 0;
bool wifiReconnecting = false;
unsigned long wifiReconnectStart = 0;

// ============================================================================
// 全域物件
// ============================================================================
WebSocketsClient webSocket;
LiquidCrystal_I2C lcd(LCD_ADDR, LCD_COLS, LCD_ROWS);
SoftwareSerial radarSerial(PIN_RADAR_RX, PIN_RADAR_TX);
Adafruit_PN532 nfc(PIN_I2C_SDA, PIN_I2C_SCL);

// ============================================================================
// 函式前向宣告
// ============================================================================
// 初始化函式
void initHardware();
void initLCD();
void initIRSensor();     // KY-033 紅外線感測器初始化
void initRadar();
void initMic();          // MAX9418 聲音感測器初始化
void initNFC();          // PN532 NFC 初始化
void initWiFi();
void initWebSocket();

// 狀態機函式
void updateStateMachine();
void enterState(SystemState newState);
void handleIdleState();
void handlePreparingState();
void handleFocusingState();
void handlePausedState();
void handleViolationState();

// 感測器讀取函式
void readSensors();
void readRadar();
void readMic();          // 讀取聲音感測器
void readNFC();          // 讀取 NFC
void processIRInterrupt();

// 顯示函式
void updateLCD();
void lcdShowIdle();
void lcdShowPreparing();
void lcdShowFocusing();
void lcdShowPaused();
void lcdShowViolation();

// 網路函式
void handleWiFiReconnect();
void sendSensorData();
void sendStateChange();
void sendHeartbeat();
void webSocketEvent(WStype_t type, uint8_t* payload, size_t length);
void handleCommand(const char* payload);

// 工具函式
String formatTime(unsigned long ms);
void IRAM_ATTR irISR();

// ============================================================================
// setup() - 系統初始化
// ============================================================================
void setup() {
    Serial.begin(115200);
    delay(500);
    
    Serial.println("\n");
    Serial.println(F("╔══════════════════════════════════════════════════════════╗"));
    Serial.println(F("║     THE FOCUS ENFORCER v1.0 - 專注執法者                 ║"));
    Serial.println(F("║     Wemos D1-mini (ESP8266) Firmware                     ║"));
    Serial.println(F("╚══════════════════════════════════════════════════════════╝"));
    Serial.print(F("[SYS] Hardware ID: "));
    Serial.println(HARDWARE_ID);
    Serial.print(F("[SYS] Firmware Version: "));
    Serial.println(FIRMWARE_VERSION);
    
    // 初始化所有硬體
    initHardware();
    
    // 初始化 WiFi
    initWiFi();
    
    // 初始化 WebSocket
    initWebSocket();
    
    // 進入待機狀態
    enterState(STATE_IDLE);
    
    Serial.println(F("[SYS] ✓ System ready - Waiting for focus session..."));
    Serial.println(F("══════════════════════════════════════════════════════════"));
}

// ============================================================================
// loop() - 主迴圈 (非阻塞設計)
// ============================================================================
void loop() {
    unsigned long currentMillis = millis();
    
    // WebSocket 維護
    webSocket.loop();
    
    // WiFi 連線檢查與重連
    if (WiFi.status() != WL_CONNECTED) {
        handleWiFiReconnect();
        return;
    } else if (wifiReconnecting) {
        // WiFi 重連成功
        Serial.println(F("\n[WiFi] ✓ Reconnected!"));
        Serial.print(F("[WiFi] IP: "));
        Serial.println(WiFi.localIP());
        wifiReconnecting = false;
        webSocket.disconnect();
        delay(100);
        webSocket.begin(WS_HOST, WS_PORT, WS_PATH);
    }
    
    // 處理紅外線感測器中斷
    processIRInterrupt();
    
    // 感測器讀取 (10Hz)
    if (currentMillis - lastSensorRead >= SENSOR_INTERVAL_MS) {
        readSensors();
        sendSensorData();
        lastSensorRead = currentMillis;
    }
    
    // LCD 更新 (4Hz)
    if (currentMillis - lastLcdUpdate >= LCD_UPDATE_INTERVAL_MS) {
        updateLCD();
        lastLcdUpdate = currentMillis;
    }
    
    // 狀態機更新
    updateStateMachine();
    
    // 心跳發送
    if (isConnectedToBackend && currentMillis - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
        sendHeartbeat();
        lastHeartbeat = currentMillis;
    }
}

// ============================================================================
// initHardware() - 初始化所有硬體
// ============================================================================
void initHardware() {
    Serial.println(F("[HW] Initializing hardware..."));
    
    initLCD();
    initIRSensor();  // KY-033 紅外線感測器
    initRadar();
    initMic();       // MAX9418 聲音感測器
    initNFC();       // PN532 NFC 模組
    
    Serial.println(F("[HW] ✓ All hardware initialized"));
}

// ============================================================================
// initLCD() - 初始化 1602 I2C LCD
// ============================================================================
void initLCD() {
    Serial.print(F("[LCD] Initializing 1602 LCD @ 0x"));
    Serial.print(LCD_ADDR, HEX);
    Serial.print(F("..."));
    
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    lcd.init();
    lcd.backlight();
    
    // 顯示啟動畫面
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(F("Focus Enforcer"));
    lcd.setCursor(0, 1);
    lcd.print(F("v1.0 Starting..."));
    
    Serial.println(F(" OK"));
}

// ============================================================================
// initIRSensor() - 初始化 KY-033 紅外線感測器 (中斷模式)
// 說明: KY-033 是紅外線反射式感測器，常用於循跡或避障
//      - 白色/反光表面: 反射紅外線 → DO 輸出 LOW
//      - 黑色/吸光表面: 吸收紅外線 → DO 輸出 HIGH
//      - 本專案用於偵測盒蓋: 蓋子關閉時反射面靠近 = LOW (正常)
//                             蓋子開啟時無反射 = HIGH (違規)
// ============================================================================
void initIRSensor() {
    Serial.print(F("[IR] Initializing KY-033 IR sensor on D3 (GPIO0)..."));
    
    pinMode(PIN_HALL, INPUT_PULLUP);
    
    // 讀取初始狀態 (HIGH = 無反射/盒蓋開啟, LOW = 有反射/盒蓋關閉)
    boxOpen = (digitalRead(PIN_HALL) == HIGH);
    
    // 設定中斷 (CHANGE 模式: 偵測反射狀態變化)
    // LOW→HIGH: 反射面離開 (盒蓋開啟)
    // HIGH→LOW: 反射面靠近 (盒蓋關閉)
    attachInterrupt(digitalPinToInterrupt(PIN_HALL), irISR, CHANGE);
    
    Serial.println(F(" OK"));
    Serial.print(F("[IR] Initial state: Box "));
    Serial.println(boxOpen ? F("OPEN (No reflection)") : F("CLOSED (Reflecting)"));
}

// ============================================================================
// initRadar() - 初始化 LD2410 mmWave 雷達
// ============================================================================
void initRadar() {
    Serial.print(F("[RADAR] Initializing LD2410 mmWave radar..."));
    
    radarSerial.begin(256000);  // LD2410 預設 baud rate
    
    // 給雷達一點啟動時間
    delay(100);
    
    Serial.println(F(" OK"));
}

// ============================================================================
// initMic() - 初始化 MAX9418 聲音感測器
// ============================================================================
void initMic() {
    Serial.print(F("[MIC] Initializing MAX9418 sound sensor on A0..."));
    
    // ESP8266 A0 不需要特別初始化，直接 analogRead 即可
    micDb = 40;
    
    Serial.println(F(" OK"));
}

// ============================================================================
// initNFC() - 初始化 PN532 NFC 模組
// ============================================================================
void initNFC() {
    Serial.print(F("[NFC] Initializing PN532 NFC module..."));
    
    nfc.begin();
    
    uint32_t versiondata = nfc.getFirmwareVersion();
    if (!versiondata) {
        Serial.println(F(" ✗ PN532 not found!"));
        return;
    }
    
    // 設定為讀取模式
    nfc.SAMConfig();
    
    Serial.println(F(" OK"));
    Serial.print(F("[NFC] Found chip PN5"));
    Serial.println((versiondata >> 24) & 0xFF, HEX);
}

// ============================================================================
// initWiFi() - 初始化 WiFi 連線
// ============================================================================
void initWiFi() {
    Serial.print(F("[WiFi] Connecting to "));
    Serial.print(WIFI_SSID);
    
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(F("WiFi Connecting"));
    lcd.setCursor(0, 1);
    lcd.print(WIFI_SSID);
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(F("."));
        attempts++;
    }
    Serial.println();
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.print(F("[WiFi] ✓ Connected! IP: "));
        Serial.println(WiFi.localIP());
        
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print(F("WiFi Connected"));
        lcd.setCursor(0, 1);
        lcd.print(WiFi.localIP());
        delay(1000);
    } else {
        Serial.println(F("[WiFi] ✗ Connection failed!"));
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print(F("WiFi Failed!"));
    }
}

// ============================================================================
// initWebSocket() - 初始化 WebSocket
// ============================================================================
void initWebSocket() {
    Serial.print(F("[WS] Connecting to ws://"));
    Serial.print(WS_HOST);
    Serial.print(F(":"));
    Serial.println(WS_PORT);
    
    webSocket.begin(WS_HOST, WS_PORT, WS_PATH);
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(10000);
    webSocket.enableHeartbeat(15000, 3000, 2);
}

// ============================================================================
// handleWiFiReconnect() - 處理 WiFi 重連
// ============================================================================
void handleWiFiReconnect() {
    if (!wifiReconnecting) {
        Serial.println(F("[WiFi] Connection lost, reconnecting..."));
        wifiReconnecting = true;
        wifiReconnectStart = millis();
        isConnectedToBackend = false;
        WiFi.disconnect();
        delay(100);
        WiFi.begin(WIFI_SSID, WIFI_PASS);
    } else {
        if (millis() - wifiReconnectStart > WIFI_RECONNECT_TIMEOUT) {
            Serial.println(F("[WiFi] Reconnect timeout, restarting..."));
            ESP.restart();
        }
    }
}

// ============================================================================
// irISR() - KY-033 紅外線感測器中斷服務常式
// ============================================================================
void IRAM_ATTR irISR() {
    irTriggered = true;
    irTriggerTime = millis();
}

// ============================================================================
// processIRInterrupt() - 處理 KY-033 紅外線感測器中斷 (主迴圈中呼叫)
// ============================================================================
void processIRInterrupt() {
    if (!irTriggered) return;
    
    // 防抖動檢查
    if (millis() - irTriggerTime < IR_DEBOUNCE_MS) return;
    
    irTriggered = false;
    
    // 讀取當前狀態
    bool newState = (digitalRead(PIN_HALL) == HIGH);
    
    if (newState != boxOpen) {
        boxOpen = newState;
        
        Serial.print(F("[IR] Box "));
        Serial.println(boxOpen ? F("OPENED! ⚠️") : F("CLOSED ✓"));
        
        // 專注狀態下開盒 = 違規
        if (boxOpen && currentState == STATE_FOCUSING) {
            Serial.println(F("[VIOLATION] Box opened during focus session!"));
            enterState(STATE_VIOLATION);
        }
    }
}

// ============================================================================
// readSensors() - 讀取所有感測器
// ============================================================================
void readSensors() {
    readRadar();
    readMic();
    readNFC();
}

// ============================================================================
// readRadar() - 讀取 LD2410 雷達 (防抖動)
// ============================================================================
void readRadar() {
    // 簡化版：使用 GPIO 輸出模式
    // LD2410 的 OUT 腳位：HIGH = 偵測到人體, LOW = 無人
    // 這裡假設 LD2410 OUT 接到某個 GPIO (可選)
    // 若使用 UART 模式，需要解析雷達協定
    
    // 暫時模擬/或透過 SoftwareSerial 讀取
    // 這裡簡化為不偵測 (保留擴展空間)
    bool rawReading = radarPresence;  // 維持當前狀態
    
    // TODO: 實作 LD2410 UART 協定解析
    // 或使用簡單的 GPIO OUT 模式
    
    // 防抖動邏輯：人離開需要 3 秒確認
    if (rawReading) {
        radarPresence = true;
        radarLowStartTime = 0;
    } else {
        if (radarPresence && radarLowStartTime == 0) {
            radarLowStartTime = millis();
        }
        if (radarLowStartTime > 0 && millis() - radarLowStartTime >= RADAR_DEBOUNCE_MS) {
            radarPresence = false;
        }
    }
}

// ============================================================================
// readMic() - 讀取 MAX9418 聲音感測器 (類比轉分貝)
// ============================================================================
void readMic() {
    // 讀取類比數值 (0-1023)
    int raw = analogRead(PIN_MIC);
    
    // 簡易轉換邏輯 (僅供參考，實際需校準)
    // 假設 0-1023 對應 30-100 dB
    micDb = map(raw, 0, 1023, 30, 100);
    
    // 限制範圍
    if (micDb < 30) micDb = 30;
    if (micDb > 110) micDb = 110;
}

// ============================================================================
// readNFC() - 讀取 PN532 NFC 標籤
// ============================================================================
void readNFC() {
    uint8_t success;
    uint8_t uid[] = { 0, 0, 0, 0, 0, 0, 0 };  // Buffer to store the returned UID
    uint8_t uidLength;                        // Length of the UID (4 or 7 bytes depending on ISO14443A card type)
    
    // 非阻塞讀取 (等待時間極短)
    success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 10);
    
    if (success) {
        nfcDetected = true;
        nfcId = "";
        for (uint8_t i = 0; i < uidLength; i++) {
            if (uid[i] < 0x10) nfcId += "0";
            nfcId += String(uid[i], HEX);
        }
        nfcId.toUpperCase();
    } else {
        nfcDetected = false;
        nfcId = "";
    }
}

// ============================================================================
// 狀態機：enterState() - 進入新狀態
// ============================================================================
void enterState(SystemState newState) {
    if (newState == currentState) return;
    
    previousState = currentState;
    currentState = newState;
    stateEnterTime = millis();
    
    Serial.print(F("[STATE] "));
    Serial.print(STATE_NAMES[previousState]);
    Serial.print(F(" → "));
    Serial.println(STATE_NAMES[currentState]);
    
    // 狀態進入動作
    switch (newState) {
        case STATE_IDLE:
            totalFocusTime = 0;
            break;
            
        case STATE_PREPARING:
            // 準備階段：10 秒倒數
            Serial.println(F("[PREPARE] 10-second grace period started"));
            break;
            
        case STATE_FOCUSING:
            focusStartTime = millis();
            Serial.println(F("[FOCUS] Focus session started!"));
            break;
            
        case STATE_PAUSED:
            // 暫停時累計專注時間
            if (previousState == STATE_FOCUSING) {
                totalFocusTime += millis() - focusStartTime;
            }
            Serial.println(F("[PAUSE] Session paused"));
            break;
            
        case STATE_VIOLATION:
            // 違規時累計專注時間
            if (previousState == STATE_FOCUSING) {
                totalFocusTime += millis() - focusStartTime;
            }
            Serial.println(F("[VIOLATION] Violation detected!"));
            break;
            
        default:
            break;
    }
    
    // 通知後端狀態變更
    sendStateChange();
}

// ============================================================================
// 狀態機：updateStateMachine() - 更新狀態機
// ============================================================================
void updateStateMachine() {
    switch (currentState) {
        case STATE_IDLE:
            handleIdleState();
            break;
        case STATE_PREPARING:
            handlePreparingState();
            break;
        case STATE_FOCUSING:
            handleFocusingState();
            break;
        case STATE_PAUSED:
            handlePausedState();
            break;
        case STATE_VIOLATION:
            handleViolationState();
            break;
        default:
            break;
    }
}

// ============================================================================
// handleIdleState() - 待機狀態處理
// ============================================================================
void handleIdleState() {
    // 待機狀態：等待來自後端的 START 指令
    // 無需主動處理
}

// ============================================================================
// handlePreparingState() - 準備狀態處理 (10 秒寬限期)
// ============================================================================
void handlePreparingState() {
    unsigned long elapsed = millis() - stateEnterTime;
    
    // 10 秒寬限期結束
    if (elapsed >= PREPARE_DURATION_MS) {
        enterState(STATE_FOCUSING);
    }
}

// ============================================================================
// handleFocusingState() - 專注狀態處理
// ============================================================================
void handleFocusingState() {
    // 檢查違規條件
    // 1. 盒蓋開啟 (由中斷處理)
    // 2. 其他違規條件可在此添加
}

// ============================================================================
// handlePausedState() - 暫停狀態處理
// ============================================================================
void handlePausedState() {
    // 暫停狀態：等待 RESUME 或 STOP 指令
}

// ============================================================================
// handleViolationState() - 違規狀態處理
// ============================================================================
void handleViolationState() {
    // 違規狀態：等待後端處理
}

// ============================================================================
// updateLCD() - 更新 LCD 顯示
// ============================================================================
void updateLCD() {
    switch (currentState) {
        case STATE_IDLE:
            lcdShowIdle();
            break;
        case STATE_PREPARING:
            lcdShowPreparing();
            break;
        case STATE_FOCUSING:
            lcdShowFocusing();
            break;
        case STATE_PAUSED:
            lcdShowPaused();
            break;
        case STATE_VIOLATION:
            lcdShowViolation();
            break;
        default:
            break;
    }
}

// ============================================================================
// lcdShowIdle() - LCD 待機畫面
// ============================================================================
void lcdShowIdle() {
    lcd.setCursor(0, 0);
    lcd.print(F("  READY TO GO   "));
    lcd.setCursor(0, 1);
    lcd.print(F("  Waiting...    "));
}

// ============================================================================
// lcdShowPreparing() - LCD 準備畫面
// ============================================================================
void lcdShowPreparing() {
    unsigned long remaining = PREPARE_DURATION_MS - (millis() - stateEnterTime);
    int seconds = remaining / 1000;
    
    lcd.setCursor(0, 0);
    lcd.print(F("  PREPARING...  "));
    lcd.setCursor(0, 1);
    lcd.print(F("  Start in: "));
    lcd.print(seconds);
    lcd.print(F("s  "));
}

// ============================================================================
// lcdShowFocusing() - LCD 專注畫面
// ============================================================================
void lcdShowFocusing() {
    unsigned long elapsed = millis() - focusStartTime + totalFocusTime;
    
    lcd.setCursor(0, 0);
    lcd.print(F("   FOCUSING     "));
    lcd.setCursor(0, 1);
    lcd.print(F("Time: "));
    lcd.print(formatTime(elapsed));
    lcd.print(F("    "));
}

// ============================================================================
// lcdShowPaused() - LCD 暫停畫面
// ============================================================================
void lcdShowPaused() {
    lcd.setCursor(0, 0);
    lcd.print(F("    PAUSED      "));
    lcd.setCursor(0, 1);
    lcd.print(F("Total: "));
    lcd.print(formatTime(totalFocusTime));
}

// ============================================================================
// lcdShowViolation() - LCD 違規畫面
// ============================================================================
void lcdShowViolation() {
    // 閃爍效果
    static bool blink = false;
    blink = !blink;
    
    lcd.setCursor(0, 0);
    if (blink) {
        lcd.print(F("!! VIOLATION !! "));
    } else {
        lcd.print(F("                "));
    }
    lcd.setCursor(0, 1);
    lcd.print(F("Box was opened! "));
}

// ============================================================================
// formatTime() - 格式化時間 (毫秒 → MM:SS)
// ============================================================================
String formatTime(unsigned long ms) {
    unsigned long totalSec = ms / 1000;
    int minutes = totalSec / 60;
    int seconds = totalSec % 60;
    
    String result = "";
    if (minutes < 10) result += "0";
    result += String(minutes);
    result += ":";
    if (seconds < 10) result += "0";
    result += String(seconds);
    
    return result;
}

// ============================================================================
// sendSensorData() - 發送感測器資料
// ============================================================================
void sendSensorData() {
    if (!isConnectedToBackend) return;
    
    StaticJsonDocument<512> doc;
    doc[0] = "sensor_data";
    
    JsonObject data = doc.createNestedObject();
    data["hardware_id"] = HARDWARE_ID;
    data["state"] = STATE_NAMES[currentState];
    data["box_open"] = boxOpen;
    data["radar_presence"] = radarPresence;
    data["mic_db"] = micDb;
    data["nfc_detected"] = nfcDetected;
    data["nfc_id"] = nfcId;
    data["uptime"] = millis() / 1000;
    data["timestamp"] = millis();
    
    String payload;
    serializeJson(doc, payload);
    webSocket.sendTXT(payload);
}

// ============================================================================
// sendStateChange() - 發送狀態變更通知
// ============================================================================
void sendStateChange() {
    if (!isConnectedToBackend) return;
    
    StaticJsonDocument<256> doc;
    doc[0] = "state_change";
    
    JsonObject data = doc.createNestedObject();
    data["hardware_id"] = HARDWARE_ID;
    data["previous_state"] = STATE_NAMES[previousState];
    data["current_state"] = STATE_NAMES[currentState];
    data["timestamp"] = millis();
    
    // 專注時間資訊
    if (currentState == STATE_VIOLATION || currentState == STATE_PAUSED || currentState == STATE_IDLE) {
        data["total_focus_time_ms"] = totalFocusTime;
    }
    
    String payload;
    serializeJson(doc, payload);
    webSocket.sendTXT(payload);
}

// ============================================================================
// sendHeartbeat() - 發送心跳
// ============================================================================
void sendHeartbeat() {
    StaticJsonDocument<256> doc;
    doc[0] = "heartbeat";
    
    JsonObject data = doc.createNestedObject();
    data["hardware_id"] = HARDWARE_ID;
    data["state"] = STATE_NAMES[currentState];
    data["uptime"] = millis() / 1000;
    data["wifi_rssi"] = WiFi.RSSI();
    data["free_heap"] = ESP.getFreeHeap();
    
    String payload;
    serializeJson(doc, payload);
    webSocket.sendTXT(payload);
}

// ============================================================================
// webSocketEvent() - WebSocket 事件處理
// ============================================================================
void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {
        case WStype_DISCONNECTED:
            if (isConnectedToBackend) {
                Serial.println(F("[WS] Disconnected"));
            }
            isConnectedToBackend = false;
            break;
            
        case WStype_CONNECTED:
            Serial.print(F("[WS] ✓ Connected to: "));
            Serial.println((char*)payload);
            isConnectedToBackend = true;
            
            // 發送硬體註冊訊息
            {
                StaticJsonDocument<256> doc;
                doc[0] = "hardware_connect";
                
                JsonObject data = doc.createNestedObject();
                data["hardware_id"] = HARDWARE_ID;
                data["version"] = FIRMWARE_VERSION;
                data["board"] = "D1-mini";
                data["features"] = "hall,lcd,radar";
                
                String msg;
                serializeJson(doc, msg);
                webSocket.sendTXT(msg);
            }
            break;
            
        case WStype_TEXT:
            handleCommand((char*)payload);
            break;
            
        case WStype_PING:
        case WStype_PONG:
            break;
            
        default:
            break;
    }
}

// ============================================================================
// handleCommand() - 處理後端指令
// ============================================================================
void handleCommand(const char* payload) {
    if (!payload) return;
    
    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, payload);
    
    if (error) {
        Serial.print(F("[WS] JSON parse error: "));
        Serial.println(error.c_str());
        return;
    }
    
    const char* command = doc["command"];
    if (!command) return;
    
    Serial.print(F("[CMD] Received: "));
    Serial.println(command);
    
    // 指令處理
    if (strcmp(command, "START") == 0) {
        if (currentState == STATE_IDLE) {
            enterState(STATE_PREPARING);
        }
    }
    else if (strcmp(command, "STOP") == 0 || strcmp(command, "CANCEL") == 0) {
        enterState(STATE_IDLE);
    }
    else if (strcmp(command, "PAUSE") == 0) {
        if (currentState == STATE_FOCUSING) {
            enterState(STATE_PAUSED);
        }
    }
    else if (strcmp(command, "RESUME") == 0) {
        if (currentState == STATE_PAUSED) {
            enterState(STATE_FOCUSING);
            focusStartTime = millis();  // 重新開始計時
        }
    }
    else if (strcmp(command, "ACKNOWLEDGE") == 0) {
        // 確認違規後回到待機
        if (currentState == STATE_VIOLATION) {
            enterState(STATE_IDLE);
        }
    }
    else if (strcmp(command, "PING") == 0) {
        // 回應 ping
        StaticJsonDocument<128> response;
        response[0] = "pong";
        response[1]["hardware_id"] = HARDWARE_ID;
        
        String msg;
        serializeJson(response, msg);
        webSocket.sendTXT(msg);
    }
    else {
        Serial.print(F("[CMD] Unknown command: "));
        Serial.println(command);
    }
}
