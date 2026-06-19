// TEAMS PAGE
// ============================================================
function renderTeams(){
  const canEdit=isAdmin();
  document.getElementById('teams-b').innerHTML=TEAMS.map((t,i)=>{
    const members=RESOURCES.filter(r=>(r.teams||[]).includes(t.id));
    const leaderSel=`<select class="ie" ${canEdit?'':`disabled`} onchange="uTeam(${i},'leaderId',this.value)" style="width:120px">
      <option value="">— nenhum —</option>
      ${members.map(m=>`<option value="${m.id}" ${t.leaderId===m.id?'selected':''}>${m.name}</option>`).join('')}
    </select>`;
    return `<tr>
      <td>${canEdit?`<input class="ie" value="${t.name}" onchange="uTeam(${i},'name',this.value)" style="min-width:125px">`:`<span style="font-size:11px">${t.name}</span>`}</td>
      <td>${leaderSel}</td>
      <td>${canEdit?`<input class="ie" value="${t.desc||''}" onchange="uTeam(${i},'desc',this.value)" style="min-width:190px">`:`<span style="font-size:11px;color:var(--fg2)">${t.desc||'—'}</span>`}</td>
      <td>${canEdit?`<input type="color" value="${t.color}" onchange="uTeam(${i},'color',this.value)" style="width:34px;height:28px;border:none;background:none;cursor:pointer">`:`<span style="display:inline-block;width:16px;height:16px;border-radius:3px;background:${t.color}"></span>`}</td>
      <td class="mono txs">${members.length} members</td>
      <td style="text-align:center"><button onclick="TEAMS[${i}].showInDash=!(TEAMS[${i}].showInDash!==false);persistState(['teams']);renderTeams();renderDash();" title="Show/hide in workload gauges" style="background:none;border:none;cursor:pointer;font-size:15px;line-height:1;opacity:${t.showInDash===false?0.2:1}">${t.showInDash===false?'🚫':'👁'}</button></td>
      <td>${canEdit?`<button class="btn btn-xs btn-d" onclick="delTeam('${t.id}')">✕</button>`:''}</td>
    </tr>`;
  }).join('');
  // Show/hide Add button based on admin
  const addBtn=document.querySelector('#page-teams .btn-p');
  if(addBtn) addBtn.style.display=isAdmin()?'':'none';
}
window.addTeam=()=>{
  if(!isAdmin()){notify('Only admins can add teams','warn');return;}
  TEAMS.push({id:'tm'+Date.now(),name:'New Team',color:'#7a8aaa',desc:'',leaderId:null});
  persistState(['teams']); renderTeams();
};
window.delTeam=(id)=>{
  if(!isAdmin()){notify('Only admins can delete teams','warn');return;}
  if(!confirm('Delete team?')) return;
  TEAMS=TEAMS.filter(t=>t.id!==id);
  persistState(['teams']); renderTeams();
};

// Move a task up (-1) or down (+1) in the TASKS array (= Gantt priority order)
window.moveTaskOrder=(taskId, dir)=>{
  const idx=TASKS.findIndex(t=>t.id===taskId);
  if(idx<0) return;
  const target=idx+dir;
  if(target<0||target>=TASKS.length) return;
  // Swap
  [TASKS[idx], TASKS[target]]=[TASKS[target], TASKS[idx]];
  persistState();
  renderGantt();
};

window.openAddChildTask=(parentId)=>{S._addChildParentId=parentId;openAddTask();const parent=TASKS.find(t=>t.id===parentId);if(parent){const ps=document.getElementById('mt-proj');if(ps&&parent.projId)ps.value=parent.projId;}document.getElementById('mt-h').textContent='Add Sub-Task';};

// ============================================================
