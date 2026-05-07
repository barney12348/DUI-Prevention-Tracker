-- Supabase SQL Editor에 복사하여 붙여넣으세요.
-- 알려주신 11개 컬럼명과 100% 일치하도록 설계되었습니다.

drop table if exists spots;

create table spots (
  id bigint primary key generated always as identity,
  사고다발지fid text,
  사고다발지id text,
  위도 float8,
  경도 float8,
  소상공인수 int8,
  유흥주점수 int8,
  음주업소합계 int8,
  카메라수 int8,
  카메라없음 text, -- True/False 등 다양한 형식 대응을 위해 text로 설정
  업소밀집 text,   -- True/False 등 다양한 형식 대응을 위해 text로 설정
  위험구간 text,   -- True/False 등 다양한 형식 대응을 위해 text로 설정
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 보안 정책 해제 (모든 접근 허용)
alter table spots disable row level security;
