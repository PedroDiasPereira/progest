// MY SPACE
// ============================================================
let _myOffset = GANTT_TODAY - 1; // start of current week



function renderMyDay(tasks, myId){
  const wrap=document.getElementById('my-day-wrap');
  if(!wrap) return;

  const dayIdx=GANTT_TODAY+_myDayOffset;
  const dt=gDate(dayIdx);
  const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DN=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dayLabel=`${DN[dt.getDay()]}, ${dt.getDate()} ${MN[dt.getMonth()]}`;
  const isToday=dayIdx===GANTT_TODAY;

  // Update nav label
  const lbl=document.getElementById('my-day-lbl');
  if(lbl) lbl.textContent=isToday?'Today':dayLabel;

  // Gather logs for this day
  const fmtH=h=>{const m=Math.round(h*60);return m>=60?`${Math.floor(m/60)}h${m%60>0?' '+m%60+'m':''}`:`${m}m`;};
  const todayDate=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;

  // All logs for this day
  const logs=tasks.flatMap(t=>(t.timeLogs||[])
    .filter(l=>l.date===todayDate)
    .map(l=>({...l,task:t,barCol:getTeam(t.teamId)?.color||'#4f9cf9'}))
  ).sort((a,b)=>(a.startTime||'99:99').localeCompare(b.startTime||'99:99'));

  // Tasks scheduled for this day (future / remaining)
  const sched=tasks.filter(t=>{
    if(t.status==='done'||t.status==='cancelled') return false;
    const s=t._sched||{};
    return s[dayIdx]>0;
  }).map(t=>({task:t,hours:t._sched[dayIdx]||0,barCol:getTeam(t.teamId)?.color||'#4f9cf9'}))
    .sort((a,b)=>b.hours-a.hours);

  // Total logged today
  const totalLogged=logs.reduce((s,l)=>s+l.hours,0);
  const cap=getRes(myId)?.dailyCap||HPD;

  const now=new Date();
  const nowStr=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  let H=`<div style="padding:16px">`;

  // Day header + capacity bar
  H+=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
    <div>
      <div style="font-size:15px;font-weight:700;color:var(--fg0)">${dayLabel}</div>
      <div style="font-size:10px;color:var(--fg3);margin-top:2px">${fmtH(totalLogged)} logged · ${fmtH(Math.max(0,cap-totalLogged))} remaining of ${fmtH(cap)} capacity</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      ${isToday?`<div style="font-size:12px;font-weight:700;color:var(--acc);font-family:var(--mono)">${nowStr}</div>`:''}
      <div style="width:120px;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${Math.min(100,Math.round(totalLogged/cap*100))}%;background:${totalLogged>=cap?'var(--danger)':totalLogged>=cap*0.7?'var(--warn)':'var(--ok)'};border-radius:3px;transition:width .4s"></div>
      </div>
    </div>
  </div>`;

  // ── PAST: time logged ──────────────────────────────────────────
  if(logs.length){
    H+=`<div style="margin-bottom:20px">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--fg3);margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <span style="color:var(--ok)">✓ Logged</span>
        <div style="flex:1;height:1px;background:var(--bd)"></div>
        <span style="color:var(--ok)">${fmtH(totalLogged)}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">`;

    logs.forEach(l=>{
      const t=l.task;
      H+=`<div style="display:flex;align-items:stretch;gap:10px">
        <div style="display:flex;flex-direction:column;align-items:center;width:44px;flex-shrink:0">
          ${l.startTime?`<div style="font-size:9px;font-family:var(--mono);color:var(--fg2)">${l.startTime}</div>`:''}
          <div style="flex:1;width:2px;background:${l.barCol};opacity:.4;margin:3px 0"></div>
          ${l.endTime?`<div style="font-size:9px;font-family:var(--mono);color:var(--fg2)">${l.endTime}</div>`:''}
        </div>
        <div style="flex:1;background:var(--bg2);border:1px solid var(--bd);border-left:3px solid ${l.barCol};border-radius:0 var(--r8) var(--r8) 0;padding:8px 12px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
            <div style="font-size:11px;font-weight:600;color:var(--fg0)">${t.name}</div>
            <div style="font-size:12px;font-weight:700;font-family:var(--mono);color:var(--ok)">${fmtH(l.hours)}</div>
          </div>
          ${l.notes?`<div style="font-size:10px;color:var(--fg3);margin-top:3px;font-style:italic">${l.notes}</div>`:''}
          <div style="font-size:9px;color:var(--fg3);margin-top:2px">${getTeam(t.teamId)?.name||'—'}</div>
        </div>
      </div>`;
    });
    H+='</div></div>';
  }

  // ── NOW marker ─────────────────────────────────────────────────
  if(isToday){
    H+=`<div style="display:flex;align-items:center;gap:8px;margin:12px 0">
      <div style="width:44px;text-align:right;font-size:9px;font-weight:700;font-family:var(--mono);color:var(--acc)">${nowStr}</div>
      <div style="height:2px;flex:1;background:linear-gradient(to right,var(--acc),transparent)"></div>
      <div style="width:8px;height:8px;border-radius:50%;background:var(--acc);box-shadow:0 0 0 3px rgba(79,156,249,.25);flex-shrink:0"></div>
    </div>`;
  }

  // ── FUTURE: scheduled tasks ────────────────────────────────────
  if(sched.length){
    H+=`<div style="margin-top:8px">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--fg3);margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <span style="color:var(--acc)">→ Scheduled</span>
        <div style="flex:1;height:1px;background:var(--bd)"></div>
        <span style="color:var(--fg2)">${fmtH(sched.reduce((s,x)=>s+x.hours,0))}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">`;

    sched.forEach(({task:t,hours,barCol})=>{
      const loggedOnTask=logH(t);
      const totalPlanned=t.resHours?.[myId]||tHours(t);
      const pct=totalPlanned>0?Math.round(loggedOnTask/totalPlanned*100):0;
      const statusBadge=t.status==='doing'?`<span style="font-size:8px;font-weight:700;padding:1px 6px;background:rgba(79,156,249,.2);color:var(--acc);border-radius:4px">▶ Active</span>`:
        t.status==='paused'?`<span style="font-size:8px;font-weight:700;padding:1px 6px;background:rgba(79,156,249,.1);color:var(--acc);border-radius:4px">⏸ Paused</span>`:'';
      H+=`<div style="display:flex;align-items:stretch;gap:10px">
        <div style="width:44px;flex-shrink:0;display:flex;align-items:center;justify-content:flex-end">
          <div style="font-size:11px;font-weight:700;font-family:var(--mono);color:${barCol}">${fmtH(hours)}</div>
        </div>
        <div style="flex:1;background:var(--bg2);border:1px solid var(--bd);border-left:3px solid ${barCol};border-radius:0 var(--r8) var(--r8) 0;padding:8px 12px;cursor:pointer" onclick="openEditTask('${t.id}')">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <div style="font-size:11px;font-weight:600;color:var(--fg0)">${t.name}</div>
            ${statusBadge}
          </div>
          <div style="height:3px;background:var(--bg3);border-radius:2px;overflow:hidden;margin-bottom:4px">
            <div style="height:100%;width:${pct}%;background:${barCol};opacity:.7;border-radius:2px"></div>
          </div>
          <div style="display:flex;gap:8px;font-size:9px;color:var(--fg3)">
            <span>${getTeam(t.teamId)?.name||'—'}</span>
            <span>${pct}% done overall</span>
            ${t.deadline?`<span style="color:${tEnd(t)>dateToIdx(t.deadline)?'var(--danger)':'var(--fg3)'}">DL: ${t.deadline}</span>`:''}
          </div>
        </div>
      </div>`;
    });
    H+='</div></div>';
  }

  if(!logs.length&&!sched.length){
    H+=`<div style="text-align:center;padding:32px;color:var(--fg3)">
      <div style="font-size:28px;margin-bottom:8px">📅</div>
      <div style="font-size:12px;font-weight:600;color:var(--fg1)">Nothing scheduled</div>
      <div style="font-size:11px;margin-top:4px">No logs or tasks for this day.</div>
    </div>`;
  }

  H+='</div>';
  wrap.innerHTML=H;
}
window.renderMyDay=renderMyDay;

function renderMySpace(){
  if(!S_USER){ document.getElementById('mys').innerHTML='<div style="padding:20px;color:var(--fg3)">Please log in first.</div>'; return; }
  try{
  const me=getRes(S_USER.resId);
  if(!me){ document.getElementById('mys').innerHTML='<div style="padding:20px;color:var(--fg3)">User not found.</div>'; return; }
  const myId=me.id;
  const myT=TASKS.filter(t=>t.resId===myId||(t.coResIds||[]).includes(myId));
  const pend=myT.filter(t=>t.status==='todo').length;
  const doing=myT.filter(t=>t.status==='doing').length;
  const ph=myT.reduce((s,t)=>s+tHours(t),0);
  const ah=myT.reduce((s,t)=>s+logH(t),0);
  document.getElementById('mys').innerHTML=`
    <div class="mg" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:12px">
      <div class="mc a1"><div class="ml">My tasks</div><div class="mv">${myT.length}</div><div class="ms">${pend} pending · ${doing} doing</div></div>
      <div class="mc a3"><div class="ml">Logged</div><div class="mv">${_fmtHours(ah)}</div><div class="ms">of ${_fmtHours(ph)} planned</div></div>
      <div class="mc a4"><div class="ml">Progress</div><div class="mv">${ph?Math.round(ah/ph*100):0}%</div><div class="ms">&nbsp;</div></div>
    </div>
    <!-- Side-by-side: Gantt 75% + Day 25% -->
    <div style="display:grid;grid-template-columns:3fr 1fr;gap:12px;align-items:stretch">
      <div class="card" style="overflow:hidden;display:flex;flex-direction:column">
        <div class="ch" style="justify-content:space-between">
          <span class="ct">My Gantt</span>
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-ic" onclick="myGanttNav(-1)">‹ week</button>
            <button class="btn btn-sm" onclick="myGanttNav(0)">Today</button>
            <button class="btn btn-sm btn-ic" onclick="myGanttNav(1)">week ›</button>
          </div>
        </div>
        <div id="my-gantt-wrap" style="overflow-x:auto;flex:1"></div>
      </div>
      <div class="card" style="overflow:hidden;display:flex;flex-direction:column">
        <div class="ch" style="justify-content:space-between;padding:8px 12px">
          <span class="ct" id="my-day-lbl" style="font-size:11px">Today</span>
          <div style="display:flex;gap:3px">
            <button class="btn btn-sm btn-ic" onclick="myDayNav(-1)" style="padding:2px 6px">‹</button>
            <button class="btn btn-sm btn-ic" onclick="myDayNav(0)" style="padding:2px 6px;font-size:9px">↺</button>
            <button class="btn btn-sm btn-ic" onclick="myDayNav(1)" style="padding:2px 6px">›</button>
          </div>
        </div>
        <div id="my-day-wrap" style="flex:1;overflow-y:auto"></div>
      </div>
    </div>`;
  renderMyGantt(myT, myId);
  renderMyDay(myT, myId);
  const allLogs=myT.flatMap(t=>(t.timeLogs||[]).map(l=>({...l,tname:t.name}))).sort((a,b)=>b.date.localeCompare(a.date));
  const logEl=document.getElementById('mys-log');
  if(logEl){
    const fmtH=h=>{const totalMin=Math.round(h*60);const hh=Math.floor(totalMin/60);const mm=totalMin%60;return mm>0?`${hh}h ${mm}m`:`${hh}h`;};
    logEl.innerHTML=allLogs.slice(0,40).map(l=>{
      const timeRange=l.startTime&&l.endTime?`${l.startTime}–${l.endTime}`:(l.date||'');
      return `<tr>
        <td style="font-size:11px">${l.tname}</td>
        <td class="txs tc">${l.date||''}<br><span style="color:var(--fg3)">${l.startTime&&l.endTime?l.startTime+' – '+l.endTime:''}</span></td>
        <td class="mono txs">${fmtH(l.hours)}</td>
        <td class="txs tc">${l.notes||'—'}</td>
      </tr>`;
    }).join('')||'<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--fg3)">No time logged yet</td></tr>';
  }
  }catch(e){ console.error('renderMySpace:',e); document.getElementById('mys').innerHTML=`<div style="padding:20px;color:var(--danger)">Error loading My Space: ${e.message}</div>`; }
}


window.setMyView=()=>{}; // unused
window.myDayNav=(dir)=>{
  if(dir===0) _myDayOffset=0;
  else _myDayOffset+=dir;
  // Only re-render day panel
  const me=S_USER?getRes(S_USER.resId):null;
  if(!me) return;
  const myT=TASKS.filter(t=>t.resId===me.id||(t.coResIds||[]).includes(me.id));
  renderMyDay(myT,me.id);
};
window.myGanttNav=(dir)=>{
  if(dir===0) _myOffset=GANTT_TODAY-1;
  else _myOffset+=dir*7;
  const me=S_USER?getRes(S_USER.resId):RESOURCES.find(r=>r.name.includes('Pedro'));
  const myId=me?.id;
  const myT=TASKS.filter(t=>t.resId===myId||(t.coResIds||[]).includes(myId));
  renderMyGantt(myT,myId);
};

function renderMyGantt(tasks,myId){
  const wrap=document.getElementById('my-gantt-wrap');
  if(!wrap) return;
  computeAllSchedules();
  const cap=getRes(myId)?.dailyCap||HPD;
  const DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const NUM_DAYS=20; // 20 working days (fills page)
  const fmtH=h=>{const totalMin=Math.round(h*60);const hh=Math.floor(totalMin/60);const mm=totalMin%60;return mm>0?`${hh}h ${mm}m`:`${hh}h`;};

  // Build cols: all calendar days for the range of NUM_DAYS working days
  // First find the end date (NUM_DAYS working days)
  let _wdCount=0, _endScan=_myOffset+1;
  while(_wdCount<NUM_DAYS&&_endScan<_myOffset+100){
    if(!isNW(_endScan)) _wdCount++;
    _endScan++;
  }
  const cols=[];
  for(let _d=_myOffset+1;_d<_endScan;_d++){
    const dt=gDate(_d);
    const nw=isNW(_d);
    cols.push({idx:_d,dt,nw,today:_d===GANTT_TODAY,day:dt.getDate(),dow:dt.getDay()});
  }
  const rangeStart=cols[0]?.idx||_myOffset+1, rangeEnd=cols[cols.length-1]?.idx||_myOffset+NUM_DAYS;

  const ws=cols[0].dt, we=cols[NUM_DAYS-1].dt;
  const rangeLabel=`${ws.getDate()} ${MN[ws.getMonth()]} – ${we.getDate()} ${MN[we.getMonth()]} ${we.getFullYear()}`;
  // Auto-fit COL_W to available width, respect zoom
  const NAME_W=220;
  const NW_W=20; // weekend narrow column
  // Count NW cols in range
  const nwCount=cols.filter(x=>x.nw).length;
  const wdCount=cols.length-nwCount;
  const wrapW=document.getElementById('my-gantt-wrap')?.clientWidth||window.innerWidth-32;
  const ZOOM_STEPS_MS=[18,24,32,42,54,68,84,100];
  const autoFit=Math.max(18,Math.min(100,Math.floor((wrapW-NAME_W-nwCount*NW_W)/Math.max(1,wdCount))));
  const COL_W=_ganttZoom===null?autoFit:ZOOM_STEPS_MS[Math.max(0,Math.min(ZOOM_STEPS_MS.length-1,_ganttZoom))];

  // Milestones relevant to this user (have at least one of this user's tasks)
  const myTaskIds=new Set(tasks.map(t=>t.id));
  const myMilestones=MILESTONES.filter(m=>
    m.dayIdx>=rangeStart && m.dayIdx<=rangeEnd &&
    (m.taskIds||[]).some(id=>myTaskIds.has(id)) &&
    (!S._activeProjId||(m.projId?m.projId===S._activeProjId:(m.taskIds||[]).some(id=>myTaskIds.has(id))))
  );

  // Build per-day log map: {dayIdx: [{hours, startTime, endTime, taskId}]}
  const logsByDay={};
  tasks.forEach(t=>{
    (t.timeLogs||[]).forEach(l=>{
      const dayIdx=dateToIdx(l.date);
      if(!dayIdx) return;
      if(!logsByDay[dayIdx]) logsByDay[dayIdx]=[];
      logsByDay[dayIdx].push({hours:l.hours,startTime:l.startTime,endTime:l.endTime,taskId:t.id,tname:t.name});
    });
  });

  // Include tasks that are scheduled in range OR have logs in range
  const inRange=[...new Set([
    ...tasks.filter(t=>t.start&&tEnd(t)>=rangeStart&&t.start<=rangeEnd),
    ...tasks.filter(t=>(t.timeLogs||[]).some(l=>{const d=dateToIdx(l.date);return d>=rangeStart&&d<=rangeEnd;}))
  ])];

  let H=`<table style="border-collapse:collapse;table-layout:fixed;min-width:${NAME_W+NUM_DAYS*COL_W}px">
  <thead>
    <tr>
      <th style="width:${NAME_W}px;background:var(--bg2);padding:6px 10px;font-size:9px;font-weight:700;text-transform:uppercase;color:var(--fg2);border-bottom:1px solid var(--bd);text-align:left">${rangeLabel}</th>
      ${cols.map(c=>{
        const msDay=myMilestones.filter(m=>m.dayIdx===c.idx);
        const msCols=msDay.length>0;
        const msHdrCol=msCols?(msDay[0].color||'var(--acc2)'):'';
        const colW=c.nw?NW_W:COL_W;
        return `<th style="width:${colW}px;min-width:${colW}px;max-width:${colW}px;background:${c.nw?'rgba(10,14,22,.5)':c.today?'rgba(79,156,249,.12)':'var(--bg2)'};padding:4px 0;text-align:center;border-bottom:1px solid var(--bd);border-left:1px solid var(--bd);${msCols?'outline:2px solid '+msHdrCol+';outline-offset:-2px;':''}" ${msCols?`title="${msDay.map(m=>m.name).join(', ')}"`:''}">
          ${c.nw
            ? `<div style="font-size:8px;color:var(--fg3);writing-mode:vertical-lr;transform:rotate(180deg);margin:4px auto;letter-spacing:.5px">${DN[c.dow]}</div>`
            : `<div style="font-size:12px;font-weight:${c.today?700:500};color:${msCols?msHdrCol:c.today?'var(--acc)':'var(--fg0)'}">${c.day}</div>
               <div style="font-size:9px;color:${c.today?'var(--acc)':'var(--fg2)'}">${DN[c.dow]}</div>`
          }
        </th>`;
      }).join('')}
    </tr>
    <tr>
      <td style="padding:3px 10px;font-size:9px;color:var(--fg3);background:var(--bg1);border-bottom:1px solid var(--bd)">Available capacity</td>
      ${cols.map(c=>{
        if(c.nw) return `<td style="width:${NW_W}px;min-width:${NW_W}px;max-width:${NW_W}px;background:rgba(10,14,22,.45);border-bottom:1px solid var(--bd);border-left:1px solid var(--bd)"></td>`;
        const load=getDayLoad(myId,c.idx,null);
        const avail=Math.max(0,cap-load);
        const pct=avail/cap;
        const col=pct>0.5?'var(--ok)':pct>0.2?'var(--warn)':'var(--danger)';
        return `<td style="padding:3px 4px;text-align:center;background:var(--bg1);border-bottom:1px solid var(--bd);border-left:1px solid var(--bd)">
          <div style="font-size:10px;font-weight:600;color:${col}">${fmtH(avail)}</div>
          <div style="height:2px;background:var(--bg3);border-radius:1px;overflow:hidden;margin-top:2px"><div style="height:100%;width:${Math.round(pct*100)}%;background:${col}"></div></div>
        </td>`;
      }).join('')}
    </tr>
  </thead><tbody>`;

  if(!inRange.length){
    H+=`<tr><td colspan="${1+NUM_DAYS}" style="padding:24px;text-align:center;font-size:11px;color:var(--fg3)">No tasks in this period</td></tr>`;
  } else {
    inRange.forEach(t=>{
      const barCol=t.teamId?getTeam(t.teamId)?.color||'#7a8aaa':'#7a8aaa';
      const _overLoggedTask=logH(t)>tHours(t);
      const isDone=t.status==='done'||t.status==='cancelled';
      const sched=t._sched||{};
      const myPlanned=t._originalPlanned||t.resHours?.[myId]||tHours(t);
      const myLogged=logH(t);
      const remaining=Math.max(0,myPlanned-myLogged);
      const logFrac=myPlanned>0?Math.min(1,myLogged/myPlanned):0;
      const isOv=t.deadline&&tEnd(t)>dateToIdx(t.deadline)&&!isDone;

      const isActiveRow=t.status==='doing';
      const isPausedRow=t.status==='paused';
      const rowBg=isActiveRow?'background:rgba(255,255,255,.06)':isPausedRow?'background:rgba(79,156,249,.04)':'';
      H+=`<tr style="${rowBg}">
        <td style="padding:4px 10px;border-bottom:1px solid var(--bd);cursor:pointer;${rowBg}" onclick="openEditTask('${t.id}')">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${SCOLS[t.status]};flex-shrink:0"></span>
            <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;max-width:190px" title="${t.name}">${t.name}</div>
          </div>
          <div style="font-size:9px;color:var(--fg3);margin-top:1px;padding-left:14px">
            ${myLogged>0?`<span style="color:var(--ok)">${fmtH(myLogged)} done</span> · `:''}<span style="color:${remaining>0?'var(--fg2)':'var(--ok)'}">${fmtH(remaining)} left</span>
          </div>
          ${myLogged>0?`<div style="height:2px;background:var(--bg3);border-radius:1px;overflow:hidden;margin-top:2px;margin-left:14px">
            <div style="height:100%;width:${Math.round(logFrac*100)}%;background:${isDone?'var(--ok)':'var(--acc)'};border-radius:1px"></div>
          </div>`:''}
        </td>
        ${cols.map(c=>{
          const msHere=myMilestones.filter(m=>(m.taskIds||[]).includes(t.id)&&m.dayIdx===c.idx);
          const hasMsHere=msHere.length>0;
          const msCol=hasMsHere?(msHere[0].color||'var(--acc2)'):'';
          if(c.nw) return `<td style="width:${NW_W}px;min-width:${NW_W}px;max-width:${NW_W}px;background:rgba(10,14,22,.45);border-bottom:1px solid var(--bd);border-left:1px solid var(--bd)"></td>`;
          // Use box-shadow inset to draw milestone line — no absolute positioning needed
          // Line via background-image — hover uses background-color so this survives
          const msBoxShadow=hasMsHere?`background-image:linear-gradient(to right,transparent calc(50% - 1px),${msCol} calc(50% - 1px),${msCol} calc(50% + 1px),transparent calc(50% + 1px));`:'';
          const _msColors2=msHere.map(m=>m.color||'var(--acc2)');
          const _msMultiBg2=_msColors2.length>1?`conic-gradient(${_msColors2.map((col,i)=>`${col} ${Math.round(i/_msColors2.length*360)}deg ${Math.round((i+1)/_msColors2.length*360)}deg`).join(',')})`:(msCol||'');
          const _msDiv=hasMsHere?`<div style="position:absolute;top:0;bottom:0;left:50%;width:2px;transform:translateX(-50%);background:${msCol};z-index:5;pointer-events:none"></div><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;background:${_msMultiBg2};border:2px solid rgba(0,0,0,.4);z-index:6;pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`:'';
          const msClick=hasMsHere?`onclick="toggleMsFilter('${msHere[0].id}')" title="${msHere[0].name} — click to filter" style="cursor:pointer"`:'';
          // For active task today with no sched data: infer from remaining hours
          let schedH=sched[c.idx]||0;
          if(!schedH&&c.today&&t.status==='doing'&&!t.segments){
            const planned2=t._originalPlanned||t.resHours?.[myId]||tHours(t);
            const loggedAll=logH(t);
            schedH=Math.min(cap, Math.max(0,planned2-loggedAll)); // cap to daily capacity
          }
          // Hours actually logged on this specific day
          const loggedToday=(t.timeLogs||[]).filter(l=>dateToIdx(l.date)===c.idx).reduce((s,l)=>s+l.hours,0);
          const logEntries=(t.timeLogs||[]).filter(l=>dateToIdx(l.date)===c.idx);
          const logTip=logEntries.map(l=>l.startTime&&l.endTime?`${l.startTime}–${l.endTime} (${fmtH(l.hours)})`:`${fmtH(l.hours)}`).join(', ');

          if(loggedToday>0.001){
            const frac=Math.min(1,loggedToday/cap);
            const bh=Math.max(20,Math.round(20+frac*28));
            const isActive=_timerState.taskId===t.id&&!_timerState.paused&&t.status==='doing';
            const hasRemSched=schedH>0.001;
            return `<td ${msClick} style="padding:2px 3px;border-bottom:1px solid var(--bd);border-left:1px solid var(--bd);vertical-align:middle;text-align:center;${msBoxShadow}">
              <div style="background:${isDone?'var(--ok)':_overLoggedTask?'var(--danger)':barCol};height:${bh}px;border-radius:3px 3px ${hasRemSched?0:3}px ${hasRemSched?0:3}px;position:relative;" title="Logged: ${logTip}">${_msDiv}
                <span style="font-size:9px;font-weight:700;color:#fff;position:absolute;inset:0;display:flex;align-items:center;justify-content:center">${fmtH(loggedToday)}${isActive?' ⏱':''}</span>
              </div>
              ${hasRemSched?`<div style="background:${barCol}55;height:6px;border-radius:0 0 3px 3px;border:1px dashed ${barCol}99;border-top:none"></div>`:''}
            </td>`;
          } else if(schedH>0.001){
            const frac=Math.min(1,schedH/cap);
            const bh=Math.max(20,Math.round(20+frac*28));
            const isActive=_timerState.taskId===t.id&&!_timerState.paused&&t.status==='doing';
            return `<td ${msClick} style="padding:2px 3px;border-bottom:1px solid var(--bd);border-left:1px solid var(--bd);vertical-align:middle;text-align:center;${msBoxShadow}">
              <div style="background:${isActiveRow?barCol:barCol+'88'};height:${bh}px;border-radius:3px;position:relative;${isOv&&!hasMsHere?'outline:1px solid var(--danger)':''}${isActiveRow?';box-shadow:0 0 8px '+barCol+'66':''}" title="${t.name}: ${fmtH(schedH)}">
                <span style="font-size:9px;font-weight:600;color:rgba(255,255,255,.85);position:absolute;inset:0;display:flex;align-items:center;justify-content:center">${fmtH(schedH)}${isActive?' ⏱':''}</span>
              </div>
            </td>`;
          } else if(t.start&&c.idx>=t.start&&c.idx<=tEnd(t)){
            const freeSeg=t.segments&&t.segments[0]?._locked&&t.segments.length>1?t.segments[t.segments.length-1]:null;
            const inFree=freeSeg&&c.idx>=freeSeg.start&&c.idx<freeSeg.start+freeSeg.dur;
            const barColFree=t.teamId?getTeam(t.teamId)?.color||'#7a8aaa':'#7a8aaa';
            if(inFree){
              return `<td ${msClick} style="padding:2px 3px;border-bottom:1px solid var(--bd);border-left:1px solid var(--bd);vertical-align:middle;text-align:center;${msBoxShadow}">
                <div style="background:${barColFree}44;height:16px;border-radius:3px;border:1.5px dashed ${barColFree}cc" title="${t.name}: ${fmtH(freeSeg.hours)} remaining"></div>
              </td>`;
            }
            return `<td ${msClick} style="padding:2px 3px;border-bottom:1px solid var(--bd);border-left:1px solid var(--bd);vertical-align:middle;${msBoxShadow}">
              <div style="height:6px;background:${barColFree}55;border-radius:3px"></div>
            </td>`;
          }
          return `<td ${msClick} style="border-bottom:1px solid var(--bd);border-left:1px solid var(--bd);${msBoxShadow}"></td>`;
        }).join('')}
      </tr>`;
    });
  }
  H+=`</tbody></table>`;
  wrap.innerHTML=H;
}

