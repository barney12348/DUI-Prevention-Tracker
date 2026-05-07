import React, { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from './supabaseClient'
import { ShieldAlert, Video, BarChart3, Play, Square, AlertTriangle, Car, Eye, Activity } from 'lucide-react'

// 시나리오 추적 경로 (울산 남구 삼산동 → 공업탑 → 달동)
const SCENARIO_ROUTE = [
  [35.5393, 129.3321],
  [35.5378, 129.3298],
  [35.5362, 129.3271],
  [35.5341, 129.3255],
  [35.5318, 129.3237],
  [35.5295, 129.3219],
  [35.5271, 129.3198],
]

const SCENARIO_LOGS = [
  { delay: 0,     type: 'warn',    msg: '[22:04] 삼산동 주차장 — 비정상 보행 패턴 감지 (위험도 88%)' },
  { delay: 2500,  type: 'info',    msg: '[22:05] Pose Estimation 분석 중... 비틀거림 확인' },
  { delay: 5000,  type: 'alert',   msg: '[22:07] 타겟 차량 탑승 및 출차 확인 (번호: 12가 3456)' },
  { delay: 7500,  type: 'info',    msg: '[22:08] YOLOv8 차량 특징 등록 완료 — 추적 시작' },
  { delay: 10000, type: 'info',    msg: '[22:10] CCTV #7 통과 — 공업탑 방면 이동 중' },
  { delay: 12500, type: 'warn',    msg: '[22:12] ⚠ CCTV 공백 구간 진입 — 수동 추적 요청' },
  { delay: 15000, type: 'info',    msg: '[22:14] CCTV #14 통과 — 달동 방면 이동 확인' },
  { delay: 17500, type: 'success', msg: '[22:16] ✓ 관제 시스템 알림 전송 완료 — 위치 공유' },
]

const FEATURE_IMPORTANCE = [
  { label: '업소 밀집도',     value: 42, color: '#ef4444' },
  { label: 'CCTV 공백',      value: 31, color: '#f97316' },
  { label: '유흥주점 수',    value: 15, color: '#eab308' },
  { label: '사고다발지 근접', value: 8,  color: '#22c55e' },
  { label: '시간대(심야)',   value: 4,  color: '#3b82f6' },
]

// 추적 차량 마커 아이콘
const carIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;background:#f97316;border:2px solid #fff;border-radius:50%;box-shadow:0 0 10px #f97316,0 0 20px #f9741644;"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

// 지도 중심 이동 컴포넌트
function MapPanner({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.panTo(center, { animate: true, duration: 1 })
  }, [center, map])
  return null
}

// Risk Score 계산 (0~99)
function calcRiskScore(spot) {
  const shopScore = Math.min(60, Math.round(spot.음주업소합계 / 5))
  const cctvPenalty = spot.카메라수 === 0 ? 30 : 0
  return Math.min(99, shopScore + cctvPenalty)
}

// 위험도에 따른 색상
function riskColor(score) {
  if (score >= 70) return '#ef4444'  // 빨강 (최고위험)
  if (score >= 50) return '#f97316'  // 주황 (고위험)
  if (score >= 30) return '#eab308'  // 노랑 (중위험)
  return '#22c55e'                   // 초록 (저위험)
}

const LOG_COLORS = {
  success: 'text-green-400',
  info:    'text-slate-400',
  warn:    'text-yellow-400',
  alert:   'text-red-400',
}

export default function App() {
  const [spots, setSpots] = useState([])
  const [stats, setStats] = useState({ avg_shops: 0, cctv_rate: 0, total_spots: 0 })
  const [loading, setLoading] = useState(true)
  const [activeNav, setActiveNav] = useState('analysis')

  const [scenarioRunning, setScenarioRunning] = useState(false)
  const [scenarioDone, setScenarioDone] = useState(false)
  const [trackerPos, setTrackerPos] = useState(null)
  const [trackedPath, setTrackedPath] = useState([])
  const [mapCenter, setMapCenter] = useState(null)
  const [logs, setLogs] = useState([
    { type: 'success', msg: '[SYSTEM] Supabase 연동 완료' },
    { type: 'info',    msg: '[AUTH] 익명 세션 활성화' },
    { type: 'info',    msg: '[DATA] spots 테이블 로드 성공' },
  ])

  const intervalRef = useRef(null)
  const timeoutsRef = useRef([])
  const logEndRef = useRef(null)

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase.from('spots').select('*')
    if (!error && data) {
      setSpots(data)
      const avg = data.length > 0
        ? Math.round(data.reduce((a, c) => a + c.음주업소합계, 0) / data.length)
        : 0
      const cctv = data.length > 0
        ? Math.round((data.filter(s => s.카메라수 > 0).length / data.length) * 100)
        : 0
      setStats({ avg_shops: avg, cctv_rate: cctv, total_spots: data.length })
    }
    if (error) console.error('데이터 로딩 실패:', error)
    setLoading(false)
  }

  function startScenario() {
    if (scenarioRunning) return
    setScenarioRunning(true)
    setScenarioDone(false)
    setTrackerPos(SCENARIO_ROUTE[0])
    setTrackedPath([SCENARIO_ROUTE[0]])
    setMapCenter(SCENARIO_ROUTE[0])

    let step = 0
    intervalRef.current = setInterval(() => {
      step++
      if (step < SCENARIO_ROUTE.length) {
        const pos = SCENARIO_ROUTE[step]
        setTrackerPos(pos)
        setTrackedPath(prev => [...prev, pos])
        setMapCenter(pos)
      } else {
        clearInterval(intervalRef.current)
        setScenarioRunning(false)
        setScenarioDone(true)
      }
    }, 2500)

    SCENARIO_LOGS.forEach(({ delay, type, msg }) => {
      const t = setTimeout(() => setLogs(prev => [...prev, { type, msg }]), delay)
      timeoutsRef.current.push(t)
    })
  }

  function stopScenario() {
    clearInterval(intervalRef.current)
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    setScenarioRunning(false)
    setTrackerPos(null)
    setTrackedPath([])
    setMapCenter(null)
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-50 font-sans overflow-hidden">

      {/* ── 사이드바 ── */}
      <aside className="w-52 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800 flex items-center gap-2">
          <ShieldAlert className="text-red-500" size={20} />
          <h1 className="font-bold text-sm tracking-tight">DUI Tracker</h1>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <button
            onClick={() => setActiveNav('analysis')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeNav === 'analysis' ? 'bg-red-500/10 text-red-400' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <BarChart3 size={15} /> 위험 분석
          </button>
          <button
            onClick={() => setActiveNav('cctv')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeNav === 'cctv' ? 'bg-red-500/10 text-red-400' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Video size={15} /> 실시간 관제
          </button>
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-2">
          <div className="px-3 py-2 rounded-xl bg-slate-800/60">
            <p className="text-xs text-slate-500 mb-0.5">관제 지점</p>
            <p className="text-xl font-bold">{stats.total_spots}<span className="text-sm font-normal text-slate-400 ml-1">개소</span></p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-slate-800/60">
            <p className="text-xs text-slate-500 mb-0.5">CCTV 충족률</p>
            <p className="text-xl font-bold text-green-400">{stats.cctv_rate}<span className="text-sm font-normal text-slate-400 ml-0.5">%</span></p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-slate-800/60">
            <p className="text-xs text-slate-500 mb-0.5">평균 위험 업소</p>
            <p className="text-xl font-bold text-red-400">{stats.avg_shops}<span className="text-sm font-normal text-slate-400 ml-1">개</span></p>
          </div>
        </div>
      </aside>

      {/* ── 메인 영역 ── */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* 헤더 */}
        <header className="h-13 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 shrink-0 py-3">
          <h2 className="text-sm font-semibold text-slate-200">울산 남구 지능형 음주운전 예방 관제 시스템</h2>
          <div className="flex items-center gap-3">
            {scenarioDone && (
              <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full animate-pulse">
                ⚠ CCTV 공백 3개소 — 추가 설치 권고
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              서버리스 운영 중
            </span>
          </div>
        </header>

        {/* 3패널 본문 */}
        <div className="flex-1 flex min-h-0">

          {/* ── 왼쪽: AI 엔진 패널 ── */}
          <div className="w-72 border-r border-slate-800 flex flex-col gap-3 p-3 overflow-y-auto shrink-0">

            {/* XGBoost 특성 중요도 */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <p className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-2">
                <Activity size={12} className="text-purple-400" />
                위험 요인 분석 (XGBoost)
              </p>
              <div className="space-y-2.5">
                {FEATURE_IMPORTANCE.map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">{label}</span>
                      <span style={{ color }} className="font-bold tabular-nums">{value}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${value}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-600 mt-3">* 업소밀집도·CCTV공백이 전체 위험의 73% 설명</p>
            </div>

            {/* Pose Estimation */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <p className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-2">
                <Eye size={12} className="text-blue-400" />
                행동 분석 (MediaPipe)
              </p>
              <div className="aspect-video bg-black rounded-lg relative overflow-hidden flex items-center justify-center border border-slate-800">
                {scenarioRunning ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50" />
                    <div className="text-center z-10 space-y-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-ping mx-auto" />
                      <p className="text-red-400 text-xs font-mono font-bold">비틀거림 감지</p>
                      <p className="text-yellow-400 text-xs font-mono">위험도 88%</p>
                    </div>
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-red-400 text-xs font-mono font-bold">LIVE</span>
                    </div>
                    <div className="absolute bottom-2 right-2 text-slate-500 text-xs font-mono">CAM_01</div>
                  </>
                ) : scenarioDone ? (
                  <p className="text-yellow-500/60 text-xs font-mono">분석 완료</p>
                ) : (
                  <p className="text-slate-700 text-xs font-mono">대기 중...</p>
                )}
              </div>
            </div>

            {/* YOLOv8 차량 탐지 */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <p className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-2">
                <Car size={12} className="text-orange-400" />
                차량 탐지 (YOLOv8)
              </p>
              {(scenarioRunning || scenarioDone) ? (
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-500">번호판</span>
                    <span className="text-orange-400 font-bold">12가 3456</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-500">차종</span>
                    <span className="text-slate-200">승용차 (흰색)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-500">신뢰도</span>
                    <span className="text-green-400 font-bold">94.2%</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">상태</span>
                    <span className={scenarioRunning ? 'text-red-400 animate-pulse font-bold' : 'text-yellow-400'}>
                      {scenarioRunning ? '● 추적 중' : '추적 완료'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-slate-700 text-xs font-mono">탐지 대기 중...</p>
                </div>
              )}
            </div>
          </div>

          {/* ── 중앙: 지도 ── */}
          <div className="flex-1 relative min-w-0">
            {/* absolute inset-0: flexbox 안에서 height:100%가 안 먹히는 문제 해결 */}
            <div className="absolute inset-0">
            <MapContainer
              center={[35.5384, 129.3114]}
              zoom={13}
              scrollWheelZoom={true}
              style={{ width: '100%', height: '100%' }}
            >
              {mapCenter && <MapPanner center={mapCenter} />}
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
              />

              {/* 히트맵 레이어 (큰 반투명 원) */}
              {spots.map((spot, idx) => {
                const risk = calcRiskScore(spot)
                const color = riskColor(risk)
                return (
                  <CircleMarker
                    key={`heat-${idx}`}
                    center={[spot.위도, spot.경도]}
                    radius={10 + (spot.음주업소합계 / 8)}
                    fillColor={color}
                    color="transparent"
                    weight={0}
                    fillOpacity={0.12}
                    interactive={false}
                  />
                )
              })}

              {/* 실제 마커 (클릭 가능) */}
              {spots.map((spot, idx) => {
                const risk = calcRiskScore(spot)
                const color = riskColor(risk)
                return (
                  <CircleMarker
                    key={`dot-${idx}`}
                    center={[spot.위도, spot.경도]}
                    radius={6 + (spot.음주업소합계 / 20)}
                    fillColor={color}
                    color="#0f172a"
                    weight={1.5}
                    fillOpacity={0.9}
                  >
                    <Popup>
                      <div style={{ color: '#1e293b', fontSize: '12px', padding: '4px', minWidth: '160px' }}>
                        <p style={{ fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '8px' }}>
                          📍 사고다발지 {spot.사고다발지id}
                        </p>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr><td style={{ color: '#64748b', paddingBottom: '3px' }}>음주업소</td><td style={{ fontWeight: 'bold', textAlign: 'right' }}>{spot.음주업소합계}개</td></tr>
                            <tr><td style={{ color: '#64748b', paddingBottom: '3px' }}>유흥주점</td><td style={{ fontWeight: 'bold', textAlign: 'right' }}>{spot.유흥주점수}개</td></tr>
                            <tr><td style={{ color: '#64748b', paddingBottom: '3px' }}>소상공인</td><td style={{ fontWeight: 'bold', textAlign: 'right' }}>{spot.소상공인수}개</td></tr>
                            <tr><td style={{ color: '#64748b' }}>CCTV</td><td style={{ fontWeight: 'bold', textAlign: 'right' }}>{spot.카메라수}대</td></tr>
                          </tbody>
                        </table>
                        <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#64748b', fontSize: '11px' }}>AI Risk Score</span>
                          <span style={{ fontSize: '24px', fontWeight: '900', color }}>{risk}</span>
                        </div>
                        {spot.카메라수 === 0 && (
                          <p style={{ marginTop: '6px', color: '#ef4444', fontSize: '11px', fontWeight: 'bold' }}>⚠ CCTV 미설치 구역</p>
                        )}
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })}

              {/* 추적 경로 */}
              {trackedPath.length > 1 && (
                <Polyline
                  positions={trackedPath}
                  color="#f97316"
                  weight={3}
                  opacity={0.9}
                  dashArray="8 5"
                />
              )}

              {/* 추적 차량 */}
              {trackerPos && (
                <Marker position={trackerPos} icon={carIcon} />
              )}
            </MapContainer>
            </div>

            {/* 시나리오 제어 버튼 */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex gap-2">
              <button
                onClick={startScenario}
                disabled={scenarioRunning}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-full shadow-2xl transition-all hover:scale-105"
              >
                <Play size={14} /> 시나리오 시작
              </button>
              {scenarioRunning && (
                <button
                  onClick={stopScenario}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold text-sm rounded-full shadow-lg transition-colors"
                >
                  <Square size={14} /> 중지
                </button>
              )}
            </div>

            {loading && (
              <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center z-[1000]">
                <p className="text-slate-400 text-sm animate-pulse">데이터 로딩 중...</p>
              </div>
            )}
          </div>

          {/* ── 오른쪽: 실시간 로그 ── */}
          <div className="w-72 border-l border-slate-800 flex flex-col p-3 shrink-0">
            <p className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-2 shrink-0">
              <AlertTriangle size={12} className="text-yellow-400" />
              실시간 관제 로그
            </p>

            <div className="flex-1 bg-black/40 rounded-xl p-3 font-mono text-xs overflow-y-auto space-y-1.5 border border-slate-800 min-h-0">
              {logs.map((log, i) => (
                <p key={i} className={`leading-relaxed ${LOG_COLORS[log.type] || 'text-slate-400'}`}>
                  {log.msg}
                </p>
              ))}
              <div ref={logEndRef} />
            </div>

            {/* 정책 제안 박스 */}
            {scenarioDone && (
              <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl shrink-0">
                <p className="text-amber-400 text-xs font-bold mb-1.5">📋 분석 결과 요약</p>
                <p className="text-amber-300/80 text-xs leading-relaxed">
                  공업탑~달동 구간 CCTV 공백으로 인해 추적 지연 발생.<br />
                  해당 구간 <b>3개소 추가 설치</b> 권고.
                </p>
              </div>
            )}

            {/* 범례 */}
            <div className="mt-3 p-3 bg-slate-900 rounded-xl border border-slate-800 shrink-0">
              <p className="text-xs text-slate-500 mb-2 font-semibold">위험도 범례</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#ef4444' }} />
                  <span className="text-slate-400">최고위험 (Score ≥ 70)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#f97316' }} />
                  <span className="text-slate-400">고위험 (Score 50~69)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#eab308' }} />
                  <span className="text-slate-400">중위험 (Score 30~49)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#22c55e' }} />
                  <span className="text-slate-400">저위험 (Score &lt; 30)</span>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#f97316', boxShadow: '0 0 6px #f97316' }} />
                  <span className="text-slate-400">추적 차량</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
