// ============================================================
// PROJECT DEADLINE
// ============================================================
window.saveProjDl=()=>{
  const dl=document.getElementById('proj-dl-inp').value||null;
  PROJ.deadline=dl;
  // Also persist deadline on the matching PROJECTS entry
  const activeProjId=S._activeProjId||(PROJECTS.length?PROJECTS[0].id:null);
  const proj=PROJECTS.find(p=>p.id===activeProjId)||PROJECTS[0];
  if(proj) proj.deadline=dl;
  addLog({type:'project',task:PROJ?.name||'Project',from:'',to:'deadline: '+(dl||'cleared')});
  persistState(['projects','meta']);
  CM('m-proj');renderGantt();
  notify('Deadline saved','success');
};

// ============================================================
// CHANGE LOG
// ============================================================
const GLOG=[];
const LOG_TTL=55000;
const LICO={move:'→',cascade:'↷',resize:'↔',split:'⌥',status:'◉',timelog:'⏱',create:'✚',edit:'✎',delete:'✕',calendar:'📅',overdue:'⚠'};
const LCOL={move:'var(--acc)',cascade:'var(--warn)',resize:'var(--fg1)',split:'var(--acc3)',status:'var(--ok)',timelog:'#a78bfa',create:'var(--ok)',edit:'var(--fg2)',overdue:'var(--danger)',calendar:'var(--fg2)'};
function addLog(e){
  GLOG.unshift({...e,ts:Date.now(),user:S_USER?.name||'—',time:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})});
  if(GLOG.length>500) GLOG.pop();
  renderLog();
  if(S.page==='logs') renderLogsPage();
  clearTimeout(window._lt); window._lt=setTimeout(renderLog,LOG_TTL+500);
  // Persist to Firebase
  clearTimeout(addLog._ft);
  addLog._ft=setTimeout(async()=>{
    try{
      await fetch(_FB_ROOT+'/logs.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(GLOG.slice(0,500))});
    }catch(e){}
  }, 800);
}
function renderLog(){
  const el=document.getElementById('glog'),le=document.getElementById('log-e');
  if(!el||!le) return;
  if(!GLOG.length){el.style.display='none';return;}
  el.style.display='block';
  const now=Date.now();
  const rec=GLOG.filter(e=>now-e.ts<LOG_TTL);
  const show=rec.length?rec:GLOG.slice(0,1);
  le.innerHTML=show.map(e=>`<div style="display:flex;align-items:baseline;gap:5px;padding:1px 0;border-bottom:1px solid rgba(37,47,69,.3);font-size:10px;font-family:var(--mono)">
    <span style="color:var(--fg3)">${e.time}</span>
    <span style="color:${LCOL[e.type]||'var(--fg2)'}">${LICO[e.type]||'·'}</span>
    <span style="color:var(--fg0);font-weight:500">${e.task}</span>
    <span style="color:var(--fg2)">${e.from?e.from+' → ':''}<span style="color:var(--fg1)">${e.to}</span></span>
  </div>`).join('');
}
window.clearLog=()=>{
  GLOG.length=0; renderLog();
  fetch(_FB_ROOT+'/logs.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:'[]'}).catch(()=>{});
};
window.openFullLog=()=>{
  document.getElementById('flog-l').innerHTML=GLOG.length?GLOG.map(e=>`<div style="display:flex;align-items:baseline;gap:7px;padding:5px 12px;border-bottom:1px solid rgba(37,47,69,.3);font-size:10px"><span style="color:var(--fg3);min-width:40px">${e.time}</span><span style="color:${LCOL[e.type]||'var(--fg2)'}">${LICO[e.type]||'·'}</span><span style="color:var(--fg0);font-weight:500">${e.task}</span><span style="color:var(--fg2)">${e.from?e.from+' → ':''}<span style="color:var(--fg1)">${e.to}</span></span></div>`).join(''):'<div style="padding:14px;font-size:11px;color:var(--fg3)">No entries</div>';
  OM('m-flog');
};

// ============================================================
// TABLE VIEW (no time tracking, with delete)
// ============================================================
function buildTagSel(){
  const tags=allTags();
  ['tv-tag'].forEach(id=>{
    const el=document.getElementById(id);if(!el) return;
    const cur=el.value;
    el.innerHTML='<option value="">All tags</option>'+tags.map(t=>`<option value="${t}">${t}</option>`).join('');
    el.value=cur;
  });
}
function renderTable(){
  buildTagSel();
  const search=(document.getElementById('tv-s')?.value||'').toLowerCase();
  const tagF=document.getElementById('tv-tag')?.value||'';
  const incOnly=document.getElementById('tv-inc')?.checked;
  const tasks=TASKS.filter(t=>{
    if(search&&!t.name.toLowerCase().includes(search)) return false;
    if(tagF&&!(t.tags||[]).includes(tagF)) return false;
    if(incOnly&&!isInc(t)) return false;
    return true;
  });

  const H=`<table class="dt" style="min-width:900px">
    <thead><tr>
      <th style="width:28px">#</th>
      <th style="min-width:200px">Task name</th>
      <th style="width:80px">Tag</th>
      <th style="width:110px">Team</th>
      <th style="width:120px">Resource</th>
      <th style="width:50px">Hrs</th>
      <th style="width:45px">Mode</th>
      <th style="width:50px">Start</th>
      <th style="width:45px">Dur</th>
      <th style="width:50px">Prog%</th>
      <th style="width:95px">Status</th>
      <th style="width:95px">Deadline</th>
      <th style="width:30px"></th>
    </tr></thead>
    <tbody>
    ${tasks.map((t,i)=>{
      const inc=isInc(t);
      const incStyle=inc?'background:rgba(240,169,40,.04)':'';
      return `<tr style="${incStyle}">
        <td class="tc txs">${i+1}${inc?'<span style="color:var(--warn);margin-left:2px" title="Incomplete">⚠</span>':''}</td>
        <td style="max-width:200px"><input class="ie" value="${t.name.replace(/"/g,'&quot;')}" onchange="uTask('${t.id}','name',this.value)" style="min-width:190px"></td>
        <td><input class="ie" value="${(t.tags||[]).join(', ')}" onchange="uTask('${t.id}','tags',this.value.split(',').map(x=>x.trim()).filter(Boolean))" style="width:75px"></td>
        <td><select class="ie" onchange="uTask('${t.id}','teamId',this.value)" style="width:105px">
          <option value="">—</option>
          ${TEAMS.map(tm=>`<option value="${tm.id}" ${t.teamId===tm.id?'selected':''}>${tm.name}</option>`).join('')}
        </select></td>
        <td><select class="ie" onchange="uTask('${t.id}','resId',this.value);uTask('${t.id}','resource',RESOURCES.find(r=>r.id===this.value)?.name||'')" style="width:115px">
          <option value="">—</option>
          ${RESOURCES.map(r=>`<option value="${r.id}" ${t.resId===r.id?'selected':''}>${r.name}</option>`).join('')}
        </select></td>
        <td><input class="ie" type="number" value="${tHours(t)}" onchange="uTask('${t.id}','hours',+this.value)" style="width:44px"></td>
        <td style="font-size:9px;color:var(--fg2)">${t.timeMode==='daily'?'Daily':'Total'}</td>
        <td><input class="ie" type="number" value="${t.start||GANTT_TODAY}" onchange="uTask('${t.id}','start',+this.value)" style="width:44px"></td>
        <td><input class="ie" type="number" value="${t.dur||1}" onchange="uTask('${t.id}','dur',+this.value)" style="width:40px"></td>
        <td><input class="ie" type="number" value="${t.prog||0}" min="0" max="100" onchange="uTask('${t.id}','prog',+this.value)" style="width:44px"></td>
        <td><select class="ie" onchange="uTask('${t.id}','status',this.value)" style="width:90px">
          ${Object.entries(SLABELS).map(([v,l])=>`<option value="${v}" ${t.status===v?'selected':''}>${l}</option>`).join('')}
        </select></td>
        <td><input class="ie" type="date" value="${t.deadline||''}" onchange="uTask('${t.id}','deadline',this.value)" style="width:90px"></td>
        <td><button class="btn btn-xs btn-d" onclick="delTask('${t.id}')" title="Delete">✕</button></td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
  document.getElementById('tv').innerHTML=H;
}
// uTask and delTask defined in persistence section below

