import { useState, useEffect, useMemo } from "react";

// ─── 상수 ───────────────────────────────────────────────────────────────────

const ADMIN_PASSWORD = "admin3526!";
const READ_KEY = "open_voice_read_v3"; // 읽음 상태만 localStorage 유지

// ─── Supabase 설정 ───────────────────────────────────────────────────────────
const SUPABASE_URL = "https://kpvjkrdkyxawqiyogjrt.supabase.co";
const SUPABASE_KEY = "sb_publishable_LZQ6-IWWABUEJqAJku0G4g_uOs2pl_8";

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": options.prefer || "",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${res.status} ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// DB row → 앱 객체 변환
function rowToItem(r) {
  return {
    id: r.id,
    receiptNumber: r.receipt_number,
    createdAt: r.created_at,
    title: r.title,
    content: r.content,
    category: r.category,
    type: r.type,
    urgency: r.urgency,
    preferredHandling: r.preferred_handling,
    allowFollowUp: r.allow_follow_up,
    contactName: r.contact_name || "",
    status: r.status,
    adminMemo: r.admin_memo || "",
    isCommitteeAgenda: r.is_committee_agenda,
    needsDepartmentReview: r.needs_department_review,
    anonymizedSummary: r.anonymized_summary || "",
    groupLabel: r.group_label || "",
  };
}

// 앱 객체 → DB row 변환
function itemToRow(item) {
  return {
    id: item.id,
    receipt_number: item.receiptNumber,
    title: item.title,
    content: item.content,
    category: item.category,
    type: item.type,
    urgency: item.urgency,
    preferred_handling: item.preferredHandling,
    allow_follow_up: item.allowFollowUp,
    contact_name: item.contactName || null,
    status: item.status,
    admin_memo: item.adminMemo || null,
    is_committee_agenda: item.isCommitteeAgenda,
    needs_department_review: item.needsDepartmentReview,
    anonymized_summary: item.anonymizedSummary || null,
    group_label: item.groupLabel || null,
  };
}

const CATEGORIES = [
  { label:"조직문화/소통", icon:"🏢" },
  { label:"업무방식/회의문화", icon:"💻" },
  { label:"인사/평가/보상", icon:"📊" },
  { label:"복리후생/안전", icon:"❤️" },
  { label:"제도/규정 개선", icon:"⚙️" },
  { label:"시설/공간 개선", icon:"🏗️" },
  { label:"고충/익명 제보", icon:"🔒" },
  { label:"칭찬/우수사례", icon:"🎉" },
  { label:"기타", icon:"📌" },
];

const TYPES = ["개선 제안","불편사항","질문","아이디어","칭찬/긍정 피드백","불만/반대 의견","기타"];
const URGENCIES = ["낮음","보통","높음","긴급"];

const PREFERRED_HANDLINGS = [
  "참고 의견으로만 접수",
  "필요 시 구성원협의회 안건 검토 가능",
  "비식별 요약 후 구성원 대상 공유 가능",
];

const STATUSES = [
  "신규 접수","참고 접수","유사 의견 누적 관찰","실무 확인 필요",
  "위원회 안건 후보","위원회 논의 예정","담당 부서 전달 필요",
  "비식별 요약 필요","조치 완료","보류","추가 확인 필요",
];

const URGENCY_COLORS = {
  낮음: { bg:"#e8f5e9", text:"#2e7d32", dot:"#4caf50" },
  보통: { bg:"#e3f2fd", text:"#1565c0", dot:"#2196f3" },
  높음: { bg:"#fff3e0", text:"#e65100", dot:"#ff9800" },
  긴급: { bg:"#fde8e8", text:"#b71c1c", dot:"#f44336" },
};

const STATUS_COLORS = {
  "신규 접수":"#4a90d9","참고 접수":"#78909c","유사 의견 누적 관찰":"#8d6e63",
  "실무 확인 필요":"#f59e0b","위원회 안건 후보":"#7c3aed","위원회 논의 예정":"#8b5cf6",
  "담당 부서 전달 필요":"#ec4899","비식별 요약 필요":"#0891b2",
  "조치 완료":"#10b981","보류":"#94a3b8","추가 확인 필요":"#ef4444",
};

const HANDLING_SHORT = {
  "참고 의견으로만 접수":"참고만",
  "필요 시 구성원협의회 안건 검토 가능":"안건 검토",
  "비식별 요약 후 구성원 대상 공유 가능":"비식별 공유",
};

// ─── 유틸 ───────────────────────────────────────────────────────────────────

function genReceiptNumber(count) {
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(4, "0");
  return `VOC-${year}-${seq}`;
}
function loadRead() { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]")); } catch { return new Set(); } }
function saveRead(s) { localStorage.setItem(READ_KEY, JSON.stringify([...s])); }
function formatDate(iso) {
  return new Date(iso).toLocaleDateString("ko-KR", { year:"numeric", month:"2-digit", day:"2-digit" });
}
function thisMonth(iso) {
  const now = new Date(), d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// ─── 전역 스타일 ─────────────────────────────────────────────────────────────

const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600&family=DM+Serif+Display&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Noto Sans KR',sans-serif;background:#f7f5f0;color:#2c2825;min-height:100vh}

    .card{background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,.07);padding:1.5rem}
    .card-sm{padding:1rem 1.25rem;border-radius:12px}

    input[type=text],input[type=password],textarea,select{
      width:100%;font-family:inherit;font-size:.9375rem;color:#2c2825;
      background:#fdfcfa;border:1.5px solid #e4e0d8;border-radius:10px;
      padding:.65rem .9rem;outline:none;transition:border-color .18s,box-shadow .18s;
      appearance:none;-webkit-appearance:none}
    input[type=text]:focus,input[type=password]:focus,textarea:focus,select:focus{
      border-color:#1a5caa;box-shadow:0 0 0 3px rgba(26,92,170,.13)}
    textarea{resize:vertical;min-height:130px;line-height:1.65}

    .btn{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;
      font-family:inherit;font-size:.9375rem;font-weight:500;padding:.65rem 1.4rem;
      border-radius:10px;border:none;cursor:pointer;transition:all .17s;white-space:nowrap}
    .btn-primary{background:#1a5caa;color:#fff}.btn-primary:hover{background:#14488a}
    .btn-secondary{background:transparent;color:#1a5caa;border:1.5px solid #c0d4ee}.btn-secondary:hover{background:#edf3fb}
    .btn-ghost{background:transparent;color:#8a7d6e;border:none;padding:.4rem .6rem}
    .btn-sm{font-size:.85rem;padding:.4rem .9rem;border-radius:8px}

    .field-label{display:block;font-size:.8125rem;font-weight:500;color:#6b6259;margin-bottom:.4rem;letter-spacing:.01em}
    .required::after{content:" *";color:#c0392b}

    /* 스텝 프로그레스 */
    .step-bar{display:flex;align-items:center;gap:0;margin-bottom:1.75rem}
    .step-item{display:flex;flex-direction:column;align-items:center;gap:.3rem;flex:1}
    .step-circle{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;
      justify-content:center;font-size:.8rem;font-weight:600;transition:all .25s}
    .step-circle.done{background:#1a5caa;color:#fff}
    .step-circle.active{background:#1a5caa;color:#fff;box-shadow:0 0 0 4px rgba(26,92,170,.2)}
    .step-circle.idle{background:#f0ece5;color:#a09080}
    .step-label{font-size:.72rem;color:#9e9689;text-align:center;white-space:nowrap}
    .step-label.active{color:#1a5caa;font-weight:500}
    .step-line{flex:1;height:2px;background:#e8e2d8;margin:0 -1px;margin-bottom:1.2rem;transition:background .25s}
    .step-line.done{background:#1a5caa}

    /* 카테고리 그리드 */
    .cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.5rem}
    .cat-card{display:flex;align-items:center;gap:.55rem;padding:.65rem .9rem;
      border:1.5px solid #e4e0d8;border-radius:10px;background:#fdfcfa;
      font-size:.875rem;color:#5a5048;cursor:pointer;transition:all .15s;user-select:none}
    .cat-card:hover{border-color:#1a5caa;background:#edf3fb}
    .cat-card.selected{border-color:#1a5caa;background:#1a5caa;color:#fff}
    .cat-icon{font-size:1.1rem;flex-shrink:0}

    /* 라디오 필 */
    .radio-group{display:flex;flex-wrap:wrap;gap:.5rem}
    .radio-pill{display:flex;align-items:center;gap:.35rem;padding:.45rem .85rem;
      border-radius:99px;border:1.5px solid #e4e0d8;background:#fdfcfa;
      font-size:.875rem;cursor:pointer;transition:all .15s;color:#5a5048;user-select:none}
    .radio-pill:hover{border-color:#1a5caa;background:#edf3fb}
    .radio-pill.selected{border-color:#1a5caa;background:#1a5caa;color:#fff}
    .radio-pill input{display:none}

    /* 배지 */
    .badge{display:inline-flex;align-items:center;gap:.3rem;font-size:.75rem;
      font-weight:500;padding:.2rem .6rem;border-radius:99px;white-space:nowrap}

    /* 체크박스 행 */
    .checkbox-row{display:flex;align-items:center;gap:.65rem;padding:.9rem 1rem;
      background:#faf8f5;border:1.5px solid #e8e2d8;border-radius:10px;
      cursor:pointer;transition:border-color .15s}
    .checkbox-row:hover{border-color:#1a5caa}
    .checkbox-row input[type=checkbox]{width:18px;height:18px;flex-shrink:0;accent-color:#1a5caa;cursor:pointer}
    .checkbox-label{font-size:.9rem;color:#4a3e33;line-height:1.55}

    /* 확인 화면 카드 */
    .confirm-row{display:flex;flex-direction:column;gap:.2rem;padding:.75rem 0;border-bottom:1px solid #f0ece5}
    .confirm-row:last-child{border-bottom:none}
    .confirm-key{font-size:.75rem;font-weight:500;color:#9e9689;letter-spacing:.04em}
    .confirm-val{font-size:.9375rem;color:#2c2825;line-height:1.55}

    /* 긴급 배너 */
    .urgent-banner{background:linear-gradient(90deg,#fde8e8,#fff5f5);
      border:1.5px solid #f5c6c6;border-radius:12px;padding:.85rem 1.1rem;
      display:flex;align-items:center;gap:.75rem;margin-bottom:1rem}
    .urgent-banner-dot{width:10px;height:10px;border-radius:50%;background:#f44336;
      flex-shrink:0;animation:pulse 1.5s infinite}
    @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.3)}}

    /* 읽음 표시 */
    tr.unread td:first-child{border-left:3px solid #1a5caa}
    tr.unread{background:#fafcff}
    tr.urgent-row td:first-child{border-left:3px solid #f44336!important}
    .unread-dot{width:7px;height:7px;border-radius:50%;background:#1a5caa;display:inline-block;margin-right:5px;flex-shrink:0}

    /* 네비바 */
    .navbar{background:#fff;border-bottom:1px solid rgba(0,0,0,.07);padding:.9rem 1.5rem;
      display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
    .logo{font-family:'DM Serif Display',serif;font-size:1.3rem;letter-spacing:-.01em}
    .logo .aju{color:#1a5caa;font-weight:700}
    .logo .open{color:#3a2e22}
    .logo .voice{color:#b89c7a}

    /* 페이지 */
    .page{max-width:680px;margin:0 auto;padding:2rem 1rem 4rem}
    .page-wide{max-width:1100px;margin:0 auto;padding:2rem 1rem 4rem}

    /* 히어로 */
    .hero-box{background:linear-gradient(135deg,#eef4fc 0%,#f5ede0 100%);
      border:1px solid #c8dbf0;border-radius:16px;padding:1.75rem 1.5rem;margin-bottom:1.5rem}
    .hero-title{font-family:'DM Serif Display',serif;font-size:1.5rem;color:#3a2e22;margin-bottom:.5rem}
    .hero-sub{font-size:.9rem;color:#7a6a5a;line-height:1.65}
    .info-chips{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1rem}
    .info-chip{display:inline-flex;align-items:center;gap:.3rem;font-size:.78rem;color:#1a4a80;
      background:rgba(255,255,255,.85);border:1px solid #b8d0ec;border-radius:99px;padding:.25rem .7rem}

    /* 폼 */
    .form-section{display:flex;flex-direction:column;gap:1.25rem}
    .field{display:flex;flex-direction:column}
    .urgency-note{font-size:.8rem;color:#c0392b;margin-top:.45rem;padding:.4rem .75rem;background:#fde8e8;border-radius:8px}

    /* 통계 */
    .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin-bottom:1.5rem}
    .stat-card{background:#fff;border:1px solid rgba(0,0,0,.07);border-radius:12px;padding:1rem 1.1rem}
    .stat-label{font-size:.78rem;color:#8a7d6e;margin-bottom:.25rem}
    .stat-value{font-size:1.75rem;font-weight:600;color:#3a2e22}
    .stat-value.urgent{color:#c0392b}

    /* 필터 */
    .filter-bar{display:flex;flex-wrap:wrap;gap:.6rem;background:#fff;
      border:1px solid rgba(0,0,0,.07);border-radius:12px;padding:.9rem 1rem;margin-bottom:1rem}
    .filter-select{font-size:.84rem;padding:.35rem .6rem;border-radius:7px;
      border:1px solid #e0d9cf;background:#fdfcfa;color:#4a3e33;cursor:pointer;min-width:110px}
    .search-input{flex:1;min-width:160px;font-size:.84rem;padding:.35rem .75rem;
      border-radius:7px;border:1px solid #e0d9cf;background:#fdfcfa}

    /* 테이블 */
    .table-wrap{overflow-x:auto}
    table{width:100%;border-collapse:collapse;font-size:.875rem}
    th{text-align:left;font-size:.78rem;font-weight:500;color:#8a7d6e;
      padding:.6rem .75rem;border-bottom:1.5px solid #ede8df;white-space:nowrap}
    td{padding:.7rem .75rem;border-bottom:1px solid #f0ece5;color:#3a2e22;vertical-align:middle}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:#f5f9ff;cursor:pointer}

    /* 모바일 카드 목록 */
    .mobile-list{display:none;flex-direction:column;gap:.6rem}
    .mobile-card{background:#fff;border:1px solid rgba(0,0,0,.07);border-radius:12px;
      padding:1rem 1.1rem;cursor:pointer;transition:box-shadow .15s;position:relative;overflow:hidden}
    .mobile-card:hover{box-shadow:0 2px 12px rgba(0,0,0,.08)}
    .mobile-card.unread{border-left:3px solid #1a5caa}
    .mobile-card.urgent-card{border-left:3px solid #f44336!important}
    .mobile-card-header{display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;margin-bottom:.5rem}
    .mobile-card-title{font-weight:500;font-size:.9375rem;color:#2c2825;line-height:1.4;flex:1}
    .mobile-card-meta{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.4rem}

    @media(max-width:700px){
      .table-wrap table{display:none}
      .mobile-list{display:flex}
      .page{padding:1rem .75rem 3rem}
      .page-wide{padding:1rem .75rem 3rem}
      .hero-title{font-size:1.25rem}
      .cat-grid{grid-template-columns:repeat(2,1fr)}
      .detail-panel{width:100vw}
      .stats-grid{grid-template-columns:repeat(2,1fr)}
    }

    /* 상세 패널 */
    .detail-panel{position:fixed;right:0;top:0;bottom:0;width:min(520px,100vw);
      background:#fff;box-shadow:-4px 0 24px rgba(0,0,0,.1);z-index:200;overflow-y:auto;display:flex;flex-direction:column}
    .detail-header{padding:1.25rem 1.5rem;border-bottom:1px solid #ede8df;
      display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:#fff;z-index:1}
    .detail-body{padding:1.5rem;flex:1;display:flex;flex-direction:column;gap:1.1rem}
    .detail-row{display:flex;flex-direction:column;gap:.3rem}
    .detail-key{font-size:.78rem;font-weight:500;color:#8a7d6e;text-transform:uppercase;letter-spacing:.04em}
    .detail-val{font-size:.9375rem;color:#2c2825;line-height:1.6}

    /* 미니바 */
    .mini-bar{display:flex;flex-direction:column;gap:.45rem}
    .bar-row{display:flex;align-items:center;gap:.6rem;font-size:.82rem}
    .bar-label{width:110px;text-align:right;color:#6b6259;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .bar-track{flex:1;height:8px;background:#f0ece5;border-radius:99px;overflow:hidden}
    .bar-fill{height:100%;border-radius:99px;transition:width .4s ease}
    .bar-count{width:24px;text-align:right;color:#3a2e22;font-weight:500}

    /* 그룹 묶음 */
    .group-section{margin-bottom:1rem}
    .group-header{display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;
      background:#edf3fb;border-radius:8px;margin-bottom:.4rem;cursor:pointer;user-select:none}
    .group-label-text{font-size:.85rem;font-weight:600;color:#1a5caa;flex:1}
    .group-count{font-size:.78rem;color:#1a5caa;background:#c8ddf5;
      border-radius:99px;padding:.1rem .55rem}

    /* 오버레이 */
    .overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:150}

    /* 탭 */
    .tabs{display:flex;gap:.25rem;border-bottom:1.5px solid #ede8df;margin-bottom:1.25rem}
    .tab{padding:.55rem 1.1rem;font-size:.875rem;font-weight:500;color:#8a7d6e;
      cursor:pointer;border-bottom:2.5px solid transparent;margin-bottom:-1.5px;transition:all .15s}
    .tab.active{color:#1a5caa;border-color:#1a5caa}

    /* Empty state */
    .empty-state{text-align:center;padding:3.5rem 2rem;color:#9e9689}
    .empty-icon{font-size:3rem;margin-bottom:.75rem;opacity:.5}
    .empty-title{font-size:1rem;font-weight:500;color:#6b6259;margin-bottom:.35rem}
    .empty-desc{font-size:.875rem;line-height:1.6}

    /* 접수 완료 */
    .success-icon{width:72px;height:72px;border-radius:50%;background:#e3edf8;
      display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;font-size:2rem}
    .receipt-pill{display:inline-block;background:#edf3fb;border:1.5px dashed #7aaee0;
      border-radius:10px;padding:.5rem 1.25rem;font-size:1.1rem;font-weight:600;
      color:#1a5caa;letter-spacing:.08em;margin:1rem 0}

    /* 애니메이션 */
    @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    .fade-up{animation:fadeUp .35s ease both}
    @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
    .slide-in{animation:slideIn .28s cubic-bezier(.25,.8,.25,1) both}
  `}</style>
);

// ─── 공통 컴포넌트 ────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="logo">
      <span className="aju">AJU</span>{" "}
      <span className="open">Open</span>{" "}
      <span className="voice">Voice</span>
    </div>
  );
}

function Navbar({ page, onNav }) {
  return (
    <nav className="navbar">
      <Logo />
      <div style={{ display:"flex", gap:".5rem" }}>
        {page !== "submit" && page !== "admin-login" && (
          <button className="btn btn-secondary btn-sm" onClick={() => onNav("submit")}>의견 제출하기</button>
        )}
        {page === "admin" && (
          <button className="btn btn-secondary btn-sm" onClick={() => onNav("submit")}>로그아웃</button>
        )}
      </div>
    </nav>
  );
}

// 관리자 접근용 푸터 링크 (구성원 화면 하단에만 표시)
function AdminFooterLink({ onNav }) {
  return (
    <div style={{ textAlign:"center", padding:"2rem 0 1rem", marginTop:"1rem" }}>
      <button
        onClick={() => onNav("admin-login")}
        style={{ background:"none", border:"none", cursor:"pointer", fontSize:".75rem", color:"#c4bdb4", textDecoration:"none" }}
      >
        관리자 로그인
      </button>
    </div>
  );
}

function RadioPill({ name, value, selected, onChange, children }) {
  return (
    <label className={`radio-pill${selected ? " selected" : ""}`}>
      <input type="radio" name={name} value={value} checked={selected} onChange={() => onChange(value)} />
      {children}
    </label>
  );
}

function MiniBar({ data, color }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="mini-bar">
      {data.map(d => (
        <div key={d.label} className="bar-row">
          <div className="bar-label" title={d.label}>{d.label}</div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width:`${(d.count/max)*100}%`, background:color }} />
          </div>
          <div className="bar-count">{d.count}</div>
        </div>
      ))}
    </div>
  );
}

// ─── 스텝 프로그레스 바 ──────────────────────────────────────────────────────

function StepBar({ step }) {
  const steps = ["의견 작성", "분류 선택", "처리 방식"];
  return (
    <div className="step-bar">
      {steps.map((label, i) => {
        const idx = i + 1;
        const isDone = step > idx;
        const isActive = step === idx;
        return (
          <>
            <div key={label} className="step-item">
              <div className={`step-circle ${isDone ? "done" : isActive ? "active" : "idle"}`}>
                {isDone ? "✓" : idx}
              </div>
              <div className={`step-label ${isActive ? "active" : ""}`}>{label}</div>
            </div>
            {i < steps.length - 1 && (
              <div className={`step-line ${isDone ? "done" : ""}`} />
            )}
          </>
        );
      })}
    </div>
  );
}

// ─── 스텝 1: 의견 작성 ───────────────────────────────────────────────────────

function Step1({ form, setField, errors }) {
  return (
    <div className="form-section fade-up">
      <div className="field">
        <label className="field-label required">의견 제목</label>
        <input
          type="text"
          placeholder="의견의 핵심을 짧게 적어주세요."
          value={form.title}
          onChange={e => setField("title", e.target.value)}
        />
        {errors.title && <p style={{ fontSize:".8rem",color:"#c0392b",marginTop:".3rem" }}>{errors.title}</p>}
      </div>
      <div className="field">
        <label className="field-label required">의견 내용</label>
        <textarea
          placeholder="불편했던 점, 개선 아이디어, 제안하고 싶은 내용을 자유롭게 작성해주세요."
          value={form.content}
          onChange={e => setField("content", e.target.value)}
        />
        {errors.content && <p style={{ fontSize:".8rem",color:"#c0392b",marginTop:".3rem" }}>{errors.content}</p>}
      </div>
    </div>
  );
}

// ─── 스텝 2: 분류 선택 ───────────────────────────────────────────────────────

function Step2({ form, setField, errors }) {
  return (
    <div className="form-section fade-up">
      <div className="field">
        <label className="field-label required" style={{ marginBottom:".7rem" }}>카테고리</label>
        <div className="cat-grid">
          {CATEGORIES.map(c => (
            <div
              key={c.label}
              className={`cat-card${form.category === c.label ? " selected" : ""}`}
              onClick={() => setField("category", c.label)}
            >
              <span className="cat-icon">{c.icon}</span>
              <span>{c.label}</span>
            </div>
          ))}
        </div>
        {errors.category && <p style={{ fontSize:".8rem",color:"#c0392b",marginTop:".4rem" }}>{errors.category}</p>}
      </div>

      <div className="field">
        <label className="field-label required">의견 유형</label>
        <div className="radio-group">
          {TYPES.map(t => (
            <RadioPill key={t} name="type" value={t} selected={form.type === t} onChange={v => setField("type", v)}>
              {t}
            </RadioPill>
          ))}
        </div>
        {errors.type && <p style={{ fontSize:".8rem",color:"#c0392b",marginTop:".3rem" }}>{errors.type}</p>}
      </div>

      <div className="field">
        <label className="field-label required">긴급도</label>
        <div className="radio-group">
          {URGENCIES.map(u => (
            <RadioPill key={u} name="urgency" value={u} selected={form.urgency === u} onChange={v => setField("urgency", v)}>
              {u}
            </RadioPill>
          ))}
        </div>
        {form.urgency === "긴급" && (
          <div className="urgency-note">⚠️ 긴급은 안전, 심각한 갈등, 즉시 조치가 필요한 사안에만 선택해주세요.</div>
        )}
        {errors.urgency && <p style={{ fontSize:".8rem",color:"#c0392b",marginTop:".3rem" }}>{errors.urgency}</p>}
      </div>
    </div>
  );
}

// ─── 스텝 3: 희망 처리 방식 ──────────────────────────────────────────────────

function Step3({ form, setField, errors }) {
  return (
    <div className="form-section fade-up">
      <div className="field">
        <label className="field-label required">희망 처리 방식</label>
        <div style={{ display:"flex", flexDirection:"column", gap:".45rem", marginTop:".2rem" }}>
          {PREFERRED_HANDLINGS.map(s => (
            <label key={s} className="checkbox-row">
              <input
                type="radio" name="ph" value={s}
                checked={form.preferredHandling === s}
                onChange={() => setField("preferredHandling", s)}
                style={{ width:18,height:18,accentColor:"#1a5caa",flexShrink:0 }}
              />
              <span className="checkbox-label">{s}</span>
            </label>
          ))}
        </div>
        {errors.preferredHandling && <p style={{ fontSize:".8rem",color:"#c0392b",marginTop:".3rem" }}>{errors.preferredHandling}</p>}
        <p style={{ fontSize:".8rem",color:"#9e9689",marginTop:".7rem",lineHeight:1.65 }}>
          선택해주신 방식은 의견을 살펴볼 때 참고하겠습니다. 모든 의견이 바로 안건으로 올라가지는 않지만, 반복되거나 함께 논의가 필요한 내용은 비식별 처리 후 안건 후보로 검토될 수 있습니다.
        </p>
      </div>

      {/* 후속 확인 - 모든 내용 입력 후 마지막에 선택 */}
      <div className="field">
        <label className="field-label" style={{ marginBottom:".5rem" }}>후속 확인 (선택)</label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.allowFollowUp}
            onChange={e => setField("allowFollowUp", e.target.checked)}
          />
          <span className="checkbox-label">
            이 의견에 대해 추가 설명이 필요한 경우 이름을 남기겠습니다.
          </span>
        </label>
        {form.allowFollowUp && (
          <div style={{ marginTop:".75rem" }}>
            <input
              type="text"
              placeholder="이름을 입력해주세요."
              value={form.contactName}
              onChange={e => setField("contactName", e.target.value)}
            />
            <p style={{ fontSize:".8rem",color:"#8a7d6e",marginTop:".35rem" }}>
              이름을 남기지 않아도 의견 제출에는 영향이 없습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 스텝 4: 제출 전 확인 ────────────────────────────────────────────────────

function StepConfirm({ form }) {
  const cat = CATEGORIES.find(c => c.label === form.category);
  const rows = [
    { key:"의견 제목", val: form.title },
    { key:"의견 내용", val: form.content, long: true },
    { key:"카테고리", val: cat ? `${cat.icon} ${cat.label}` : form.category },
    { key:"의견 유형", val: form.type },
    { key:"긴급도", val: form.urgency },
    { key:"희망 처리 방식", val: form.preferredHandling },
    { key:"후속 확인", val: form.allowFollowUp ? `가능 ${form.contactName ? `(${form.contactName})` : ""}` : "미선택" },
  ];
  return (
    <div className="fade-up">
      <div style={{ background:"#edf3fb",borderRadius:12,padding:".85rem 1.1rem",marginBottom:"1rem",fontSize:".875rem",color:"#1a4a80" }}>
        📋 아래 내용으로 의견을 제출합니다. 제출 후에는 수정이 어려우니 한 번 더 확인해주세요.
      </div>
      <div className="card">
        {rows.map(r => (
          <div key={r.key} className="confirm-row">
            <div className="confirm-key">{r.key}</div>
            <div className="confirm-val" style={r.long ? { whiteSpace:"pre-wrap",maxHeight:120,overflowY:"auto" } : {}}>
              {r.val || "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 의견 제출 폼 (스텝 관리) ────────────────────────────────────────────────

function SubmitPage({ onSubmit }) {
  const [step, setStep] = useState(1); // 1~3 입력, 4 확인
  const [form, setForm] = useState({
    title:"", content:"", category:"", type:"", urgency:"",
    preferredHandling:"", allowFollowUp:false, contactName:"",
  });
  const [errors, setErrors] = useState({});

  function setField(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function validateStep(s) {
    const e = {};
    if (s === 1) {
      if (!form.title.trim()) e.title = "제목을 입력해주세요.";
      if (!form.content.trim()) e.content = "의견 내용을 입력해주세요.";
    }
    if (s === 2) {
      if (!form.category) e.category = "카테고리를 선택해주세요.";
      if (!form.type) e.type = "의견 유형을 선택해주세요.";
      if (!form.urgency) e.urgency = "긴급도를 선택해주세요.";
    }
    if (s === 3) {
      if (!form.preferredHandling) e.preferredHandling = "희망 처리 방식을 선택해주세요.";
    }
    return e;
  }

  function next() {
    const e = validateStep(step);
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setStep(s => s + 1);
    window.scrollTo(0, 0);
  }

  function prev() {
    setErrors({});
    setStep(s => s - 1);
    window.scrollTo(0, 0);
  }

  function handleSubmit() { onSubmit(form); }

  const totalSteps = 3;
  const isConfirm = step === 4;

  return (
    <div className="page">
      {/* 히어로 - 스텝 1에만 표시 */}
      {step === 1 && (
        <div className="hero-box fade-up">
          <div className="hero-title">구성원의 목소리를 더 잘 듣기 위한 익명 의견함입니다.</div>
          <div className="hero-sub">
            업무 환경, 조직문화, 제도 개선, 복지, 커뮤니케이션 등 자유롭게 의견을 남겨주세요.
          </div>
          <div className="info-chips">
            <span className="info-chip">🔒 이름·이메일·사번을 수집하지 않습니다</span>
            <span className="info-chip">📋 구성원협의회 위원만 열람 가능합니다</span>
            <span className="info-chip">⚠️ 특정 개인 식별·비방 내용은 비식별 처리될 수 있습니다</span>
          </div>
        </div>
      )}

      <div className="card">
        {/* 스텝 바 (확인 화면 제외) */}
        {!isConfirm && <StepBar step={step} />}
        {isConfirm && (
          <div style={{ marginBottom:"1.25rem" }}>
            <div style={{ fontSize:"1rem",fontWeight:600,color:"#3a2e22" }}>✅ 제출 전 최종 확인</div>
          </div>
        )}

        {/* 스텝 콘텐츠 */}
        {step === 1 && <Step1 form={form} setField={setField} errors={errors} />}
        {step === 2 && <Step2 form={form} setField={setField} errors={errors} />}
        {step === 3 && <Step3 form={form} setField={setField} errors={errors} />}
        {isConfirm && <StepConfirm form={form} />}

        {/* 버튼 영역 */}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"1.5rem",paddingTop:"1.25rem",borderTop:"1px solid #ede8df" }}>
          {step > 1 ? (
            <button className="btn btn-secondary" onClick={prev}>← {isConfirm ? "수정하기" : "이전"}</button>
          ) : <div />}

          {!isConfirm && step < totalSteps && (
            <button className="btn btn-primary" onClick={next}>다음 →</button>
          )}
          {!isConfirm && step === totalSteps && (
            <button className="btn btn-primary" onClick={next}>내용 확인하기 →</button>
          )}
          {isConfirm && (
            <button className="btn btn-primary" style={{ padding:".75rem 2rem" }} onClick={handleSubmit}>
              제출하기 ✓
            </button>
          )}
        </div>

        {!isConfirm && (
          <p style={{ textAlign:"center",fontSize:".78rem",color:"#9e9689",marginTop:".75rem" }}>
            연락 정보를 남기지 않아도 의견 제출에는 영향이 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── 제출 완료 ────────────────────────────────────────────────────────────────

function SuccessPage({ receiptNumber, onReset }) {
  return (
    <div className="page fade-up">
      <div className="card" style={{ textAlign:"center",padding:"3rem 2rem" }}>
        <div className="success-icon">✅</div>
        <h2 style={{ fontSize:"1.3rem",fontWeight:600,color:"#3a2e22",marginBottom:".5rem" }}>의견이 접수되었습니다.</h2>
        <p style={{ color:"#7a6a5a",fontSize:".9375rem",lineHeight:1.65,marginBottom:".5rem" }}>
          접수된 의견은 구성원협의회 위원이 확인하며,<br />
          의견의 성격에 따라 적절한 방식으로 검토됩니다.
        </p>
        <div className="receipt-pill">{receiptNumber}</div>
        <p style={{ fontSize:".8rem",color:"#8a7d6e",marginBottom:"1.75rem",display:"flex",alignItems:"center",justifyContent:"center",gap:".3rem" }}>
          📸 이 화면을 캡처하거나 번호를 메모해두세요.
        </p>
        <p style={{ fontWeight:500,color:"#1a5caa",fontSize:"1rem",marginBottom:"1.5rem" }}>소중한 의견 감사합니다. 💛</p>
        <button className="btn btn-secondary" onClick={onReset}>새 의견 제출하기</button>
      </div>
    </div>
  );
}

// ─── 관리자 로그인 ────────────────────────────────────────────────────────────

function AdminLogin({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  function tryLogin() { pw === ADMIN_PASSWORD ? onLogin() : setErr(true); }
  return (
    <div style={{ maxWidth:400,margin:"5rem auto",padding:"0 1rem" }} className="fade-up">
      <div className="card">
        <div style={{ textAlign:"center",marginBottom:"1.5rem" }}>
          <Logo />
          <p style={{ fontSize:".875rem",color:"#8a7d6e",marginTop:".5rem" }}>위원 전용 대시보드입니다.</p>
        </div>
        <div className="field">
          <label className="field-label">비밀번호</label>
          <input
            type="password" placeholder="비밀번호를 입력해주세요."
            value={pw} onChange={e => { setPw(e.target.value); setErr(false); }}
            onKeyDown={e => e.key === "Enter" && tryLogin()}
          />
          {err && <p style={{ fontSize:".8rem",color:"#c0392b",marginTop:".3rem" }}>비밀번호가 올바르지 않습니다.</p>}
        </div>
        <button className="btn btn-primary" style={{ width:"100%",marginTop:"1rem" }} onClick={tryLogin}>로그인</button>
      </div>
    </div>
  );
}

// ─── 상세 패널 ────────────────────────────────────────────────────────────────

function DetailPanel({ item, onClose, onUpdate, onDelete }) {
  const [status, setStatus] = useState(item.status);
  const [memo, setMemo] = useState(item.adminMemo || "");
  const [isAgenda, setIsAgenda] = useState(item.isCommitteeAgenda || false);
  const [needsDept, setNeedsDept] = useState(item.needsDepartmentReview || false);
  const [anon, setAnon] = useState(item.anonymizedSummary || "");
  const [groupLabel, setGroupLabel] = useState(item.groupLabel || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function save() {
    onUpdate({ ...item, status, adminMemo:memo, isCommitteeAgenda:isAgenda, needsDepartmentReview:needsDept, anonymizedSummary:anon, groupLabel });
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    onDelete(item.id);
  }

  const urg = URGENCY_COLORS[item.urgency] || {};
  const cat = CATEGORIES.find(c => c.label === item.category);

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="detail-panel slide-in">
        <div className="detail-header">
          <div>
            <div style={{ fontSize:".78rem",color:"#8a7d6e" }}>{item.receiptNumber} · {formatDate(item.createdAt)}</div>
            <div style={{ fontWeight:600,fontSize:"1rem",color:"#3a2e22",marginTop:".15rem" }}>{item.title}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>닫기</button>
        </div>

        <div className="detail-body">
          <div style={{ display:"flex",flexWrap:"wrap",gap:".5rem" }}>
            <span className="badge" style={{ background:urg.bg,color:urg.text }}>
              <span style={{ width:6,height:6,borderRadius:"50%",background:urg.dot,display:"inline-block" }} />
              {item.urgency}
            </span>
            {cat && <span className="badge" style={{ background:"#f0f0f0",color:"#4a4a4a" }}>{cat.icon} {item.category}</span>}
            <span className="badge" style={{ background:"#f0f0f0",color:"#4a4a4a" }}>{item.type}</span>
            <span className="badge" style={{ background:(STATUS_COLORS[item.status]||"#888")+"22",color:STATUS_COLORS[item.status]||"#888" }}>
              {item.status}
            </span>
          </div>

          <div className="detail-row">
            <div className="detail-key">의견 내용</div>
            <div className="detail-val" style={{ background:"#faf8f5",border:"1px solid #ede8df",borderRadius:10,padding:".9rem",whiteSpace:"pre-wrap" }}>
              {item.content}
            </div>
          </div>

          <div className="detail-row">
            <div className="detail-key">희망 처리 방식</div>
            <div className="detail-val">{item.preferredHandling || "—"}</div>
          </div>

          <div className="detail-row">
            <div className="detail-key">후속 확인</div>
            <div className="detail-val">{item.allowFollowUp ? `가능 ${item.contactName ? `· ${item.contactName}` : ""}` : "불가"}</div>
          </div>

          <div className="detail-row">
            <div className="detail-key">처리 상태 변경</div>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ display:"flex",flexDirection:"column",gap:".5rem" }}>
            <label className="checkbox-row">
              <input type="checkbox" checked={isAgenda} onChange={e => setIsAgenda(e.target.checked)} />
              <span className="checkbox-label">위원회 안건 후보로 지정</span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={needsDept} onChange={e => setNeedsDept(e.target.checked)} />
              <span className="checkbox-label">담당 부서 전달 필요</span>
            </label>
          </div>

          <div className="detail-row">
            <div className="detail-key">이슈 그룹 라벨</div>
            <input type="text" placeholder="예: 회의 운영 개선" value={groupLabel} onChange={e => setGroupLabel(e.target.value)} />
            <p style={{ fontSize:".78rem",color:"#9e9689",marginTop:".35rem" }}>
              같은 라벨을 붙인 의견끼리 대시보드에서 자동으로 묶입니다.
            </p>
          </div>

          <div className="detail-row">
            <div className="detail-key">관리자 메모 (위원만 열람)</div>
            <textarea style={{ minHeight:80 }} placeholder="예: 다음 정기회의 안건으로 검토 필요" value={memo} onChange={e => setMemo(e.target.value)} />
          </div>

          <div className="detail-row">
            <div className="detail-key">비식별 요약본</div>
            <textarea style={{ minHeight:70 }} placeholder="위원회 공유나 구성원 공지를 위한 비식별 요약" value={anon} onChange={e => setAnon(e.target.value)} />
          </div>

          <button className="btn btn-primary" onClick={save} style={{ width:"100%" }}>저장하기</button>

          {/* 삭제 버튼 - 2단계 확인 */}
          <div style={{ borderTop:"1px solid #f0ece5", paddingTop:"1rem", marginTop:".25rem" }}>
            {!confirmDelete ? (
              <button
                className="btn btn-sm"
                onClick={handleDelete}
                style={{ background:"transparent", color:"#c0392b", border:"1px solid #e8c4c0", width:"100%", fontSize:".85rem" }}
              >
                🗑 이 의견 삭제
              </button>
            ) : (
              <div style={{ background:"#fde8e8", borderRadius:10, padding:".9rem 1rem" }}>
                <p style={{ fontSize:".875rem", color:"#b71c1c", marginBottom:".65rem", fontWeight:500 }}>
                  정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                </p>
                <div style={{ display:"flex", gap:".5rem" }}>
                  <button
                    className="btn btn-sm"
                    onClick={handleDelete}
                    style={{ background:"#c0392b", color:"#fff", flex:1 }}
                  >
                    삭제 확인
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setConfirmDelete(false)}
                    style={{ flex:1 }}
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── 관리자 대시보드 ──────────────────────────────────────────────────────────

function AdminDashboard({ submissions, loading, readIds, onUpdate, onMarkRead, onDelete, onRefresh }) {
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("list");
  const [filters, setFilters] = useState({
    period:"", category:"", type:"", urgency:"", status:"", handling:"", keyword:"", unreadOnly:false,
  });
  const [expandedGroups, setExpandedGroups] = useState({});

  function setFilter(key, val) { setFilters(f => ({ ...f, [key]: val })); }

  function openItem(item) {
    setSelected(item);
    onMarkRead(item.id);
  }

  // 필터 적용
  const filtered = useMemo(() => {
    let data = [...submissions].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (filters.category) data = data.filter(d => d.category === filters.category);
    if (filters.type) data = data.filter(d => d.type === filters.type);
    if (filters.urgency) data = data.filter(d => d.urgency === filters.urgency);
    if (filters.status) data = data.filter(d => d.status === filters.status);
    if (filters.handling) data = data.filter(d => d.preferredHandling === filters.handling);
    if (filters.unreadOnly) data = data.filter(d => !readIds.has(d.id));
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      data = data.filter(d => d.title.toLowerCase().includes(kw) || d.content.toLowerCase().includes(kw));
    }
    if (filters.period === "thisMonth") data = data.filter(d => thisMonth(d.createdAt));
    if (filters.period === "urgent") data = data.filter(d => d.urgency === "긴급");
    return data;
  }, [submissions, filters, readIds]);

  // 통계
  const total = submissions.length;
  const monthCount = submissions.filter(d => thisMonth(d.createdAt)).length;
  const newCount = submissions.filter(d => d.status === "신규 접수").length;
  const agendaCount = submissions.filter(d => d.status === "위원회 안건 후보").length;
  const doneCount = submissions.filter(d => d.status === "조치 완료").length;
  const urgentCount = submissions.filter(d => d.urgency === "긴급").length;
  const unreadCount = submissions.filter(d => !readIds.has(d.id)).length;

  // 차트 데이터
  const byCategory = CATEGORIES.map(c => ({ label:`${c.icon} ${c.label}`, count: submissions.filter(d => d.category === c.label).length }))
    .filter(d => d.count > 0).sort((a,b) => b.count - a.count);
  const byUrgency = URGENCIES.map(u => ({ label:u, count: submissions.filter(d => d.urgency === u).length }));
  const byStatus = STATUSES.map(s => ({ label:s, count: submissions.filter(d => d.status === s).length })).filter(d => d.count > 0);

  // 안건 후보
  const agendaItems = submissions.filter(d => d.isCommitteeAgenda);

  // 그룹 묶음 - 라벨 있는 것만
  const groups = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const key = item.groupLabel?.trim() || "__none";
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [filtered]);

  const hasGroups = Object.keys(groups).some(k => k !== "__none" && groups[k].length > 1);

  function handleUpdate(updated) {
    onUpdate(updated);
    setSelected(updated);
  }

  function handleDelete(id) {
    onDelete(id);
    setSelected(null);
  }

  function toggleGroup(label) {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  }

  // 긴급 의견 알림 배너
  const urgentNew = submissions.filter(d => d.urgency === "긴급" && !readIds.has(d.id));

  const resetFilters = () => setFilters({ period:"", category:"", type:"", urgency:"", status:"", handling:"", keyword:"", unreadOnly:false });

  return (
    <div className="page-wide fade-up">
      <div style={{ marginBottom:"1.25rem",display:"flex",alignItems:"flex-start",justifyContent:"space-between" }}>
        <div>
          <h1 style={{ fontSize:"1.4rem",fontWeight:600,color:"#3a2e22" }}>관리자 대시보드</h1>
          <p style={{ fontSize:".875rem",color:"#8a7d6e",marginTop:".2rem" }}>구성원협의회 위원 전용 의견 관리 화면입니다.</p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onRefresh}
          disabled={loading}
          style={{ marginTop:".25rem", display:"flex", alignItems:"center", gap:".3rem" }}
        >
          {loading ? "⏳" : "🔄"} {loading ? "불러오는 중..." : "새로고침"}
        </button>
      </div>

      {/* 긴급 알림 배너 */}
      {urgentNew.length > 0 && (
        <div className="urgent-banner">
          <div className="urgent-banner-dot" />
          <div>
            <div style={{ fontWeight:600,color:"#b71c1c",fontSize:".9rem" }}>
              긴급 의견 {urgentNew.length}건 미확인
            </div>
            <div style={{ fontSize:".8rem",color:"#c0392b",marginTop:".15rem" }}>
              {urgentNew.map(u => u.title).join(" · ")}
            </div>
          </div>
          <button className="btn btn-sm" style={{ background:"#f44336",color:"#fff",marginLeft:"auto" }}
            onClick={() => { setFilter("urgency","긴급"); setFilter("unreadOnly",true); setTab("list"); }}>
            바로 확인
          </button>
        </div>
      )}

      {/* 요약 카드 */}
      <div className="stats-grid">
        {[
          { label:"전체 접수", val:total },
          { label:"이번 달", val:monthCount },
          { label:"신규 접수", val:newCount },
          { label:"안건 후보", val:agendaCount },
          { label:"조치 완료", val:doneCount },
          { label:"긴급", val:urgentCount, cls:urgentCount>0?"urgent":"" },
          { label:"안 읽음", val:unreadCount, cls:unreadCount>0?"":"" },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.cls||""}`}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="tabs">
        {[["list","의견 목록"],["group","그룹 묶음"],["charts","통계"],["agenda","안건 후보"]].map(([key,label]) => (
          <div key={key} className={`tab${tab===key?" active":""}`} onClick={() => setTab(key)}>
            {label}
            {key==="agenda" && agendaItems.length>0 && (
              <span style={{ marginLeft:4,background:"#1a5caa",color:"#fff",borderRadius:99,fontSize:".7rem",padding:"1px 6px" }}>
                {agendaItems.length}
              </span>
            )}
            {key==="list" && unreadCount>0 && (
              <span style={{ marginLeft:4,background:"#ef4444",color:"#fff",borderRadius:99,fontSize:".7rem",padding:"1px 6px" }}>
                {unreadCount}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ── 목록 탭 ── */}
      {tab === "list" && (
        <>
          <div className="filter-bar">
            <input className="search-input" placeholder="🔍 제목·내용 검색"
              value={filters.keyword} onChange={e => setFilter("keyword", e.target.value)} />
            <select className="filter-select" value={filters.period} onChange={e => setFilter("period", e.target.value)}>
              <option value="">전체 기간</option>
              <option value="thisMonth">이번 달</option>
              <option value="urgent">긴급만</option>
            </select>
            <select className="filter-select" value={filters.category} onChange={e => setFilter("category", e.target.value)}>
              <option value="">카테고리</option>
              {CATEGORIES.map(c => <option key={c.label}>{c.label}</option>)}
            </select>
            <select className="filter-select" value={filters.urgency} onChange={e => setFilter("urgency", e.target.value)}>
              <option value="">긴급도</option>
              {URGENCIES.map(u => <option key={u}>{u}</option>)}
            </select>
            <select className="filter-select" value={filters.status} onChange={e => setFilter("status", e.target.value)}>
              <option value="">처리 상태</option>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="filter-select" value={filters.handling} onChange={e => setFilter("handling", e.target.value)}>
              <option value="">희망 처리 방식</option>
              {PREFERRED_HANDLINGS.map(h => <option key={h}>{h}</option>)}
            </select>
            <label style={{ display:"flex",alignItems:"center",gap:".4rem",fontSize:".84rem",color:"#4a3e33",cursor:"pointer",whiteSpace:"nowrap" }}>
              <input type="checkbox" checked={filters.unreadOnly} onChange={e => setFilter("unreadOnly", e.target.checked)}
                style={{ accentColor:"#1a5caa" }} />
              안 읽음만
            </label>
            {Object.values(filters).some(v => v === true || (typeof v==="string" && v)) && (
              <button className="btn btn-secondary btn-sm" onClick={resetFilters}>초기화</button>
            )}
          </div>

          {/* 데스크톱 테이블 */}
          <div className="card" style={{ padding:0,overflow:"hidden" }}>
            <div className="table-wrap">
              {filtered.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <div className="empty-title">표시할 의견이 없습니다</div>
                  <div className="empty-desc">필터 조건을 변경하거나 초기화해보세요.</div>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th></th>
                      <th>접수일</th><th>접수번호</th><th>제목</th>
                      <th>카테고리</th><th>유형</th><th>긴급도</th>
                      <th>희망 처리 방식</th><th>처리 상태</th><th>연락</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(item => {
                      const urg = URGENCY_COLORS[item.urgency] || {};
                      const isUnread = !readIds.has(item.id);
                      const cat = CATEGORIES.find(c => c.label === item.category);
                      return (
                        <tr
                          key={item.id}
                          className={`${item.urgency==="긴급" ? "urgent-row" : ""} ${isUnread ? "unread" : ""}`}
                          onClick={() => openItem(item)}
                        >
                          <td style={{ width:12,padding:"0 0 0 4px" }}>
                            {isUnread && <span className="unread-dot" />}
                          </td>
                          <td style={{ color:"#8a7d6e",fontSize:".82rem",whiteSpace:"nowrap" }}>{formatDate(item.createdAt)}</td>
                          <td style={{ fontSize:".82rem",fontFamily:"monospace",color:"#8a7d6e" }}>{item.receiptNumber}</td>
                          <td style={{ maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                            {item.isCommitteeAgenda && <span style={{ marginRight:4 }}>📌</span>}
                            {item.title}
                          </td>
                          <td><span className="badge" style={{ background:"#edf3fb",color:"#1a4a80" }}>
                            {cat?.icon} {item.category}
                          </span></td>
                          <td style={{ fontSize:".82rem",color:"#6b6259" }}>{item.type}</td>
                          <td>
                            <span className="badge" style={{ background:urg.bg,color:urg.text }}>
                              <span style={{ width:5,height:5,borderRadius:"50%",background:urg.dot,display:"inline-block" }} />
                              {item.urgency}
                            </span>
                          </td>
                          <td style={{ fontSize:".8rem",color:"#6b6259",whiteSpace:"nowrap" }}>
                            {HANDLING_SHORT[item.preferredHandling] || "—"}
                          </td>
                          <td>
                            <span className="badge" style={{ background:(STATUS_COLORS[item.status]||"#888")+"22",color:STATUS_COLORS[item.status]||"#888" }}>
                              {item.status}
                            </span>
                          </td>
                          <td style={{ fontSize:".82rem",color:"#8a7d6e" }}>
                            {item.allowFollowUp ? `✔ ${item.contactName||""}` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 모바일 카드 목록 */}
          <div className="mobile-list">
            {filtered.length === 0 ? (
              <div className="empty-state card">
                <div className="empty-icon">📭</div>
                <div className="empty-title">표시할 의견이 없습니다</div>
                <div className="empty-desc">필터 조건을 변경하거나 초기화해보세요.</div>
              </div>
            ) : filtered.map(item => {
              const urg = URGENCY_COLORS[item.urgency] || {};
              const isUnread = !readIds.has(item.id);
              const cat = CATEGORIES.find(c => c.label === item.category);
              return (
                <div
                  key={item.id}
                  className={`mobile-card ${isUnread?"unread":""} ${item.urgency==="긴급"?"urgent-card":""}`}
                  onClick={() => openItem(item)}
                >
                  <div className="mobile-card-header">
                    <div className="mobile-card-title">
                      {isUnread && <span className="unread-dot" />}
                      {item.isCommitteeAgenda && "📌 "}
                      {item.title}
                    </div>
                    <span className="badge" style={{ background:urg.bg,color:urg.text,flexShrink:0 }}>
                      {item.urgency}
                    </span>
                  </div>
                  <div style={{ fontSize:".8rem",color:"#8a7d6e",marginBottom:".4rem" }}>
                    {item.receiptNumber} · {formatDate(item.createdAt)}
                  </div>
                  <div className="mobile-card-meta">
                    {cat && <span className="badge" style={{ background:"#edf3fb",color:"#1a4a80" }}>{cat.icon} {item.category}</span>}
                    <span className="badge" style={{ background:(STATUS_COLORS[item.status]||"#888")+"22",color:STATUS_COLORS[item.status]||"#888" }}>
                      {item.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <p style={{ fontSize:".8rem",color:"#8a7d6e",marginTop:".5rem" }}>
            {filtered.length}건 표시 중 (전체 {total}건)
          </p>
        </>
      )}

      {/* ── 그룹 묶음 탭 ── */}
      {tab === "group" && (
        <div>
          {!hasGroups && (
            <div className="empty-state card">
              <div className="empty-icon">🏷️</div>
              <div className="empty-title">아직 그룹 라벨이 없습니다</div>
              <div className="empty-desc">
                의견 상세 화면에서 '이슈 그룹 라벨'을 입력하면<br />
                같은 라벨끼리 이곳에서 자동으로 묶입니다.
              </div>
            </div>
          )}
          {Object.entries(groups)
            .filter(([k]) => k !== "__none")
            .sort((a,b) => b[1].length - a[1].length)
            .map(([label, items]) => {
              const isOpen = expandedGroups[label] !== false; // 기본 열림
              return (
                <div key={label} className="group-section">
                  <div className="group-header" onClick={() => toggleGroup(label)}>
                    <span style={{ fontSize:".9rem" }}>{isOpen ? "▾" : "▸"}</span>
                    <span className="group-label-text">#{label}</span>
                    <span className="group-count">{items.length}건</span>
                  </div>
                  {isOpen && (
                    <div style={{ display:"flex",flexDirection:"column",gap:".4rem" }}>
                      {items.map(item => {
                        const urg = URGENCY_COLORS[item.urgency]||{};
                        const isUnread = !readIds.has(item.id);
                        return (
                          <div key={item.id}
                            className={`card card-sm ${isUnread?"unread":""}`}
                            style={{ cursor:"pointer",borderLeft:item.urgency==="긴급"?"3px solid #f44336":"" }}
                            onClick={() => openItem(item)}
                          >
                            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:".5rem" }}>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:".78rem",color:"#8a7d6e",marginBottom:".2rem" }}>
                                  {item.receiptNumber} · {formatDate(item.createdAt)}
                                </div>
                                <div style={{ fontWeight:500,color:"#2c2825",fontSize:".9375rem" }}>
                                  {isUnread && <span className="unread-dot" />}
                                  {item.title}
                                </div>
                                {item.anonymizedSummary && (
                                  <div style={{ marginTop:".4rem",fontSize:".85rem",color:"#5a5048",background:"#f5f9ff",borderRadius:8,padding:".5rem .75rem",borderLeft:"3px solid #1a5caa" }}>
                                    {item.anonymizedSummary}
                                  </div>
                                )}
                              </div>
                              <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:".3rem",flexShrink:0 }}>
                                <span className="badge" style={{ background:urg.bg,color:urg.text }}>{item.urgency}</span>
                                <span className="badge" style={{ background:(STATUS_COLORS[item.status]||"#888")+"22",color:STATUS_COLORS[item.status]||"#888" }}>
                                  {item.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          {/* 라벨 없는 의견 */}
          {groups["__none"]?.length > 0 && (
            <div className="group-section">
              <div className="group-header" onClick={() => toggleGroup("__none")}>
                <span style={{ fontSize:".9rem" }}>{expandedGroups["__none"]===false ? "▸" : "▾"}</span>
                <span className="group-label-text" style={{ color:"#8a7d6e" }}>라벨 미지정</span>
                <span className="group-count" style={{ background:"#f0ece5",color:"#8a7d6e" }}>{groups["__none"].length}건</span>
              </div>
              {expandedGroups["__none"] !== false && (
                <div style={{ display:"flex",flexDirection:"column",gap:".4rem" }}>
                  {groups["__none"].map(item => {
                    const isUnread = !readIds.has(item.id);
                    return (
                      <div key={item.id}
                        className={`card card-sm ${isUnread?"unread":""}`}
                        style={{ cursor:"pointer" }} onClick={() => openItem(item)}
                      >
                        <div style={{ fontSize:".78rem",color:"#8a7d6e",marginBottom:".15rem" }}>
                          {item.receiptNumber} · {formatDate(item.createdAt)}
                        </div>
                        <div style={{ fontWeight:500,color:"#2c2825" }}>
                          {isUnread && <span className="unread-dot" />}{item.title}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 통계 탭 ── */}
      {tab === "charts" && (
        total === 0 ? (
          <div className="empty-state card">
            <div className="empty-icon">📊</div>
            <div className="empty-title">아직 접수된 의견이 없습니다</div>
            <div className="empty-desc">의견이 접수되면 통계 차트가 표시됩니다.</div>
          </div>
        ) : (
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"1rem" }}>
            <div className="card">
              <h3 style={{ fontSize:".9rem",fontWeight:600,color:"#3a2e22",marginBottom:"1rem" }}>카테고리별 의견 수</h3>
              {byCategory.length === 0
                ? <p style={{ color:"#8a7d6e",fontSize:".875rem" }}>데이터 없음</p>
                : <MiniBar data={byCategory} color="#1a5caa" />
              }
            </div>
            <div className="card">
              <h3 style={{ fontSize:".9rem",fontWeight:600,color:"#3a2e22",marginBottom:"1rem" }}>긴급도별 의견 수</h3>
              <MiniBar data={byUrgency} color="#e07b54" />
            </div>
            <div className="card">
              <h3 style={{ fontSize:".9rem",fontWeight:600,color:"#3a2e22",marginBottom:"1rem" }}>처리 상태별 의견 수</h3>
              {byStatus.length === 0
                ? <p style={{ color:"#8a7d6e",fontSize:".875rem" }}>데이터 없음</p>
                : <MiniBar data={byStatus} color="#5c8a6b" />
              }
            </div>
          </div>
        )
      )}

      {/* ── 안건 후보 탭 ── */}
      {tab === "agenda" && (
        agendaItems.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-icon">📌</div>
            <div className="empty-title">위원회 안건 후보로 지정된 의견이 없습니다</div>
            <div className="empty-desc">의견 상세 화면에서 안건 후보로 지정할 수 있습니다.</div>
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:".75rem" }}>
            {agendaItems.map(item => {
              const urg = URGENCY_COLORS[item.urgency] || {};
              return (
                <div key={item.id} className="card card-sm" style={{ cursor:"pointer" }} onClick={() => openItem(item)}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:".75rem" }}>
                    <div>
                      <div style={{ fontSize:".78rem",color:"#8a7d6e",marginBottom:".2rem" }}>
                        {item.receiptNumber} · {formatDate(item.createdAt)}
                      </div>
                      <div style={{ fontWeight:500,color:"#3a2e22" }}>📌 {item.title}</div>
                      {item.groupLabel && (
                        <span className="badge" style={{ background:"#edf3fb",color:"#1a4a80",fontSize:".75rem",marginTop:".35rem" }}>
                          #{item.groupLabel}
                        </span>
                      )}
                      {item.anonymizedSummary && (
                        <div style={{ marginTop:".5rem",fontSize:".875rem",color:"#5a5048",background:"#f5f9ff",borderRadius:8,padding:".55rem .75rem",borderLeft:"3px solid #1a5caa" }}>
                          {item.anonymizedSummary}
                        </div>
                      )}
                    </div>
                    <span className="badge" style={{ background:urg.bg,color:urg.text,flexShrink:0 }}>{item.urgency}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* 상세 패널 */}
      {selected && (
        <DetailPanel
          item={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ─── 앱 루트 ─────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState("submit");
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastReceipt, setLastReceipt] = useState("");
  const [readIds, setReadIds] = useState(loadRead);

  // 읽음 상태는 여전히 localStorage (기기별 UX)
  useEffect(() => { saveRead(readIds); }, [readIds]);

  // Supabase에서 전체 의견 불러오기
  async function fetchSubmissions() {
    setLoading(true);
    try {
      const rows = await sbFetch("submissions?order=created_at.desc");
      setSubmissions((rows || []).map(rowToItem));
    } catch (e) {
      console.error("fetch error:", e);
    } finally {
      setLoading(false);
    }
  }

  // 관리자 대시보드 진입 시 + 주기적 새로고침
  useEffect(() => {
    if (page === "admin") {
      fetchSubmissions();
      const timer = setInterval(fetchSubmissions, 30000); // 30초마다 자동 갱신
      return () => clearInterval(timer);
    }
  }, [page]);

  async function handleSubmit(form) {
    try {
      // 지금까지 발급된 접수번호 중 최대 일련번호 조회 → 삭제해도 번호 안 줄어듦
      const rows = await sbFetch("submissions?select=receipt_number&order=receipt_number.desc&limit=1");
      let nextSeq = 1;
      if (Array.isArray(rows) && rows.length > 0 && rows[0].receipt_number) {
        // "VOC-2026-0007" 에서 마지막 숫자 파싱
        const parts = rows[0].receipt_number.split("-");
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
      }
      const year = new Date().getFullYear();
      const rn = `VOC-${year}-${String(nextSeq).padStart(4, "0")}`;

      const newItem = {
        id: Date.now().toString(),
        receiptNumber: rn,
        createdAt: new Date().toISOString(),
        status: "신규 접수",
        adminMemo: "",
        isCommitteeAgenda: false,
        needsDepartmentReview: false,
        anonymizedSummary: "",
        groupLabel: "",
        ...form,
      };
      await sbFetch("submissions", {
        method: "POST",
        prefer: "return=minimal",
        body: JSON.stringify(itemToRow(newItem)),
      });
      setLastReceipt(rn);
      setPage("success");
    } catch (e) {
      alert("제출 중 오류가 발생했습니다. 다시 시도해주세요.");
      console.error(e);
    }
  }

  async function handleUpdate(updated) {
    try {
      await sbFetch(`submissions?id=eq.${updated.id}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: JSON.stringify(itemToRow(updated)),
      });
      setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s));
    } catch (e) {
      alert("저장 중 오류가 발생했습니다.");
      console.error(e);
    }
  }

  async function handleDelete(id) {
    try {
      await sbFetch(`submissions?id=eq.${id}`, { method: "DELETE" });
      setSubmissions(prev => prev.filter(s => s.id !== id));
      setReadIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    } catch (e) {
      alert("삭제 중 오류가 발생했습니다.");
      console.error(e);
    }
  }

  function handleMarkRead(id) {
    setReadIds(prev => new Set([...prev, id]));
  }

  function nav(target) { setPage(target); }

  return (
    <>
      <GlobalStyle />
      <Navbar page={page} onNav={nav} />
      {page === "submit" && <SubmitPage onSubmit={handleSubmit} />}
      {page === "success" && <SuccessPage receiptNumber={lastReceipt} onReset={() => setPage("submit")} />}
      {page === "admin-login" && <AdminLogin onLogin={() => setPage("admin")} />}
      {page === "admin" && (
        <AdminDashboard
          submissions={submissions}
          loading={loading}
          readIds={readIds}
          onUpdate={handleUpdate}
          onMarkRead={handleMarkRead}
          onDelete={handleDelete}
          onRefresh={fetchSubmissions}
        />
      )}
      {(page === "submit" || page === "success") && (
        <AdminFooterLink onNav={nav} />
      )}
    </>
  );
}
