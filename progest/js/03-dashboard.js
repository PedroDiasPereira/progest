// ============================================================
// DASHBOARD
// ============================================================
function _renderTeamWorkload(){
  const el=document.getElementById('rp-team-workload');
  if(!el) return;
  const _rpSel=document.getElementById('rpt-proj-filter');
  const _rpProjId=_rpSel?.value||'';
  const _projTasks=(_rpProjId?TASKS.filter(t=>t.projId===_rpProjId):TASKS).filter(t=>t.start!=null&&t.status!=='cancelled');
  if(!_projTasks.length){ el.innerHTML='<div style="font-size:11px;color:var(--fg3);padding:8px">No tasks with dates.</div>'; return; }

  const _idxToIso=idx=>{ if(!idx) return null; const d=gDate(idx); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
  const _toMs=iso=>new Date(iso).getTime();
  const _toIso=ms=>{ const d=new Date(ms); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
  const _fmtS=iso=>iso?iso.slice(5).replace('-','/'):'';

  // Build team data
  const _teamIds=[...new Set(_projTasks.map(t=>t.teamId).filter(Boolean))];
  const _teams=_teamIds.map(tid=>{
    const _tm=getTeam(tid);
    const _tTasks=_projTasks.filter(t=>t.teamId===tid);
    const _items=_tTasks.map(t=>({start:_idxToIso(t.start),end:_idxToIso(tEnd(t)),hours:tHours(t)})).filter(x=>x.start&&x.end);
    const _totalH=_items.reduce((s,x)=>s+x.hours,0);
    // merge overlapping blocks
    const _sorted=[..._items].sort((a,b)=>_toMs(a.start)-_toMs(b.start));
    const _blocks=[];
    _sorted.forEach(x=>{
      const s=_toMs(x.start),e=_toMs(x.end);
      if(_blocks.length&&s<=_blocks[_blocks.length-1].end+86400000){
        _blocks[_blocks.length-1].end=Math.max(_blocks[_blocks.length-1].end,e);
        _blocks[_blocks.length-1].count++;
      } else { _blocks.push({start:s,end:e,count:1}); }
    });
    return {name:_tm?.name||tid,color:_tm?.color||'var(--acc)',blocks:_blocks,totalH:_totalH};
  }).filter(t=>t.blocks.length);

  if(!_teams.length){ el.innerHTML='<div style="font-size:11px;color:var(--fg3);padding:8px">No team data.</div>'; return; }

  const _allMs=_teams.flatMap(t=>t.blocks.flatMap(b=>[b.start,b.end]));
  const _minMs=Math.min(..._allMs)-5*86400000;
  const _maxMs=Math.max(..._allMs)+5*86400000;
  const _span=_maxMs-_minMs;
  const _pct=ms=>(((ms-_minMs)/_span)*100).toFixed(2);
  const LABEL_W=120, HOURS_W=52;

  let H='';

  // Month header
  H+='<div style="display:flex;align-items:center;margin-bottom:4px">';
  H+='<div style="width:'+LABEL_W+'px;flex-shrink:0"></div>';
  H+='<div style="flex:1;position:relative;height:18px;border-bottom:1px solid var(--bd2)">';
  const _months={};
  for(let ms=_minMs;ms<=_maxMs;ms+=86400000){
    const d=new Date(ms);
    const key=d.getFullYear()+'-'+d.getMonth();
    if(!_months[key]) _months[key]={ms,label:d.toLocaleDateString('en-GB',{month:'short',year:'2-digit'})};
  }
  Object.values(_months).forEach(m=>{
    H+='<div style="position:absolute;top:0;font-size:10px;color:var(--fg3);transform:translateX(-50%);left:'+_pct(m.ms)+'%;white-space:nowrap">'+m.label+'</div>';
  });
  H+='</div>';
  H+='<div style="width:'+HOURS_W+'px;flex-shrink:0;text-align:right;font-size:10px;color:var(--fg3);padding-right:4px">hours</div>';
  H+='</div>';

  // Team rows
  _teams.forEach(team=>{
    H+='<div style="display:flex;align-items:center;margin-bottom:8px">';
    H+='<div style="width:'+LABEL_W+'px;flex-shrink:0;display:flex;align-items:center;gap:6px;padding-right:8px">'
      +'<span style="width:7px;height:7px;border-radius:2px;background:'+team.color+';flex-shrink:0"></span>'
      +'<span style="font-size:11px;color:var(--fg0);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+team.name+'</span>'
    +'</div>';
    H+='<div style="flex:1;position:relative;height:24px">';
    H+='<div style="position:absolute;top:50%;left:0;right:0;height:1px;background:var(--bd2);transform:translateY(-50%)"></div>';
    team.blocks.forEach(b=>{
      const left=parseFloat(_pct(b.start));
      const right=parseFloat(_pct(b.end));
      const w=Math.max(right-left,0.5);
      const tip=_fmtS(_toIso(b.start))+' → '+_fmtS(_toIso(b.end))+(b.count>1?' ('+b.count+' tasks)':'');
      H+='<div title="'+tip+'" style="position:absolute;top:50%;height:14px;border-radius:3px;background:'+team.color+';opacity:.85;transform:translateY(-50%);left:'+left+'%;width:'+w+'%"></div>';
      if(w>6){
        H+='<div style="position:absolute;top:50%;transform:translateY(-50%);left:'+left+'%;width:'+w+'%;display:flex;justify-content:space-between;align-items:center;padding:0 4px;pointer-events:none;overflow:hidden">'
          +'<span style="font-size:9px;font-weight:500;color:#fff;white-space:nowrap">'+_fmtS(_toIso(b.start))+'</span>'
          +'<span style="font-size:9px;font-weight:500;color:#fff;white-space:nowrap">'+_fmtS(_toIso(b.end))+'</span>'
        +'</div>';
      }
    });
    H+='</div>';
    const _hStr=team.totalH%1===0?team.totalH:team.totalH.toFixed(1);
    H+='<div style="width:'+HOURS_W+'px;flex-shrink:0;text-align:right;padding-right:4px;font-size:12px;font-weight:600;color:var(--fg0)">'+_hStr+'h</div>';
    H+='</div>';
  });

  el.innerHTML=H;
}
function _renderProjProgress(){
  const el=document.getElementById('dash-proj-progress');
  if(!el) return;
  const today=new Date().toISOString().slice(0,10);
  const activeProjs=PROJECTS.filter(p=>p.status==='active'||p.status==='planning');
  if(!activeProjs.length){ el.innerHTML='<div style="color:var(--fg3);font-size:11px;padding:8px">No active projects</div>'; return; }
  const sorted=[...activeProjs].sort((a,b)=>{
    if(!a.deadline&&!b.deadline) return 0;
    if(!a.deadline) return 1; if(!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  });
  let H='';
  sorted.forEach(p=>{
    const pts=TASKS.filter(t=>t.projId===p.id&&t.status!=='cancelled');
    const total=pts.length; if(!total) return;
    const done=pts.filter(t=>t.status==='done').length;
    const doing=pts.filter(t=>t.status==='doing'||t.status==='paused').length;
    const todo=total-done-doing;
    const pct=Math.round(done/total*100);
    const hTot=pts.reduce((s,t)=>s+tHours(t),0);
    const hDone=pts.filter(t=>t.status==='done').reduce((s,t)=>s+tHours(t),0);
    const hRem=hTot-hDone;
    const col=p.color||'var(--acc)';
    const pctDone=hTot>0?Math.min(100,Math.round(hDone/hTot*100)):0;
    const pctDoing=hTot>0?Math.min(100-pctDone,Math.round(doing/total*100)):0;
    const dlCol=p.deadline&&p.deadline<today?'var(--danger)':'var(--fg3)';
    const dlStr=p.deadline?'<span style="font-size:9px;color:'+dlCol+'">'+p.deadline+'</span>':'';
    const pctCol=pct>=100?'var(--ok)':pct>=50?col:'var(--fg2)';
    const doingStr=doing>0?(doing+' in progress · '):'';
    H+='<div style="margin-bottom:10px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">'
        +'<div style="display:flex;align-items:center;gap:6px;min-width:0">'
          +'<span style="width:8px;height:8px;border-radius:2px;background:'+col+';flex-shrink:0"></span>'
          +'<span style="font-size:11px;font-weight:600;color:var(--fg0);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+p.name+'</span>'
          +dlStr
        +'</div>'
        +'<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:8px">'
          +'<span style="font-size:10px;color:var(--fg3)">'+done+'/'+total+' tasks</span>'
          +'<span style="font-size:11px;font-weight:700;color:'+pctCol+';font-family:var(--mono);min-width:32px;text-align:right">'+pct+'%</span>'
        +'</div>'
      +'</div>'
      +'<div style="height:8px;background:var(--bg3);border-radius:4px;overflow:hidden;margin-bottom:2px">'
        +'<div style="height:100%;display:flex;border-radius:4px;overflow:hidden">'
          +'<div style="width:'+pctDone+'%;background:'+col+';opacity:.9;transition:width .4s"></div>'
          +'<div style="width:'+pctDoing+'%;background:'+col+';opacity:.4;transition:width .4s"></div>'
        +'</div>'
      +'</div>'
      +'<div style="display:flex;justify-content:space-between;font-size:9px;color:var(--fg3)">'
        +'<span>'+_fmtHours(hDone)+'h done · '+_fmtHours(hRem)+'h remaining</span>'
        +'<span>'+doingStr+todo+' to do</span>'
      +'</div>'
    +'</div>';
  });
  el.innerHTML=H||'<div style="color:var(--fg3);font-size:11px;padding:8px">No tasks found</div>';
}
function renderDash(){
  const h=new Date().getHours();
  const uname=S_USER?.name||'there'; document.getElementById('greet').textContent=(h<12?'Good morning':h<18?'Good afternoon':'Good evening')+', '+uname.split(' ')[0];
  const tot=TASKS.length, done=TASKS.filter(t=>t.status==='done').length,
    doing=TASKS.filter(t=>t.status==='doing').length, hold=TASKS.filter(t=>t.status==='hold').length,
    ph=TASKS.reduce((s,t)=>s+tHours(t),0), ah=TASKS.reduce((s,t)=>s+logH(t),0),
    ov=TASKS.filter(t=>t.deadline&&t.status!=='done'&&t.status!=='cancelled'&&(dateToIdx(t.deadline)<GANTT_TODAY||tEnd(t)>dateToIdx(t.deadline))).length;
  document.getElementById('dash-m').innerHTML=`
    <div class="mc a1"><div class="ml">Total tasks</div><div class="mv">${tot}</div><div class="ms">${done} done · ${doing} in progress</div></div>
    <div class="mc a2"><div class="ml">Completion</div><div class="mv">${tot?Math.round(done/tot*100):0}%</div><div class="ms">${hold} on hold</div></div>
    <div class="mc a3"><div class="ml">Planned hours</div><div class="mv">${_fmtHours(ph)}</div><div class="ms">${_fmtHours(ah)} logged (${ph>0?Math.round(ah/ph*100):0}%)</div></div>
    <div class="mc a4"><div class="ml">Overdue</div><div class="mv" style="color:${ov?'var(--danger)':'inherit'}">${ov}</div><div class="ms">tasks past deadline</div></div>
    <div class="mc a1"><div class="ml">On Hold</div><div class="mv" style="color:${hold?'var(--warn)':'inherit'}">${hold}</div><div class="ms">tasks on hold</div></div>`;

  // ── WORKLOAD GAUGES ──────────────────────────────────────────
  // Calculate load: pending hours / (working days left * dailyCap) for each resource
  const today=GANTT_TODAY;
  const LOOK_AHEAD=20; // working days
  // Count working days in next LOOK_AHEAD days
  let wdaysLeft=0;
  for(let d=today;d<today+60&&wdaysLeft<LOOK_AHEAD;d++){ if(!isNW(d)) wdaysLeft++; }

  // ── Workload: Day/Week/Month ─────────────────────────────────
  const wlView=S._wlView||'week';
  const wlOffset=S._wlOffset||0;

  function wlRange(){
    const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if(wlView==='day'){
      const d=GANTT_TODAY+wlOffset;
      return {start:d,end:d,label:sd(d)};
    }
    if(wlView==='week'){
      const dt=gDate(GANTT_TODAY+wlOffset*7);
      const dow=dt.getDay(); const mo=dow===0?-6:1-dow;
      const mon=GANTT_TODAY+wlOffset*7+mo;
      const fri=mon+4;
      const dm=gDate(mon),df=gDate(fri);
      return {start:mon,end:fri,label:`${dm.getDate()} ${MN[dm.getMonth()]} – ${df.getDate()} ${MN[df.getMonth()]}`};
    }
    const dt=gDate(GANTT_TODAY);
    const adj=new Date(dt.getFullYear(),dt.getMonth()+wlOffset,1);
    const dim=new Date(adj.getFullYear(),adj.getMonth()+1,0).getDate();
    const s=Math.round((adj-GANTT_ORIGIN)/86400000)+1;
    const MN2=['January','February','March','April','May','June','July','August','September','October','November','December'];
    return {start:s,end:s+dim-1,label:`${MN2[adj.getMonth()]} ${adj.getFullYear()}`};
  }

  function wdInRange(s,e){ let n=0; for(let d=s;d<=e;d++) if(!isNW(d)) n++; return Math.max(1,n); }

  function resHrsInRange(resId,s,e){
    let logged=0,planned=0,overdue=0;
    TASKS.forEach(t=>{
      if(t.resId!==resId&&!(t.coResIds||[]).includes(resId)) return;
      if(t.status==='cancelled'||t.status==='done') return;
      (t.timeLogs||[]).forEach(l=>{ const di=dateToIdx(l.date); if(di&&di>=s&&di<=e) logged+=l.hours||0; });
      const sc=t._sched||{};
      Object.entries(sc).forEach(([d,h])=>{ const di=+d; if(di>=s&&di<=e) planned+=h||0; });
      if(t.deadline){ const dl=dateToIdx(t.deadline);
        if(dl) Object.entries(sc).forEach(([d,h])=>{ if(+d>dl&&+d>=s&&+d<=e) overdue+=h||0; }); }
    });
    return {logged,planned,overdue};
  }

  function getResFreeDate2(resId){
    const tasks=TASKS.filter(t=>t.resId===resId&&t.status!=='done'&&t.status!=='cancelled');
    let last=0;
    tasks.forEach(t=>{ const sc=t._sched||{};
      const days=Object.keys(sc).map(Number).filter(d=>sc[d]>0.001);
      const e=days.length?Math.max(...days):tEnd(t); if(e>last) last=e; });
    return last||null;
  }

  function getTeamFreeDate2(ids){ const ds=ids.map(getResFreeDate2).filter(Boolean); return ds.length?Math.max(...ds):null; }

  function freeLabel2(d){
    if(!d||d<=GANTT_TODAY) return '<span style="color:var(--ok);font-size:9px">✓ Free now</span>';
    const diff=d-GANTT_TODAY;
    const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dt=gDate(d);
    if(diff<=7) return `<span style="color:var(--warn);font-size:9px">Free in ${diff}d</span>`;
    return `<span style="color:var(--fg3);font-size:9px">Free ${dt.getDate()} ${MN[dt.getMonth()]}</span>`;
  }

  const activeTeams=TEAMS.filter(tm=>{
    if(tm.showInDash===false) return false;
    return RESOURCES.some(r=>r.showInDash!==false&&(r.teams||[]).includes(tm.id));
  });

  const wlRange2=wlRange();
  const wdays=wdInRange(wlRange2.start,wlRange2.end);

  let gaugeHTML=`<div class="card" style="margin-top:16px">
    <div class="ch" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
      <span class="ct">Team Workload</span>
      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
        <button class="btn btn-sm btn-ic" onclick="S._wlOffset=(S._wlOffset||0)-1;renderDash()">‹</button>
        <button class="btn btn-sm" onclick="S._wlOffset=0;renderDash()" style="font-size:9px;min-width:120px;text-align:center">${wlRange2.label}</button>
        <button class="btn btn-sm btn-ic" onclick="S._wlOffset=(S._wlOffset||0)+1;renderDash()">›</button>
        <div style="display:flex;border:1px solid var(--bd);border-radius:6px;overflow:hidden;margin-left:4px">
          ${['day','week','month'].map(v=>`<button onclick="S._wlView='${v}';S._wlOffset=0;renderDash()" style="padding:3px 10px;font-size:9px;font-weight:600;border:none;cursor:pointer;background:${wlView===v?'var(--acc)':'transparent'};color:${wlView===v?'#fff':'var(--fg2)'};font-family:var(--font)">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="cb" style="padding:8px"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px">`;

  activeTeams.forEach(tm=>{
    const tmRes=RESOURCES.filter(r=>r.showInDash!==false&&(r.teams||[]).includes(tm.id));
    if(!tmRes.length) return;
    const totalCap=tmRes.reduce((s,r)=>s+(r.dailyCap||8),0)*wdays;
    let tmLogged=0,tmPlanned=0,tmOver=0;
    tmRes.forEach(r=>{ const {logged,planned,overdue}=resHrsInRange(r.id,wlRange2.start,wlRange2.end);
      tmLogged+=logged; tmPlanned+=planned; tmOver+=overdue; });
    const tmUsed=tmLogged+tmPlanned;
    const pct=totalCap>0?Math.round(tmUsed/totalCap*100):0;
    const col=pct>=100?'var(--danger)':pct>=90?'var(--warn)':pct>=70?'#f59e0b':'var(--ok)';
    const fd=getTeamFreeDate2(tmRes.map(r=>r.id));

    gaugeHTML+=`<div style="background:var(--bg2);border:1px solid var(--bd)${pct>=100?';outline:1px solid rgba(240,82,82,.4)':''};border-radius:10px;padding:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="width:8px;height:8px;border-radius:50%;background:${tm.color}"></span>
          <span style="font-size:11px;font-weight:700">${tm.name}</span>
          <span style="font-size:9px;color:var(--fg3)">${tmRes.length}p</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:6px">
          <span style="font-size:18px;font-weight:800;color:${col};font-family:var(--mono)">${pct}%</span>
          ${tmOver>0?`<span style="font-size:9px;font-weight:700;color:var(--danger);background:rgba(240,82,82,.12);padding:1px 6px;border-radius:4px">+${_fmtHours(tmOver)} OVR</span>`:''}
        </div>
      </div>
      <div style="height:7px;background:var(--bg3);border-radius:4px;overflow:hidden;margin-bottom:6px">
        <div style="height:100%;width:${Math.min(pct,100)}%;background:${col};border-radius:4px;transition:width .4s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--fg3);margin-bottom:8px">
        <span>${_fmtHours(tmLogged)} logged · ${_fmtHours(tmPlanned)} sched · ${_fmtHours(totalCap)} cap</span>
        ${freeLabel2(fd)}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        ${tmRes.map(r=>{
          const {logged,planned,overdue:rOvr}=resHrsInRange(r.id,wlRange2.start,wlRange2.end);
          const rUsed=logged+planned; const rCap=(r.dailyCap||8)*wdays;
          const rPct=rCap>0?Math.round(rUsed/rCap*100):0;
          const rCol=rPct>=100?'var(--danger)':rPct>=90?'var(--warn)':rPct>=70?'#f59e0b':'var(--ok)';
          return `<div style="flex:1;min-width:65px;background:var(--bg3);border-radius:7px;padding:6px 8px">
            <div style="font-size:9px;font-weight:600;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.name.split(' ')[0]}</div>
            <div style="height:4px;background:var(--bg2);border-radius:2px;overflow:hidden;margin-bottom:4px">
              <div style="height:100%;width:${Math.min(rPct,100)}%;background:${rCol};border-radius:2px"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:8px;gap:3px">
              <span style="color:${rCol};font-weight:700;font-family:var(--mono)">${rPct}%</span>
              ${rOvr>0?`<span style="color:var(--danger)">+${_fmtHours(rOvr)}</span>`:''}
              <span style="color:var(--fg3)">${_fmtHours(rUsed)}/${_fmtHours(rCap)}</span>
            </div>
            <div style="margin-top:3px">${freeLabel2(getResFreeDate2(r.id))}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  });

  gaugeHTML+=`</div></div></div>`;

  document.getElementById('dash-c').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="card"><div class="ch"><span class="ct">Status breakdown</span></div><div class="cb" style="display:flex;align-items:center;gap:18px">
        <div style="position:relative;width:130px;height:130px;flex-shrink:0"><canvas id="dc-s">Status chart</canvas></div>
        <div style="display:flex;flex-direction:column;gap:5px">${['todo','doing','done','hold','cancelled'].map(s=>`<div style="display:flex;align-items:center;gap:6px;font-size:11px"><span style="width:8px;height:8px;border-radius:2px;background:${SCOLS[s]}"></span><span style="color:var(--fg2)">${SLABELS[s]} — ${TASKS.filter(t=>t.status===s).length}</span></div>`).join('')}</div>
      </div></div>
      <div class="card"><div class="ch"><span class="ct">Hours by team (planned vs logged)</span></div><div class="cb" style="position:relative;height:160px"><canvas id="dc-h">Hours chart</canvas></div></div>
    </div>
    ${gaugeHTML}
    <div class="card" style="margin-top:16px">
      <div class="ch" style="justify-content:space-between">
        <span class="ct">Projects Progress</span>
        <span style="font-size:10px;color:var(--fg3)">active projects · hours remaining vs done</span>
      </div>
      <div class="cb" style="padding:8px 12px" id="dash-proj-progress"></div>
    </div>`

  _renderProjProgress();
  _renderTeamWorkload();
  setTimeout(()=>{
    ['dc-s','dc-h'].forEach(id=>{if(S.charts[id])S.charts[id].destroy();});
    S.charts['dc-s']=new Chart(document.getElementById('dc-s'),{type:'doughnut',data:{labels:Object.values(SLABELS),datasets:[{data:['todo','doing','done','hold','cancelled'].map(s=>TASKS.filter(t=>t.status===s).length),backgroundColor:['#3e4f6a','#4f9cf9','#22c55e','#f0a928','#f05252'],borderWidth:3,borderColor:'#1b2130'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'66%',plugins:{legend:{display:false}}}});
    const tIds=TEAMS.map(t=>t.id);
    S.charts['dc-h']=new Chart(document.getElementById('dc-h'),{type:'bar',data:{labels:TEAMS.map(t=>t.name.split(' ')[0]),datasets:[{label:'Planned',data:tIds.map(id=>TASKS.filter(t=>resInTeam(t.resId,id)).reduce((s,t)=>s+tHours(t),0)),backgroundColor:'rgba(79,156,249,.3)',borderRadius:3},{label:'Logged',data:tIds.map(id=>TASKS.filter(t=>resInTeam(t.resId,id)).reduce((s,t)=>s+logH(t),0)),backgroundColor:'rgba(0,201,160,.45)',borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(37,47,69,.4)'},ticks:{color:'#6e7e9e',font:{size:9}}},y:{grid:{color:'rgba(37,47,69,.4)'},ticks:{color:'#6e7e9e',callback:v=>v+'h'}}}}});
  },40);
}
function resInTeam(resId,teamId){ const r=getRes(resId); return r&&r.teams&&r.teams.includes(teamId); }

