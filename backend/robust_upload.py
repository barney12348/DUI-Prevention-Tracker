import pandas as pd
import requests
import json

# Supabase 정보 (제공해주신 정보)
URL = "https://otrjhxoqetuftpfdbsfv.supabase.co/rest/v1/spots"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90cmpoeG9xZXR1ZnRwZmRic2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwOTgxMjEsImV4cCI6MjA5MzY3NDEyMX0.xAEc9wRY0YeeZhSgCuFahUmG4CCZhhlJCZUsgPJ1qQE"

def upload():
    csv_path = "융합캡스톤디자인I/web_app/backend/data.csv"
    print(f"Reading {csv_path}...")
    
    try:
        df = pd.read_csv(csv_path, encoding='cp949')
    except:
        df = pd.read_csv(csv_path, encoding='utf-8')

    # 알려주신 11개 컬럼 필터링
    cols = ['사고다발지fid', '사고다발지id', '위도', '경도', '소상공인수', '유흥주점수', '음주업소합계', '카메라수', '카메라없음', '업소밀집', '위험구간']
    upload_df = df[cols]
    
    # NaN 처리 (Supabase는 null을 이해함)
    upload_df = upload_df.where(pd.notnull(upload_df), None)
    
    records = upload_df.to_dict(orient='records')
    print(f"Uploading {len(records)} records to Supabase via REST API...")

    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

    # 50개씩 끊어서 전송 (안전성)
    chunk_size = 50
    for i in range(0, len(records), chunk_size):
        chunk = records[i:i + chunk_size]
        response = requests.post(URL, headers=headers, data=json.dumps(chunk))
        if response.status_code not in [200, 201]:
            print(f"Error at {i}: {response.text}")
            return
        print(f"Progress: {i + len(chunk)}/{len(records)}")

    print("Success! Data is now in Supabase.")

if __name__ == "__main__":
    upload()
