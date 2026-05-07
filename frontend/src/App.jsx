import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { supabase } from './supabaseClient';
import { ShieldAlert, Video, BarChart3, Settings, LogIn } from 'lucide-react';

function App() {
  const [spots, setSpots] = useState([]);
  const [stats, setStats] = useState({ avg_shops: 0, cctv_rate: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    // Supabase에서 'spots' 테이블 데이터 가져오기
    const { data, error } = await supabase
      .from('spots')
      .select('*');

    if (error) {
      console.error("데이터 로딩 실패:", error);
    } else if (data) {
      setSpots(data);
      
      // 통계 계산
      const avg = data.length > 0 ? Math.round(data.reduce((acc, cur) => acc + cur.음주업소합계, 0) / data.length) : 0;
      const cctv = data.length > 0 ? Math.round((data.filter(s => s.카메라수 > 0).length / data.length) * 100) : 0;
      
      setStats({ avg_shops: avg, cctv_rate: cctv });
    }
    setLoading(false);
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-50 font-sans">
      {/* 사이드바 */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <ShieldAlert className="text-red-500" />
          <h1 className="font-bold text-lg tracking-tight">DUI Tracker</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-red-500/10 text-red-500 rounded-xl font-medium">
            <BarChart3 size={18} /> 위험 분석
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 rounded-xl transition-colors">
            <Video size={18} /> 실시간 관제
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 rounded-xl transition-colors">
            <LogIn size={18} /> 로그인
          </button>
        </div>
      </aside>

      {/* 메인 영역 */}
      <main className="flex-1 flex flex-col">
        {/* 상단 헤더 */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/50 backdrop-blur-md">
          <h2 className="text-xl font-semibold">울산 남구 지능형 관제 시스템 (Supabase)</h2>
          <div className="flex items-center gap-4">
             <span className="flex items-center gap-2 text-sm text-slate-400">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                서버리스 모드 작동 중
             </span>
          </div>
        </header>

        {/* 대시보드 콘텐츠 */}
        <div className="flex-1 p-6 flex gap-6 overflow-hidden">
          {/* 지도 영역 */}
          <div className="flex-[3] bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden relative shadow-2xl">
            <MapContainer center={[35.5437, 129.3301]} zoom={14} scrollWheelZoom={true}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {spots.map((spot, idx) => (
                <CircleMarker
                  key={idx}
                  center={[spot.위도, spot.경도]}
                  radius={5 + (spot.음주업소합계 / 2)}
                  fillColor="#ef4444"
                  color="#b91c1c"
                  weight={1}
                  fillOpacity={0.6}
                >
                  <Popup>
                    <div className="text-slate-900 p-1">
                      <p className="font-bold border-b mb-1">{spot.사고다발지id} 지점</p>
                      <p>업소 수: {spot.음주업소합계}개</p>
                      <p>CCTV: {spot.카메라수}대</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          {/* 정보 패널 */}
          <div className="flex-1 space-y-6 overflow-y-auto pr-2">
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg">
              <p className="text-slate-400 text-sm font-medium mb-1">평균 위험 업소</p>
              <p className="text-3xl font-bold text-red-500">{stats.avg_shops}개</p>
            </div>
            
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg border-b-4 border-b-green-500">
              <p className="text-slate-400 text-sm font-medium mb-1">CCTV 충족률</p>
              <p className="text-3xl font-bold">{stats.cctv_rate}%</p>
            </div>

            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg h-64 flex flex-col">
              <p className="text-slate-400 text-sm font-medium mb-4">관제 시스템 로그</p>
              <div className="flex-1 bg-black/50 rounded-xl p-3 font-mono text-xs text-green-400 overflow-y-auto space-y-1">
                <p>[SYSTEM] Supabase 연동 완료</p>
                <p>[AUTH] 익명 세션 활성화</p>
                <p>[DATA] 'spots' 테이블 로드 성공</p>
                <p className="text-slate-500">--------------------------</p>
                {loading ? (
                  <p className="animate-pulse">데이터 동기화 중...</p>
                ) : (
                  <p>[INFO] {spots.length}개 위험 지점 맵핑됨</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
