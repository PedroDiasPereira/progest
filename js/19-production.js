// PRODUCTION
// ============================================================
function renderProduction(){
  const el=document.getElementById('prod-content');
  if(!el) return;
  const data=window._prodData;
  if(!data||!data.length){
    el.innerHTML='<div style="padding:40px;text-align:center;color:var(--fg3);font-size:13px">No data — click <b>📂 Load JSON</b> to import a pending lines file.</div>';
    return;
  }

  // Filter state
  if(window._prodFilterMy===undefined) window._prodFilterMy=true;
  // Default visible columns
  const ALL_COLS=['Documento','DataEntrega','CodigoArtigo','NomeArtigo','Qtd','QtdTransferida','QtdPendente','Obra','IdLinha'];
  if(!window._prodCols) window._prodCols=['Documento','DataEntrega','CodigoArtigo','NomeArtigo','Qtd','QtdTransferida','QtdPendente'];

  const search=(document.getElementById('prod-search')?.value||'').toLowerCase();
  const sortBy=document.getElementById('prod-sort')?.value||'date';

  // Update filter button
  const fbtn=document.getElementById('prod-filter-btn');
  if(fbtn){
    const canAll=isPM();
    fbtn.style.display=canAll?'':'none';
    fbtn.textContent=window._prodFilterMy?'🔒 My Projects':'🌐 All Orders';
    fbtn.style.opacity=window._prodFilterMy?'1':'0.6';
  }

  // Build set of orderIds linked to projects
  const linkedOrderIds=new Set(PROJECTS.flatMap(p=>(p.orderId||'').split(',').map(s=>s.trim()).filter(Boolean)));

  // Filter lines
  let lines=data.filter(l=>{
    if(window._prodFilterMy && !linkedOrderIds.has(l.Documento)) return false;
    if(!search) return true;
    return ['Documento','CodigoArtigo','NomeArtigo','Obra','IdLinha'].some(k=>(l[k]||'').toLowerCase().includes(search));
  });

  // Group by Documento
  const byDoc={};
  lines.forEach(l=>{
    if(!byDoc[l.Documento]) byDoc[l.Documento]={
      doc:l.Documento, lines:[], minDate:l.DataEntrega, maxDate:l.DataEntrega,
      totalQty:0, totalPend:0,
      proj:PROJECTS.find(p=>(p.orderId||'').split(',').map(s=>s.trim()).includes(l.Documento))||null
    };
    const g=byDoc[l.Documento];
    g.lines.push(l);
    g.totalQty+=(l.Qtd||0);
    g.totalPend+=(l.QtdPendente||0);
    if(l.DataEntrega<g.minDate) g.minDate=l.DataEntrega;
    if(l.DataEntrega>g.maxDate) g.maxDate=l.DataEntrega;
  });

  let groups=Object.values(byDoc);
  if(sortBy==='date') groups.sort((a,b)=>a.minDate.localeCompare(b.minDate));
  else if(sortBy==='doc') groups.sort((a,b)=>a.doc.localeCompare(b.doc));
  else if(sortBy==='qty') groups.sort((a,b)=>b.totalPend-a.totalPend);

  const today=new Date().toISOString().slice(0,10);
  const _sd=d=>{if(!d||d==='0001-01-01')return'—';const dt=new Date(d+'T00:00:00');return dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});};
  const _ov=d=>d&&d!=='0001-01-01'&&d<today;
  const _soon=d=>{if(!d||d==='0001-01-01')return false;const diff=(new Date(d+'T00:00:00')-new Date())/(1000*86400);return diff>=0&&diff<=7;};

  // Milestone diamond button
  const msBtn=(doc,line,date,label)=>{
    const proj=PROJECTS.find(p=>(p.orderId||'').split(',').map(s=>s.trim()).includes(doc));
    if(!proj) return '';
    const enc=encodeURIComponent;
    return `<button onclick="prodAddMilestone('${enc(proj.id)}','${enc(label)}','${date}')"
      title="Add milestone to project ${proj.name}"
      style="padding:0 5px;height:18px;font-size:9px;border-radius:4px;border:1px solid var(--acc);background:rgba(79,156,249,.1);color:var(--acc);cursor:pointer;line-height:18px">◆ MS</button>`;
  };

  const cols=window._prodCols;
  const colLabel={'Documento':'Order','DataEntrega':'Delivery','CodigoArtigo':'Code','NomeArtigo':'Article','Qtd':'Qty','QtdTransferida':'Transferred','QtdPendente':'Pending','Obra':'Obra ID','IdLinha':'Line ID'};

  let H=`<div style="font-size:11px;color:var(--fg3);margin-bottom:10px">${groups.length} orders · ${lines.length} lines · ${lines.reduce((a,l)=>a+(l.QtdPendente||0),0).toFixed(0)} units pending</div>`;

  groups.forEach(g=>{
    const ov=_ov(g.minDate); const soon=_soon(g.minDate);
    const borderCol=ov?'var(--danger)':soon?'var(--warn)':'var(--bd)';
    const bgCol=ov?'rgba(220,38,38,.05)':soon?'rgba(245,158,11,.05)':'var(--bg1)';
    const dateRange=g.minDate===g.maxDate?_sd(g.minDate):`${_sd(g.minDate)} → ${_sd(g.maxDate)}`;

    H+=`<div style="border:1px solid ${borderCol};border-radius:10px;margin-bottom:8px;overflow:hidden;background:${bgCol}">
      <!-- Order header -->
      <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;cursor:pointer;user-select:none"
           onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none';this.querySelector('.pa').textContent=this.nextElementSibling.style.display==='none'?'▶':'▼'">
        <span class="pa" style="font-size:10px;color:var(--fg3);width:10px;flex-shrink:0">▼</span>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-size:13px;font-weight:700;color:var(--fg0)">Order ${g.doc}</span>
            ${g.proj?`<span style="font-size:10px;padding:1px 6px;border-radius:4px;background:${g.proj.color||'var(--acc)'}22;color:${g.proj.color||'var(--acc)'};">${g.proj.name}</span>`:''}
            ${ov?'<span style="font-size:9px;font-weight:700;color:var(--danger)">⚠ OVERDUE</span>':soon?'<span style="font-size:9px;font-weight:700;color:var(--warn)">⏰ DUE SOON</span>':''}
          </div>
          <div style="font-size:10px;color:var(--fg3);margin-top:2px">${g.lines.length} line${g.lines.length!==1?'s':''} · ${g.totalPend.toFixed(0)} units pending</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          ${g.proj?msBtn(g.doc,null,g.minDate,`Order ${g.doc} delivery`):''}
          <div style="text-align:right">
            <div style="font-size:12px;font-weight:600;color:${ov?'var(--danger)':soon?'var(--warn)':'var(--fg0)'}">${dateRange}</div>
          </div>
        </div>
      </div>
      <!-- Lines table -->
      <div style="border-top:1px solid var(--bd);overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:500px">
          <thead>
            <tr style="background:var(--bg2)">
              ${cols.map(col=>`<th style="padding:5px 10px;text-align:${['Qtd','QtdTransferida','QtdPendente'].includes(col)?'right':'left'};color:var(--fg3);font-weight:600;white-space:nowrap">${colLabel[col]||col}</th>`).join('')}
              <th style="padding:5px 10px;text-align:center;color:var(--fg3);font-weight:600;white-space:nowrap">Milestone</th>
            </tr>
          </thead>
          <tbody>
            ${g.lines.map((l,i)=>{
              const lov=_ov(l.DataEntrega); const lsoon=_soon(l.DataEntrega);
              return `<tr style="border-top:1px solid var(--bd);background:${i%2?'var(--bg2)':'transparent'}">
                ${cols.map(col=>{
                  let val=l[col];
                  if(['Qtd','QtdTransferida','QtdPendente'].includes(col)){
                    const num=(val||0);
                    const color=col==='QtdPendente'?(num>0?'var(--warn)':'var(--ok)'):col==='QtdTransferida'?'var(--ok)':'var(--fg1)';
                    return `<td style="padding:5px 10px;text-align:right;font-weight:${col==='QtdPendente'?'600':'400'};color:${color}">${num.toFixed(0)}</td>`;
                  }
                  if(col==='DataEntrega'){
                    return `<td style="padding:5px 10px;white-space:nowrap;color:${lov?'var(--danger)':lsoon?'var(--warn)':'var(--fg0)'}">
                      ${_sd(val)}${lov?' ⚠':lsoon?' ⏰':''}</td>`;
                  }
                  if(col==='CodigoArtigo') return `<td style="padding:5px 10px;font-family:var(--mono);font-size:10px;color:var(--fg3);white-space:nowrap">${val||'—'}</td>`;
                  if(col==='Obra'||col==='IdLinha') return `<td style="padding:5px 10px;font-family:var(--mono);font-size:9px;color:var(--fg3);white-space:nowrap">${(val||'').slice(0,18)}…</td>`;
                  return `<td style="padding:5px 10px;color:var(--fg0)">${val||'—'}</td>`;
                }).join('')}
                <td style="padding:5px 10px;text-align:center">${g.proj?msBtn(g.doc,l,l.DataEntrega,`${l.CodigoArtigo||l.NomeArtigo}`):'—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  });

  if(!groups.length) H+='<div style="padding:40px;text-align:center;color:var(--fg3)">No orders found'+( search?` for "${search}"`:'')+(window._prodFilterMy?' — try switching to All Orders':'')+' </div>';
  el.innerHTML=H;
}

window.prodToggleFilter=()=>{
  if(!isPM()){ notify('Only PM/Admin can view all orders','warn'); return; }
  window._prodFilterMy=!window._prodFilterMy;
  renderProduction();
};

window.prodAddMilestone=(projId,label,date)=>{
  projId=decodeURIComponent(projId); label=decodeURIComponent(label);
  const proj=PROJECTS.find(p=>p.id===projId);
  if(!proj){ notify('Project not found','warn'); return; }
  const name=prompt('Milestone name:',label);
  if(!name) return;
  const idx=dateToIdx(date);
  if(!idx){ notify('Invalid date','warn'); return; }
  MILESTONES.push({id:'ms'+Date.now().toString(36),name,dayIdx:idx,color:proj.color||'#7b61ff',taskIds:[],projId,shape:'circle'});
  addLog({type:'milestone',task:name,from:'',to:'created from Production ('+proj.name+')'});
  persistState(['milestones']);
  notify('Milestone "'+name+'" added to '+proj.name,'success');
  renderGantt();
};

window.prodCols=()=>{
  const ALL=['Documento','DataEntrega','CodigoArtigo','NomeArtigo','Qtd','QtdTransferida','QtdPendente','Obra','IdLinha'];
  const labels={'Documento':'Order','DataEntrega':'Delivery','CodigoArtigo':'Code','NomeArtigo':'Article','Qtd':'Qty','QtdTransferida':'Transferred','QtdPendente':'Pending','Obra':'Obra ID','IdLinha':'Line ID'};
  const cur=window._prodCols||[];
  const old=document.getElementById('_prodColsPanel');
  if(old){old.remove();return;}
  const panel=document.createElement('div');
  panel.id='_prodColsPanel';
  panel.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:500;background:var(--bg2);border:1px solid var(--bd2);border-radius:12px;padding:16px;min-width:220px;box-shadow:0 4px 20px rgba(0,0,0,.5)';
  panel.innerHTML='<div style="font-size:13px;font-weight:700;margin-bottom:10px;color:var(--fg0)">Visible columns</div>'+
    ALL.map(col=>`<label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:12px;color:var(--fg1)">
      <input type="checkbox" ${cur.includes(col)?'checked':''} onchange="prodToggleCol('${col}',this.checked)" style="accent-color:var(--acc)">
      ${labels[col]||col}</label>`).join('')+
    '<button onclick="document.getElementById(\'_prodColsPanel\')?.remove()" style="margin-top:10px;width:100%;" class="btn btn-sm btn-p">Done</button>';
  document.body.appendChild(panel);
};

window.prodToggleCol=(col,on)=>{
  if(!window._prodCols) window._prodCols=['Documento','DataEntrega','CodigoArtigo','NomeArtigo','Qtd','QtdTransferida','QtdPendente'];
  if(on){ if(!window._prodCols.includes(col)) window._prodCols.push(col); }
  else { window._prodCols=window._prodCols.filter(c=>c!==col); }
  renderProduction();
};

window.prodLoadFile=()=>{
  // Reset input so same file can be selected again
  const inp=document.getElementById('prod-file-input');
  if(!inp) return;
  inp.value='';
  inp.click();
};

window.prodFileChanged=(input)=>{
  const file=input.files[0];
  if(!file){ return; }
  if(!file.name.endsWith('.json')){
    prodShowMsg('Please select a .json file.','error'); return;
  }
  const reader=new FileReader();
  reader.onerror=()=>prodShowMsg('Error reading file.','error');
  reader.onload=e=>{
    try{
      let text=e.target.result;
      // Strip UTF-8 BOM if present
      if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
      // Strip line breaks that may appear inside numbers in this JSON
      while(text.indexOf('\r')>=0||text.indexOf('\n')>=0){ text=text.split('\r').join('').split('\n').join(''); }
      const data=JSON.parse(text);
      const lines=data.LinhasPendentes||data||[];
      if(!Array.isArray(lines)||!lines.length){
        prodShowMsg('File loaded but no lines found (expected "LinhasPendentes" array).','error');
        return;
      }
      window._prodData=lines;
      const ts=new Date().toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
      try{ sessionStorage.setItem('pg_prod',JSON.stringify({data:lines,ts})); }catch(e){}
      // Save to Firebase so all users see the same data
      fetch(_FB_ROOT+'/production.json',{method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({data:lines,ts,file:file.name})})
        .then(()=>prodShowMsg('Loaded & saved: '+lines.length+' lines from '+file.name,'ok'))
        .catch(()=>prodShowMsg('Loaded '+lines.length+' lines (Firebase save failed)','ok'));
      const upd=document.getElementById('prod-updated');
      if(upd) upd.textContent='Last loaded: '+ts+' — '+file.name+' ('+lines.length+' lines)';
      renderProduction();
    }catch(err){
      prodShowMsg('Invalid JSON: '+err.message,'error');
    }
  };
  reader.readAsText(file,'utf-8');
};

function prodShowMsg(msg,type){
  const el=document.getElementById('prod-content');
  if(!el) return;
  const col=type==='error'?'var(--danger)':type==='ok'?'var(--ok)':'var(--fg2)';
  const banner=document.createElement('div');
  banner.style.cssText='padding:10px 14px;border-radius:8px;font-size:12px;margin-bottom:10px;background:'+
    (type==='error'?'rgba(220,38,38,.1)':'rgba(34,197,94,.1)')+';color:'+col+';border:1px solid '+col;
  banner.textContent=msg;
  el.prepend(banner);
  setTimeout(()=>banner.remove(),5000);
}

// Load prod data from Firebase (authoritative) then fallback to sessionStorage
(async()=>{
  try{
    const r=await fetch(_FB_ROOT+'/production.json');
    if(r.ok){
      const d=await r.json();
      if(d&&d.data&&d.data.length){
        window._prodData=d.data;
        try{sessionStorage.setItem('pg_prod',JSON.stringify(d));}catch(e){}
        const upd=document.getElementById('prod-updated');
        if(upd) upd.textContent='Last loaded: '+(d.ts||'—')+' — '+(d.file||'')+(d.data?' ('+d.data.length+' lines)':'');
        if(S.page==='production') renderProduction();
        return;
      }
    }
  }catch(e){}
  // Fallback to sessionStorage
  try{
    const saved=sessionStorage.getItem('pg_prod');
    if(saved){
      const parsed=JSON.parse(saved);
      window._prodData=parsed.data||parsed;
      const upd=document.getElementById('prod-updated');
      if(upd&&parsed.ts) upd.textContent='Last loaded: '+parsed.ts+' (cached)';
    }
  }catch(e){}
})();
window.renderProduction=renderProduction;


window.setTaskType=(type)=>{
  const isCont=type==='continuous';
  // Sync radio buttons
  const rCont=document.getElementById('tt-cont'); if(rCont) rCont.checked=isCont;
  const rDaily=document.getElementById('tt-daily'); if(rDaily) rDaily.checked=!isCont;
  // Active panel: full opacity + fields enabled; inactive: dimmed + fields disabled
  const cp=document.getElementById('tt-cont-panel'); const dp=document.getElementById('tt-daily-panel');
  if(cp) cp.style.opacity=isCont?'1':'0.45';
  if(dp) dp.style.opacity=isCont?'0.45':'1';
  document.querySelectorAll('#tt-cont-fields input,#tt-cont-fields select,#tt-cont-fields button').forEach(el=>{ el.disabled=!isCont; });
  document.querySelectorAll('#tt-daily-fields input,#tt-daily-fields select,#tt-daily-fields button').forEach(el=>{ el.disabled=isCont; });
  if(typeof setTM==='function'){ if(isCont) setTM('total'); else setTM('daily'); }
  // Redistribute after DOM updates
  requestAnimationFrame(()=>{ if(_taskTeams.flatMap(tt=>tt.entries).length) _distributeHoursAll(); });
  _updateAllocVisibility();
};

// Show/hide allocation controls based on current modal state.
function _updateAllocVisibility(){
  const nRes=_taskTeams.flatMap(tt=>tt.entries).length;
  const isDaily=(S.tm==='daily')||document.getElementById('tt-daily')?.checked;
  const assignType=document.getElementById('mt-assign-type')?.value||'direct';
  // Simultaneous only with >1 resource
  const simulRow=document.getElementById('mt-simul-row');
  if(simulRow) simulRow.style.display=(nRes>1&&assignType==='direct')?'flex':'none';
  // Fixed dates only for daily tasks
  const fixedRow=document.getElementById('mt-fixed-row');
  if(fixedRow) fixedRow.style.display=isDaily?'flex':'none';
  // Team-pool options only when assignType=team
  const teamOpts=document.getElementById('mt-team-opts');
  if(teamOpts) teamOpts.style.display=assignType==='team'?'block':'none';
}

window._onAssignTypeChange=()=>{
  const assignType=document.getElementById('mt-assign-type')?.value||'direct';
  if(assignType==='team'){
    // Populate team selector from existing teams
    const sel=document.getElementById('mt-team-ref');
    if(sel && sel.options.length<=1){
      TEAMS.forEach(t=>{ const o=document.createElement('option'); o.value=t.id; o.textContent=t.name; sel.appendChild(o); });
    }
  }
  _updateAllocVisibility();
};
window.toggleWD=(btn)=>{ if(!btn.disabled){ btn.classList.toggle('on'); setTimeout(_distributeHoursAll,10); } };
window.mtProjChange=()=>{};
function _nextFreeDay(resId){
  if(!resId) return GANTT_TODAY;
  let d=GANTT_TODAY;
  for(let i=0;i<60;i++){
    if(!isNW(d)){ const load=getDayLoad(resId,d,null); if(load<(getRes(resId)?.dailyCap||HPD)) return d; }
    d++;
  }
  return GANTT_TODAY;
}

// Populate flat "add resource" dropdown grouped by team
function _populateResAddFlat(){
  const sel=document.getElementById('mt-res-add-flat');
  if(!sel) return;
  // Get already-added resource IDs
  const addedIds=new Set(_taskTeams.flatMap(tt=>tt.entries.map(e=>e.id)));
  let html='<option value="">— add resource —</option>';
  TEAMS.forEach(tm=>{
    const res=RESOURCES.filter(r=>(r.teams||[]).includes(tm.id)&&!addedIds.has(r.id));
    if(!res.length) return;
    html+=`<optgroup label="${tm.name}">`;
    res.forEach(r=>{ html+=`<option value="${r.id}|${tm.id}">${r.name}</option>`; });
    html+=`</optgroup>`;
  });
  // Resources with no team
  const noTeam=RESOURCES.filter(r=>(!r.teams||!r.teams.length)&&!addedIds.has(r.id));
  if(noTeam.length){
    html+=`<optgroup label="No team">`;
    noTeam.forEach(r=>{ html+=`<option value="${r.id}|">${r.name}</option>`; });
    html+=`</optgroup>`;
  }
  sel.innerHTML=html;
  // Sync combo-search list
  _buildResSearchItems();
}

window.addResFlat=()=>{
  const sel=document.getElementById('mt-res-add-flat');
  if(!sel||!sel.value) return;
  const [resId,teamId]=sel.value.split('|');
  if(!resId) return;
  // Find or create team bucket
  let tt=_taskTeams.find(t=>t.teamId===teamId);
  if(!tt){
    tt={teamId,entries:[]};
    _taskTeams.push(tt);
  }
  if(!tt.entries.find(e=>e.id===resId)){
    tt.entries.push({id:resId,hours:0});
    _distributeHoursAll();
    _populateResAddFlat();
    renderTeamResList();
  }
  sel.value='';
};

// ── COLLECTIVE HOLIDAYS ──────────────────────────────────────
function _renderCollHolList(){
  const el=document.getElementById('ch-list'); if(!el) return;
  if(!COLLECTIVE_HOLIDAYS.length){ el.innerHTML='<div style="font-size:11px;color:var(--fg3);padding:4px">No collective holidays defined.</div>'; return; }
  el.innerHTML=COLLECTIVE_HOLIDAYS.map((ch,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--bd2);border-radius:var(--r8);margin-bottom:6px;background:var(--bg1)">
    <span style="font-size:16px">📅</span>
    <div style="flex:1">
      <div style="font-size:11px;font-weight:600;color:var(--fg0)">${ch.name||'Holiday'}</div>
      <div style="font-size:10px;color:var(--fg3)">${ch.start} → ${ch.end}</div>
    </div>
    <button onclick="removeCollectiveHoliday(${i})" style="background:none;border:none;cursor:pointer;color:var(--fg3);font-size:11px;padding:0 4px">✕</button>
  </div>`).join('');
}

window.openCollectiveHolidays=()=>{
  if(!isAdmin()){notify('Only admins can manage collective holidays','warn');return;}
  document.getElementById('ch-start').value='';
  document.getElementById('ch-end').value='';
  document.getElementById('ch-name').value='';
  _renderCollHolList();
  OM('m-coll-hol');
};

window.addCollectiveHoliday=()=>{
  const start=document.getElementById('ch-start').value;
  const end=document.getElementById('ch-end').value||start;
  const name=document.getElementById('ch-name').value.trim();
  if(!start){notify('Please select a start date','warn');return;}
  if(end<start){notify('End date must be after start date','warn');return;}
  COLLECTIVE_HOLIDAYS.push({start,end,name:name||'Collective holiday'});
  _applyCollectiveHolidays();
  persistState(['meta']);
  renderGantt();
  _renderCollHolList();
  document.getElementById('ch-start').value='';
  document.getElementById('ch-end').value='';
  document.getElementById('ch-name').value='';
  addLog({type:'resource',task:'Collective holiday',from:'',to:`added: ${name||'Holiday'} ${start}→${end}`});
  notify('Collective holiday added','success');
};

window.removeCollectiveHoliday=(idx)=>{
  const ch=COLLECTIVE_HOLIDAYS.splice(idx,1)[0];
  // Rebuild DIS_DAYS: remove only days from this removed holiday, keep manual ones
  const _s=dateToIdx(ch?.start), _e=dateToIdx(ch?.end);
  if(_s&&_e){ for(let d=_s;d<=_e;d++) DIS_DAYS.delete(String(d)); }
  _applyCollectiveHolidays();
  persistState(['meta']);
  renderGantt();
  _renderCollHolList();
  addLog({type:'resource',task:'Collective holiday',from:'',to:`removed: ${ch?.name||''} ${ch?.start||''}→${ch?.end||''}`});
  notify('Collective holiday removed','warn');
};

// ── TIME OFF ─────────────────────────────────────────────────
let _toResId=null;

function _syncTimeOffToDays(resId){
  // Rebuild RES_DAYS.disabled for this resource from timeOff array
  const r=getRes(resId); if(!r) return;
  if(!RES_DAYS.has(resId)) RES_DAYS.set(resId,{enabled:new Set(),disabled:new Set()});
  const rd=RES_DAYS.get(resId);
  // Clear existing time-off days (keep manually disabled days — prefixed with 'to:')
  // We store time-off day keys without prefix, so clear all and re-add manual ones
  rd.disabled=new Set([...rd.disabled].filter(k=>k.startsWith('m:')));
  // Add all time-off days — ONLY full-day time-offs block the whole day.
  // Partial time-offs (allDay===false) do NOT disable the day; their hours are
  // subtracted later by dayCapacity(). Otherwise a 2h time-off would wrongly
  // mark the entire day as non-working.
  (r.timeOff||[]).forEach(to=>{
    if(!to.start||!to.end) return;
    if(to.allDay===false) return; // partial — handled by dayCapacity
    const s=dateToIdx(to.start), e=dateToIdx(to.end);
    if(!s||!e) return;
    for(let d=s;d<=e;d++) rd.disabled.add(String(d));
  });
}

function _renderTimeOffList(){
  const el=document.getElementById('to-list'); if(!el) return;
  const r=getRes(_toResId); if(!r){ el.innerHTML=''; return; }
  const items=(r.timeOff||[]).sort((a,b)=>a.start.localeCompare(b.start));
  if(!items.length){ el.innerHTML='<div style="font-size:11px;color:var(--fg3);padding:4px">No time off scheduled.</div>'; return; }
  const icons={vacation:'🏖',sick:'🤒',local_holiday:'📅',other:'📌'};
  el.innerHTML=items.map((to,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--bd2);border-radius:var(--r8);margin-bottom:6px;background:var(--bg1)">
    <span style="font-size:14px">${icons[to.type]||'📌'}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:11px;font-weight:600;color:var(--fg0)">${to.start} → ${to.end}${to.allDay===false?` <span style="color:var(--warn);font-weight:500">· ${to.hours}h/day</span>`:''}</div>
      <div style="font-size:10px;color:var(--fg3)">${to.note||to.type}</div>
    </div>
    <button onclick="removeTimeOff('${_toResId}',${i})" style="background:none;border:none;cursor:pointer;color:var(--fg3);font-size:11px;padding:0 4px">✕</button>
  </div>`).join('');
}

window.openTimeOff=(resId)=>{
  _toResId=resId;
  const r=getRes(resId); if(!r) return;
  document.getElementById('to-res-name').textContent=r.name;
  document.getElementById('to-start').value='';
  document.getElementById('to-end').value='';
  document.getElementById('to-note').value='';
  document.getElementById('to-type').value='vacation';
  { const _ad=document.getElementById('to-allday'); if(_ad) _ad.value='true'; }
  { const _hw=document.getElementById('to-hours-wrap'); if(_hw) _hw.style.display='none'; }
  _renderTimeOffList();
  OM('m-timeoff');
};

window.addTimeOff=()=>{
  const start=document.getElementById('to-start').value;
  const end=document.getElementById('to-end').value||start;
  const type=document.getElementById('to-type').value;
  const note=document.getElementById('to-note').value.trim();
  if(!start){notify('Please select a start date','warn');return;}
  if(end<start){notify('End date must be after start date','warn');return;}
  const r=getRes(_toResId); if(!r) return;
  const allDay=(document.getElementById('to-allday')?.value||'true')==='true';
  let hours=null;
  if(!allDay){
    hours=parseFloat(document.getElementById('to-hours')?.value)||0;
    if(hours<=0){notify('Partial time off needs hours > 0','warn');return;}
    const _cap=r.dailyCap||HPD;
    if(hours>=_cap){notify(`Partial hours (${hours}h) ≥ daily cap (${_cap}h). Use "Full day" instead.`,'warn');return;}
  }
  if(!r.timeOff) r.timeOff=[];
  r.timeOff.push({start,end,type,note,allDay,hours});
  _syncTimeOffToDays(_toResId);
  addLog({type:'resource',task:r.name,from:'',to:`time off added: ${type} ${start}→${end}${allDay?'':` (${hours}h/day)`}${note?' ('+note+')':''}`});
  persistState(['resources','meta']);
  renderGantt();
  _renderTimeOffList();
  document.getElementById('to-start').value='';
  document.getElementById('to-end').value='';
  document.getElementById('to-note').value='';
  notify('Time off added','success');
};

window._onToAllDayChange=()=>{
  const allDay=(document.getElementById('to-allday')?.value||'true')==='true';
  const wrap=document.getElementById('to-hours-wrap');
  if(wrap) wrap.style.display=allDay?'none':'block';
};

window.removeTimeOff=(resId,idx)=>{
  const r=getRes(resId); if(!r||!r.timeOff) return;
  const _removed=r.timeOff.splice(idx,1)[0];
  _syncTimeOffToDays(resId);
  addLog({type:'resource',task:r.name,from:'',to:`time off removed: ${_removed?.type||''} ${_removed?.start||''}→${_removed?.end||''}`});
  persistState(['resources','meta']);
  renderGantt();
  _renderTimeOffList();
  notify('Time off removed','warn');
};

// ── CSV IMPORT ───────────────────────────────────────────────
let _csvParsed=[];

window.openImportCSV=()=>{
  if(!isAdmin()){notify('Only admins can import tasks','warn');return;}
  _csvParsed=[];
  document.getElementById('csv-preview').style.display='none';
  document.getElementById('csv-import-btn').style.display='none';
  document.getElementById('csv-file-input').value='';
  document.getElementById('csv-drop-zone').style.borderColor='var(--bd2)';
  OM('m-import-csv');
};

window.downloadCSVTemplate=()=>{
  const rows=[
    ['external_id','name','project','group','type','total_hours','hours_per_day','start_date','end_date','deadline','status','tags','notes','resource','resource_hours','weekdays'],
    ['EXT-001','Task name (required)','Project name or ID (required)','Group name','continuous or daily','8','0','2026-06-01','2026-06-05','2026-06-30','todo','tag1,tag2','Notes here','Resource name (use ; for multiple)','Hours per resource (use ; for multiple)','Mon,Tue,Wed,Thu,Fri'],
    ['EXT-002','Install panels','PAZZI','Mechanical','continuous','16','','','','2026-07-15','todo','ROB','Install solar panels','João Silva','16','Mon,Tue,Wed,Thu,Fri'],
    ['EXT-003','Multi-res task','PAZZI','Mechanical','continuous','24','','','','2026-07-15','todo','','Task with 2 resources','João Silva;Maria Santos','16;8','Mon,Tue,Wed,Thu,Fri'],
    ['EXT-004','Daily check','PAZZI','Electrical','daily','','2','2026-06-10','2026-06-20','','todo','','Daily inspection','Maria Santos','','Mon,Tue,Wed,Thu,Fri'],
  ];
  const csv=rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='task_import_template.csv';
  a.click();
};

function _parseCSV(text){
  // RFC 4180 compliant parser — handles multiline fields, escaped quotes, Excel exports
  text=text.replace(/^﻿/,'');

  // Parse entire text char by char to handle quoted fields spanning lines
  function parseAll(txt, sep){
    const rows=[];
    let row=[], cur='', inQ=false, i=0;
    while(i<txt.length){
      const ch=txt[i];
      if(inQ){
        if(ch==='"'){
          if(txt[i+1]==='"'){cur+='"';i+=2;continue;} // escaped quote
          else{inQ=false;i++;continue;} // end quote
        }
        cur+=ch; i++;
      } else {
        if(ch==='"'){inQ=true;i++;continue;}
        if(ch===sep){row.push(cur.trim());cur='';i++;continue;}
        if(ch==='\r'&&txt[i+1]==='\n'){row.push(cur.trim());cur='';rows.push(row);row=[];i+=2;continue;}
        if(ch==='\n'){row.push(cur.trim());cur='';rows.push(row);row=[];i++;continue;}
        cur+=ch; i++; // advance — prevents infinite loop
      }
    }
    if(cur||row.length){row.push(cur.trim());rows.push(row);}
    return rows.filter(r=>r.some(c=>c));
  }

  // Auto-detect separator from first non-quoted content
  const firstLine=text.split('\n')[0];
  const sep=firstLine.replace(/"[^"]*"/g,'').includes(';')?';':',';
  const rows=parseAll(text,sep);
  if(!rows.length) return [];

  // Handle Excel-wrapped header: entire header as single quoted field
  let headers=rows[0];
  if(headers.length===1&&headers[0].includes(sep)){
    // Single field containing all headers separated by sep
    headers=headers[0].split(sep).map(h=>h.trim());
  }
  headers=headers.map(h=>h.replace(/^"|"$/g,'').trim().toLowerCase());

  return rows.slice(1).map((cols,li)=>{
    const row={_line:li+2};
    headers.forEach((h,i)=>{ row[h]=(cols[i]||'').replace(/^"|"$/g,'').trim(); });
    return row;
  });
}

// Map new ClickUp-style CSV format to internal format
// _PROJ_ID_MAP is now dynamic — built from PROJECTS.externalId
function _getProjIdMap(){
  const map={};
  PROJECTS.forEach(p=>{ if(p.externalId) map[p.externalId.trim()]=p.name; });
  return map;
}
const _PROJ_ID_MAP={};
const _STATUS_MAP={
  'to do':'todo','in progress':'doing','critical':'doing',
  'on hold':'hold','review':'ready','completed':'done',
  'migrated':'done','canceled':'cancelled','closed':'done',
};
const _SKIP_STATUSES=new Set(['completed','migrated','canceled','closed']);


function _mapNewCSVRow(row){
  const rawStatus=(row['status']||'').trim().toLowerCase();

  // Map project from Home Location ID
  const homeLocId=(row['home location id']||'').trim();
  const _dynMap=_getProjIdMap(); const projName=_dynMap[homeLocId]||null;

  // Map status
  const mappedStatus=_STATUS_MAP[rawStatus]||'todo';

  // Map hours: Time Estimated is in ms (divide by 1000 to get seconds, then /3600 for hours)
  const timeEstMs=parseFloat(row['time estimated']||'0')||0;
  const hours=timeEstMs>0?Math.round(timeEstMs/1000/3600*10)/10:0;

  // Map assignees: format is [name1,name2] or [name]
  let assigneeStr=(row['assignees']||'').trim();
  if(assigneeStr.startsWith('[')) assigneeStr=assigneeStr.slice(1);
  if(assigneeStr.endsWith(']')) assigneeStr=assigneeStr.slice(0,-1);
  let assignees=assigneeStr.split(',').map(s=>s.trim()).filter(Boolean);

  // Tags: if [sr hélder] add Hélder Parente
  const tagsStr=(row['tags']||'').trim().toLowerCase();
  if(tagsStr.includes('sr hélder')||tagsStr.includes('sr helder')){
    if(!assignees.some(a=>a.toLowerCase().includes('hélder')||a.toLowerCase().includes('helder'))){
      assignees.push('Hélder Parente');
    }
  }
  // Tags: if [outros recursos] add Outros Recursos
  if(tagsStr.includes('outros recursos')){
    if(!assignees.some(a=>a.toLowerCase().includes('outros recursos'))){
      assignees.push('Outros Recursos');
    }
  }

  // Map time spent: milliseconds -> hours (same as time estimated)
  const timeSpentMs=parseFloat((row['time spent']||'0').replace(/[^0-9.]/g,''))||0;
  const spentHours=timeSpentMs>0?Math.round(timeSpentMs/1000/3600*100)/100:0;

  return {
    external_id: (row['task id']||'').trim(),
    _rawStatus: rawStatus,
    _rawSpentHours: spentHours,
    _line: row._line,
    name: (row['task name']||'').trim(),
    project: projName,
    group: (()=>{
      const _n=(row['task name']||'').trim();
      if(_n.includes(' - 1')) return 'REQUISITOS E ESPECIFICAÇÃO';
      if(_n.includes(' - 2')) return 'PROTÓTIPO';
      if(_n.includes(' - 3')) return 'VALIDAÇÃO';
      if(_n.includes(' - 4')) return 'HANDOVER';
      if(_n.includes(' - 5')) return 'AVALIAÇÃO DE RISCOS TÉCNICOS';
      if(_n.includes(' - 6')) return 'PROJETO';
      return null;
    })(),
    type: 'continuous',
    total_hours: hours>0?String(hours):'0',
    hours_per_day: '',
    start_date: '',
    end_date: '',
    deadline: '',
    status: mappedStatus,
    tags: '',
    notes: '',
    resource: assignees.join(';'),
    resource_hours: '',
    weekdays: '',
  };
}

function _validateCSVRow(row){
  const errors=[];
  if(!row.name) errors.push('name is required');
  if(!row.project) errors.push('project is required');
  const _pq=(row.project||'').trim().toLowerCase();
  const proj=PROJECTS.find(p=>p.name.toLowerCase()===_pq||p.id.toLowerCase()===_pq||(p.orderId||'').split(',').map(s=>s.trim().toLowerCase()).includes(_pq));
  if(!proj){
    const _tid2=row.external_id?('['+row.external_id+'] '):'';
    const _label2=(_tid2+(row.name||'')).slice(0,50);
    const _noMap=row.project&&!PROJECTS.find(p=>p.externalId===row.project);
    const _hint=_noMap?' (Home Location ID not mapped — set External Project ID in project settings)':'';
    errors.push('project not found'+_hint+' — '+_label2);
  }
  const type=(row.type||'continuous').toLowerCase();
  if(!['continuous','daily'].includes(type)) errors.push(`type must be "continuous" or "daily"`);
  if(row.status&&!['todo','doing','done','hold','cancelled','ready','inprogress','onhold'].includes(row.status)) errors.push(`invalid status "${row.status}"`);
  // Warn about resources not found
  const _resNames=(row.resource||'').split(';').map(s=>s.trim()).filter(Boolean);
  if(_resNames.length){
    const notFound=_resNames.filter(name=>!RESOURCES.find(r=>r.name.toLowerCase()===name.toLowerCase()||r.id.toLowerCase()===name.toLowerCase()));
    if(notFound.length){ const _tid=row.external_id?('['+row.external_id+'] '):''; const _label=(_tid+(row.name||'')).slice(0,50); errors.push('resource'+(notFound.length>1?'s':'')+' not found: '+notFound.join(', ')+' — '+_label); }
  } // no resource — silently skip creation (no error shown)
  // No hours — silently skip creation (no error shown)
  return {errors,proj,type};
}

window.handleCSVFile=(file)=>{
  if(!file) return;
  const reader=new FileReader();
  // Try UTF-8 first, fallback to Latin-1 if garbled
  reader.onload=e=>{
    let text=e.target.result;
    // Detect if first line looks like a header — if not, prepend it
    const firstLine=text.split(/\r?\n/)[0];
    const knownHeaders=['task id','task name','home location','name','project'];
    const hasHeader=knownHeaders.some(h=>firstLine.toLowerCase().includes(h));
    if(!hasHeader) text='name,project,group,type,total_hours,hours_per_day,start_date,end_date,deadline,status,tags,notes,resource,resource_hours,weekdays\n'+text;
    _processCSV(text);
  };
  // Detect encoding: try UTF-8 first, fallback to Latin-1
  const fr=new FileReader();
  fr.onload=e=>{
    let t=e.target.result;
    // Check if result contains replacement chars (UTF-8 read as Latin-1 issue)
    if(t.includes('ï»¿')||t.charCodeAt(0)===65279){
      // Has UTF-8 BOM but read as Latin-1 — re-read as UTF-8
      const fr2=new FileReader();
      fr2.onload=e2=>reader.onload({target:e2.target});
      fr2.readAsText(file,'UTF-8');
    } else {
      reader.onload({target:e.target});
    }
  };
  fr.readAsText(file,'UTF-8');
};

window.handleCSVDrop=(file)=>{
  if(!file||!file.name.endsWith('.csv')){notify('Please upload a .csv file','warn');return;}
  handleCSVFile(file);
};

function _processCSV(text){
  // Detect lines wrapped in outer quotes (Excel export issue)
  const rawLines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(l=>l.trim()).slice(1); // skip header
  const quotedLines=[];
  rawLines.forEach((line,i)=>{
    if(line.startsWith('"')&&line.endsWith('"')&&!line.slice(1,-1).includes('""')){
      quotedLines.push(i+2); // +2: 1-based + skip header
    }
  });

  let parsedRows=_parseCSV(text);
  // Debug: show parsed row count
  // Always use ClickUp format mapping
  const rows=parsedRows.map(r=>_mapNewCSVRow(r)).filter(r=>r&&r.name);
  _csvParsed=rows;
  const preview=document.getElementById('csv-preview');
  const summary=document.getElementById('csv-preview-summary');
  const errorsEl=document.getElementById('csv-preview-errors');
  const tableEl=document.getElementById('csv-preview-table');
  const importBtn=document.getElementById('csv-import-btn');
  preview.style.display='';
  if(!rows.length){
    summary.textContent='No valid rows found.';
    const quotedWarn=quotedLines.length?'<div style="background:rgba(240,169,40,.08);border:1px solid rgba(240,169,40,.3);border-radius:var(--r8);padding:8px 10px;margin-bottom:8px"><div style="font-size:11px;font-weight:600;color:var(--warn);margin-bottom:4px">⚠ Rows wrapped in quotes detected</div><div style="font-size:10px;color:var(--fg2)">Row'+(quotedLines.length>1?'s':'')+' '+quotedLines.join(', ')+' appear to be wrapped in outer quotes, which prevents correct parsing. Fields containing commas must be individually quoted, not the entire row.</div></div>':'';
    errorsEl.innerHTML=quotedWarn;
    tableEl.innerHTML='';
    importBtn.style.display='none';
    return;
  }
  // Only validate rows that will be created or updated — skip ignored rows
  let allErrors=[];
  rows.forEach(row=>{
    const willUpdate=row.external_id&&TASKS.find(t=>t.externalId===row.external_id);
    const willCreate=!_SKIP_STATUSES.has(row._rawStatus||'')&&(parseFloat(row.total_hours||'0')||0)>0&&(row.resource||'').trim().length>0;
    if(!willUpdate&&!willCreate) return; // silently skipped
    const {errors}=_validateCSVRow(row);
    if(errors.length) allErrors.push({line:row._line,errors});
  });
  // Preview table
  const validRows=rows.filter(r=>_validateCSVRow(r).errors.length===0);
  // Classify all rows
  const _toUpdate2=rows.filter(r=>r.external_id&&TASKS.find(t=>t.externalId===r.external_id));
  // Detect which updates actually have changes
  window._hasChanges=function(r){
    const t=TASKS.find(x=>x.externalId===r.external_id);
    if(!t) return false;
    const proj=PROJECTS.find(p=>p.name.toLowerCase()===(r.project||'').toLowerCase()||p.id.toLowerCase()===(r.project||'').toLowerCase()||(p.orderId||'').split(',').map(s=>s.trim().toLowerCase()).includes((r.project||'').toLowerCase()));
    if(t.name!==(r.name||'')) { console.log('[DIFF]',r.external_id,'name:',JSON.stringify(t.name),'vs',JSON.stringify(r.name)); return true; }
    if(proj&&t.projId!==proj.id) { console.log('[DIFF]',r.external_id,'proj:',t.projId,'vs',proj.id); return true; }
    if(t.group!==(r.group||'PROTÓTIPO')) { console.log('[DIFF]',r.external_id,'group:',JSON.stringify(t.group),'vs',JSON.stringify(r.group||'PROTÓTIPO')); return true; }
    const _csvH=Math.round((parseFloat(r.total_hours||'0')||0)*100)/100;
    const _tH=Math.round((tHours(t)||0)*100)/100;
    if(Math.abs(_tH-_csvH)>0.05) { console.log('[DIFF]',r.external_id,'hours:',_tH,'vs',_csvH); return true; }
    if(t.status!==(r.status||'todo')) { console.log('[DIFF]',r.external_id,'status:',JSON.stringify(t.status),'vs',JSON.stringify(r.status||'todo')); return true; }
    const newRes=(r.resource||'').split(';').map(s=>s.trim()).filter(Boolean).sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase())).join(';').toLowerCase();
    const oldRes=[t.resId,...(t.coResIds||[])].filter(Boolean).map(id=>getRes(id)?.name||id).sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase())).join(';').toLowerCase();
    if(newRes!==oldRes) { console.log('[DIFF]',r.external_id,'resource:',JSON.stringify(oldRes),'vs',JSON.stringify(newRes)); return true; }
    return false;
  }
  const _toUpdateWithChanges=_toUpdate2.filter(r=>_hasChanges(r));
  const _toUpdateNoChanges=_toUpdate2.filter(r=>!_hasChanges(r));
  const _toCreate2=rows.filter(r=>{
    if(r.external_id&&TASKS.find(t=>t.externalId===r.external_id)) return false; // update
    if(_SKIP_STATUSES.has(r._rawStatus||'')) return false; // skip status
    if(!(parseFloat(r.total_hours||'0')||0)) return false; // no hours
    if(!(r.resource||'').trim()) return false; // no resource
    if(_validateCSVRow(r).errors.length>0) return false; // validation errors
    return true;
  });
  const _toSkip2=rows.filter(r=>{
    if(r.external_id&&TASKS.find(t=>t.externalId===r.external_id)) return false; // update
    if(_validateCSVRow(r).errors.length>0) return false; // has errors (shown separately)
    if(_SKIP_STATUSES.has(r._rawStatus||'')) return true;
    if(!(parseFloat(r.total_hours||'0')||0)) return true;
    if(!(r.resource||'').trim()) return true;
    return false;
  });
  // Classify every row into exactly one bucket
  const _skipStatus=[], _skipNoRes=[], _skipNoHours=[], _unclassified=[];
  rows.forEach(r=>{
    if(_toUpdate2.includes(r)) return; // update
    if(_toCreate2.includes(r)) return; // create
    if(allErrors.find(e=>e.line===r._line)) return; // visible error
    // Skipped — determine reason (priority order)
    if(_SKIP_STATUSES.has(r._rawStatus||'')) { _skipStatus.push(r); return; }
    if(!(parseFloat(r.total_hours||'0')||0)) { _skipNoHours.push(r); return; }
    if(!(r.resource||'').trim()) { _skipNoRes.push(r); return; }
    _unclassified.push(r); // catch-all — should not happen
  });
  const _totalSkipped=_skipStatus.length+_skipNoHours.length+_skipNoRes.length+_unclassified.length;
  const _totalAll=_toCreate2.length+_toUpdate2.length+_totalSkipped+allErrors.length;

  let summaryParts=[rows.length+' task'+(rows.length!==1?'s':'')+' found'];
  if(_toCreate2.length) summaryParts.push(_toCreate2.length+' to create');
  if(_toUpdateWithChanges.length){
    const _toCancelled=_toUpdateWithChanges.filter(r=>r.status==='cancelled');
    const _toDone=_toUpdateWithChanges.filter(r=>r.status==='done');
    const _updateParts=[];
    if(_toCancelled.length) _updateParts.push(_toCancelled.length+' → Cancelled');
    if(_toDone.length) _updateParts.push(_toDone.length+' → Done');
    summaryParts.push(_toUpdateWithChanges.length+' to update'+(_updateParts.length?' ('+_updateParts.join(', ')+')':''));
  }
  if(_toUpdateNoChanges.length) summaryParts.push(_toUpdateNoChanges.length+' unchanged');
  if(allErrors.length) summaryParts.push(allErrors.length+' error'+(allErrors.length!==1?'s':''));
  // Debug: show if totals don't match
  if(_totalAll!==rows.length) summaryParts.push('⚠ '+(rows.length-_totalAll)+' unaccounted');
  const _skipParts=[];
  if(_skipStatus.length) _skipParts.push(_skipStatus.length+' status');
  if(_skipNoHours.length) _skipParts.push(_skipNoHours.length+' no hours');
  if(_skipNoRes.length) _skipParts.push(_skipNoRes.length+' no resource');
  if(_unclassified.length) _skipParts.push(_unclassified.length+' unknown');
  const _skipLine=_totalSkipped>0?(_totalSkipped+' skipped'+(_skipParts.length?' ('+_skipParts.join(', ')+')':'')):'';
  summary.innerHTML=summaryParts.join(' · ')+(_skipLine?'<br><span style="font-size:10px;color:var(--fg3)">'+_skipLine+'</span>':'');
  const quotedWarnHtml=quotedLines.length?'<div style="background:rgba(240,169,40,.08);border:1px solid rgba(240,169,40,.3);border-radius:var(--r8);padding:8px 10px;margin-bottom:8px"><div style="font-size:11px;font-weight:600;color:var(--warn);margin-bottom:4px">⚠ '+quotedLines.length+' row'+(quotedLines.length>1?'s':'')+' wrapped in quotes (row'+(quotedLines.length>1?'s':'')+' '+quotedLines.join(', ')+')</div><div style="font-size:10px;color:var(--fg2)">These rows could not be parsed correctly. Fields containing commas must be individually quoted, not the entire row. Please fix in a text editor or Excel and re-upload.</div></div>':'';
  errorsEl.innerHTML=quotedWarnHtml+(allErrors.length?'<div style="background:rgba(240,82,82,.08);border:1px solid rgba(240,82,82,.3);border-radius:var(--r8);padding:8px 10px;margin-bottom:8px">'+allErrors.map(e=>`<div style="font-size:10px;color:var(--danger)">Row ${e.line}: ${e.errors.join(', ')}</div>`).join('')+'</div>':'');
  tableEl.innerHTML='<table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--bg2)">'
    +['Ext ID','Name','Project','Hours','Resource','Status'].map(h=>`<th style="padding:5px 8px;text-align:left;font-size:10px;color:var(--fg3);font-weight:600;border-bottom:1px solid var(--bd2)">${h}</th>`).join('')
    +'</tr></thead><tbody>'
    +[..._toCreate2,..._toUpdateWithChanges].map((r,i)=>`<tr style="background:${i%2===0?'transparent':'rgba(255,255,255,.02)'}">
      <td style="padding:4px 8px;font-size:10px;color:var(--fg3);font-family:var(--mono)">${r.external_id||'—'}</td>
      <td style="padding:4px 8px;font-size:10px;color:${_hasChanges(r)?'var(--warn)':TASKS.find(t=>t.externalId&&t.externalId===r.external_id)?'var(--fg3)':'var(--fg0)'}">${r.name}${_hasChanges(r)?' ✎':TASKS.find(t=>t.externalId&&t.externalId===r.external_id)?' —':''}</td>
      <td style="padding:4px 8px;font-size:10px;color:var(--fg2)">${r.project}</td>
      <td style="padding:4px 8px;font-size:10px;color:var(--fg3)">${r.total_hours||r.hours_per_day||'—'}h</td>
      <td style="padding:4px 8px;font-size:10px;color:var(--fg2)">${r.resource||'—'}</td>
      <td style="padding:4px 8px;font-size:10px;font-weight:${r.status==='cancelled'||r.status==='done'?'600':'400'};color:${r.status==='cancelled'?'var(--danger)':r.status==='done'?'var(--ok)':'var(--fg3)'}">${SLABELS[r.status]||r.status||'To Do'}</td>
    </tr>`).join('')
    +'</tbody></table>';
  importBtn.style.display=(_toCreate2.length||_toUpdate2.length)?'':'none';
  importBtn.textContent='Import ('+(_toCreate2.length?_toCreate2.length+' create':'')+
    ((_toCreate2.length&&_toUpdateWithChanges.length)?' · ':'')+(_toUpdateWithChanges.length?_toUpdateWithChanges.length+' update':'')+(_toUpdateNoChanges.length?' · '+_toUpdateNoChanges.length+' unchanged':'')+')';
}

window.executeCSVImport=()=>{
  const validRows=_csvParsed.filter(r=>_validateCSVRow(r).errors.length===0);
  if(!validRows.length) return;
  let created=0, updated=0;
  validRows.forEach(row=>{
    const {proj,type}=_validateCSVRow(row); if(!proj) return;
    const tags=row.tags?row.tags.split(',').map(t=>t.trim()).filter(Boolean):[];
    const tm=type==='daily'?'daily':'total';
    const totalHours=tm==='daily'?(parseFloat(row.hours_per_day)||0):(parseFloat(row.total_hours)||8);
    const wdays=row.weekdays?row.weekdays.split(',').map(d=>({mon:1,tue:2,wed:3,thu:4,fri:5,sat:6,sun:0}[d.trim().toLowerCase()])).filter(d=>d!==undefined):[1,2,3,4,5];

    // Parse multiple resources: use ; as separator (e.g. "Res1;Res2" with hours "16;8")
    const resNames=(row.resource||'').split(';').map(s=>s.trim()).filter(Boolean);
    const resHoursList=(row.resource_hours||'').split(';').map(s=>parseFloat(s.trim())||0);
    const allRes=resNames.map((name,i)=>({
      res:RESOURCES.find(r=>r.name.toLowerCase()===name.toLowerCase()||r.id.toLowerCase()===name.toLowerCase())||null,
      hours:resHoursList[i]||0
    })).filter(x=>x.res);

    // Distribute hours equally if not specified
    if(allRes.length&&allRes.every(x=>x.hours===0)){
      const each=Math.round(totalHours/allRes.length*10)/10;
      allRes.forEach((x,i)=>{ x.hours=i===allRes.length-1?Math.round((totalHours-each*i)*10)/10:each; });
    }

    const mainRes=allRes[0]?.res||null;
    const coRes=allRes.slice(1).map(x=>x.res);
    const resHours={};
    allRes.forEach(x=>{ resHours[x.res.id]=x.hours; });

    // Build taskTeams grouped by team
    const teamMap={};
    allRes.forEach(x=>{
      const tid=(x.res.teams||[])[0]||'_notm';
      if(!teamMap[tid]) teamMap[tid]={teamId:tid==='_notm'?null:tid,entries:[]};
      teamMap[tid].entries.push({id:x.res.id,hours:x.hours});
    });
    const taskTeams=Object.values(teamMap);

    const task={
      id:'t'+Date.now()+Math.random().toString(36).slice(2,6),
      name:row.name,
      projId:proj.id,
      group:row.group||null,
      timeMode:tm,
      hours:totalHours,
      hpd:tm==='daily'?totalHours:null,
      contHours:tm!=='daily'?totalHours:8,
      dailyHpd:tm==='daily'?totalHours:0,
      start:row.start_date?dateToIdx(row.start_date):null,
      dur:row.start_date&&row.end_date?Math.max(1,dateToIdx(row.end_date)-dateToIdx(row.start_date)+1):1,
      deadline:row.deadline||null,
      status:row.status||'todo',
      prog:0,
      tags,
      notes:row.notes||'',
      resId:mainRes?.id||null,
      resource:mainRes?.name||'',
      coResIds:coRes.map(r=>r.id),
      resHours,
      teamId:(mainRes?.teams||[])[0]||null,
      teamIds:[...new Set(allRes.flatMap(x=>x.res.teams||[]))],
      taskTeams,
      weekdays:tm==='daily'?wdays:null,
      timeLogs:[],
      resStart:{},resDur:{},
      externalId:row.external_id||null,
    };
    // Check if task already exists by external_id
    const existingTask=row.external_id?TASKS.find(t=>t.externalId===row.external_id):null;
    // Skip creation for completed/migrated/canceled/closed — only update if already exists
    if(!existingTask&&_SKIP_STATUSES.has((row._rawStatus||''))) return;
    // Skip creation if no resource or no hours — only update if already exists
    const _hasRes=(row.resource||'').trim().length>0;
    const _hasHours=(parseFloat(row.total_hours||'0')||0)>0;
    if(!existingTask&&(!_hasRes||!_hasHours)) return;
    if(existingTask){
      // Skip if no changes
      if(!_hasChanges(row)) { updated++; return; } // count but don't write
      // Update timeLogs if spent hours changed
      const _existingLogged=(existingTask.timeLogs||[]).reduce((s,l)=>s+l.hours,0);
      const _newSpent=row._rawSpentHours||0;
      if(_newSpent>0&&Math.abs(_existingLogged-_newSpent)>0.05){
        const _nonImport=(existingTask.timeLogs||[]).filter(l=>l.notes!=='Imported from ClickUp');
        const _manualH=_nonImport.reduce((s,l)=>s+l.hours,0);
        const _importH=Math.max(0,_newSpent-_manualH);
        if(_importH>0){
          existingTask.timeLogs=[..._nonImport,{date:new Date().toISOString().slice(0,10),hours:_importH,notes:'Imported from ClickUp',user:S_USER?.name||'import'}];
        }
      }
      // Update existing task
      Object.assign(existingTask,{
        name:task.name, projId:task.projId, group:task.group, // group updated from name-based mapping
        updatedAt:Date.now(),
        timeMode:task.timeMode, hours:task.hours, hpd:task.hpd,
        contHours:task.contHours, dailyHpd:task.dailyHpd,
        status:task.status,
        resId:task.resId, resource:task.resource, coResIds:task.coResIds,
        resHours:task.resHours, teamId:task.teamId, teamIds:task.teamIds,
        taskTeams:task.taskTeams,
        // deadline, tags, notes, weekdays are never updated from CSV
      });
      addLog({type:'edit',task:task.name,from:'',to:'updated from CSV'});
      updated++;
    } else {
      task.externalId=row.external_id||null;
      task.updatedAt=Date.now();
      // Auto-calculate start if not provided in CSV (same behaviour as modal)
      if(!task.start && task.resId){
        task.start=_nextFreeDay(task.resId);
      }
      if(row._rawSpentHours>0){
        task.timeLogs=[{date:new Date().toISOString().slice(0,10),hours:row._rawSpentHours,notes:'Imported from ClickUp',user:S_USER?.name||'import'}];
      }
      TASKS.push(task);
      addLog({type:'create',task:task.name,from:'',to:'imported from CSV'});
      created++;
    }
  });
  persistState(['tasks']);
  renderGantt();renderDash();_refreshOverview();
  CM('m-import-csv');
  const _parts2=[];
  if(created) _parts2.push(created+' created');
  if(updated) _parts2.push(updated+' updated');
  notify(_parts2.join(' · ')||'No changes','success');
};

// ── SETTINGS > CALENDÁRIO ─────────────────────────────────────────────────
// PT_HOL_CUSTOM: persisted in meta.ptHolCustom as [{m,d,name,type}]
// Merges with the built-in PT_HOL list; custom overrides are highlighted.
function _getHolidays(){
  const base=PT_HOL.map(h=>({...h, builtin:true, name:h.name||_ptHolName(h.m,h.d), type:h.type||'nacional'}));
  const map={}; base.forEach(h=>map[`${h.m}-${h.d}`]=h);
  PT_HOL_CUSTOM.forEach(h=>map[`${h.m}-${h.d}`]={...h, builtin:false});
  return Object.values(map).sort((a,b)=>a.m!==b.m?a.m-b.m:a.d-b.d);
}
function _ptHolName(m,d){
  const names={
    '1-1':'Ano Novo','4-10':'Sexta-feira Santa','4-12':'Páscoa','4-25':'25 de Abril',
    '5-1':'Dia do Trabalhador','6-10':'Dia de Portugal','6-24':'S. João (Municipal)',
    '8-15':'Assunção de Nossa Senhora','10-5':'Implantação da República',
    '11-1':'Dia de Todos os Santos','12-1':'Restauração da Independência',
    '12-8':'Imaculada Conceição','12-25':'Natal'
  };
  return names[`${m}-${d}`]||`${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`;
}
let _editHolKey=null;
function renderSettings(){
  // Show nav-settings for admins
  const ns=document.getElementById('nav-settings'); if(ns) ns.style.display=isAdmin()?'':'none';
  _renderHolidayList();
  const addBtn=document.getElementById('set-hol-add-btn');
  if(addBtn) addBtn.style.display=isAdmin()?'':'none';
}
function _renderHolidayList(){
  const el=document.getElementById('set-hol-list'); if(!el) return;
  const hols=_getHolidays();
  const admin=isAdmin();
  el.innerHTML=hols.map(h=>{
    const key=`${h.m}-${h.d}`;
    const label=h.name||_ptHolName(h.m,h.d);
    const badge=h.type==='municipal'?'🏙':'🇵🇹';
    return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--bd2);font-size:11px">
      <span style="font-size:13px">${badge}</span>
      <span style="flex:1;color:var(--fg0)">${label}</span>
      <span style="color:var(--fg3);min-width:40px">${String(h.d).padStart(2,'0')}/${String(h.m).padStart(2,'0')}</span>
      <span style="font-size:9px;color:var(--fg3);min-width:55px">${h.type||'nacional'}</span>
      ${admin?`<button class="btn btn-xs" onclick="_editHolidayForm('${key}')" title="Edit">✎</button>
               <button class="btn btn-xs btn-d" onclick="_deleteHoliday('${key}')" title="Delete">✕</button>`:''}
    </div>`;
  }).join('');
}
window._addHolidayForm=()=>{
  _editHolKey=null;
  document.getElementById('set-hol-name').value='';
  document.getElementById('set-hol-date').value='';
  document.getElementById('set-hol-type').value='municipal';
  document.getElementById('set-hol-form').style.display='';
  document.getElementById('set-hol-add-btn').style.display='none';
};
window._editHolidayForm=(key)=>{
  _editHolKey=key;
  const h=_getHolidays().find(x=>`${x.m}-${x.d}`===key); if(!h) return;
  document.getElementById('set-hol-name').value=h.name||_ptHolName(h.m,h.d);
  document.getElementById('set-hol-date').value=`${String(h.m).padStart(2,'0')}-${String(h.d).padStart(2,'0')}`;
  document.getElementById('set-hol-type').value=h.type||'nacional';
  document.getElementById('set-hol-form').style.display='';
  document.getElementById('set-hol-add-btn').style.display='none';
};
window._cancelHoliday=()=>{
  document.getElementById('set-hol-form').style.display='none';
  document.getElementById('set-hol-add-btn').style.display=isAdmin()?'':'none';
};
window._saveHoliday=()=>{
  const name=document.getElementById('set-hol-name').value.trim();
  const dateVal=document.getElementById('set-hol-date').value.trim(); // MM-DD
  const type=document.getElementById('set-hol-type').value;
  if(!name||!dateVal){ notify('Name and date required','warn'); return; }
  const parts=dateVal.split('-').map(Number);
  if(parts.length!==2||parts[0]<1||parts[0]>12||parts[1]<1||parts[1]>31){ notify('Date must be MM-DD (e.g. 06-13)','warn'); return; }
  const [m,d]=parts;
  const action=_editHolKey?'edit':'create';
  const msg=action==='edit'
    ? `Save changes to this holiday?\n\nCalendar changes take effect immediately in the Gantt — tasks already allocated on the affected dates may need to be reviewed.`
    : `Add "${name}" (${dateVal}) as a holiday?\n\nCalendar changes take effect immediately in the Gantt — tasks already allocated on this date may need to be reviewed.`;
  if(!confirm(msg)) return;
  // If editing, remove the OLD entry first (by original key, not new date)
  if(_editHolKey){
    const oldParts=_editHolKey.split('-').map(Number);
    const oldIdx=PT_HOL_CUSTOM.findIndex(x=>x.m===oldParts[0]&&x.d===oldParts[1]);
    if(oldIdx>=0) PT_HOL_CUSTOM.splice(oldIdx,1);
    // If old date was a builtin and date changed, mark old date as deleted
    const oldBuiltin=PT_HOL.find(h=>h.m===oldParts[0]&&h.d===oldParts[1]);
    if(oldBuiltin&&(oldParts[0]!==m||oldParts[1]!==d))
      PT_HOL_CUSTOM.push({m:oldParts[0],d:oldParts[1],name:'',type:'deleted'});
  }
  // Insert/update new entry
  const existing=PT_HOL_CUSTOM.findIndex(x=>x.m===m&&x.d===d);
  if(existing>=0) PT_HOL_CUSTOM[existing]={m,d,name,type};
  else PT_HOL_CUSTOM.push({m,d,name,type});
  persistState(['meta']);
  _cancelHoliday(); _renderHolidayList();
  notify('Holiday saved — Gantt updated','success');
};
window._deleteHoliday=(key)=>{
  const parts=key.split('-').map(Number); const [m,d]=parts;
  const hol=_getHolidays().find(h=>`${h.m}-${h.d}`===key);
  const label=hol?.name||`${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`;
  if(!confirm(`Remove "${label}" from the holiday calendar?\n\nThis change takes effect immediately in the Gantt — tasks already allocated on this date may need to be reviewed.`)) return;
  const idx=PT_HOL_CUSTOM.findIndex(x=>x.m===m&&x.d===d);
  if(idx>=0) PT_HOL_CUSTOM.splice(idx,1);
  const builtin=PT_HOL.find(h=>h.m===m&&h.d===d);
  if(builtin) PT_HOL_CUSTOM.push({m,d,name:'',type:'deleted'});
  persistState(['meta']);
  _renderHolidayList();
  notify('Holiday removed — Gantt updated','success');
};

function renderLogsPage(){
  const el=document.getElementById('logs-page-content');
  if(!el) return;

  // Populate user filter (preserve current selection)
  const userSel=document.getElementById('log-filter-user');
  if(userSel){
    const _prevUser=userSel.value;
    const users=new Set(GLOG.map(e=>e.user||'—').filter(Boolean));
    userSel.innerHTML='<option value="">All users</option>'+[...users].map(u=>`<option value="${u}">${u}</option>`).join('');
    if(_prevUser) userSel.value=_prevUser;
  }

  const typeF=document.getElementById('log-filter-type')?.value||'';
  const userF=document.getElementById('log-filter-user')?.value||'';

  const logs=GLOG.filter(e=>{
    if(typeF&&e.type!==typeF) return false;
    if(userF&&(e.user||'—')!==userF) return false;
    return true;
  });

  if(!logs.length){
    el.innerHTML='<div style="padding:24px;text-align:center;color:var(--fg3);font-size:11px">No activity logged yet. Logs appear here when tasks are created, edited, moved or timed.</div>';
    return;
  }

  el.innerHTML=`<div style="overflow-x:auto">
    <table class="dt">
      <thead><tr>
        <th style="width:75px">Time</th>
        <th style="width:85px">User</th>
        <th style="width:65px">Type</th>
        <th style="min-width:160px">Task / Entity</th>
        <th style="min-width:300px">Details</th>
      </tr></thead>
      <tbody>
        ${logs.map(e=>{
          const col=LCOL[e.type]||'var(--fg2)';
          const ico=LICO[e.type]||'·';
          const user=e.user||S_USER?.name||'—';
          return `<tr>
            <td class="mono txs" style="color:var(--fg3)">${e.time||'—'}</td>
            <td style="font-size:10px;font-weight:600;color:var(--fg1)">${user}</td>
            <td><span style="display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;color:${col};padding:2px 6px;background:${col}18;border-radius:4px">${ico} ${e.type}</span></td>
            <td style="font-size:11px;color:var(--fg0);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${e.task}">${e.task||'—'}</td>
            <td style="font-size:10px;color:var(--fg2);white-space:normal;line-height:1.5">${e.from?`<span style="color:var(--fg3)">${e.from}</span><span style="color:var(--fg3);margin:0 4px">→</span>`:''}<span style="color:var(--fg1)">${e.to||''}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}
window.renderLogsPage=renderLogsPage;





window.cycleMsFilter=(id)=>{
  _msFilter=id||null;
  renderGantt();
};

window.showMsDayMenu=(e,ids)=>{
  const old=document.getElementById('ms-day-menu');
  if(old) old.remove();
  const menu=document.createElement('div');
  menu.id='ms-day-menu';
  menu.style.cssText='position:fixed;z-index:500;background:var(--bg2);border:1px solid var(--bd2);border-radius:8px;padding:4px;box-shadow:0 4px 16px rgba(0,0,0,.5);min-width:160px';
  menu.style.left=Math.min(e.clientX,window.innerWidth-170)+'px';
  menu.style.top=Math.min(e.clientY,window.innerHeight-220)+'px';
  let html='<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--fg3);padding:4px 8px 2px">Milestones</div>';
  ids.forEach(id=>{
    const ms=MILESTONES.find(m=>m.id===id); if(!ms) return;
    const isAct=_msFilter===id;
    const col=ms.color||'var(--acc2)';
    html+=`<div onclick="window._msDayMenuClick('${id}')" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:5px;cursor:pointer;${isAct?'background:rgba(79,156,249,.12)':''};font-size:11px;color:var(--fg0)" onmouseover="this.style.background='rgba(255,255,255,.06)'" onmouseout="this.style.background='${isAct?'rgba(79,156,249,.12)':''}'">
      <span style="width:10px;height:10px;border-radius:50%;background:${col};flex-shrink:0"></span>
      <span style="flex:1">${ms.name}</span>
      ${isAct?'<span style="font-size:9px;color:var(--acc)">✓</span>':''}
    </div>`;
  });
  html+=`<div style="height:1px;background:var(--bd);margin:3px 0"></div>`;
  if(_msFilter&&ids.includes(_msFilter)){
    html+=`<div onclick="window._msDayMenuClick(null)" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:5px;cursor:pointer;font-size:11px;color:var(--fg2)" onmouseover="this.style.background='rgba(255,255,255,.06)'" onmouseout="this.style.background=''">
      <span>✕</span> Clear filter
    </div>`;
  }
  html+=`<div style="height:1px;background:var(--bd);margin:3px 0"></div>`;
  ids.forEach(id=>{
    const ms=MILESTONES.find(m=>m.id===id); if(!ms) return;
    html+=`<div onclick="openEditMilestone('${id}');document.getElementById('ms-day-menu')?.remove()" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:5px;cursor:pointer;font-size:11px;color:var(--fg2)" onmouseover="this.style.background='rgba(255,255,255,.06)'" onmouseout="this.style.background=''">
      <span style="font-size:10px">✎</span> Edit: ${ms.name}
    </div>`;
  });
  menu.innerHTML=html;
  document.body.appendChild(menu);
  window._msDayMenuClick=(id)=>{
    _msFilter=id||null;
    renderGantt();
    menu.remove();
  };
  setTimeout(()=>{
    const close=(ev)=>{ if(!menu.contains(ev.target)){ menu.remove(); document.removeEventListener('click',close); } };
    document.addEventListener('click',close);
  },50);
};

window._showHoldDialog=(taskId)=>{
  const t=TASKS.find(x=>x.id===taskId); if(!t) return;
  // Create inline mini-modal
  const old=document.getElementById('hold-dialog'); if(old) old.remove();
  const dlg=document.createElement('div');
  dlg.id='hold-dialog';
  dlg.style.cssText='position:fixed;inset:0;z-index:600;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5)';
  dlg.innerHTML=`
    <div style="background:var(--bg2);border:1px solid var(--bd2);border-radius:var(--r12);padding:20px 24px;width:360px;max-width:95vw;box-shadow:0 8px 32px rgba(0,0,0,.6)">
      <div style="font-size:13px;font-weight:700;color:var(--fg0);margin-bottom:4px">⏸ Put on hold</div>
      <div style="font-size:11px;color:var(--fg2);margin-bottom:14px">${t.name}</div>
      <label style="font-size:10px;font-weight:600;color:var(--fg2);display:block;margin-bottom:6px">Reason / blocked by <span style="color:var(--fg3);font-weight:400">(optional)</span></label>
      <input id="hold-reason-inp" class="fi" placeholder="e.g. Waiting for parts, Pedro, Supplier X…" style="margin-bottom:14px;width:100%" value="${t.holdBlocker||''}">
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-sm" onclick="document.getElementById('hold-dialog').remove()">Cancel</button>
        <button class="btn btn-sm" style="background:rgba(240,169,40,.18);color:var(--warn);border-color:var(--warn)" onclick="
          const reason=document.getElementById('hold-reason-inp').value.trim();
          const t2=TASKS.find(x=>x.id==='${taskId}');
          if(t2){ t2.status='hold'; t2.holdBlocker=reason||null; }
          addLog({type:'status',task:'${t.name.replace(/'/g,"\'")}',from:'',to:'On Hold'+(reason?' — '+reason:'')});
          notify('On hold'+(reason?' — '+reason:''),'warn');
          persistState(['tasks'],{tasks:['${taskId}']}); renderGantt(); renderDash();
          document.getElementById('hold-dialog').remove();
        ">⏸ Put on hold</button>
      </div>
    </div>`;
  dlg.addEventListener('click',e=>{ if(e.target===dlg) dlg.remove(); });
  document.body.appendChild(dlg);
  setTimeout(()=>document.getElementById('hold-reason-inp')?.focus(),50);
};


// ── Auto-pause on PC suspend / screen lock ────────────────────
(()=>{
  let _hiddenAt=null;
  const SUSPEND_THRESHOLD=60000; // 60s = definite suspend/sleep

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      _hiddenAt=Date.now();
    } else {
      if(_hiddenAt){
        const hiddenMs=Date.now()-_hiddenAt;
        _hiddenAt=null;
        if(hiddenMs>=SUSPEND_THRESHOLD){
          const tid=_timerState?.taskId;
          if(tid&&!_timerState.paused){
            tpPause(tid);
            notify('Timer paused — PC was suspended','warn');
          }
        }
      }

    }
  });
})();

// Prevent modal from closing when mouse drag ends outside
(()=>{
  let _mbgMouseDownTarget=null;
  document.addEventListener('mousedown',e=>{ _mbgMouseDownTarget=e.target; });
  document.addEventListener('click',e=>{
    const mbg=e.target.closest?.('.mbg');
    if(mbg&&e.target===mbg&&_mbgMouseDownTarget===mbg){
      // Both mousedown and click on backdrop — close
      const modal=mbg.querySelector('.modal');
      if(modal){
        const id=mbg.id;
        if(id==='m-task'||id==='m-milestone'||id==='m-project'||id==='m-proj'||id==='m-log'||id==='m-split'||id==='m-flog'){
          CM(id);
        }
      }
    }
  });
})();

window._cycleSortGantt=()=>{
  const order=['chrono','name','tags'];
  const cur=S._sortBy||'chrono';
  S._sortBy=order[(order.indexOf(cur)+1)%order.length];
  S._sortLocked=false;
  renderGantt();
};
window._sortMenuGantt=(e)=>{
  const old=document.getElementById('g-sort-menu'); if(old) old.remove();
  const menu=document.createElement('div');
  menu.id='g-sort-menu';
  menu.style.cssText='position:fixed;z-index:500;background:var(--bg2);border:1px solid var(--bd2);border-radius:8px;padding:4px;box-shadow:0 4px 16px rgba(0,0,0,.5);min-width:140px';
  menu.style.left=e.clientX+'px'; menu.style.top=e.clientY+'px';
  const opts=[['chrono','📅 Chronological'],['name','🔤 Name (A–Z)'],['tags','# Tags (A–Z)']];
  menu.innerHTML=opts.map(([v,l])=>`<div onclick="S._sortBy='${v}';S._sortLocked=false;renderGantt();this.closest('#g-sort-menu').remove()" style="padding:7px 12px;font-size:11px;cursor:pointer;border-radius:5px;background:${(S._sortBy||'chrono')===v?'var(--bg3)':'none'};color:var(--fg0)" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='${(S._sortBy||'chrono')===v?'var(--bg3)':'none'}'">
    ${l}${(S._sortBy||'chrono')===v?' ✓':''}
  </div>`).join('');
  document.body.appendChild(menu);
  setTimeout(()=>{ const cl=()=>{menu.remove();document.removeEventListener('click',cl);}; document.addEventListener('click',cl); },50);
};

window._onProjSelectorChange=(projId)=>{
  S._activeProjId=projId||null;
  // Clear milestone filter if it belongs to a different project
  if(_msFilter){ const _msObj=MILESTONES.find(m=>m.id===_msFilter); if(_msObj&&_msObj.projId&&projId&&_msObj.projId!==projId) _msFilter=null; }
  // Project selector only sets _activeProjId — never touches vbFilter
  // (vbFilter belongs to the resource/team/project view-by filter)
  renderGantt();
};

function _renderTaskMilestones(taskId){
  const wrap=document.getElementById('mt-ms-list');
  if(!wrap) return;
  if(!taskId){
    wrap.innerHTML='<span style="font-size:10px;color:var(--fg3)">Save task first to associate milestones</span>';
    return;
  }
  // Filter milestones to the task's project only
  const _task=TASKS.find(t=>t.id===taskId);
  const _projFilter=_task?.projId;
  const projMs=ms=>!_projFilter||!ms.projId||(ms.projId===_projFilter); // include global milestones (no projId)
  const assoc=MILESTONES.filter(m=>(m.taskIds||[]).includes(taskId)&&projMs(m));
  const unassoc=MILESTONES.filter(m=>!(m.taskIds||[]).includes(taskId)&&projMs(m));
  let html='';
  if(assoc.length){
    html+=assoc.map(m=>`<span style="display:inline-flex;align-items:center;gap:4px;background:${m.color||'var(--acc2)'}22;border:1px solid ${m.color||'var(--acc2)'};border-radius:5px;padding:2px 8px;font-size:10px;color:${m.color||'var(--acc2)'}">◆ ${m.name}<span onclick="(function(){var ms=MILESTONES.find(function(x){return x.id==='${m.id}'});if(ms)ms.taskIds=(ms.taskIds||[]).filter(function(x){return x!=='${taskId}'});persistState(['milestones']);_renderTaskMilestones('${taskId}');})()" style="cursor:pointer;margin-left:3px;opacity:.6">✕</span></span>`).join('');
  }
  if(unassoc.length){
    html+=`<select onchange="(function(){var ms=MILESTONES.find(function(x){return x.id===this.value}.bind(this));if(ms){if(!ms.taskIds)ms.taskIds=[];if(!ms.taskIds.includes('${taskId}'))ms.taskIds.push('${taskId}');persistState(['milestones']);_renderTaskMilestones('${taskId}');}this.value='';}.bind(this))()" style="font-size:10px;padding:2px 6px;border-radius:5px;border:1px solid var(--bd);background:var(--bg3);color:var(--fg2);cursor:pointer;margin-left:4px"><option value="">+ Add milestone</option>${unassoc.map(m=>`<option value="${m.id}">◆ ${m.name}</option>`).join('')}</select>`;
  }
  if(!assoc.length&&!unassoc.length) html='<span style="font-size:10px;color:var(--fg3)">No milestones defined yet</span>';
  wrap.innerHTML=html;
}
window._updateTaskMilestones=()=>_renderTaskMilestones(S.editId||null);

function taskHasMilestone(taskId){
  return getEffectiveMilestones(taskId).length>0;
}

function _checkMilestoneAutoComplete(){
  let changed=false; const _changedIds=[];
  MILESTONES.forEach(ms=>{
    if(!ms.dayIdx||ms.dayIdx>GANTT_TODAY) return;
    (ms.taskIds||[]).forEach(tid=>{
      const t=TASKS.find(x=>x.id===tid);
      if(t&&t.status==='ready'){
        t.status='done';
        _changedIds.push(tid);
        addLog({type:'status',task:t.name,from:'Ready',to:'Done (milestone passed)'});
        changed=true;
      }
    });
  });
  if(changed){ persistState(['tasks'],{tasks:_changedIds}); renderGantt&&renderGantt(); renderDash&&renderDash(); }
}

window._msSwitchTab=(tab)=>{
  document.getElementById('ms-pane-details').style.display=tab==='details'?'':'none';
  document.getElementById('ms-pane-notes').style.display=tab==='notes'?'':'none';
  document.getElementById('ms-tab-details').classList.toggle('on',tab==='details');
  document.getElementById('ms-tab-notes').classList.toggle('on',tab==='notes');
};

function _saveSessionState(){
  if(!S_USER?.resId) return;
  try{
    sessionStorage.setItem('pg_ui_'+S_USER.resId, JSON.stringify({
      page: S.page,
      viewBy: S.viewBy,
      vbFilter: S.vbFilter.filter(x=>x!=='__none__'), // don't persist sentinel
      statusFilter: S.statusFilter,
      filterUnassigned: S.filterUnassigned,
      offset: S.offset,
      _sortBy: S._sortBy||'chrono',
      _wlView: S._wlView||'week',
      _activeProjId: S._activeProjId||null,
      _myDayOffset: _myDayOffset||0
    }));
  }catch(e){}
}

function _restoreSessionState(){
  if(!S_USER?.resId) return;
  try{
    const raw=sessionStorage.getItem('pg_ui_'+S_USER.resId);
    if(!raw) return;
    const saved=JSON.parse(raw);
    if(saved.viewBy) S.viewBy=saved.viewBy;
    if(saved.vbFilter) S.vbFilter=(saved.vbFilter||[]).filter(x=>x!=='__none__');
    if(saved.statusFilter) S.statusFilter=saved.statusFilter;
    if(saved.filterUnassigned!=null) S.filterUnassigned=saved.filterUnassigned;
    if(saved.offset) S.offset=saved.offset;
    if(saved._sortBy) S._sortBy=saved._sortBy;
    if(saved._wlView) S._wlView=saved._wlView;
    if(saved._activeProjId) S._activeProjId=saved._activeProjId;
    if(saved._myDayOffset) _myDayOffset=saved._myDayOffset;
    return saved.page; // return saved page to navigate to
  }catch(e){ return null; }
}

// Force save on tab close / navigate away
window.addEventListener('beforeunload', ()=>{
  if(!Object.keys(_pendingSave).length) return;
  clearTimeout(persistState._t);
  const snap2=_pendingSave; _pendingSave={};
  const patch={};
  const _be=(k,arr)=>{ if(!snap2[k]) return; const p={}; const ids=snap2[k]; if(ids.has('__all__')) arr.forEach(x=>p[x.id]=x); else ids.forEach(id=>{const x=arr.find(i=>i.id===id);if(x)p[x.id]=x;}); if(Object.keys(p).length) patch[k]=p; };
  _be('tasks',TASKS); _be('milestones',MILESTONES); _be('resources',RESOURCES); _be('teams',TEAMS); _be('projects',PROJECTS);
  if(snap2.meta) patch.meta=_buildMeta();
  if(snap2.logs) patch.logs=GLOG.slice(0,500);
  try{
    // Per-entity PATCHes with keepalive so concurrent saves don't conflict
    const _e={tasks:TASKS,milestones:MILESTONES,resources:RESOURCES,teams:TEAMS,projects:PROJECTS};
    for(const [k,arr] of Object.entries(_e)){
      if(patch[k]) fetch(_FB_ROOT+'/'+k+'.json',{method:'PATCH',keepalive:true,
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(patch[k])}).catch(()=>{});
    }
    if(patch.meta) fetch(_FB_ROOT+'/meta.json',{method:'PATCH',keepalive:true,
      headers:{'Content-Type':'application/json'},body:JSON.stringify(patch.meta)}).catch(()=>{});
  } catch(e){}
  _pendingSave={};
});


window._cycleSubtaskStatus=(taskId,stId)=>{
  const t=TASKS.find(x=>x.id===taskId); if(!t) return;
  const st=(t.subtasks||[]).find(s=>s.id===stId); if(!st) return;
  const order=['todo','doing','paused','done'];
  st.status=order[(order.indexOf(st.status||'todo')+1)%order.length];
  // Auto-update parent progress
  const sts=t.subtasks.filter(s=>s.name?.trim());
  if(sts.length) t.prog=Math.round(sts.filter(s=>s.status==='done').length/sts.length*100);
  addLog({type:'edit',task:t.name,from:'',to:`subtask "${st.name}" → ${SLABELS[st.status]||st.status}`});
  persistState(['tasks'],{tasks:[taskId]});
  renderGantt();
};

// ── SUBTASK EDITOR MODAL ──────────────────────────────────────────
let _stEditParentId=null, _stEditStId=null;

window._openSubtaskEditor=(parentId, stId)=>{
  const t=TASKS.find(x=>x.id===parentId); if(!t) return;
  // Find subtask in t.subtasks[] or in TASKS[] children (promoted subtasks)
  const st=(t.subtasks||[]).find(s=>s.id===stId) || TASKS.find(x=>x.id===stId&&x.parentId===parentId);
  if(!st) return;
  _stEditParentId=parentId; _stEditStId=stId;
  const modal=document.getElementById('m-subtask');
  if(!modal){
    // Create modal inline
    const div=document.createElement('div');
    div.id='m-subtask';
    div.className='mbg';
    div.innerHTML=`<div class="modal" style="width:420px;max-width:95vw">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <span style="font-size:13px;font-weight:700;color:var(--fg0)" id="mst-title">Edit Subtask</span>
        <button onclick="CM('m-subtask')" style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--fg3)">✕</button>
      </div>
      <div class="fg"><label class="fl">Name *</label><input class="fi" id="mst-name" placeholder="Subtask name"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="fg"><label class="fl">Resource</label><select class="fi" id="mst-res"><option value="">— none —</option></select></div>
        <div class="fg"><label class="fl">Hours</label><input class="fi" type="number" id="mst-hours" min="0.5" step="0.5" placeholder="0"></div>
        <div class="fg"><label class="fl">Group</label><input class="fi" id="mst-group" readonly style="background:var(--bg2);color:var(--fg3);cursor:default" tabindex="-1"></div>
        <div class="fg"><label class="fl">Deadline</label><input class="fi" type="date" id="mst-deadline"></div>
      </div>
      <div class="fg"><label class="fl">Notes</label><textarea class="fi" id="mst-notes" rows="2" style="resize:none" placeholder="Optional notes…"></textarea></div>
      <div class="fg" style="margin-bottom:0">
        <label class="fl">Status</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${['todo','doing','paused','done'].map(s=>`<button onclick="document.querySelectorAll('.mst-stat').forEach(b=>b.classList.remove('on'));this.classList.add('on');document.getElementById('mst-stat-val').value='${s}'" class="btn btn-sm mst-stat" style="font-size:10px">${SLABELS[s]||s}</button>`).join('')}
          <input type="hidden" id="mst-stat-val" value="todo">
        </div>
      </div>
      <div class="mf">
        <button class="btn btn-sm" style="margin-right:auto;background:rgba(240,82,82,.12);color:var(--danger);border-color:var(--danger)" onclick="window._deleteSubtask()">Delete</button>
        <button class="btn btn-sm" onclick="CM('m-subtask')">Cancel</button>
        <button class="btn btn-p btn-sm" onclick="window._saveSubtaskEditor()">Save</button>
      </div>
    </div>`;
    div.addEventListener('mousedown',e=>{if(e.target===div){div._mousedownOnBg=true;}});
    div.addEventListener('click',e=>{if(e.target===div&&div._mousedownOnBg){CM('m-subtask');}div._mousedownOnBg=false;});
    document.body.appendChild(div);
  // Populate resources grouped by team
  const sel=document.getElementById('mst-res');
  const byTeam={};
  RESOURCES.forEach(r=>{ const tid=(r.teams||[])[0]||'__none__'; if(!byTeam[tid]) byTeam[tid]=[]; byTeam[tid].push(r); });
  sel.innerHTML='<option value="">— Unassigned —</option>'+Object.entries(byTeam).map(([tid,res])=>{
    const tName=tid==='__none__'?'No team':(TEAMS.find(x=>x.id===tid)?.name||tid);
    return `<optgroup label="${tName}">${res.map(r=>`<option value="${r.id}">${r.name}</option>`).join('')}</optgroup>`;
  }).join('');
  }
  // Fill fields
  document.getElementById('mst-name').value=st.name||'';
  document.getElementById('mst-res').value=st.resId||'';
  document.getElementById('mst-hours').value=st.hours||'';
  document.getElementById('mst-group').value=t.group||'';
  // start date not shown in editor
  document.getElementById('mst-deadline').value=st.deadline||'';
  document.getElementById('mst-notes').value=st.notes||'';
  const statVal=st.status||'todo';
  document.getElementById('mst-stat-val').value=statVal;
  document.querySelectorAll('.mst-stat').forEach(b=>b.classList.toggle('on',b.textContent.trim()===(SLABELS[statVal]||statVal)));
  OM('m-subtask');
};

window._saveSubtaskEditor=()=>{
  const t=TASKS.find(x=>x.id===_stEditParentId); if(!t) return;
  const st=(t.subtasks||[]).find(s=>s.id===_stEditStId) || TASKS.find(x=>x.id===_stEditStId&&x.parentId===_stEditParentId);
  if(!st) return;
  const isChild=!!(st.parentId); // true if promoted to TASKS[]
  const name=document.getElementById('mst-name').value.trim();
  if(!name){notify('Name required','warn');return;}
  const oldSt=JSON.parse(JSON.stringify(st));
  st.name=name;
  const _newStResId=document.getElementById('mst-res').value||null;
  st.resId=_newStResId;
  st.group=t.group||null;
  st.hours=parseFloat(document.getElementById('mst-hours').value)||null;
  // start is computed by the scheduler, not set manually
  st.deadline=document.getElementById('mst-deadline').value||null;
  st.notes=document.getElementById('mst-notes').value||'';
  st.status=document.getElementById('mst-stat-val').value||'todo';
  // Recompute dur
  if(st.start&&st.hours){
    const cap=getRes(st.resId||t.resId)?.dailyCap||HPD;
    st.dur=Math.max(1,Math.ceil(st.hours/cap));
  }
  // Log changes
  const diffs=[];
  if(oldSt.name!==st.name) diffs.push(`name: "${oldSt.name}" → "${st.name}"`);
  if((oldSt.status||'todo')!==(st.status||'todo')) diffs.push(`status: ${SLABELS[oldSt.status]||oldSt.status} → ${SLABELS[st.status]||st.status}`);
  if(oldSt.hours!==st.hours) diffs.push(`hours: ${oldSt.hours||0}h → ${st.hours||0}h`);
  if(oldSt.deadline!==st.deadline) diffs.push(`deadline: ${oldSt.deadline||'none'} → ${st.deadline||'none'}`);
  if(diffs.length) addLog({type:'edit',task:`${t.name} › ${st.name}`,from:'',to:diffs.join(' · ')});
  // Auto-update parent progress
  const sts=t.subtasks.filter(s=>s.name?.trim());
  if(sts.length) t.prog=Math.round(sts.filter(s=>s.status==='done').length/sts.length*100);
  persistState(['tasks'],{tasks:[_stEditParentId,...(isChild?[_stEditStId]:[])]}); 
  CM('m-subtask');
  renderGantt();
  notify(`"${st.name}" saved ✓`,'success');
};

window._deleteSubtask=()=>{
  if(!confirm('Delete this subtask?')) return;
  const t=TASKS.find(x=>x.id===_stEditParentId); if(!t) return;
  const st=(t.subtasks||[]).find(s=>s.id===_stEditStId) || TASKS.find(x=>x.id===_stEditStId&&x.parentId===_stEditParentId);
  addLog({type:'delete',task:`${t.name} › ${st?.name||''}`,from:'',to:'subtask deleted'});
  // Remove from t.subtasks[] if present
  t.subtasks=(t.subtasks||[]).filter(s=>s.id!==_stEditStId);
  // Remove from TASKS[] if promoted
  const childIdx=TASKS.findIndex(x=>x.id===_stEditStId&&x.parentId===_stEditParentId);
  if(childIdx!==-1){
    TASKS.splice(childIdx,1);
    const _dp={}; _dp[_stEditStId]=null;
    fetch(_FB_ROOT+'/tasks.json',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(_dp)}).catch(()=>{});
  }
  const sts=t.subtasks.filter(s=>s.name?.trim());
  if(sts.length) t.prog=Math.round(sts.filter(s=>s.status==='done').length/sts.length*100);
  persistState(['tasks'],{tasks:[_stEditParentId]});
  CM('m-subtask');
  renderGantt();
};

window._showSubCtx=(e,parentId,stId)=>{
  const t=TASKS.find(x=>x.id===parentId); if(!t) return;
  const st=(t.subtasks||[]).find(s=>s.id===stId); if(!st) return;
  const old=document.getElementById('sub-ctx'); if(old) old.remove();
  const menu=document.createElement('div');
  menu.id='sub-ctx';
  menu.style.cssText='position:fixed;z-index:500;background:var(--bg2);border:1px solid var(--bd2);border-radius:8px;padding:4px;box-shadow:0 4px 16px rgba(0,0,0,.5);min-width:160px';
  menu.style.left=Math.min(e.clientX,window.innerWidth-170)+'px';
  menu.style.top=Math.min(e.clientY,window.innerHeight-220)+'px';
  const stCol=SCOLS[st.status]||'var(--fg3)';
  menu.innerHTML=`
    <div style="padding:5px 10px;font-size:9px;font-weight:700;color:var(--fg3);text-transform:uppercase;letter-spacing:.5px">⤷ ${st.name.slice(0,24)}${st.name.length>24?'…':''}</div>
    <div style="height:1px;background:var(--bd);margin:2px 0"></div>
    <div onclick="window._openSubtaskEditor('${parentId}','${stId}');this.closest('#sub-ctx').remove()" class="ci">✎ Edit subtask</div>
    <div style="height:1px;background:var(--bd);margin:2px 0"></div>
    ${['todo','doing','paused','done'].map(s=>`<div onclick="window._setSubStatusDirect('${parentId}','${stId}','${s}');this.closest('#sub-ctx').remove()" class="ci" style="color:${SCOLS[s]||'var(--fg2)'}">${s===st.status?'✓ ':''} ${SLABELS[s]||s}</div>`).join('')}
    <div style="height:1px;background:var(--bd);margin:2px 0"></div>
    <div onclick="if(confirm('Delete subtask?')){_stEditParentId='${parentId}';_stEditStId='${stId}';window._deleteSubtask();}this.closest('#sub-ctx')?.remove()" class="ci" style="color:var(--danger)">🗑 Delete</div>`;
  document.body.appendChild(menu);
  setTimeout(()=>{const cl=()=>{menu.remove();document.removeEventListener('click',cl);};document.addEventListener('click',cl);},50);
};

window._setSubStatusDirect=(parentId,stId,status)=>{
  const t=TASKS.find(x=>x.id===parentId); if(!t) return;
  const st=(t.subtasks||[]).find(s=>s.id===stId); if(!st) return;
  addLog({type:'status',task:`${t.name} › ${st.name}`,from:SLABELS[st.status]||st.status,to:SLABELS[status]||status});
  st.status=status;
  const sts=t.subtasks.filter(s=>s.name?.trim());
  if(sts.length) t.prog=Math.round(sts.filter(s=>s.status==='done').length/sts.length*100);
  persistState(['tasks'],{tasks:[parentId]});
  renderGantt();
};
// ── SUBTASKS ──────────────────────────────────────────────────
// Subtask: {id, name, resId, hours, status('todo'|'doing'|'paused'|'done'), deadline, notes}
let _curSubtasks = [];
let _showSubtasks = true; // Gantt toggle

function _renderSubtaskList(){
  const wrap = document.getElementById('mt-sub-list');
  const count = document.getElementById('mt-sub-count');
  const progBar = document.getElementById('mt-sub-prog-bar');
  const progFill = document.getElementById('mt-sub-prog-fill');
  const progPct = document.getElementById('mt-sub-prog-pct');
  if(!wrap) return;
  const done = _curSubtasks.filter(s=>s.status==='done').length;
  const total = _curSubtasks.length;
  if(count) count.textContent = total ? `${done}/${total}` : '';
  // Progress bar
  if(progBar){
    progBar.style.display = total ? '' : 'none';
    if(total){
      const pct = Math.round(done/total*100);
      if(progFill) progFill.style.width = pct+'%';
      if(progPct) progPct.textContent = pct+'%';
    }
  }
  if(!total){
    wrap.innerHTML = `<div style="font-size:10px;color:var(--fg3);padding:8px 0;text-align:center;border:1px dashed var(--bd);border-radius:7px;cursor:pointer" onclick="window._addSubtask()">
      + Add your first subtask
    </div>`;
    return;
  }
  wrap.innerHTML = _curSubtasks.map((st,i)=>{
    const isDone = st.status==='done';
    const stCol = SCOLS[st.status]||'var(--fg3)';
    const res = getRes(st.resId);
    const isPromoted = !!TASKS.find(x=>x.id===st.id);
    return `<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--bg2);border-radius:7px;border:1px solid var(--bd);${isDone?'opacity:.55':''}transition:background .15s"
      onmouseenter="this.style.background='var(--bg3)'" onmouseleave="this.style.background='var(--bg2)'">
      <!-- Status circle -->
      <button onclick="window._cycleSubStatus(${i})" title="Status: ${SLABELS[st.status]||st.status} — click to cycle"
        style="flex-shrink:0;width:14px;height:14px;border-radius:50%;border:2px solid ${stCol};background:${isDone?stCol:'transparent'};padding:0;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center">
        ${isDone?'<svg width="8" height="8" viewBox="0 0 8 8"><polyline points="1,4 3,6 7,2" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>':''}
      </button>
      <!-- Name -->
      <input type="text" value="${(st.name||'').replace(/"/g,'&quot;')}"
        oninput="window._renameSubtask(${i},this.value)"
        onfocus="this.parentElement.style.background='var(--bg3)'"
        onblur="this.parentElement.style.background='var(--bg2)'"
        style="flex:1;min-width:0;background:none;border:none;outline:none;font-size:11px;color:${isDone?'var(--fg3)':'var(--fg0)'};font-family:var(--font);${isDone?'text-decoration:line-through':''}"
        placeholder="Subtask name…">
      <!-- Resource avatar or assign button -->
      ${res
        ? `<div class="av av-sm ${res.avClass}" title="${res.name}" style="flex-shrink:0;width:20px;height:20px;font-size:8px;line-height:20px;cursor:pointer" onclick="window._openSubtaskEditor('${S.editId||''}','${st.id}')">${res.initials}</div>`
        : `<button onclick="window._openSubtaskEditor('${S.editId||''}','${st.id}')" title="Assign resource" style="flex-shrink:0;width:20px;height:20px;border-radius:50%;border:1.5px dashed var(--fg3);background:none;color:var(--fg3);font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0">+</button>`
      }
      <!-- Hours input -->
      <input type="number" value="${st.hours||''}" min="0.5" step="0.5" placeholder="h"
        oninput="window._setSubHours(${i},this.value)"
        title="Hours"
        style="flex-shrink:0;width:38px;font-size:9px;font-family:var(--mono);color:var(--fg2);background:var(--bg3);border:1px solid transparent;border-radius:4px;padding:1px 4px;text-align:center;outline:none"
        onfocus="this.style.borderColor='var(--acc)'"
        onblur="this.style.borderColor='transparent'">
      <!-- Deadline -->
      ${st.deadline ? `<span style="flex-shrink:0;font-size:9px;color:${new Date(st.deadline)<new Date()&&!isDone?'var(--danger)':'var(--fg3)'};font-family:var(--mono)">${st.deadline}</span>` : ''}
      <!-- Open full task -->
      ${isPromoted ? `<button onclick="event.stopPropagation();CM('m-task');setTimeout(()=>openEditTask('${st.id}'),50)" title="Open as full task" style="flex-shrink:0;background:none;border:none;cursor:pointer;color:var(--acc);font-size:11px;padding:0 2px;opacity:.7" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='.7'">↗</button>` : ''}
      <!-- Delete -->
      <button onclick="window._delSubtask(${i})" title="Remove subtask"
        style="flex-shrink:0;background:none;border:none;cursor:pointer;color:var(--fg3);font-size:13px;padding:0;line-height:1;opacity:0;transition:opacity .15s"
        onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0'">✕</button>
    </div>`;
  }).join('');
}

window._cycleSubStatus = (i)=>{
  const order=['todo','doing','paused','done'];
  const st=_curSubtasks[i]; if(!st) return;
  const next=order[(order.indexOf(st.status||'todo')+1)%order.length];
  st.status=next;
  _renderSubtaskList();
  _autoSaveSubtasks();
};
window._renameSubtask   = (i,v)=>{ if(_curSubtasks[i]){ _curSubtasks[i].name=v; clearTimeout(window._rnT); window._rnT=setTimeout(_autoSaveSubtasks,600); } };
window._setSubRes=(i,v)=>{
  if(!_curSubtasks[i]) return;
  _curSubtasks[i].resId=v||null;
  _renderSubtaskList();
  _autoSaveSubtasks();
};
window._setSubHours     = (i,v)=>{ if(_curSubtasks[i]){ _curSubtasks[i].hours=parseFloat(v)||null; _updateTotalWithSubs(); _autoSaveSubtasks(); } };
window._setSubDl        = (i,v)=>{ if(_curSubtasks[i]){ _curSubtasks[i].deadline=v||null; _autoSaveSubtasks(); } };
window._setSubStart     = (i,v)=>{ if(_curSubtasks[i]){ _curSubtasks[i].start=v?dateToIdx(v):null; _autoSaveSubtasks(); } };
// Auto-save subtask changes to TASKS + Firebase while modal is open
window._autoSaveSubtasks=()=>{
  if(!S.editId) return;
  const t=TASKS.find(x=>x.id===S.editId); if(!t) return;
  const kept=new Set(_curSubtasks.filter(st=>st.name?.trim()).map(st=>st.id));
  // Remove promoted children that were deleted from the modal
  const toDelete=TASKS.filter(x=>x.parentId===S.editId&&!kept.has(x.id));
  toDelete.forEach(x=>{
    TASKS.splice(TASKS.indexOf(x),1);
    const _dp={}; _dp[x.id]=null;
    fetch(_FB_ROOT+'/tasks.json',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(_dp)}).catch(()=>{});
  });
  t.subtasks=_curSubtasks.filter(st=>st.name?.trim()).map(st=>({...st,name:st.name.trim(),group:t.group||null}));
  // For subtasks already promoted to TASKS[], update them directly
  _curSubtasks.filter(st=>st.name?.trim()).forEach(st=>{
    const child=TASKS.find(x=>x.id===st.id&&x.parentId===t.id);
    if(child){ Object.assign(child,{name:st.name.trim(),resId:st.resId||null,hours:st.hours||null,deadline:st.deadline||null,status:st.status||'todo',group:t.group||null,notes:st.notes||''}); }
  });
  // Also clear subtasks entries that are already in TASKS[] to avoid re-promotion
  t.subtasks=t.subtasks.filter(st=>!TASKS.find(x=>x.id===st.id&&x.parentId===t.id));
  const sts=_curSubtasks.filter(st=>st.name?.trim());
  if(sts.length) t.prog=Math.round(sts.filter(s=>s.status==='done').length/sts.length*100);
  const _promotedIds=sts.map(st=>st.id).filter(id=>TASKS.find(x=>x.id===id&&x.parentId===S.editId));
  persistState(['tasks'],{tasks:[S.editId,..._promotedIds]});
};
window._delSubtask=(i)=>{
  const st=_curSubtasks[i];
  if(st&&st.id){
    // Remove promoted child task from TASKS[] if it exists
    const childIdx=TASKS.findIndex(x=>x.id===st.id&&x.parentId===S.editId);
    if(childIdx!==-1){
      const childId=TASKS[childIdx].id;
      TASKS.splice(childIdx,1);
      // Delete from Firebase
      const _dp={}; _dp[childId]=null;
      fetch(_FB_ROOT+'/tasks.json',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(_dp)}).catch(()=>{});
    }
  }
  _curSubtasks.splice(i,1);
  _renderSubtaskList();
  _updateTotalWithSubs();
  _autoSaveSubtasks();
};

window._addSubtask = ()=>{
  const _parentTask=TASKS.find(x=>x.id===S.editId);
  _curSubtasks.push({id:'st'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
    name:'', status:'todo', resId:null, hours:null, start:null, deadline:null, notes:'',
    group:_parentTask?.group||null});
  _renderSubtaskList();
  _updateTotalWithSubs();
  _autoSaveSubtasks();
  const inputs = document.querySelectorAll('#mt-sub-list input[type=text]');
  if(inputs.length) inputs[inputs.length-1].focus();
};

function _loadSubtasksIntoModal(subtasks){
  _curSubtasks = JSON.parse(JSON.stringify((subtasks||[]).map(st=>({
    id:st.id||('st'+Date.now()),
    name:st.name||'',
    status:st.status||(st.done?'done':'todo'),
    resId:st.resId||null,
    hours:st.hours||null,
    start:st.start||null,
    deadline:st.deadline||null,
    notes:st.notes||'',
    group:st.group||null
  }))));
  _renderSubtaskList();
}

// Gantt toggle
window.ganttToggleAllCollapse=()=>{
  const btn=document.getElementById('btn-collapse-all');
  const isTV=S.viewBy==='team'||S.viewBy==='resource';
  const tasksWithChildren=TASKS.filter(t=>hasChildren(t.id));
  if(isTV){
    // team/resource view: default=collapsed, _expandedTeamRes tracks expanded
    const allExpanded=tasksWithChildren.every(t=>_expandedTeamRes.has(t.id));
    if(allExpanded){ _expandedTeamRes.clear(); if(btn) btn.textContent='▼'; }
    else { tasksWithChildren.forEach(t=>_expandedTeamRes.add(t.id)); if(btn) btn.textContent='▶'; }
  } else {
    // project view: default=expanded, _collapsedTasks tracks collapsed
    const allCollapsed=tasksWithChildren.every(t=>_collapsedTasks.has(t.id));
    if(allCollapsed){ tasksWithChildren.forEach(t=>_collapsedTasks.delete(t.id)); _saveCollapsed(); if(btn) btn.textContent='▼'; }
    else { tasksWithChildren.forEach(t=>_collapsedTasks.add(t.id)); _saveCollapsed(); if(btn) btn.textContent='▶'; }
  }
  renderGantt();
};

window.toggleSubtasks = ()=>{
  _showSubtasks = !_showSubtasks;
  const btn=document.getElementById('btn-show-subtasks');
  if(btn){ btn.style.opacity=_showSubtasks?'1':'0.4'; btn.title=_showSubtasks?'Hide subtasks':'Show subtasks'; }
  renderGantt();
};

// ── CLEAR FILTERS ────────────────────────────────────────────────
window.clearAllFilters=()=>{
  S.statusFilter=['todo','doing','paused','ready','hold'];
  S.filterUnassigned=false;
  S.selectedTags=[];
  S.vbFilter=[];
  const gs=document.getElementById('g-search'); if(gs) gs.value='';
  buildSFChips(); buildTagPanel(); buildVBPanel&&buildVBPanel();
  renderGantt(); renderTable&&renderTable();
  notify('Filters cleared','success');
};

// ── DESELECT ALL VB ──────────────────────────────────────────────
window.deselectAllVB=()=>{
  // '__none__' sentinel = nothing selected = show nothing
  S.vbFilter=['__none__'];
  // Re-render the panel in place so checkboxes reflect the new state
  const _p=document.getElementById('vb-sel-panel');
  if(_p&&_p.style.display!=='none'){ _p.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.checked=false); }
  renderGantt();
};

// ── TOTAL W/ SUBTASKS UPDATE ─────────────────────────────────────
window._updateTotalWithSubs=()=>{
  const h=parseFloat(document.getElementById('mt-h-tot').value)||0;
  const stH=_curSubtasks.filter(st=>st.name?.trim()).reduce((a,s)=>a+(s.hours||0),0);
  const el=document.getElementById('mt-h-total-sub');
  if(el){
    if(stH>0) el.value=`${h+stH}h (${h}h + ${stH}h subtasks)`;
    else el.value=`${h}h`;
  }
};

// ── GANTT MULTI-SELECT ───────────────────────────────────────────
let _selTasks = new Set();

window.toggleSelTask = (id, checked) => {
  if(checked) _selTasks.add(id);
  else _selTasks.delete(id);
  _updateSelBar();
  // highlight row
  const row = document.querySelector(`.gt tr[data-tid="${id}"]`);
  if(row) row.classList.toggle('sel-row', checked);
};

window.selectAllVisibleTasks=()=>{
  if(!isAdmin()){notify('Only admins can select tasks','warn');return;}
  // Get all task IDs currently visible in the Gantt (checkboxes)
  const checkboxes=document.querySelectorAll('#gw input[type=checkbox][data-tid]');
  if(!checkboxes.length){notify('No tasks visible','warn');return;}
  checkboxes.forEach(cb=>{
    const id=cb.dataset.tid;
    if(id){ _selTasks.add(id); cb.checked=true; }
  });
  _updateSelBar();
};
window.clearSelTasks = () => {
  _selTasks.clear();
  document.querySelectorAll('.gt-sel-cb').forEach(cb => cb.checked = false);
  document.querySelectorAll('.gt tr.sel-row').forEach(r => r.classList.remove('sel-row'));
  _updateSelBar();
};

function _updateSelBar(){
  const bar = document.getElementById('sel-bar');
  const cnt = document.getElementById('sel-bar-count');
  if(!bar) return;
  if(_selTasks.size > 0){
    bar.classList.remove('hidden');
    if(cnt) cnt.textContent = _selTasks.size;
  } else {
    bar.classList.add('hidden');
  }
}

window.selDuplicate = () => {
  if(!_selTasks.size) return;
  if(!isAdmin()){notify('Only admins can duplicate tasks','warn');return;}
  const ids=[..._selTasks];
  clearSelTasks();
  let inserted=0;
  ids.forEach(id=>{
    const src=TASKS.find(x=>x.id===id);
    if(!src) return;
    const copy=JSON.parse(JSON.stringify(src));
    copy.id='t'+Date.now()+inserted;
    copy.name='(copy) '+src.name;
    copy.status='todo';
    copy.prog=0;
    copy.timeLogs=[];
    copy.segments=null;
    const idx=TASKS.findIndex(x=>x.id===src.id);
    TASKS.splice(idx+1,0,copy);
    addLog({type:'create',task:copy.name,from:'',to:'duplicated from '+src.name});
    inserted++;
  });
  persistState(['tasks']);
  renderGantt();renderDash();_refreshOverview();
  notify(inserted+' task'+(inserted>1?'s':'')+' duplicated','success');
};
window.selChangeGroup=()=>{
  if(!isAdmin()){notify('Only admins can change group','warn');return;}
  if(!_selTasks.size) return;
  // Use same fixed group list as Edit Task modal (same order)
  const _fixedGroups=[...document.querySelectorAll('#mt-group option')].filter(o=>o.value).map(o=>o.value);
  const selGroups=[...new Set([..._selTasks].map(id=>TASKS.find(t=>t.id===id)?.group).filter(Boolean))];
  const currentGroup=selGroups.length===1?selGroups[0]:'';
  const inp=document.getElementById('sel-group-input');
  if(inp){
    inp.innerHTML='<option value="">— group —</option>'+_fixedGroups.map(g=>`<option value="${g}" ${g===currentGroup?'selected':''}>${g}</option>`).join('');
  }
  const countEl=document.getElementById('sel-group-count');
  if(countEl) countEl.textContent=_selTasks.size+' task'+(_selTasks.size!==1?'s':'')+' selected';
  OM('m-sel-group');
  setTimeout(()=>document.getElementById('sel-group-input')?.focus(),50);
};

window.selChangeGroupApply=()=>{
  const newGroup=document.getElementById('sel-group-input')?.value||null;
  const ids=[..._selTasks];
  ids.forEach(id=>{
    const t=TASKS.find(x=>x.id===id);
    if(t){ addLog({type:'edit',task:t.name,from:t.group||'—',to:newGroup||'—'}); t.group=newGroup; }
  });
  persistState(['tasks'],{tasks:ids});
  renderGantt(); renderDash(); _refreshOverview();
  CM('m-sel-group');
  clearSelTasks();
  notify(ids.length+' task'+(ids.length!==1?'s':'')+' updated','success');
};

window.selDelete = () => {
  if(!_selTasks.size) return;
  if(!isAdmin()){notify('Only admins can delete tasks','warn');return;}
  const count=_selTasks.size;
  if(!confirm(`Delete ${count} task${count!==1?'s':''}? This cannot be undone.`)) return;
  const ids=[..._selTasks];
  clearSelTasks();
  ids.forEach(id=>{
    _deletedIds.tasks.add(id);
    const t=TASKS.find(x=>x.id===id);
    if(t) addLog({type:'delete',task:t.name,from:'',to:'deleted'});
  });
  TASKS=TASKS.filter(t=>!ids.includes(t.id));
  persistState(['tasks'],{tasks:ids});
  renderGantt();renderDash();_refreshOverview();
  notify(count+' task'+(count!==1?'s':'')+' deleted','warn');
};
window.selAddDependent = () => {
  if(!_selTasks.size) return;
  const ids = [..._selTasks];
  clearSelTasks();
  openAddTask();
  // Set dep type to task
  const depType = document.getElementById('mt-dep-type');
  if(depType){ depType.value = 'task'; onDepTypeChange(); }
  // If only one task, pre-fill the combo-search label
  if(ids.length === 1){
    const src = TASKS.find(x => x.id === ids[0]);
    const inp = document.getElementById('dep-task-search');
    if(inp && src) inp.value = src.name;
    const sel = document.getElementById('mt-dep-id');
    if(sel && src){
      let opt = [...sel.options].find(o => o.value === ids[0]);
      if(!opt){ opt = new Option(src.name, ids[0]); sel.add(opt); }
      sel.value = ids[0];
    }
    // Pre-fill group from source
    const gsel = document.getElementById('mt-group');
    if(gsel && src?.group) gsel.value = src.group;
  } else {
    // Multiple: show names in the search field as hint, store first as dep
    // and note others in the dep note field
    const tasks = ids.map(id => TASKS.find(x => x.id === id)).filter(Boolean);
    const first = tasks[0];
    const inp = document.getElementById('dep-task-search');
    if(inp && first) inp.value = first.name;
    const sel = document.getElementById('mt-dep-id');
    if(sel && first){
      let opt = [...sel.options].find(o => o.value === first.id);
      if(!opt){ opt = new Option(first.name, first.id); sel.add(opt); }
      sel.value = first.id;
    }
    // Put remaining task names in the dep note as reference
    const note = document.getElementById('mt-dep-note');
    if(note && tasks.length > 1){
      note.value = 'Also depends on: ' + tasks.slice(1).map(t => t.name).join(', ');
    }
    document.getElementById('fg-dep-note').style.display = '';
    const gsel = document.getElementById('mt-group');
    if(gsel && first?.group) gsel.value = first.group;
  }
  document.getElementById('fg-dep-task').style.display = '';
  document.getElementById('fg-dep-note').style.display = '';
};

// ── DEP-TASK COMBO-SEARCH (task modal) ───────────────────────────
let _depTaskItems = [];  // [{value, label, indent}]
let _depTaskIdx = -1;

function _buildDepTaskItems(){
  const _projId = S._activeProjId || document.getElementById('mt-proj')?.value || null;
  _depTaskItems = [];
  function _walk(t, depth){
    if(t.id === S.editId) return;
    _depTaskItems.push({value: t.id, label: t.name, depth});
    TASKS.filter(ch => ch.parentId === t.id).forEach(ch => _walk(ch, depth+1));
  }
  TASKS.filter(t => !t.parentId && (!_projId || t.projId === _projId)).forEach(t => _walk(t, 0));
}

function _filterDepTasks(q){
  const ql = q.toLowerCase();
  return _depTaskItems.filter(it => it.label.toLowerCase().includes(ql));
}

function _renderDepTaskDropdown(items){
  const dd = document.getElementById('dep-task-dropdown');
  const csb = document.getElementById('dep-task-csb');
  if(!dd) return;
  if(!items.length){
    dd.innerHTML = '<div class="csi" style="color:var(--fg3);pointer-events:none">No results</div>';
  } else {
    dd.innerHTML = items.map((it,i) => `
      <div class="csi ${i===_depTaskIdx?'csi-active':''}"
        data-val="${it.value}" data-label="${it.label.replace(/"/g,'&quot;')}"
        onmousedown="depTaskSelect('${it.value}','${it.label.replace(/'/g,"&#39;")}')"
        style="${i===_depTaskIdx?'background:var(--bg3);color:var(--fg0)':''}">
        ${'&nbsp;&nbsp;'.repeat(it.depth)}${it.depth>0?'⤷ ':''}<span style="font-weight:600">${it.label}</span>
      </div>`).join('');
  }
  csb.classList.add('open');
}

window.depTaskOpen = ()=>{
  _buildDepTaskItems();
  _depTaskIdx = -1;
  const q = (document.getElementById('dep-task-search')?.value||'').trim();
  _renderDepTaskDropdown(q ? _filterDepTasks(q) : _depTaskItems);
  const inp = document.getElementById('dep-task-search');
  const dd = document.getElementById('dep-task-dropdown');
  if(inp && dd){
    const r = inp.getBoundingClientRect();
    dd.style.left = r.left+'px';
    dd.style.top = (r.bottom+2)+'px';
    dd.style.width = r.width+'px';
  }
};

window.depTaskClose = ()=>{
  const csb = document.getElementById('dep-task-csb');
  if(csb) csb.classList.remove('open');
  _depTaskIdx = -1;
};

window.depTaskInput = (inp)=>{
  _depTaskIdx = -1;
  const q = inp.value.trim();
  _renderDepTaskDropdown(q ? _filterDepTasks(q) : _depTaskItems);
  const dd = document.getElementById('dep-task-dropdown');
  if(dd){
    const r = inp.getBoundingClientRect();
    dd.style.left = r.left+'px';
    dd.style.top = (r.bottom+2)+'px';
    dd.style.width = r.width+'px';
  }
};

window.depTaskKeydown = (e)=>{
  const dd = document.getElementById('dep-task-dropdown');
  const items = dd ? dd.querySelectorAll('.csi[data-val]') : [];
  if(e.key==='ArrowDown'){ e.preventDefault(); _depTaskIdx=Math.min(_depTaskIdx+1,items.length-1); _highlightDepTask(items); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); _depTaskIdx=Math.max(_depTaskIdx-1,0); _highlightDepTask(items); }
  else if(e.key==='Enter'){
    e.preventDefault();
    if(_depTaskIdx>=0&&items[_depTaskIdx]) depTaskSelect(items[_depTaskIdx].dataset.val, items[_depTaskIdx].dataset.label);
    else if(items.length===1) depTaskSelect(items[0].dataset.val, items[0].dataset.label);
  } else if(e.key==='Escape'){ depTaskClose(); }
};

function _highlightDepTask(items){
  items.forEach((el,i)=>{
    el.style.background = i===_depTaskIdx?'var(--bg3)':'';
    el.style.color = i===_depTaskIdx?'var(--fg0)':'';
    if(i===_depTaskIdx) el.scrollIntoView({block:'nearest'});
  });
}

window.depTaskSelect = (value, label)=>{
  const sel = document.getElementById('mt-dep-id');
  if(sel){
    if(![...sel.options].find(o=>o.value===value)){
      const opt=new Option(label, value, true, true);
      sel.add(opt);
    } else {
      [...sel.options].find(o=>o.value===value).selected=true;
    }
  }
  const inp = document.getElementById('dep-task-search');
  if(inp){ inp.value=''; depTaskClose(); }
  _renderDepChips();
};

function _renderDepChips(){
  const sel=document.getElementById('mt-dep-id');
  const chips=document.getElementById('dep-task-chips');
  if(!sel||!chips) return;
  const selected=[...sel.options].filter(o=>o.selected&&o.value);
  chips.innerHTML=selected.map(o=>`<span style="display:inline-flex;align-items:center;gap:4px;background:var(--bg3);border:1px solid var(--bd2);border-radius:4px;padding:2px 6px;font-size:10px;color:var(--fg1)">
    <span>${o.text}</span>
    <span onclick="depRemoveChip('${o.value}')" style="cursor:pointer;color:var(--fg3);font-size:10px;line-height:1">✕</span>
  </span>`).join('');
  chips.style.display=selected.length?'flex':'none';
}

window.depRemoveChip=(value)=>{
  const sel=document.getElementById('mt-dep-id');
  if(!sel) return;
  const opt=[...sel.options].find(o=>o.value===value);
  if(opt) sel.remove(opt.index);
  _renderDepChips();
};

// ── RESOURCE COMBO-SEARCH (task modal) ───────────────────────────
// Internal list: [{value:'resId|teamId', label:'Name', team:'Team Name', initials:'NM'}]
let _resSearchItems = [];
let _resSearchIdx = -1;

function _getInitials(name){
  return name.split(/\s+/).map(w=>w[0]||'').join('').toUpperCase();
}

// Called by _populateResAddFlat to also fill _resSearchItems
function _buildResSearchItems(){
  const addedIds = new Set(_taskTeams.flatMap(tt=>tt.entries.map(e=>e.id)));
  _resSearchItems = [];
  TEAMS.forEach(tm=>{
    const res = RESOURCES.filter(r=>(r.teams||[]).includes(tm.id) && !addedIds.has(r.id));
    res.forEach(r=>_resSearchItems.push({
      value: r.id+'|'+tm.id,
      label: r.name,
      team: tm.name,
      initials: _getInitials(r.name)
    }));
  });
  const noTeam = RESOURCES.filter(r=>(!r.teams||!r.teams.length)&&!addedIds.has(r.id));
  noTeam.forEach(r=>_resSearchItems.push({value:r.id+'|',label:r.name,team:'No team',initials:_getInitials(r.name)}));
}

function _renderResDropdown(items){
  const dd = document.getElementById('mt-res-dropdown');
  const csb = document.getElementById('mt-res-csb');
  if(!dd) return;
  if(!items.length){
    dd.innerHTML = '<div class="csi" style="color:var(--fg3);pointer-events:none">No results</div>';
  } else {
    dd.innerHTML = items.map((it,i)=>`
      <div class="csi ${i===_resSearchIdx?'csi-active':''}"
        data-val="${it.value}" data-label="${it.label}"
        onmousedown="resSearchSelect('${it.value}','${it.label.replace(/'/g,"&#39;")}')"
        style="${i===_resSearchIdx?'background:var(--bg3);color:var(--fg0)':''}">
        <span style="font-weight:600">${it.label}</span>
        <span style="color:var(--fg3);font-size:10px;margin-left:6px">${it.team}</span>
      </div>`).join('');
  }
  csb.classList.add('open');
}

window.resSearchOpen = ()=>{
  _buildResSearchItems();
  _resSearchIdx = -1;
  const q = (document.getElementById('mt-res-search')?.value||'').trim();
  const filtered = q ? _filterResItems(q) : _resSearchItems;
  _renderResDropdown(filtered);
  // Position fixed dropdown under the input
  const inp = document.getElementById('mt-res-search');
  const dd = document.getElementById('mt-res-dropdown');
  if(inp && dd){
    const r = inp.getBoundingClientRect();
    dd.style.left = r.left+'px';
    dd.style.top = (r.bottom+2)+'px';
    dd.style.width = r.width+'px';
  }
};

window.resSearchClose = ()=>{
  const csb = document.getElementById('mt-res-csb');
  if(csb) csb.classList.remove('open');
  _resSearchIdx = -1;
};

function _filterResItems(q){
  const ql = q.toLowerCase();
  // Match by initials first, then by name substring
  const byInitials = _resSearchItems.filter(it=>it.initials.toLowerCase().startsWith(ql));
  const byName = _resSearchItems.filter(it=>!byInitials.includes(it) && it.label.toLowerCase().includes(ql));
  return [...byInitials, ...byName];
}

window.resSearchInput = (inp)=>{
  _resSearchIdx = -1;
  const q = inp.value.trim();
  const filtered = q ? _filterResItems(q) : _resSearchItems;
  _renderResDropdown(filtered);
  const dd = document.getElementById('mt-res-dropdown');
  if(dd){
    const r = inp.getBoundingClientRect();
    dd.style.left = r.left+'px';
    dd.style.top = (r.bottom+2)+'px';
    dd.style.width = r.width+'px';
  }
};

window.resSearchKeydown = (e)=>{
  const dd = document.getElementById('mt-res-dropdown');
  const csb = document.getElementById('mt-res-csb');
  const items = dd ? dd.querySelectorAll('.csi[data-val]') : [];
  if(e.key==='ArrowDown'){
    e.preventDefault();
    _resSearchIdx = Math.min(_resSearchIdx+1, items.length-1);
    _highlightResItem(items);
  } else if(e.key==='ArrowUp'){
    e.preventDefault();
    _resSearchIdx = Math.max(_resSearchIdx-1, 0);
    _highlightResItem(items);
  } else if(e.key==='Enter'){
    e.preventDefault();
    if(_resSearchIdx>=0 && items[_resSearchIdx]){
      const el = items[_resSearchIdx];
      resSearchSelect(el.dataset.val, el.dataset.label);
    } else if(items.length===1){
      resSearchSelect(items[0].dataset.val, items[0].dataset.label);
    }
  } else if(e.key==='Escape'){
    resSearchClose();
  } else {
    if(!csb.classList.contains('open')) csb.classList.add('open');
  }
};

function _highlightResItem(items){
  items.forEach((el,i)=>{
    el.style.background = i===_resSearchIdx ? 'var(--bg3)' : '';
    el.style.color = i===_resSearchIdx ? 'var(--fg0)' : '';
    if(i===_resSearchIdx) el.scrollIntoView({block:'nearest'});
  });
}

window.resSearchSelect = (value, label)=>{
  // Trigger addResFlat via the hidden select
  const sel = document.getElementById('mt-res-add-flat');
  if(sel){
    // Ensure the option exists (it was populated by _populateResAddFlat)
    let opt = [...sel.options].find(o=>o.value===value);
    if(!opt){ opt = new Option(label, value); sel.add(opt); }
    sel.value = value;
    addResFlat();
  }
  // Clear and close
  const inp = document.getElementById('mt-res-search');
  if(inp) inp.value = '';
  resSearchClose();
};

// ── GENERATE REPORT ──────────────────────────────────────────────
window.generateReport=()=>{
  notify('Report — em breve: define o que deves incluir no relatório','info');
};
// ============================================================
