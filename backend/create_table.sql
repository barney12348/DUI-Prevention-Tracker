-- Supabase SQL Editor에 복사하여 붙여넣으세요.

-- 1. spots 테이블 생성
create table spots (
  id bigint primary key generated always as identity,
  사고다발지fid text,
  사고다발지id text,
  위도 float8,
  경도 float8,
  음주업소합계 int8,
  카메라수 int8,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. 보안 정책 설정 (개발 중에는 모든 읽기/쓰기 허용)
-- 나중에 서비스 배포 시에는 RLS를 켜고 적절한 정책을 설정해야 합니다.
alter table spots disable row level security;

-- 3. (선택사항) 데이터가 잘 들어갔는지 확인하는 쿼리
-- select * from spots;
