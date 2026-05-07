-- [복사해서 Supabase SQL Editor에 붙여넣으세요]
-- 1. 기존 테이블 삭제
drop table if exists spots;

-- 2. 알려주신 11개 컬럼에 최적화된 테이블 생성
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
  카메라없음 text,
  업소밀집 text,
  위험구간 text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. 모든 보안 정책 해제 (개발 모드)
alter table spots disable row level security;

-- 4. 확인용 쿼리 (실행 후 결과가 비어있으면 정상)
select * from spots;
