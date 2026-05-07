from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import requests
import os
import json

app = FastAPI(title="DUI Prevention Tracker API")

# React 앱과의 통신을 위해 CORS 설정 (매우 중요!)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 개발 중에는 모든 도메인 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = "data.csv"

# 1. 위험 구역 데이터 엔드포인트
@app.get("/api/risk-data")
def get_risk_data():
    if not os.path.exists(DATA_FILE):
        return {"error": "Data file not found"}
    
    df = pd.read_csv(DATA_FILE)
    df = df.dropna(subset=['위도', '경도'])
    
    # 리액트가 읽기 편하도록 리스트 형식으로 변환
    data = df.to_dict(orient="records")
    
    # 간단한 통계 계산
    avg_shops = int(df['음주업소합계'].mean())
    cctv_rate = round((len(df[df['카메라수'] > 0]) / len(df)) * 100, 1)
    
    return {
        "stats": {
            "avg_shops": avg_shops,
            "cctv_rate": cctv_rate,
            "total_spots": len(df)
        },
        "spots": data
    }

# 2. 실시간 CCTV 목록 엔드포인트
@app.get("/api/cctv")
def get_cctv(apiKey: str = "382f16a033c74384b647321590f0f5b1", roadType: str = "its"):
    url = "https://openapi.its.go.kr:9443/cctvInfo"
    params = {
        "apiKey": apiKey,
        "type": roadType,
        "cctvType": "1",
        "minX": "129.20", "maxX": "129.45", "minY": "35.50", "maxY": "35.60",
        "getType": "json"
    }
    try:
        response = requests.get(url, params=params, timeout=5)
        return response.json()
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
