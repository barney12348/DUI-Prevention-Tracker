import pandas as pd
from supabase import create_client
import os

# Supabase 설정
url = "https://otrjhxoqetuftpfdbsfv.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90cmpoeG9xZXR1ZnRwZmRic2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwOTgxMjEsImV4cCI6MjA5MzY3NDEyMX0.xAEc9wRY0YeeZhSgCuFahUmG4CCZhhlJCZUsgPJ1qQE"
supabase = create_client(url, key)

def upload_data():
    csv_path = "융합캡스톤디자인I/web_app/backend/data.csv"
    print(f"Reading {csv_path}...")
    
    # CSV 읽기 (인코딩 주의)
    try:
        df = pd.read_csv(csv_path, encoding='cp949')
    except:
        df = pd.read_csv(csv_path, encoding='utf-8')
    
    # 데이터 정제 (필요한 컬럼만 선택 및 이름 매칭)
    # CSV 컬럼: 사고다발지fid,사고다발지id,위도,경도,음주업소합계,카메라수 등
    upload_df = df[['사고다발지fid', '사고다발지id', '위도', '경도', '음주업소합계', '카메라수']]
    
    # JSON 리스트로 변환
    records = upload_df.to_dict(orient='records')
    
    print(f"Uploading {len(records)} rows to Supabase...")
    
    # 100개씩 끊어서 업로드 (대량 데이터 안정성)
    chunk_size = 100
    for i in range(0, len(records), chunk_size):
        chunk = records[i:i + chunk_size]
        try:
            supabase.table("spots").insert(chunk).execute()
            print(f"Progress: {i + len(chunk)}/{len(records)}")
        except Exception as e:
            print(f"Error at chunk {i}: {e}")
            break

    print("Upload completed successfully!")

if __name__ == "__main__":
    upload_data()
