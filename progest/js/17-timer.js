// TIMER PANEL
// ============================================================
// _timerState: {taskId, sessionStartMs, sessionPausedMs, paused, pausedAt}
// ============================================================
// TIMER — state, controls, panel rendering
// ============================================================

// _timerState: {taskId, sessionStartMs, sessionPausedMs, paused}
let _timerState = {};
let _timerInterval = null;
let _tpView = 'day';   // 'day' | 'all'
let _tpDayOffset = 0;  // days from GANTT_TODAY for day view

function _saveTimerState(){
  try{ localStorage.setItem('pg_timer', JSON.stringify(_timerState)); }catch(e){}
}
function _loadTimerState(){
  try{ const s=localStorage.getItem('pg_timer'); if(s) _timerState=JSON.parse(s)||{}; }catch(e){}
}

// ms elapsed in current live session (0 if paused or no session)
function _sessionElapsedMs(){
  if(!_timerState.sessionStartMs||_timerState.paused) return 0;
  return Math.max(0, Date.now()-_timerState.sessionStartMs-(_timerState.sessionPausedMs||0));
}

// Total hours logged across all timeLogs for a task
function _totalLoggedH(t){
  return (t&&t.timeLogs||[]).reduce((s,l)=>s+(l.hours||0),0);
}

// Commit current session to timeLogs (rounds to nearest minute)
// Returns hours committed
function _commitSession(taskId){
  const ms=_sessionElapsedMs();
  if(ms<10000) return 0; // ignore < 10 seconds
  const minutes=Math.round(ms/60000);
  const h=minutes/60;
  const endMs=Date.now();
  const startMs=endMs-ms;
  const fmt=ts=>{const d=new Date(ts);return d.toTimeString().slice(0,5);};
  const t=TASKS.find(x=>x.id===taskId); if(!t) return 0;
  t.timeLogs=t.timeLogs||[];
  t.timeLogs.push({
    date:new Date().toISOString().slice(0,10),
    hours:h,
    startTime:fmt(startMs),
    endTime:fmt(endMs),
    notes:'Timer'
  });
  return h;
}

// Live tick: update timer display every second
function _startTimerTick(){
  clearInterval(_timerInterval);
  _timerInterval=setInterval(()=>{
    const id=_timerState.taskId;
    if(!id||_timerState.paused) return;
    const t=TASKS.find(x=>x.id===id);
    const myId=S_USER?.resId;
    const planned=t?._originalPlanned||t?.resHours?.[myId]||tHours(t)||0;
    const logged=_totalLoggedH(t||{});
    const sessMs=_sessionElapsedMs();
    const sessH=sessMs/3600000;
    const totalH=logged+sessH;
    const remaining=planned-totalH;

    const sessEl=document.getElementById(`tp-sess-${id}`);
    const totEl=document.getElementById(`tp-total-${id}`);
    const remEl=document.getElementById(`tp-rem-${id}`);
    if(sessEl) sessEl.textContent=_fmtMs(sessMs);
    if(totEl)  totEl.textContent=_fmtMs(Math.round(totalH*3600000));
    if(remEl){
      remEl.textContent=_fmtHours(remaining);
      remEl.style.color=remaining<0?'var(--danger)':remaining<0.5?'var(--warn)':'var(--ok)';
    }
  },1000);
}

// ── Start or Resume a task ────────────────────────────────────
window.tpStart=(taskId)=>{
  if(!isAdmin()){notify('Only admins can start tasks','warn');return;}
  const myId=S_USER?.resId;

  // If another task is currently ticking, pause it first
  if(_timerState.taskId && _timerState.taskId!==taskId && !_timerState.paused){
    _commitSession(_timerState.taskId);
    const prev=TASKS.find(x=>x.id===_timerState.taskId);
    if(prev) prev.status='paused';
    clearInterval(_timerInterval); _timerInterval=null;
    _timerState={};
  }

  const t=TASKS.find(x=>x.id===taskId);
  if(!t) return;
  // Already ticking for this task — do nothing
  if(_timerState.taskId===taskId && !_timerState.paused) return;

  // Store original planned hours once (so we always know the budget)
  if(!t._originalPlanned) t._originalPlanned = t.resHours?.[myId]||tHours(t);

  // Start fresh session
  _timerState = {taskId, sessionStartMs:Date.now(), sessionPausedMs:0, paused:false};
  _saveTimerState();

  // Mark task as doing, anchor to today
  t.status='doing';
  if(!t.startedAt) t.startedAt=GANTT_TODAY;
  t.start=GANTT_TODAY;
  _tpDayOffset=0;

  addLog({type:'time',task:t.name,from:'',to:'▶ timer started'});
  persistState(['tasks'],{tasks:[taskId]}); _reRenderCurrent(); updateTimerToggle(); if(typeof updateMobBanner!=="undefined") updateMobBanner();
  _startTimerTick();
  renderTimerPanel();
};

// ── Pause active task ─────────────────────────────────────────
window.tpPause=(taskId)=>{
  if(!taskId || _timerState.taskId!==taskId || _timerState.paused) return;
  _commitSession(taskId);
  _timerState.paused=true;
  _timerState.sessionStartMs=null;
  _timerState.sessionPausedMs=0;
  _saveTimerState();
  clearInterval(_timerInterval); _timerInterval=null;
  const t=TASKS.find(x=>x.id===taskId);
  if(t){ t.status='paused'; const sessH=_sessionElapsedMs()/3600000; addLog({type:'time',task:t.name,from:'',to:`⏸ paused — session: ${_fmtHours(sessH)}`}); persistState(['tasks'],{tasks:[taskId]}); _reRenderCurrent(); }
  renderTimerPanel();
};

// ── Mark task done ────────────────────────────────────────────
window.tpDone=(taskId)=>{
  const t=TASKS.find(x=>x.id===taskId); if(!t) return;
  if(_timerState.taskId===taskId){
    _commitSession(taskId);
    _timerState={}; _saveTimerState();
    clearInterval(_timerInterval); _timerInterval=null;
  }
  const _sessH=_commitSession?0:0; const _loggedH=_totalLoggedH(t);
  t.status=taskHasMilestone(taskId)?'ready':'done'; t.prog=100;
  addLog({type:'status',task:t.name,from:'',to:`${taskHasMilestone(taskId)?'◆ Ready':'✓ Done'} — total logged: ${_fmtHours(_loggedH)}`});
  persistState(['tasks'],{tasks:[taskId]}); _reRenderCurrent();
  notify(`"${t.name}" → Done ✓`,'success');
  renderTimerPanel();
};

// ── Cancel task ───────────────────────────────────────────────
window.tpCancel=(taskId)=>{
  const t=TASKS.find(x=>x.id===taskId); if(!t) return;
  if(!confirm(`Cancel "${t.name}"?`)) return;
  if(_timerState.taskId===taskId){
    _commitSession(taskId);
    _timerState={}; _saveTimerState();
    clearInterval(_timerInterval); _timerInterval=null;
  }
  t.status='cancelled';
  addLog({type:'status',task:t.name,from:'',to:'Cancelled'});
  persistState(['tasks'],{tasks:[taskId]}); _reRenderCurrent();
  notify(`"${t.name}" cancelled`,'warn');
  renderTimerPanel();
};

// ── Timer panel rendering ─────────────────────────────────────
window.toggleTimerPanel=()=>{
  const panel=document.getElementById('timer-panel');
  const isOpen=panel.classList.contains('open');
  panel.classList.toggle('open',!isOpen);
  if(!isOpen) renderTimerPanel();
};

window.setTPView=(view, el)=>{
  _tpView=view;
  document.querySelectorAll('.tp-tab').forEach(t=>t.classList.remove('on'));
  if(el) el.classList.add('on');
  const nav=document.getElementById('tp-day-nav');
  if(nav) nav.style.display=view==='day'?'flex':'none';
  renderTimerPanel();
};

window.tpNavDay=(dir)=>{
  if(dir===0) _tpDayOffset=0;
  else _tpDayOffset+=dir;
  // Update day label
  const lbl=document.getElementById('tp-day-lbl');
  if(lbl){
    const d=gDate(GANTT_TODAY+_tpDayOffset);
    const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    lbl.textContent=_tpDayOffset===0?'Today':DN[d.getDay()]+' '+d.getDate()+' '+MN[d.getMonth()];
  }
  renderTimerPanel();
};


window.toggleTPAdd=()=>{
  const form=document.getElementById('tp-add-form');
  const arrow=document.getElementById('tp-add-arrow');
  const open=form.style.display==='none';
  form.style.display=open?'block':'none';
  if(arrow) arrow.textContent=open?'▾':'▸';
  if(open){
    // Populate team select
    const sel=document.getElementById('tp-team');
    if(sel) sel.innerHTML=TEAMS.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
  }
};

window.tpAddTask=()=>{
  const desc=document.getElementById('tp-desc')?.value?.trim();
  const teamId=document.getElementById('tp-team')?.value;
  const hours=parseFloat(document.getElementById('tp-hours')?.value)||1;
  if(!desc){notify('Add a description','warn');return;}
  const myId=S_USER?.resId; if(!myId) return;
  const id='t'+Date.now().toString(36);
  const t={id,name:desc,tags:[],teamId,teamIds:[teamId].filter(Boolean),
    resId:myId,coResIds:[],resHours:{[myId]:hours},resource:S_USER.name,
    status:'todo',timeMode:'total',hours,hpd:null,
    start:GANTT_TODAY,dur:Math.max(1,Math.ceil(hours/(getRes(myId)?.dailyCap||HPD))),
    prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''};
  TASKS.push(t);
  migrateTasks();
  persistState(['tasks'],{tasks:[id]});
  _reRenderCurrent();
  document.getElementById('tp-desc').value='';
  document.getElementById('tp-hours').value='1';
  notify(`"${desc}" added ✓`,'success');
};

function renderTimerPanel(){
  if(!document.getElementById('timer-panel').classList.contains('open')) return;
  if(!S_USER) return;

  const dayIdx=GANTT_TODAY+_tpDayOffset;
  const dayDate=gDate(dayIdx);
  const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const lbl=document.getElementById('tp-day-lbl');
  if(lbl){
    if(_tpDayOffset===0) lbl.textContent='Today';
    else if(_tpDayOffset===1) lbl.textContent='Tomorrow';
    else if(_tpDayOffset===-1) lbl.textContent='Yesterday';
    else lbl.textContent=`${DN[dayDate.getDay()]} ${dayDate.getDate()} ${MN[dayDate.getMonth()]}`;
  }

  const projSel=document.getElementById('tp-proj-filter');
  const curProj=projSel?.value||'';
  if(projSel&&projSel.options.length<=1){
    projSel.innerHTML='<option value="">All projects</option>'+
      PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    projSel.value=curProj;
  }

  const myId=S_USER.resId;
  let myT=TASKS.filter(t=>(t.resId===myId||(t.coResIds||[]).includes(myId))&&t.status!=='cancelled');
  if(curProj){
    const proj=PROJECTS.find(p=>p.id===curProj);
    const ptags=new Set(proj?.tags||[]);
    myT=myT.filter(t=>(t.tags||[]).some(tg=>ptags.has(tg)));
  }
  if(_tpView==='day'){
    // Only show on a day if the task has scheduled hours (sched) or it's a working day within span
    const inDay=myT.filter(t=>{
      if(!t.start&&t.status!=='todo') return false;
      // Always show active timer task today
      if(_timerState.taskId===t.id&&dayIdx===GANTT_TODAY) return true;
      // Tasks that haven't started yet but are todo — show on today
      if(!t.start&&t.status==='todo'&&dayIdx===GANTT_TODAY) return true;
      if(!t.start) return false;
      if(t.start>dayIdx||tEnd(t)<dayIdx) return false;
      // If schedule data, use it; otherwise any working day in task span
      if(t._sched&&Object.keys(t._sched).length>0) return (t._sched[dayIdx]||0)>0;
      return !isNW(dayIdx,t.id,t.resId);
    });
    const noStart=(_tpDayOffset===0)?myT.filter(t=>!t.start&&t.status==='todo'):[];
    myT=[...inDay,...noStart];
  }

  const wrap=document.getElementById('tp-tasks');
  if(!myT.length){
    wrap.innerHTML=`<div style="padding:20px;text-align:center;font-size:11px;color:var(--fg3)">${_tpView==='day'?'No tasks for this day':'No tasks assigned'}</div>`;
    return;
  }

  wrap.innerHTML=myT.map(t=>{
    const isActive = _timerState.taskId===t.id && !_timerState.paused;
    const isPaused = t.status==='paused';
    const isExpanded = isActive; // ONLY the running task expands
    const planned=t._originalPlanned||t.resHours?.[myId]||tHours(t);
    const logged=_totalLoggedH(t);
    const sessH=isActive?_sessionElapsedMs()/3600000:0;
    const totalH=logged+sessH;
    const remaining=planned-totalH;
    const team=getTeam(t.teamId);
    const remColor=remaining<0?'var(--danger)':remaining<0.5?'var(--warn)':'var(--ok)';
    const statusDot=`<span style="width:8px;height:8px;border-radius:50%;background:${SCOLS[t.status]};flex-shrink:0;margin-top:3px"></span>`;

    if(!isExpanded){
      // MINIMIZED: just name + status dot + remaining + Start button
      return `<div class="tp-task${isPaused?' paused':''}">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          ${statusDot}
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${t.name}">${t.name}</div>
            <div style="font-size:9px;color:var(--fg3);margin-top:1px">${team?`<span style="color:${team.color}">${team.name}</span> · `:''}${_fmtHours(remaining)} remaining</div>
          </div>
          ${isPaused?`<span style="font-size:9px;color:var(--acc)">⏸</span>`:''}
        </div>
        <div class="tp-btns">
          <button class="tp-btn start" onclick="tpStart('${t.id}')">${isPaused?'▶ Resume':'▶ Start'}</button>
          <button class="tp-btn start" onclick="tpDone('${t.id}')" style="background:rgba(34,197,94,.15);color:var(--ok);border:1px solid rgba(34,197,94,.3)">✓ Done</button>
          <button class="tp-btn stop" onclick="tpCancel('${t.id}')">✕</button>
        </div>
      </div>`;
    }

    // EXPANDED: full timer display for active/paused task
    return `<div class="tp-task ${isActive?'active':'paused'}">
      <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:6px">
        ${statusDot}
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${t.name}">${t.name}</div>
          <div style="font-size:9px;color:var(--fg3);margin-top:1px">${team?`<span style="color:${team.color}">${team.name}</span> · `:''}${_fmtHours(planned)} planned</div>
        </div>
        <span style="font-size:9px;color:${isActive?'var(--acc)':'var(--warn)'}">${isActive?'● Running':'⏸ Paused'}</span>
      </div>

      <div style="background:var(--bg1);border-radius:6px;padding:8px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">
          <span style="font-size:9px;color:var(--fg3)">TOTAL</span>
          <div class="tp-timer ${isPaused?'paused':''}" id="tp-total-${t.id}">${_fmtMs(Math.round(totalH*3600000))}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">
          <span style="font-size:9px;color:var(--fg3)">SESSION</span>
          <div style="font-size:13px;font-weight:600;font-family:var(--mono);color:var(--fg2)" id="tp-sess-${t.id}">${_fmtMs(isActive?_sessionElapsedMs():0)}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span style="font-size:9px;color:var(--fg3)">REMAINING</span>
          <div style="font-size:13px;font-weight:600;font-family:var(--mono);color:${remColor}" id="tp-rem-${t.id}">${_fmtHours(remaining)}</div>
        </div>
      </div>

      <div class="tp-btns">
        ${isActive
          ? `<button class="tp-btn pause" onclick="tpPause('${t.id}')">⏸ Pause</button>
             <button class="tp-btn start" onclick="tpDone('${t.id}')" style="background:rgba(34,197,94,.15);color:var(--ok);border:1px solid rgba(34,197,94,.3)">✓ Done</button>
             <button class="tp-btn stop" onclick="tpCancel('${t.id}')">✕</button>`
          : `<button class="tp-btn start" onclick="tpStart('${t.id}')">▶ Resume</button>
             <button class="tp-btn start" onclick="tpDone('${t.id}')" style="background:rgba(34,197,94,.15);color:var(--ok);border:1px solid rgba(34,197,94,.3)">✓ Done</button>
             <button class="tp-btn stop" onclick="tpCancel('${t.id}')">✕</button>`
        }
      </div>
    </div>`;
  }).join('');

  if(_timerState.taskId&&!_timerState.paused&&!_timerInterval) _startTimerTick();
}




// ============================================================
