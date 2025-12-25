"""
懲罰執行 API
===================
提供前端動畫完成後觸發實際懲罰發送的端點。
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..automation.social_manager import social_manager
from ..logger import safe_print


router = APIRouter(prefix="/api/penalty", tags=["penalty"])


class ExecutePenaltyRequest(BaseModel):
    """執行懲罰的請求參數"""
    # 可選：未來可擴展傳入額外參數
    pass


class ExecutePenaltyResponse(BaseModel):
    """執行懲罰的回應"""
    success: bool
    message: str
    platforms_executed: int


@router.post("/execute", response_model=ExecutePenaltyResponse)
async def execute_penalty():
    """
    執行懲罰發送。
    
    此端點由前端在懲罰動畫播放完最後一步時呼叫，
    用於觸發實際的社交平台訊息發送。
    """
    try:
        safe_print("[懲罰 API] 收到前端請求，開始執行社交羞恥發送...")
        
        # 從 socket_manager 獲取當前系統狀態
        from ..socket_manager import socket_manager
        state = socket_manager.state
        
        if not state:
            raise HTTPException(status_code=400, detail="系統狀態未初始化")
        
        if not state.penalty_settings:
            return ExecutePenaltyResponse(
                success=False,
                message="尚未配置處罰機制",
                platforms_executed=0
            )
        
        enabled = state.penalty_settings.enabled_platforms
        if not enabled:
            return ExecutePenaltyResponse(
                success=False,
                message="未啟用任何處罰平台",
                platforms_executed=0
            )
        
        # 執行實際的懲罰發送
        await social_manager.execute_penalty(state)
        
        safe_print(f"[懲罰 API] ✅ 社交羞恥發送完成，涉及 {len(enabled)} 個平台")
        
        return ExecutePenaltyResponse(
            success=True,
            message=f"已向 {len(enabled)} 個平台發送懲罰通知",
            platforms_executed=len(enabled)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        safe_print(f"[懲罰 API] ❌ 執行失敗: {e}")
        raise HTTPException(status_code=500, detail=f"懲罰執行失敗: {str(e)}")
