/**
 * Student Portal Interactivity & Handlers
 * CarbonLens (CS-2104 Database Systems)
 */

let studentActivityTypes = [];

function switchStudentTab(tabId, clickedEl) {
  document.querySelectorAll('.tab-pane-student').forEach(t => t.classList.add('d-none'));
  const activeTab = document.getElementById(tabId);
  if (activeTab) activeTab.classList.remove('d-none');

  document.querySelectorAll('.nav-link-custom').forEach(l => l.classList.remove('active'));
  if (clickedEl) {
    clickedEl.classList.add('active');
  } else {
    // If called via shortcut button, update matching sidebar link
    const matchingLink = document.querySelector(`.nav-link-custom[data-tab="${tabId}"]`);
    if (matchingLink) matchingLink.classList.add('active');
  }

  if (tabId === 'tab-student-dashboard') loadStudentProfile();
  if (tabId === 'tab-student-log') resetLogForm();
  if (tabId === 'tab-student-history') loadStudentActivities();
  if (tabId === 'tab-student-leaderboards') loadStudentLeaderboards();
}

async function loadStudentProfile() {
  try {
    const res = await fetch('/api/student/profile');
    const result = await res.json();
    if (!result.success) return;

    const data = result.data;

    document.getElementById('student-green-points').textContent = data.total_green_points || 0;
    document.getElementById('student-rank-badge').textContent = data.rank ? `#${data.rank}` : 'N/A';
    document.getElementById('student-approved-count').textContent = data.approved_count || 0;
    document.getElementById('student-pending-count').textContent = data.pending_count || 0;

    // Also reload activities for the recent table
    loadStudentActivities();
  } catch (err) {
    console.error('Failed to load student profile:', err);
  }
}

async function loadActivityTypes() {
  try {
    const res = await fetch('/api/student/activity-types');
    const result = await res.json();
    if (!result.success) return;

    studentActivityTypes = result.data;

    // Populate dropdown
    const selectEl = document.getElementById('log-activity-type');
    selectEl.innerHTML = '<option value="">Select an approved sustainable activity...</option>' +
      result.data.map(t => `<option value="${t.activity_type_id}">${t.activity_name} (+${t.points} points)</option>`).join('');

    // Populate scoring guide
    const guideEl = document.getElementById('activity-scoring-list');
    guideEl.innerHTML = result.data.map(t => `
      <div class="d-flex justify-content-between align-items-center p-2 rounded bg-light border">
        <span>${t.activity_name}</span>
        <span class="badge bg-success-subtle text-success fw-bold">+${t.points} pts</span>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load activity types:', err);
  }
}

function resetLogForm() {
  const dateInput = document.getElementById('log-activity-date');
  if (dateInput && !dateInput.value) {
    // Default to today
    dateInput.value = new Date().toISOString().split('T')[0];
  }
}

document.getElementById('form-student-activity').addEventListener('submit', async (e) => {
  e.preventDefault();
  const activity_type_id = document.getElementById('log-activity-type').value;
  const activity_date = document.getElementById('log-activity-date').value;
  const description = document.getElementById('log-description').value;

  try {
    const res = await fetch('/api/student/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_type_id, activity_date, description })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('form-student-activity').reset();
      switchStudentTab('tab-student-history');
      loadStudentProfile();
    } else {
      showToast(data.error, 'danger');
    }
  } catch (err) {
    showToast('Failed to submit activity', 'danger');
  }
});

async function loadStudentActivities() {
  try {
    const res = await fetch('/api/student/activities');
    const result = await res.json();
    if (!result.success) return;

    const data = result.data;

    // 1. Populate recent activities on dashboard
    const tbodyRecent = document.getElementById('tbody-student-recent');
    if (tbodyRecent) {
      if (!data.length) {
        tbodyRecent.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-muted">No activities submitted yet. Click 'Log Action' to start!</td></tr>`;
      } else {
        tbodyRecent.innerHTML = data.slice(0, 5).map(a => `
          <tr>
            <td class="fw-semibold">${a.activity_name}</td>
            <td><span class="badge bg-success-subtle text-success fw-bold">+${a.points} pts</span></td>
            <td class="small text-muted">${a.activity_date}</td>
            <td>
              <span class="${a.status === 'approved' ? 'badge-soft-success' : a.status === 'rejected' ? 'badge-soft-danger' : 'badge-soft-warning'}">
                ${a.status.toUpperCase()}
              </span>
            </td>
          </tr>
        `).join('');
      }
    }

    // 2. Populate complete history table
    const tbodyHistory = document.getElementById('tbody-student-history');
    if (tbodyHistory) {
      if (!data.length) {
        tbodyHistory.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No activities recorded yet.</td></tr>`;
      } else {
        tbodyHistory.innerHTML = data.map(a => `
          <tr>
            <td class="text-muted small">#${a.log_id}</td>
            <td class="fw-semibold">${a.activity_name}</td>
            <td><span class="badge bg-success-subtle text-success fw-bold">+${a.points} pts</span></td>
            <td>${a.activity_date}</td>
            <td class="small text-muted" style="max-width: 300px;">${a.description || ''}</td>
            <td>
              <span class="${a.status === 'approved' ? 'badge-soft-success' : a.status === 'rejected' ? 'badge-soft-danger' : 'badge-soft-warning'}">
                ${a.status.toUpperCase()}
              </span>
            </td>
            <td class="small text-muted">${a.reviewer_name || 'Pending Review'}</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load student activities:', err);
  }
}

async function loadStudentLeaderboards() {
  try {
    const resDept = await fetch('/api/leaderboards/departments');
    const dataDept = await resDept.json();
    if (dataDept.success) {
      document.getElementById('tbody-student-lead-dept').innerHTML = dataDept.data.map(d => `
        <tr>
          <td><span class="badge ${d.carbon_rank === 1 ? 'bg-success' : 'bg-light text-dark border'}">#${d.carbon_rank}</span></td>
          <td class="fw-semibold">${d.department_name}</td>
          <td><span class="badge bg-light text-dark border">${d.department_code}</span></td>
          <td class="fw-bold text-success">${formatNumber(d.total_co2_kg)} kg</td>
        </tr>
      `).join('');
    }

    const resStudent = await fetch('/api/leaderboards/students');
    const dataStudent = await resStudent.json();
    if (dataStudent.success) {
      document.getElementById('tbody-student-lead-student').innerHTML = dataStudent.data.slice(0, 15).map(s => `
        <tr>
          <td><span class="badge ${s.student_rank === 1 ? 'bg-warning text-dark' : 'bg-light text-dark border'}">#${s.student_rank}</span></td>
          <td class="fw-semibold">${s.full_name}</td>
          <td><span class="badge bg-light text-dark border">${s.department_code || 'N/A'}</span></td>
          <td><span class="badge bg-success-subtle text-success fw-bold">${s.total_points} pts</span></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load student leaderboards:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadStudentProfile();
  loadActivityTypes();
  resetLogForm();
});
