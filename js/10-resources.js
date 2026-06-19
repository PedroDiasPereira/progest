// ============================================================
// RESOURCES PAGE
// ============================================================
// ── RESOURCES TABLE SORT ─────────────────────────────────────────
let _resSort = {col: null, dir: 1}; // dir: 1=asc, -1=desc

window.sortRes = (col) => {
  if(_resSort.col === col) _resSort.dir *= -1;
  else { _resSort.col = col; _resSort.dir = 1; }
  renderRes();
};

function _getSortedResources(){
  const {col, dir} = _resSort;
  if(!col) return RESOURCES.map((r,i)=>({r,i}));
  return RESOURCES.map((r,i)=>({r,i})).sort((a,b)=>{
    let va, vb;
    if(col==='tasks'){
      va = TASKS.filter(t=>t.resId===a.r.id).length;
      vb = TASKS.filter(t=>t.resId===b.r.id).length;
    } else {
      va = (a.r[col]||'').toString().toLowerCase();
      vb = (b.r[col]||'').toString().toLowerCase();
    }
    if(va < vb) return -dir;
    if(va > vb) return dir;
    return 0;
  });
}

function _updateResSortHeaders(){
  ['name','role','dailyCap','tasks'].forEach(col=>{
    const el = document.getElementById('res-sh-'+col);
    if(!el) return;
    const isActive = _resSort.col === col;
    const arrow = isActive ? (_resSort.dir===1 ? ' ↑' : ' ↓') : '';
    el.textContent = {name:'Name',role:'Role',dailyCap:'Daily cap (h)',tasks:'Tasks'}[col] + arrow;
    el.parentElement.style.color = isActive ? 'var(--acc)' : '';
  });
}

function renderRes(){
  const sorted = _getSortedResources();
  document.getElementById('res-b').innerHTML=sorted.map(({r,i})=>`<tr>
    <td><input class="ie" value="${r.name}" onchange="uRes(${i},'name',this.value)" style="min-width:130px"></td>
    <td><input class="ie" value="${r.role||''}" onchange="uRes(${i},'role',this.value)" style="min-width:95px"></td>
    <td><div style="display:flex;gap:3px;flex-wrap:wrap;align-items:center">
      ${TEAMS.map(t=>`<label style="display:inline-flex;align-items:center;gap:3px;font-size:10px;color:var(--fg2);cursor:pointer;white-space:nowrap">
        <input type="checkbox" ${(r.teams||[]).includes(t.id)?'checked':''} onchange="toggleResTeam(${i},'${t.id}',this.checked)" style="accent-color:${t.color}">
        <span style="width:5px;height:5px;border-radius:1px;background:${t.color}"></span>${t.name.split(' ')[0]}
      </label>`).join('')}
    </div></td>
    <td><input class="ie" type="number" value="${r.dailyCap||8}" min="1" max="24" onchange="uRes(${i},'dailyCap',+this.value)" style="width:50px"></td>
    <td style="text-align:center"><button onclick="RESOURCES[${i}].showInDash=!(RESOURCES[${i}].showInDash!==false);persistState(['resources']);renderRes();renderDash();" title="Show/hide in workload gauges" style="background:none;border:none;cursor:pointer;font-size:15px;line-height:1;opacity:${r.showInDash===false?0.2:1}">${r.showInDash===false?'🚫':'👁'}</button></td>
    <td class="mono txs">${TASKS.filter(t=>t.resId===r.id).length}</td>
    <td class="mono txs" title="Vacation days this year: remaining / total">${(()=>{
      const _yr=new Date().getFullYear();
      const _todayStr=new Date().toISOString().slice(0,10);
      let _total=0, _taken=0;
      [...(r.timeOff||[]),...(COLLECTIVE_HOLIDAYS||[])].forEach(to=>{ // personal + collective
        if(!to.start||!to.end) return;
        const s=new Date(to.start+'T12:00:00'), e=new Date(to.end+'T12:00:00');
        if(s.getFullYear()!==_yr&&e.getFullYear()!==_yr) return;
        const _sD=new Date(Math.max(s,new Date(_yr+'-01-01T12:00:00')));
        const _eD=new Date(Math.min(e,new Date(_yr+'-12-31T12:00:00')));
        for(let d=new Date(_sD);d<=_eD;d.setDate(d.getDate()+1)){
          const dw=d.getDay();
          if(dw===0||dw===6) continue;
          _total++;
          const _dStr=d.toISOString().slice(0,10);
          if(_dStr<_todayStr) _taken++; // strictly before today = gozado
        }
      });
      if(!_total) return '—';
      const _rem=_total-_taken;
      return `<span style="color:${_rem===0?'var(--ok)':_rem<5?'var(--warn)':'var(--fg0)'}">${_rem}</span><span style="color:var(--fg3)">/${_total}</span>`;
    })()}</td>
    <td style="display:flex;gap:4px;align-items:center">
      <button class="btn btn-xs" onclick="adminResetPw('${r.id}')" title="Repor palavra-passe">🔑</button>
      ${r.id!=='pp'?`<button class="btn btn-xs" id="admin-btn-${r.id}" onclick="adminToggleAdminUI('${r.id}')" title="Toggle admin" style="font-size:10px">${(_adminMap.get(r.id)||r._isAdmin)?'★ Admin':'☆'}</button>`:'<span style="font-size:9px;color:var(--acc)">ADMIN</span>'}
      <button class="btn btn-xs" onclick="openTimeOff('${r.id}')" title="Time Off">🏖</button>
      <button class="btn btn-xs" onclick="RESOURCES[${i}].simulated=!RESOURCES[${i}].simulated;persistState(['resources']);renderRes();" title="${r.simulated?'Simulated (hypothetical) resource — click to make real':'Real resource — click to mark as simulated'}" style="${r.simulated?'background:rgba(240,169,40,.15);border-color:var(--warn)':''}">${r.simulated?'👻':'👤'}</button>
      <button class="btn btn-xs btn-d" onclick="delRes('${r.id}')">✕</button>
    </td>
  </tr>`).join('');
  _updateResSortHeaders();
}
window.adminToggleAdminUI=async(resId)=>{
  const newAdmin=await adminToggleAdmin(resId);
  const r=getRes(resId); if(r) r._isAdmin=newAdmin===true;
  _adminMap.set(resId,newAdmin===true);
  renderRes();
};
function toggleResTeam(i,teamId,checked){
  if(!RESOURCES[i].teams) RESOURCES[i].teams=[];
  if(checked){ if(!RESOURCES[i].teams.includes(teamId)) RESOURCES[i].teams.push(teamId); }
  else RESOURCES[i].teams=RESOURCES[i].teams.filter(x=>x!==teamId);
  const tm=getTeam(teamId);
  addLog({type:'resource',task:RESOURCES[i].name,from:'',to:(checked?'added to ':'removed from ')+(tm?.name||teamId)});
  persistState(['resources']);
}
window.addRes=()=>{
  const defaultName='New Resource';
  RESOURCES.push({id:'r'+Date.now(),name:defaultName,initials:_getInitials(defaultName),avClass:'av-b',teams:[],role:'',dailyCap:8});
  addLog({type:'resource',task:defaultName,from:'',to:'created'});
  persistState(['resources']); renderRes();
};
window.delRes=(id)=>{
  if(!confirm('Delete resource?')) return;
  const _dr=getRes(id);
  addLog({type:'resource',task:_dr?.name||id,from:'',to:'deleted'});
  _deletedIds.resources.add(id);
  RESOURCES=RESOURCES.filter(r=>r.id!==id);
  persistState(['resources']); renderRes();
};

