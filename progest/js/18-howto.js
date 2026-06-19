// HOW TO USE
// ============================================================
function renderHowTo(){
  const doc=document.getElementById('howto-content');
  if(!doc) return;
  doc.innerHTML=`
<style>
.ht-wrap{max-width:780px;margin:0 auto;padding:0 0 48px}
.ht-step{background:var(--bg1);border:1px solid var(--bd);border-radius:var(--r12);margin-bottom:10px;overflow:hidden}
.ht-step-h{display:flex;align-items:center;gap:10px;padding:11px 16px;cursor:pointer;user-select:none;background:var(--bg2)}
.ht-step-h:hover{background:var(--bg3)}
.ht-num{width:24px;height:24px;border-radius:50%;background:var(--acc);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0}
.ht-num.orange{background:#f59e0b}.ht-num.green{background:var(--ok)}.ht-num.purple{background:#8b5cf6}
.ht-title{font-size:12px;font-weight:600;color:var(--fg0);flex:1}
.ht-badge{font-size:9px;font-weight:700;padding:1px 7px;border-radius:10px;border:1px solid;flex-shrink:0}
.ht-body{padding:14px 16px;border-top:1px solid var(--bd)}
.ht-step.open .ht-body{display:block}.ht-step:not(.open) .ht-body{display:none}
.ht-step.open .ht-arr{transform:rotate(90deg)}
.ht-arr{transition:transform .2s;color:var(--fg3);font-size:13px}
.ht-demo{background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r8);padding:12px;margin:8px 0}
.ht-btn{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:5px;border:1px solid var(--bd2);background:var(--bg3);color:var(--acc);cursor:pointer;font-size:11px;font-family:var(--font)}
.ht-btn.ok{color:var(--ok);border-color:var(--ok)}.ht-btn.warn{color:var(--warn);border-color:var(--warn)}
.ht-key{display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;background:var(--bg3);border:1px solid var(--bd2);color:var(--fg1);font-family:var(--mono)}
.ht-row{display:flex;align-items:flex-start;gap:8px;padding:5px 0;border-bottom:1px solid var(--bd);font-size:11px;line-height:1.5}
.ht-row:last-child{border:none}
.ht-perm{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px;font-size:10px}
.ht-perm-hdr{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--fg3);padding:4px 6px}
.ht-perm-cell{padding:4px 6px;border-radius:4px;background:var(--bg3)}
.ht-perm-y{color:var(--ok)}.ht-perm-n{color:var(--fg3)}.ht-perm-p{color:var(--warn)}
.tip{font-size:10px;color:var(--fg2);padding:6px 10px;background:rgba(79,156,249,.07);border-left:3px solid var(--acc);border-radius:0 5px 5px 0;margin:8px 0;line-height:1.6}
.tip.orange{background:rgba(245,158,11,.07);border-color:#f59e0b}
.tip.purple{background:rgba(139,92,246,.07);border-color:#8b5cf6}
.ht-2col{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ht-fi{font-size:11px;padding:4px 8px;border-radius:5px;border:1px solid var(--bd2);background:var(--bg2);color:var(--fg0);font-family:var(--font);width:100%}
@media(max-width:600px){.ht-2col,.ht-perm{grid-template-columns:1fr}.ht-perm{display:none}}
</style>
<div class="ht-wrap">
<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:4px">
  <span style="font-size:20px;font-weight:700;color:var(--fg0)">Progest — How To Use</span>
  <span style="font-size:10px;color:var(--fg3)">v0.6.300</span>
</div>
<p style="font-size:11px;color:var(--fg3);margin-bottom:16px">Click any section to expand. Sections marked <span style="color:#f59e0b;font-weight:700">Team Leader</span> or <span style="color:#8b5cf6;font-weight:700">Admin</span> require those roles.</p>

<!-- PERMISSION MATRIX -->
<div class="ht-step open">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">★</div><div class="ht-title">Permission levels</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-perm" style="margin-bottom:8px">
    <div class="ht-perm-hdr">Action</div>
    <div class="ht-perm-hdr" style="color:var(--fg2)">Resource</div>
    <div class="ht-perm-hdr" style="color:#f59e0b">Team Leader</div>
    <div class="ht-perm-hdr" style="color:#8b5cf6">Admin / PM</div>
    ${[
      ['View Gantt','✓','✓','✓'],
      ['Edit own tasks','✓','✓','✓'],
      ['Edit team tasks','✗','✓','✓'],
      ['Edit all tasks','✗','✗','✓'],
      ['Disable own days','✓','✓','✓'],
      ['Disable team days','✗','✓','✓'],
      ['Disable global days','✗','✗','✓'],
      ['Add/remove resources','✗','✗','✓ Admin'],
      ['Manage teams','✗','✗','✓ Admin'],
      ['Reset passwords','✗','✗','✓ Admin'],
      ['Clear all time logs','✗','✗','✓ Admin'],
    ].map(([a,r,tl,pm])=>`
      <div class="ht-perm-cell">${a}</div>
      <div class="ht-perm-cell ht-perm-${r==='✓'?'y':'n'}">${r}</div>
      <div class="ht-perm-cell ht-perm-${tl.startsWith('✓')?'y':'n'}">${tl}</div>
      <div class="ht-perm-cell ht-perm-${pm.startsWith('✓')?'y':'n'}">${pm}</div>`).join('')}
  </div>
  <div class="tip">Your role is shown at the bottom of the left sidebar. PM = any member of the <b>Project Management</b> team or Admin.</div>
</div>
</div>

<!-- GANTT VIEWS -->
<div class="ht-step open">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">1</div><div class="ht-title">Gantt — views & navigation</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-demo">
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
      ${['By Resource (default)','By Team','By Project'].map(v=>`<button class="ht-btn" onclick="this.style.background='var(--acc)';this.style.color='#fff';setTimeout(()=>{this.style.background='';this.style.color=''},1200)">${v}</button>`).join('')}
    </div>
    <div class="ht-2col" style="font-size:11px;gap:6px">
      <div class="ht-row"><span class="ht-key">Select… ▾</span><span>Filter by project / team / resource. Multiple selections supported.</span></div>
      <div class="ht-row"><span class="ht-key">✕ Deselect all</span><span>Hide everything — click individual items to show them again.</span></div>
      <div class="ht-row"><span class="ht-key">⤷ Sub</span><span>Show/hide subtask rows. When hidden, subtask bars appear inside the parent row.</span></div>
      <div class="ht-row"><span class="ht-key">⊕ / ⊖ zoom</span><span>Adjust column width. ↺ resets to auto-fit.</span></div>
      <div class="ht-row"><span class="ht-key">← → arrows</span><span>Navigate weeks forward/back.</span></div>
      <div class="ht-row"><span class="ht-key">Today</span><span>Jump back to the current week.</span></div>
    </div>
  </div>
  <div class="tip">Bar colour = team colour. Bar thickness = hours ÷ daily capacity. Past days show <b>actual logged hours</b>; future days show <b>planned hours</b>.</div>
</div>
</div>

<!-- TASKS -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">2</div><div class="ht-title">Creating & editing tasks</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-demo">
    <div class="ht-row"><span class="ht-key">+ Task</span><span>Opens the task modal (toolbar). Can also drag an empty cell to create.</span></div>
    <div class="ht-row"><span class="ht-key">Click bar</span><span>Opens the edit modal for that task.</span></div>
    <div class="ht-row"><span class="ht-key">Drag bar</span><span>Move the task's start date.</span></div>
    <div class="ht-row"><span class="ht-key">◂ ▸ grips</span><span>Resize duration — hours recalculated automatically.</span></div>
    <div class="ht-row"><span class="ht-key">Right-click bar</span><span>Status context menu: Done, Hold, Cancelled…</span></div>
  </div>
  <p style="font-size:11px;color:var(--fg2);margin:8px 0">Two scheduling modes:</p>
  <div class="ht-2col" style="font-size:11px">
    <div style="padding:8px;background:var(--bg3);border-radius:6px"><b style="color:var(--acc)">Continuous</b> — total hours, distributed across days automatically by auto-schedule.</div>
    <div style="padding:8px;background:var(--bg3);border-radius:6px"><b style="color:var(--acc)">Daily</b> — hours/day and a date range. Runs in parallel (doesn't consume shared capacity).</div>
  </div>
  <div class="tip">Each task can have multiple resources and teams. Hours are split equally by default — adjust per resource in the task modal.</div>

  <p style="font-size:11px;color:var(--fg2);margin:10px 0 6px">Bar outlines and visual states:</p>
  <div class="ht-demo">
    <div class="ht-row">
      <span class="ht-key" style="background:rgba(240,82,82,.12);border-color:rgba(240,82,82,.4);color:#f87171;white-space:nowrap">── red pulse</span>
      <span><b style="color:#f87171">Overdue</b> — task has a deadline that has already passed.</span>
    </div>
    <div class="ht-row">
      <span class="ht-key" style="background:rgba(240,169,40,.12);border-color:rgba(240,169,40,.5);color:#fbbf24;white-space:nowrap">── yellow solid</span>
      <span><b style="color:#fbbf24">On Hold</b> — task is paused and waiting for something.</span>
    </div>
    <div class="ht-row">
      <span class="ht-key" style="background:rgba(240,169,40,.08);border-color:rgba(240,169,40,.4);color:#fbbf24;white-space:nowrap">--- yellow dashed</span>
      <span><b style="color:#fbbf24">Incomplete</b> — task is missing start date, hours, or assigned resource.</span>
    </div>
    <div class="ht-row">
      <span class="ht-key" style="background:rgba(120,120,120,.12);border-color:rgba(120,120,120,.4);color:var(--fg3);white-space:nowrap">── grey hatched</span>
      <span><b style="color:var(--fg3)">Locked</b> — task is frozen and cannot be moved (e.g. a dependency constraint is active).</span>
    </div>
    <div class="ht-row">
      <span class="ht-key" style="background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.3);color:#4ade80;white-space:nowrap">── green fade</span>
      <span><b style="color:#4ade80">Done</b> — task is completed. Bar appears at reduced opacity.</span>
    </div>
    <div class="ht-row">
      <span class="ht-key" style="background:rgba(0,201,160,.1);border-color:rgba(0,201,160,.3);color:#34d399;white-space:nowrap">── teal fade</span>
      <span><b style="color:#34d399">Ready</b> — task is ready to start.</span>
    </div>
  </div>
</div>
</div>

<!-- SUBTASKS -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">3</div><div class="ht-title">Subtasks</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-demo" id="ht-sub-demo">
    <div style="font-size:11px;font-weight:600;margin-bottom:6px;color:var(--fg0)">Task example — total: <b id="ht-sub-total">6h</b> <span id="ht-sub-prog" style="font-size:10px;color:var(--fg3)"></span></div>
    <div id="ht-sub-list" style="display:flex;flex-direction:column;gap:3px;margin-bottom:8px"></div>
  </div>
  <div class="ht-row"><span class="ht-key">⤷ Sub OFF</span><span>Subtask rows hidden. Each sub bar appears <b>below</b> the parent bar in the same row — thickness proportional to its hours ÷ cap, colour slightly more transparent.</span></div>
  <div class="ht-row"><span class="ht-key">Click subtask bar</span><span>Opens subtask editor (name, resource, hours, deadline, status, notes).</span></div>
  <div class="tip">Subtasks are scheduled by <b>Auto-schedule</b> and have their own resources and deadlines. Parent progress auto-calculates from subtask completion.</div>
</div>
</div>

<!-- STATUSES -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">4</div><div class="ht-title">Task statuses</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-demo">
    ${Object.entries({todo:'Not started',doing:'Timer running — set only via ▶ timer button',paused:'Started, timer stopped',ready:'Done, waiting for milestone date — auto-completes after milestone',done:'Fully completed',hold:'Blocked — a reason must be given',cancelled:'Excluded from planning'}).map(([s,d])=>`
    <div class="ht-row">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${SCOLS[s]};flex-shrink:0;margin-top:3px"></span>
      <span style="font-size:10px;font-weight:700;min-width:80px;color:${SCOLS[s]}">${SLABELS[s]||s}</span>
      <span style="color:var(--fg2)">${d}</span>
    </div>`).join('')}
  </div>
  <div class="tip">The red/orange vertical line = <b>project deadline</b>. Task bars turn red outline when they extend past the task's own deadline.</div>
</div>
</div>

<!-- TIMER -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">5</div><div class="ht-title">Timer — logging time</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-demo">
    <div style="display:flex;align-items:center;gap:10px;background:var(--bg3);border-radius:7px;padding:10px;margin-bottom:8px">
      <div style="font-size:24px;font-family:var(--mono);font-weight:700;color:var(--acc)" id="ht-timer-display">00:00:00</div>
      <div style="flex:1"><div style="font-size:11px;font-weight:600;color:var(--fg0)" id="ht-timer-task">No task</div>
        <div style="font-size:10px;color:var(--fg3)" id="ht-timer-state">Stopped</div></div>
    </div>
    <div style="display:flex;gap:5px;flex-wrap:wrap">
      <select id="ht-timer-sel" class="ht-fi" style="flex:1;min-width:140px">
        <option value="">Select a task…</option>
        ${TASKS.filter(t=>t.status!=='done'&&t.status!=='cancelled').slice(0,8).map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}
      </select>
      <button class="ht-btn ok" onclick="htTimerStart()">▶ Start</button>
      <button class="ht-btn warn" onclick="htTimerPause()">⏸ Pause</button>
      <button class="ht-btn ok" onclick="htTimerDone()">✓ Done</button>
    </div>
    <div id="ht-timer-log" style="font-size:10px;color:var(--fg3);margin-top:5px"></div>
  </div>
  <div class="tip">Timer keeps running if you navigate to other pages. On browser close, the session is saved automatically. Only <b>you</b> can log time — it appears under your name in the Logs page.</div>
</div>
</div>

<!-- DAYS -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">6</div><div class="ht-title">Working days — enable / disable</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-row"><span class="ht-key">Click day header</span><span>Toggle that day. Weekends/holidays → enable for everyone (PM only). Weekdays → disable globally (PM only).</span></div>
  <div class="ht-row"><span class="ht-key">Click resource row header</span><span>Toggle that day for that specific resource. Team leaders can do this for their team members. Resources can do it for themselves.</span></div>
  <div class="tip orange">When a working day is disabled: tasks starting on it are pushed forward; tasks spanning it are extended by one working day.</div>
</div>
</div>

<!-- AUTO-SCHEDULE -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">7</div><div class="ht-title">Auto-schedule & milestones</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-row"><span class="ht-key">⚡ Auto</span><span>Packs all tasks from today, filling each resource's daily capacity in deadline priority order. Also schedules subtasks interleaved with parent tasks. <b>Admin only.</b> After running, a report shows how many tasks were rescheduled and the before/after dates.</span></div>
  <div class="ht-row"><span class="ht-key">◆ Milestone</span><span>Link tasks to a delivery date. Tasks set to <b>Ready</b> auto-complete to <b>Done</b> after the milestone date passes.</span></div>
  <div class="ht-demo">
    ${MILESTONES.slice(0,3).map(ms=>{
      const done=(ms.taskIds||[]).filter(id=>TASKS.find(t=>t.id===id&&(t.status==='done'||t.status==='ready'))).length;
      const total=(ms.taskIds||[]).length;
      return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:10px;border-bottom:1px solid var(--bd)">
        <span style="width:8px;height:8px;border-radius:50%;background:${ms.color||'var(--acc2)'};flex-shrink:0"></span>
        <span style="font-weight:600;color:${ms.color||'var(--acc2)'};">${ms.name}</span>
        <span style="color:var(--fg3)">${ms.dayIdx?sd(ms.dayIdx):'no date'}</span>
        <span style="color:var(--ok);margin-left:auto">${done}/${total} done</span>
      </div>`;
    }).join('')||'<div style="font-size:11px;color:var(--fg3)">No milestones yet — click ◆ Milestone in the toolbar to create one.</div>'}
  </div>
</div>
</div>

<!-- TEAM LEADER -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num" style="background:#f59e0b">TL</div><div class="ht-title">Team Leader features</div>
  <span class="ht-badge" style="color:#f59e0b;border-color:#f59e0b">Team Leader</span>
  <span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="tip orange" style="margin-bottom:10px">A Team Leader is any resource set as leader of a team (configurable in the Teams page by an Admin).</div>
  <div class="ht-row"><span>✎ Edit tasks</span><span>Can create and edit tasks belonging to their team(s) in addition to their own tasks.</span></div>
  <div class="ht-row"><span>📅 Days</span><span>Can enable/disable working days for any resource in their team — click the resource row header in the Gantt.</span></div>
  <div class="ht-row"><span>👁 View</span><span>Can see all tasks in their teams and all team members' Gantt rows.</span></div>
  <div class="tip orange">Team leaders cannot: add/remove resources, change team composition, reset passwords, or edit tasks from other teams.</div>
</div>
</div>

<!-- ADMIN -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num" style="background:#8b5cf6">A</div><div class="ht-title">Admin features</div>
  <span class="ht-badge" style="color:#8b5cf6;border-color:#8b5cf6">Admin only</span>
  <span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-2col" style="margin-bottom:10px">
    <div>
      <div style="font-size:10px;font-weight:700;color:var(--fg2);margin-bottom:6px">Resources page</div>
      <div class="ht-row"><span class="ht-key">🔑</span><span>Reset password — resets to the resource's name (lowercase, no spaces). User must change on next login.</span></div>
      <div class="ht-row"><span class="ht-key">☆ / ★</span><span>Toggle Admin — grants or revokes admin rights for that resource.</span></div>
      <div class="ht-row"><span class="ht-key">✕</span><span>Delete resource permanently.</span></div>
      <div class="ht-row"><span class="ht-key">👁</span><span>Show/hide resource in workload gauges on the Dashboard.</span></div>
    </div>
    <div>
      <div style="font-size:10px;font-weight:700;color:var(--fg2);margin-bottom:6px">Teams page</div>
      <div class="ht-row"><span>Leader</span><span>Set the Team Leader for each team — they get editing rights for all tasks in that team.</span></div>
      <div class="ht-row"><span>Colour</span><span>Team colour appears on all task bars for that team throughout the Gantt.</span></div>
      <div class="ht-row"><span>+ Add team</span><span>Create a new team. Assign resources to teams on the Resources page.</span></div>
    </div>
  </div>
  <div style="font-size:10px;font-weight:700;color:var(--fg2);margin-bottom:6px">Other admin actions</div>
  <div class="ht-row"><span class="ht-key">Clear logs</span><span>In the Logs page — permanently clears ALL time logs from ALL tasks. Cannot be undone.</span></div>
  <div class="ht-row"><span class="ht-key">Global days</span><span>Click any day column header to disable/enable it globally for all resources.</span></div>
  <div class="ht-row"><span class="ht-key">Projects</span><span>Create projects, set deadlines (shown as vertical line in Gantt), assign colours and status.</span></div>
  <div class="tip purple">The admin account (pp) cannot have its admin status revoked. All other admins can be toggled by any existing admin.</div>
</div>
</div>

<!-- LOGS & SYNC -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">8</div><div class="ht-title">Logs & real-time sync</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-demo" style="max-height:160px;overflow-y:auto">
    ${GLOG.slice(0,8).map(e=>`
    <div style="display:grid;grid-template-columns:38px 75px 55px 1fr;gap:5px;padding:3px 0;border-bottom:1px solid var(--bd);font-size:10px;align-items:start">
      <span style="color:var(--fg3)">${e.time||'—'}</span>
      <span style="font-weight:600;color:var(--fg2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(e.user||'').split(' ')[0]}</span>
      <span style="color:${LCOL[e.type]||'var(--fg2)'};">${LICO[e.type]||'·'} ${e.type}</span>
      <span style="color:var(--fg1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(e.task||'').slice(0,18)}${e.to?' — '+(e.to||'').slice(0,40):''}</span>
    </div>`).join('')||'<div style="font-size:11px;color:var(--fg3)">No activity yet.</div>'}
  </div>
  <div class="ht-row" style="margin-top:8px"><span class="ht-key">● live</span><span>Firebase SSE pushes changes to all open tabs in real time. Each save sends only the changed entity — no full overwrites.</span></div>
  <div class="ht-row"><span class="ht-key">↓ updated</span><span>Appears when another user's change arrives. Gantt refreshes automatically.</span></div>
  <div class="tip">Logs record full diffs: "deadline: none → 2026-05-10", "subtask done: Check wiring", "tag added: ROB". Filter by user or type on the Logs page.</div>
</div>
</div>

<!-- MY SPACE -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">9</div><div class="ht-title">My Space & My Day</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-row"><span class="ht-key">My Space</span><span>Personal Gantt showing only your tasks + a day-view panel with logged hours and scheduled work.</span></div>
  <div class="ht-row"><span class="ht-key">‹ › nav</span><span>Navigate days in the day panel. ↺ returns to today.</span></div>
  <div class="ht-row"><span class="ht-key">Capacity bar</span><span>Shows your daily load vs capacity (green → yellow → red as you approach full capacity).</span></div>
  <div class="tip">The ▶ Start button in the Timer panel sets a task to <b>In Progress</b> and starts timing. Only the currently-running task is expanded in the panel; others show compact buttons.</div>
</div>
</div>

<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">10</div><div class="ht-title">Import Tasks (ClickUp CSV)</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <p style="font-size:11px;color:var(--fg2);margin:0 0 10px">Tasks are imported from a ClickUp CSV export. The system automatically maps ClickUp fields to Progest fields using the rules below.</p>
  <div class="ht-demo">
    <div class="ht-row"><span class="ht-key">Task ID</span><span>Used as the <b>external_id</b> — the unique identifier that links imported tasks to ClickUp. Tasks with a matching external_id are <b>updated</b>; tasks without one are <b>created</b>.</span></div>
    <div class="ht-row"><span class="ht-key">Task Name</span><span>Maps to the task <b>name</b>.</span></div>
    <div class="ht-row"><span class="ht-key">Home Location ID</span><span>Maps to the <b>project</b> by matching the <b>External Project ID</b> field set in each project's settings (Edit Project). If no match is found, a validation error is shown — set the External Project ID on the corresponding project to fix it.</span></div>
    <div class="ht-row"><span class="ht-key">Time Estimated</span><span>Converted to <b>total hours</b>: value in milliseconds ÷ 1000 ÷ 3600. <b>New tasks without estimated time are not created.</b> Existing tasks without time are updated (hours set to 0).</span></div>
    <div class="ht-row"><span class="ht-key">Time Spent</span><span>Converted to <b>logged hours</b> (milliseconds ÷ 1000 ÷ 3600) and stored in the task's time log as an "Imported from ClickUp" entry. On update, only the import entry is replaced — manually logged hours are preserved.</span></div>
    <div class="ht-row"><span class="ht-key">Status</span><span>Mapped to Progest status: <b>to do</b> → todo · <b>in progress / critical</b> → doing · <b>on hold</b> → hold · <b>review</b> → ready · <b>completed / migrated / closed</b> → done · <b>canceled</b> → cancelled.</span></div>
    <div class="ht-row"><span class="ht-key">Assignees</span><span>Maps to <b>resource</b>. Brackets <code>[ ]</code> are removed; multiple assignees separated by commas become multiple resources separated by <code>;</code>. <b>New tasks without a resource are not created.</b> Existing tasks without a resource are updated (resource is cleared).</span></div>
    <div class="ht-row"><span class="ht-key">Tags</span><span>If Tags contains <b>sr hélder</b>, <b>Hélder Parente</b> is automatically added as a resource to that task.</span></div>
  </div>
  <p style="font-size:11px;color:var(--fg2);margin:10px 0 6px">Fixed values (always the same regardless of the CSV):</p>
  <div class="ht-demo">
    <div class="ht-row"><span class="ht-key">group</span><span>Derived automatically from the task name: <b> - 1</b> → Requisitos e Especificação · <b> - 2</b> → Protótipo · <b> - 3</b> → Validação · <b> - 4</b> → Handover · <b> - 5</b> → Avaliação de Riscos Técnicos · <b> - 6</b> → Projeto. If none match, group is left empty.</span></div>
    <div class="ht-row"><span class="ht-key">type</span><span>Always <b>continuous</b>.</span></div>
    <div class="ht-row"><span class="ht-key">hours_per_day, start/end date, deadline, notes, resource_hours, weekdays</span><span>Always left <b>empty</b> — scheduled by auto-schedule.</span></div>
  </div>
  <p style="font-size:11px;color:var(--fg2);margin:10px 0 6px">Create vs Update rules:</p>
  <div class="ht-demo">
    <div class="ht-row"><span class="ht-key">New task</span><span>If the Task ID does not match any existing external_id → <b>creates</b> a new task (unless status is completed / migrated / canceled / closed).</span></div>
    <div class="ht-row"><span class="ht-key">Existing task</span><span>If the Task ID matches an existing external_id → <b>updates</b> name, project, group, total hours, status and resources. Deadline is never updated. Always updates, including completed/migrated/canceled/closed tasks.</span></div>
    <div class="ht-row"><span class="ht-key">Skip statuses</span><span>Tasks with status <b>completed, migrated, canceled or closed</b> are <b>not created</b> if they don't already exist in Progest.</span></div>
    <div class="ht-row"><span class="ht-key">Skipped</span><span>New tasks are silently skipped (no error shown) when: status is completed/migrated/canceled/closed, <b>no resource</b> is assigned, or <b>no hours</b> are estimated. The preview shows a <b>skipped</b> count. Existing tasks are always updated regardless.</span></div>
  </div>
</div>
</div>

</div>

<scr` + `ipt>
// How To Use helpers
let _htTrn=false,_htTs=0,_htTInt=null;
function htTimerStart(){
  const sel=document.getElementById('ht-timer-sel');
  if(!sel?.value){document.getElementById('ht-timer-log').textContent='⚠ Select a task first';return;}
  const t=TASKS.find(x=>x.id===sel.value);
  document.getElementById('ht-timer-task').textContent=t?.name||'?';
  document.getElementById('ht-timer-state').textContent='In Progress ●';
  document.getElementById('ht-timer-state').style.color='var(--acc)';
  if(!_htTrn){_htTrn=true;_htTs=Date.now();
    _htTInt=setInterval(()=>{const s=Math.floor((Date.now()-_htTs)/1000);const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60;const el=document.getElementById('ht-timer-display');if(el)el.textContent=[h,m,sc].map(x=>x.toString().padStart(2,'0')).join(':');},1000);}
  document.getElementById('ht-timer-log').textContent='▶ Timer started for "'+t?.name+'"';
}
function htTimerPause(){
  if(!_htTrn)return;clearInterval(_htTInt);_htTrn=false;
  document.getElementById('ht-timer-state').textContent='Paused';
  document.getElementById('ht-timer-state').style.color='var(--warn)';
  const s=Math.floor((Date.now()-_htTs)/1000);document.getElementById('ht-timer-log').textContent='⏸ '+Math.floor(s/60)+'m '+s%60+'s';
}
function htTimerDone(){
  clearInterval(_htTInt);_htTrn=false;
  const h=((Date.now()-_htTs)/3600000).toFixed(2);
  document.getElementById('ht-timer-state').textContent='Done ✓';
  document.getElementById('ht-timer-state').style.color='var(--ok)';
  const el=document.getElementById('ht-timer-display');if(el)el.textContent='00:00:00';
  document.getElementById('ht-timer-log').textContent='✓ Simulated: '+h+'h logged';
  _htTs=Date.now();
}
let _htSubs=[{name:'Check wiring',hours:3,status:'done'},{name:'Install sensors',hours:5,status:'todo'}];
const _htPH=6;
function htRenderSubs(){
  const el=document.getElementById('ht-sub-list');if(!el)return;
  el.innerHTML=_htSubs.map((s,i)=>{
    const done=s.status==='done';
    return '<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:var(--bg3);border-radius:6px;opacity:'+(done?.55:1)+'">'
      +'<button onclick="_htSubs['+i+'].status=_htSubs['+i+'].status===\'done\'?\'todo\':\'done\';htRenderSubs()" style="width:11px;height:11px;border-radius:50%;border:1.5px solid '+(done?'var(--ok)':'var(--fg3)')+';background:'+(done?'var(--ok)':'transparent')+';cursor:pointer;padding:0;flex-shrink:0"></button>'
      +'<span style="font-size:11px;color:'+(done?'var(--fg3)':'var(--fg1)')+';flex:1;'+(done?'text-decoration:line-through':'')+'">'+(s.name||'')+'</span>'
      +'<span style="font-size:10px;color:var(--fg3)">'+s.hours+'h</span>'
      +'<button onclick="_htSubs.splice('+i+',1);htRenderSubs()" style="background:none;border:none;cursor:pointer;color:var(--fg3);font-size:12px;padding:0">✕</button>'
      +'</div>';
  }).join('');
  const done=_htSubs.filter(s=>s.status==='done').length;
  const stH=_htSubs.reduce((a,s)=>a+s.hours,0);
  const tot=document.getElementById('ht-sub-total');if(tot)tot.textContent=(_htPH+stH)+'h';
  const prog=_htSubs.length?Math.round(done/_htSubs.length*100):0;
  const lbl=document.getElementById('ht-sub-prog');if(lbl)lbl.textContent='('+done+'/'+_htSubs.length+' done, '+prog+'% progress)';
}
function htAddSub(){_htSubs.push({name:'New subtask',hours:4,status:'todo'});htRenderSubs();}
htRenderSubs();
<\/script>
`;
}

// ============================================================
// MILESTONES
// ============================================================
let _msEditId=null;


function _populateMsFilters(){
  const ts=document.getElementById('ms-task-team'); if(ts) ts.innerHTML='<option value="">All teams</option>'+TEAMS.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
  const rs=document.getElementById('ms-task-res'); if(rs) rs.innerHTML='<option value="">All resources</option>'+RESOURCES.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
}
window._renderMsTaskListFiltered=()=>{
  // Save currently checked before re-render
  const checked=new Set([...document.querySelectorAll('#ms-task-list input[type=checkbox]:checked')].map(cb=>cb.value));
  window._msCurSelected=[...new Set([...(window._msCurSelected||[]),...checked])];
  const sel=new Set(window._msCurSelected||[]);

  const q=(document.getElementById('ms-task-search')?.value||'').toLowerCase();
  const tf=document.getElementById('ms-task-team')?.value||'';
  const rf=document.getElementById('ms-task-res')?.value||'';

  // Filter by active project if one is selected
  const _msProjId=document.getElementById('ms-proj')?.value||null;
  const projFilter=t=>!_msProjId||(t.projId===_msProjId);

  // Selected tasks always shown first; unselected filtered by search
  const selected=TASKS.filter(t=>sel.has(t.id)&&projFilter(t));
  const unselected=TASKS.filter(t=>!sel.has(t.id)&&projFilter(t)&&(
    (!q||t.name.toLowerCase().includes(q))&&
    (!tf||(t.teamId===tf||(t.teamIds||[]).includes(tf)))&&
    (!rf||t.resId===rf)
  ));

  const list=[...selected,...unselected];
  const el=document.getElementById('ms-task-list'); if(!el) return;

  const mkRow=t=>`<label style="display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:4px;cursor:pointer;font-size:11px;${sel.has(t.id)?'background:rgba(123,97,255,.1);':''}color:${sel.has(t.id)?'var(--fg0)':'var(--fg2)'}">
    <input type="checkbox" ${sel.has(t.id)?'checked':''} value="${t.id}" style="accent-color:var(--acc2)" onchange="(window._msCurSelected=window._msCurSelected||[],this.checked?(!window._msCurSelected.includes('${t.id}')&&window._msCurSelected.push('${t.id}')):window._msCurSelected=window._msCurSelected.filter(x=>x!=='${t.id}'),_renderMsTaskListFiltered())">
    <span style="width:7px;height:7px;border-radius:50%;background:${SCOLS[t.status]};flex-shrink:0"></span>
    ${t.name}${t.tags?.length?` <span style="font-size:8px;color:var(--fg3)">${t.tags.join(', ')}</span>`:''}
  </label>`;

  if(selected.length&&unselected.length){
    el.innerHTML=selected.map(mkRow).join('')+
      `<div style="height:1px;background:var(--bd);margin:4px 0"></div>`+
      unselected.map(mkRow).join('');
  } else {
    el.innerHTML=list.map(mkRow).join('')||'<div style="font-size:11px;color:var(--fg3);padding:6px">No tasks found</div>';
  }
};

// Update colour picker: disable colours already used on the selected date
function _updateMsColorAvailability(){
  // No restrictions — all colors always available
  document.querySelectorAll('#ms-colors div').forEach(d=>{
    d.style.opacity='1';
    d.style.cursor='pointer';
    d.style.pointerEvents='auto';
    d.title='';
  });
}
window.selMsCol=(el,col)=>{
  document.getElementById('ms-color').value=col;
  document.querySelectorAll('#ms-colors div').forEach(d=>{
    const sel=d.dataset.col===col;
    d.style.border=sel?'3px solid white':'2px solid transparent';
    d.style.boxShadow=sel?'0 0 0 2px '+col:'none';
  });
};

window.openAddMilestone=()=>{
  _msEditId=null;
  document.getElementById('ms-modal-title').textContent='New Milestone';
  document.getElementById('ms-name').value='';
  document.getElementById('ms-date').value=new Date().toISOString().slice(0,10);
  document.getElementById('ms-color').value='#7b61ff';
  document.getElementById('ms-del-btn').style.display='none';
  const _msProjSel=document.getElementById('ms-proj');
  if(_msProjSel){ _msProjSel.innerHTML='<option value="">— all projects —</option>'+PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join(''); _msProjSel.value=''; }
  selMsCol(null,'#7b61ff');
  setTimeout(_updateMsColorAvailability,0);
  window._msCurSelected=[];
  if(document.getElementById('ms-task-search')) document.getElementById('ms-task-search').value='';
  _populateMsFilters();
  _renderMsTaskList(null);
  OM('m-milestone');
};

window.openEditMilestone=(msId)=>{
  const ms=MILESTONES.find(m=>m.id===msId); if(!ms) return;
  _msEditId=msId;
  document.getElementById('ms-modal-title').textContent='Edit Milestone';
  document.getElementById('ms-name').value=ms.name;
  const d=gDate(ms.dayIdx); const pad=n=>String(n).padStart(2,'0');
  document.getElementById('ms-date').value=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  document.getElementById('ms-color').value=ms.color||'#7b61ff';
  document.getElementById('ms-del-btn').style.display='';
  selMsCol(null,ms.color||'#7b61ff');
  const _msProjSel2=document.getElementById('ms-proj');
  if(_msProjSel2){ _msProjSel2.innerHTML='<option value="">— all projects —</option>'+PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join(''); _msProjSel2.value=ms.projId||''; }
  setTimeout(_updateMsColorAvailability,0);
  window._msCurSelected=[...(ms.taskIds||[])];
  _populateMsFilters();
  _renderMsTaskList(ms.taskIds||[]);
  OM('m-milestone');
};

function _renderMsTaskList(selectedIds){
  const sel=new Set(selectedIds||[]);
  const el=document.getElementById('ms-task-list');
  if(!el) return;
  const sortedTasks=[...TASKS].sort((a,b)=>a.name.localeCompare(b.name));
  el.innerHTML=sortedTasks.map(t=>`
    <label style="display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:4px;cursor:pointer;font-size:11px;color:${sel.has(t.id)?'var(--fg0)':'var(--fg2)'}">
      <input type="checkbox" ${sel.has(t.id)?'checked':''} value="${t.id}" style="accent-color:var(--acc2)">
      <span style="width:7px;height:7px;border-radius:50%;background:${SCOLS[t.status]};flex-shrink:0"></span>
      ${t.name}
    </label>`).join('');
}

window.saveMilestone=()=>{
  // Check for duplicate colour on same day
  const date=document.getElementById('ms-date').value;


  const name=document.getElementById('ms-name').value.trim();
  const dateStr=document.getElementById('ms-date').value;
  if(!name){notify('Name required','warn');return;}
  if(!dateStr){notify('Date required','warn');return;}
  const dayIdx=dateToIdx(dateStr);
  if(!dayIdx){notify('Invalid date','warn');return;}
  const color=document.getElementById('ms-color').value||'#7b61ff';
  const projId=document.getElementById('ms-proj')?.value||null;
  const taskIds=[...document.querySelectorAll('#ms-task-list input[type=checkbox]:checked')].map(cb=>cb.value);
  if(_msEditId){
    const ms=MILESTONES.find(m=>m.id===_msEditId);
    if(ms){Object.assign(ms,{name,dayIdx,color,taskIds,projId});}
    const _old=MILESTONES.find(m=>m.id===_msEditId);
    const _msDiffs=[];
    if(_old?.name!==name) _msDiffs.push(`name: "${_old?.name}" → "${name}"`);
    if(_old?.dayIdx!==dayIdx) _msDiffs.push(`date: ${_old?.dayIdx?sd(_old.dayIdx):'—'} → ${sd(dayIdx)}`);
    const _prevIds=_old?.taskIds||[]; const _addedTs=taskIds.filter(id=>!_prevIds.includes(id)); const _removedTs=_prevIds.filter(id=>!taskIds.includes(id));
    if(_addedTs.length) _msDiffs.push(`+tasks: ${_addedTs.map(id=>TASKS.find(t=>t.id===id)?.name||id).join(', ')}`);
    if(_removedTs.length) _msDiffs.push(`-tasks: ${_removedTs.map(id=>TASKS.find(t=>t.id===id)?.name||id).join(', ')}`);
    addLog({type:'milestone',task:name,from:'',to:_msDiffs.length?_msDiffs.join(' · '):'saved'});
  } else {
    MILESTONES.push({id:'ms'+Date.now().toString(36),name,dayIdx,color,taskIds,projId,shape:'diamond'});
    addLog({type:'milestone',task:name,from:'',to:`created — ${sd(dayIdx)}${taskIds.length?' · '+taskIds.length+' task(s)':''}`});
  }
  persistState(['milestones']);
  CM('m-milestone');
  renderGantt();
  _refreshOverview();
  notify(`Milestone "${name}" saved ✓`,'success');
};

window.deleteMilestone=()=>{
  if(!_msEditId||!confirm('Delete this milestone?')) return;
  const _dm=MILESTONES.find(m=>m.id===_msEditId);
  addLog({type:'milestone',task:_dm?.name||'',from:'',to:'deleted'});
  _deletedIds.milestones.add(_msEditId);
  MILESTONES=MILESTONES.filter(m=>m.id!==_msEditId);
  if(_msFilter===_msEditId) _msFilter=null;
  persistState(['milestones']);
  CM('m-milestone');
  renderGantt();
  _refreshOverview();
  notify('Milestone deleted','warn');
};


// ── MOBILE HAMBURGER ─────────────────────────────────────────
(function(){
  function isMob(){ return window.innerWidth<=768 || ('ontouchstart' in window && window.innerWidth<=1024); }

  function ensureMobUI(){
    if(!isMob()) return;
    // Hamburger button
    if(!document.getElementById('mob-menu-btn')){
      const btn=document.createElement('div');
      btn.id='mob-menu-btn';
      btn.innerHTML='<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><line x1="2" y1="4" x2="16" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="2" y1="14" x2="16" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
      btn.style.cssText='display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;background:var(--bg2);border:1px solid var(--bd);cursor:pointer;color:var(--fg1);flex-shrink:0';
      btn.onclick=toggleMob;
      const tb=document.getElementById('topbar');
      if(tb) tb.prepend(btn);
    }
    // Overlay
    if(!document.getElementById('mob-overlay')){
      const ov=document.createElement('div');
      ov.id='mob-overlay';
      ov.onclick=closeMob;
      document.body.appendChild(ov);
    }
  }

  function toggleMob(){
    const sb=document.getElementById('sb');
    const ov=document.getElementById('mob-overlay');
    const isOpen=sb.classList.contains('mob-open');
    sb.classList.toggle('mob-open',!isOpen);
    ov.classList.toggle('show',!isOpen);
  }

  function closeMob(){
    document.getElementById('sb')?.classList.remove('mob-open');
    document.getElementById('mob-overlay')?.classList.remove('show');
  }

  // Close menu when a nav item is clicked on mobile
  window.addEventListener('click', e=>{
    if(!isMob()) return;
    const nav=e.target.closest('.nav');
    if(nav) setTimeout(closeMob, 150);
  });

  window.toggleMob=toggleMob;
  window.closeMob=closeMob;

  // Init after DOM ready
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', ensureMobUI);

  // ── Sync ROW 2 sticky top to ROW 1 height ───────────────────
  document.addEventListener('DOMContentLoaded',()=>{
    function _syncRow2(){
      const r1=document.getElementById('dl-banner');
      const r2=document.getElementById('gantt-row2');
      if(r1&&r2) r2.style.top=r1.offsetHeight+'px';
    }
    _syncRow2();
    new ResizeObserver(_syncRow2).observe(document.getElementById('dl-banner')||document.body);
  });

  // ── Sticky Gantt thead (disabled) ───────────────────────────
  window._syncGanttThead=()=>{};
  } else {
    ensureMobUI();
  }
  window.addEventListener('resize', ensureMobUI);
})();


// ============================================================
// MOBILE ACTIVE TASK BANNER
// ============================================================
function updateMobBanner(){
  if(window.innerWidth>768) return;
  const banner=document.getElementById('mob-active-task');
  if(!banner) return;
  const tid=_timerState?.taskId;
  const t=tid?TASKS.find(x=>x.id===tid):null;
  const isRunning=t&&!_timerState.paused;
  const isPaused=t&&_timerState.paused;
  const show=t&&(isRunning||isPaused);
  banner.style.display=show?'flex':'none';
  if(!show) return;
  const nameEl=document.getElementById('mob-task-name');
  const metaEl=document.getElementById('mob-task-meta');
  const pauseBtn=document.getElementById('mob-pause-btn');
  if(nameEl) nameEl.textContent=t.name;
  const rem=Math.max(0,(t._originalPlanned||tHours(t))-_totalLoggedH(t)-_sessionElapsedMs()/3600000);
  if(metaEl) metaEl.textContent=(getTeam(t.teamId)?.name||'')+' · '+_fmtHours(rem)+' left';
  if(pauseBtn){
    if(isRunning){ pauseBtn.textContent='⏸'; pauseBtn.style.background='rgba(240,169,40,.2)'; pauseBtn.style.color='var(--warn)'; }
    else { pauseBtn.textContent='▶'; pauseBtn.style.background='rgba(79,156,249,.15)'; pauseBtn.style.color='var(--acc)'; }
  }
  const timerEl=document.getElementById('mob-timer');
  if(timerEl) timerEl.textContent=_fmtMs(Math.round((_totalLoggedH(t)+_sessionElapsedMs()/3600000)*3600000));
}
window.mobToggleActive=()=>{
  const tid=_timerState?.taskId;
  if(!tid) return;
  if(_timerState.paused) tpStart(tid); else tpPause(tid);
};

// Mobile banner: update timer display via a separate interval started after login

// ============================================================
// WEEK VIEW
// ============================================================
let _weekView=false;
let _ganttZoom=null; // null = auto, number = index into ZOOM_STEPS
let _myView='gantt'; // 'gantt' | 'day'
let _myDayOffset=0; // days offset from today for day view

window.toggleWeekView=()=>{ /* removed */ };
window.ganttZoom=(dir)=>{
  if(dir===0){
    _ganttZoom=null; // reset to auto
  } else {
    // If currently on auto, find closest step index first
    if(_ganttZoom===null){
      const STEPS=[14,18,22,28,36,48,64,90];
      const gw=document.getElementById('gw');
      const availW=Math.max(300,(gw?.clientWidth||window.innerWidth-350));
      const autoW=Math.max(14,Math.min(90,Math.floor(availW/28)));
      // Find closest step
      let best=3, bestDiff=999;
      STEPS.forEach((s,i)=>{ const d=Math.abs(s-autoW); if(d<bestDiff){bestDiff=d;best=i;} });
      _ganttZoom=best;
    }
    _ganttZoom=Math.max(0,Math.min(7,_ganttZoom+dir));
  }
  const btn=document.getElementById('btn-zoom-reset');
  if(btn) btn.style.color=_ganttZoom!==null?'var(--acc)':'';
  renderGantt();
  // Also re-render My Space if open
  if(S.page==='myspace'&&_myView==='gantt'){
    const me=S_USER?getRes(S_USER.resId):null;
    if(me){ const myT=TASKS.filter(t=>t.resId===me.id||(t.coResIds||[]).includes(me.id)); renderMyGantt(myT,me.id); }
  }
};

// Patch renderGantt to support week view
const _origRenderGantt=renderGantt;
window.renderGantt=function(){
  if(!_weekView){ _origRenderGantt(); return; }
  renderGanttWeek();
};

function renderGanttWeek(){
  computeAllSchedules();
  // Populate project selector
  const _pSel=document.getElementById('proj-selector');
  if(_pSel){
    const _cur=_pSel.value;
    _pSel.innerHTML='<option value="">All projects</option>'+PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    _pSel.value=_cur;
  }
  const tasks=visTasks();
  const rows=buildGRows(tasks);

  // Build 12 weeks starting from current week Monday
  const todayDate=gDate(GANTT_TODAY);
  const monday=new Date(todayDate);
  monday.setDate(todayDate.getDate()-((todayDate.getDay()+6)%7));
  const NWEEKS=12;
  const weeks=[];
  for(let w=0;w<NWEEKS;w++){
    const wStart=new Date(monday); wStart.setDate(monday.getDate()+w*7);
    const wEnd=new Date(wStart); wEnd.setDate(wStart.getDate()+6);
    const startIdx=dateToIdx(wStart.toISOString().slice(0,10));
    const endIdx=dateToIdx(wEnd.toISOString().slice(0,10));
    const isCurrentWeek=startIdx<=GANTT_TODAY&&GANTT_TODAY<=endIdx;
    const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    weeks.push({startIdx,endIdx,label:wStart.getDate()+' '+MN[wStart.getMonth()],isCurrentWeek});
  }

  const NAME_W=160, WCOL_W=52;
  let H=`<div><table class="gt" style="width:100%;table-layout:fixed">
  <thead>
    <tr>
      <th style="width:${NAME_W}px;text-align:left;padding-left:10px;background:var(--bg2);position:sticky;left:0;z-index:3">Task</th>
      <th style="width:32px;background:var(--bg2)">Hrs</th>
      ${weeks.map(w=>`<th style="width:${WCOL_W}px;background:${w.isCurrentWeek?'rgba(79,156,249,.15)':'var(--bg2)'};color:${w.isCurrentWeek?'var(--acc)':'var(--fg2)'}${w.isCurrentWeek?';outline:2px solid rgba(79,156,249,.3);outline-offset:-2px':''}">${w.label}</th>`).join('')}
    </tr>
  </thead><tbody>`;

  let curResId=null;
  rows.forEach(({t,depth,isHeader,label})=>{
    if(isHeader){
      const res=RESOURCES.find(r=>r.id===label)||{name:label};
      H+=`<tr><td colspan="${2+NWEEKS}" style="background:var(--bg2);padding:5px 10px;font-size:9px;font-weight:700;color:var(--acc3);position:sticky;left:0">${label==='__nogroup'?'':'● '+(RESOURCES.find(r=>r.id===label)?.name||TEAMS.find(t=>t.id===label)?.name||label)}</td></tr>`;
      return;
    }
    const th=tHours(t);
    const barColor=t.teamId?(getTeam(t.teamId)?.color||'#7a8aaa'):'#7a8aaa';
    const isDone=t.status==='done';
    const isHold=t.status==='hold';
    const isOv=getEffectiveDeadline(t)&&!isDone&&tEnd(t)>dateToIdx(getEffectiveDeadline(t));

    H+=`<tr ondblclick="openEditTask('${t.id}')" oncontextmenu="showCtx(event,'${t.id}')">
      <td style="position:sticky;left:0;background:var(--bg1);padding:3px 8px;z-index:1">
        <div style="font-size:10px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${isDone?'var(--fg3)':'var(--fg0)'}">${t.name}</div>
        <div style="font-size:8px;color:var(--fg3);margin-top:1px">${(t.tags||[]).map(tg=>`<span style="background:rgba(79,156,249,.1);color:var(--acc);padding:1px 5px;border-radius:3px;margin-right:2px">${tg}</span>`).join('')}</div>
      </td>
      <td style="text-align:center;font-size:9px;color:var(--fg2)">${th}h</td>
      ${weeks.map(w=>{
        // Does task span this week?
        const tStart=t.start||99999, tEnd2=tEnd(t)||0;
        const overlap=tStart<=w.endIdx&&tEnd2>=w.startIdx;
        if(!overlap) return `<td style="background:${w.isCurrentWeek?'rgba(79,156,249,.04)':''}"></td>`;
        // Hours scheduled in this week
        const weekH=Object.entries(t._sched||{}).reduce((s,[d,h])=>{const di=parseInt(d);return di>=w.startIdx&&di<=w.endIdx?s+h:s;},0);
        const loggedW=(t.timeLogs||[]).filter(l=>{const d=dateToIdx(l.date);return d>=w.startIdx&&d<=w.endIdx;}).reduce((s,l)=>s+l.hours,0);
        const dispH=weekH||loggedW;
        const ms=MILESTONES.filter(m=>(m.taskIds||[]).includes(t.id)&&m.dayIdx>=w.startIdx&&m.dayIdx<=w.endIdx&&(!S._activeProjId||(m.projId?m.projId===S._activeProjId:(m.taskIds||[]).some(id=>TASKS.find(t=>t.id===id&&t.projId===S._activeProjId)))));
        const _wmc=ms.length?(ms[0].color||'var(--acc2)'):'';
        const _wmStyle=ms.length?`background-image:linear-gradient(to right,transparent calc(50% - 1px),${_wmc} calc(50% - 1px),${_wmc} calc(50% + 1px),transparent calc(50% + 1px));`:'';
        if(dispH>0){
          return `<td style="padding:2px;vertical-align:middle;${_wmStyle}${w.isCurrentWeek?'background-color:rgba(79,156,249,.04)':''}">
            <div style="background:${isDone?'var(--ok)':barColor};height:18px;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#fff">${Math.round(dispH)}h</div>
          </td>`;
        }
        return `<td style="${w.isCurrentWeek?'background:rgba(79,156,249,.04)':''}${msStyle}">
          <div style="height:6px;background:${barColor}44;border-radius:3px;margin:2px"></div>
        </td>`;
      }).join('')}
    </tr>`;
  });

  H+=`</tbody></table></div>`;
  document.getElementById('gw').innerHTML=H;
  renderLog();
}


// Update timer toggle tab state
function updateTimerToggle(){
  const btn=document.getElementById('timer-toggle');
  if(!btn) return;
  const tid=_timerState?.taskId;
  const isPlaying=tid&&!_timerState.paused;
  const icon=document.getElementById('tt-icon');
  const lbl=document.getElementById('tt-label');
  btn.classList.remove('tt-playing','tt-idle');
  if(isPlaying){
    btn.classList.add('tt-playing');
    if(icon) icon.textContent='▶';
    if(lbl){ lbl.textContent='REC'; lbl.style.color='var(--ok)'; }
  } else {
    // Not recording — red blink regardless of pause/idle
    btn.classList.add('tt-idle');
    if(icon) icon.textContent='⏱';
    if(lbl){ lbl.textContent='TIMER'; lbl.style.color='var(--danger)'; }
  }
}

// ============================================================
