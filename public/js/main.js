/**
 * Main Shared Utilities for CarbonLens
 * CS-2104 Database Systems
 */

// Show floating alert / toast
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toastId = 'toast-' + Date.now();
  const bgClass = type === 'success' ? 'bg-success' : type === 'danger' ? 'bg-danger' : type === 'warning' ? 'bg-warning text-dark' : 'bg-primary';

  const html = `
    <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0 show shadow-lg mb-2" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body d-flex align-items-center gap-2">
          <i class="bi ${type === 'success' ? 'bi-check-circle-fill' : type === 'danger' ? 'bi-exclamation-octagon-fill' : 'bi-info-circle-fill'}"></i>
          <span>${message}</span>
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close" onclick="document.getElementById('${toastId}').remove()"></button>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', html);

  setTimeout(() => {
    const el = document.getElementById(toastId);
    if (el) el.remove();
  }, 4500);
}

// Compact number formatting for stat cards (Requirement 2)
// Examples: 6760322 -> "6.76 M", 1445000 -> "1.45 M", 12500 -> "12.5 K", 450 -> "450"
function formatCompact(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return '0';
  const num = Number(value);
  const abs = Math.abs(num);

  if (abs >= 1000000000) {
    return (num / 1000000000).toFixed(decimals).replace(/\.00$/, '') + ' B';
  }
  if (abs >= 1000000) {
    return (num / 1000000).toFixed(decimals).replace(/\.00$/, '') + ' M';
  }
  if (abs >= 1000) {
    return (num / 1000).toFixed(decimals).replace(/\.00$/, '') + ' K';
  }
  // Under 1,000: show with up to decimals if it has fractions, else integer
  return Number.isInteger(num) ? num.toString() : num.toFixed(decimals);
}

// Standard full comma formatting
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0.00';
  return Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatInt(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US');
}

// Export array of objects or arrays to CSV (Requirement 4)
function exportToCSV(filename, headers, rows) {
  if (!rows || !rows.length) {
    showToast('No records available to export', 'warning');
    return;
  }

  const escapeCSV = (str) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Global Logout Handler
async function handleLogout() {
  try {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      window.location.href = '/login';
    } else {
      showToast(data.error || 'Failed to logout', 'danger');
    }
  } catch (err) {
    console.error('Logout error:', err);
    window.location.href = '/login';
  }
}

// Load Current User Details into UI
async function initUserHeader() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.authenticated && data.user) {
      const u = data.user;
      const nameEls = document.querySelectorAll('.user-display-name');
      const roleEls = document.querySelectorAll('.user-display-role');
      const deptEls = document.querySelectorAll('.user-display-dept');
      const campusEls = document.querySelectorAll('.campus-display-name');
      const avatarEls = document.querySelectorAll('.user-display-avatar');

      nameEls.forEach(el => el.textContent = u.name);
      roleEls.forEach(el => {
        el.textContent = u.role.toUpperCase();
        el.className = `user-role-badge ${u.role === 'admin' ? 'bg-danger text-white' : u.role === 'chairperson' ? 'bg-primary text-white' : 'bg-success text-white'}`;
      });
      deptEls.forEach(el => el.textContent = u.departmentName || 'Campus Administration');
      campusEls.forEach(el => el.textContent = data.campusName || 'Dawood University of Engineering & Technology (DUET)');
      avatarEls.forEach(el => el.textContent = u.name.charAt(0).toUpperCase());
    } else {
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/access-denied')) {
        window.location.href = '/login';
      }
    }
  } catch (err) {
    console.error('Failed to initialize user session:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.includes('/login')) {
    initUserHeader();
  }
});
