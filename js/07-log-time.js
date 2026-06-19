// ============================================================
// LOG TIME
// ============================================================
function openLogTime(taskId){
  S.logId=taskId;
  const t=taskId?TASKS.find(x=>x.id===taskId):null;
  document.getElementById('ml-ts').textContent=t?t.name:'Select a task';
  document.getElementById('ml-t-inp').value=t?t.name:'';
  document.getElementById('ml-t-id').value=taskId||'';
  document.getElementById('ml-date').value=idxToDate(GANTT_TODAY);
  document.getElementById('ml-h').value=1;
  document.getElementById('ml-notes').value='';
  OM('m-log');
}
window.openLogTime=openLogTime;
window.saveLog=()=>{
  const taskId=document.getElementById('ml-t-id').value;
  const t=TASKS.find(x=>x.id===taskId);
  if(!t){notify('Select a task','warn');return;}
  const h=parseFloat(document.getElementById('ml-h').value)||0;
  if(h<=0){notify('Hours > 0 required','warn');return;}
  t.timeLogs=t.timeLogs||[];
  t.timeLogs.push({date:document.getElementById('ml-date').value,hours:h,notes:document.getElementById('ml-notes').value,user:'Pedro Pereira'});
  if(t.status==='todo') t.status='paused'; // manual log = work done, task is paused (not actively timing)
  addLog({type:'timelog',task:t.name,from:'',to:`${_fmtHours(h)} logged on ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}`});
  notify(`${h}h logged on "${t.name}"`,'success');
  CM('m-log');renderGantt();renderDash();_refreshOverview();
  persistState(['tasks'],{tasks:[taskId]});
};

// ============================================================
// SPLIT
// ============================================================
function openSplit(taskId){
  const t=TASKS.find(x=>x.id===taskId);
  if(!t){return;}
  const tot=tHours(t);
  if(tot<16){notify('Need ≥16h to split','warn');return;}
  S.splitId=taskId;
  document.getElementById('ms-inf').textContent=`"${t.name}" — ${tot}h`;
  const half=Math.round(tot/2);
  document.getElementById('ms-ah').value=half;
  document.getElementById('ms-bh').value=tot-half;
  document.getElementById('ms-gap').value=1;
  updSplitPrev();
  OM('m-split');
}
function updSplitPrev(){
  const t=TASKS.find(x=>x.id===S.splitId);
  if(!t) return;
  const tot=tHours(t);
  const ah=parseFloat(document.getElementById('ms-ah').value)||0;
  const bh=parseFloat(document.getElementById('ms-bh').value)||0;
  const gap=parseInt(document.getElementById('ms-gap').value)||0;
  const ok=Math.round(ah+bh)===Math.round(tot);
  document.getElementById('ms-ck').innerHTML=ok?`<span style="color:var(--acc3)">✓ ${tot}h</span>`:`<span style="color:var(--warn)">⚠ ${ah+bh}h ≠ ${tot}h</span>`;
  const ad=Math.ceil(ah/HPD),bd=Math.ceil(bh/HPD),s=t.start||1;
  document.getElementById('ms-prev').textContent=`A: ${sd(s)}–${sd(s+ad-1)} (${ah}h) + ${gap}d + B: ${sd(s+ad+gap)}–${sd(s+ad+gap+bd-1)} (${bh}h)`;
}
window.syncSB=()=>{ const t=TASKS.find(x=>x.id===S.splitId); if(t){const a=parseFloat(document.getElementById('ms-ah').value)||0;document.getElementById('ms-bh').value=Math.max(0,tHours(t)-a);updSplitPrev();}};
window.syncSA=()=>{ const t=TASKS.find(x=>x.id===S.splitId); if(t){const b=parseFloat(document.getElementById('ms-bh').value)||0;document.getElementById('ms-ah').value=Math.max(0,tHours(t)-b);updSplitPrev();}};
window.confirmSplit=()=>{
  const t=TASKS.find(x=>x.id===S.splitId);
  if(!t) return;
  const tot=tHours(t),ah=parseFloat(document.getElementById('ms-ah').value)||0,bh=parseFloat(document.getElementById('ms-bh').value)||0,gap=parseInt(document.getElementById('ms-gap').value)||0;
  if(Math.round(ah+bh)!==Math.round(tot)){notify(`Parts must sum to ${tot}h`,'warn');return;}
  const ad=Math.ceil(ah/HPD),bd=Math.ceil(bh/HPD),s=t.start||1;
  t.segments=[{start:s,dur:ad,hours:ah},{start:s+ad+gap,dur:bd,hours:bh}];
  t.dur=ad+gap+bd;
  addLog({type:'split',task:t.name,from:`${tot}h total`,to:`Part A: ${ah}h · Part B: ${bh}h · gap: ${gap}d`});
  notify('Task split','success');
  CM('m-split');renderGantt();
};

