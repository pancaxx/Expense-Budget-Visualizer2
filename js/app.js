/* ============================================================
   Expense & Budget Visualizer — app.js
   Vanilla JavaScript only (no frameworks)
   LocalStorage for persistence

   Optional Challenges implemented (3 of 5):
     ✅ Sort transactions by amount or category
     ✅ Highlight spending over a set limit
     ✅ Dark / light mode toggle
   ============================================================ */

'use strict';

/* ── Constants ───────────────────────────────────────────── */
const STORAGE_KEY  = 'budget_transactions';
const THEME_KEY    = 'budget_theme';
const LIMIT_KEY    = 'budget_limit';

const CATEGORY_COLORS = {
  Food:      '#4caf50',
  Transport: '#2196f3',
  Fun:       '#ff9800',
};

/* ── State ───────────────────────────────────────────────── */
let transactions  = loadFromStorage(STORAGE_KEY, []);
let spendingLimit = loadFromStorage(LIMIT_KEY, '');
let pieChart      = null;

/* ── DOM References ──────────────────────────────────────── */
const form         = document.getElementById('txForm');
const inputName    = document.getElementById('itemName');
const inputAmount  = document.getElementById('amount');
const inputCat     = document.getElementById('category');
const errName      = document.getElementById('errName');
const errAmount    = document.getElementById('errAmount');
const errCat       = document.getElementById('errCategory');
const txList       = document.getElementById('txList');
const balanceEl    = document.getElementById('totalBalance');
const chartWrapper = document.getElementById('chartWrapper');
const themeToggle  = document.getElementById('themeToggle');
const sortSelect   = document.getElementById('sortSelect');
const limitInput   = document.getElementById('limitInput');
const limitBanner  = document.getElementById('limitBanner');
const limitMsg     = document.getElementById('limitMsg');

/* ── Init ─────────────────────────────────────────────────── */
function init() {
  // Restore saved theme
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(savedTheme);

  // Restore limit input
  if (spendingLimit !== '') limitInput.value = spendingLimit;

  // Event listeners
  form.addEventListener('submit', handleAddTransaction);
  themeToggle.addEventListener('click', handleThemeToggle);
  sortSelect.addEventListener('change', renderAll);
  limitInput.addEventListener('input', handleLimitChange);

  renderAll();
}

/* ============================================================
   OPTIONAL CHALLENGE 1 — Dark / Light Mode Toggle
   ============================================================ */
function handleThemeToggle() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);

  // Redraw chart so legend colours update
  if (pieChart) { pieChart.destroy(); pieChart = null; }
  renderChart();
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  themeToggle.setAttribute(
    'title',
    theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  );
}

/* ============================================================
   OPTIONAL CHALLENGE 2 — Sort Transactions
   ============================================================ */
function getSortedTransactions() {
  const list  = [...transactions];
  const order = sortSelect.value;

  switch (order) {
    case 'newest':      return list.sort((a, b) => b.id - a.id);
    case 'oldest':      return list.sort((a, b) => a.id - b.id);
    case 'amount-desc': return list.sort((a, b) => b.amount - a.amount);
    case 'amount-asc':  return list.sort((a, b) => a.amount - b.amount);
    case 'category':    return list.sort((a, b) => a.category.localeCompare(b.category));
    default:            return list;
  }
}

/* ============================================================
   OPTIONAL CHALLENGE 3 — Highlight Spending Over Limit
   ============================================================ */
function handleLimitChange() {
  const val     = parseFloat(limitInput.value);
  spendingLimit = isNaN(val) || val <= 0 ? '' : val;
  saveToStorage(LIMIT_KEY, spendingLimit);
  renderAll();
}

function checkSpendingLimit(total) {
  if (spendingLimit === '' || transactions.length === 0) {
    limitBanner.hidden = true;
    return;
  }

  if (total > spendingLimit) {
    limitBanner.hidden = false;
    const over = (total - spendingLimit).toFixed(2);
    limitMsg.textContent =
      `You exceeded your spending limit of ${formatMoney(spendingLimit)} by ${formatMoney(over)}!`;
  } else {
    limitBanner.hidden = true;
  }
}

/* ── Validation ──────────────────────────────────────────── */
function clearErrors() {
  [inputName, inputAmount, inputCat].forEach(el => el.classList.remove('error'));
  [errName, errAmount, errCat].forEach(el => el.classList.remove('visible'));
}

function validateForm() {
  let valid = true;
  clearErrors();

  if (!inputName.value.trim()) {
    inputName.classList.add('error');
    errName.classList.add('visible');
    valid = false;
  }

  const amt = parseFloat(inputAmount.value);
  if (!inputAmount.value || isNaN(amt) || amt <= 0) {
    inputAmount.classList.add('error');
    errAmount.classList.add('visible');
    valid = false;
  }

  if (!inputCat.value) {
    inputCat.classList.add('error');
    errCat.classList.add('visible');
    valid = false;
  }

  return valid;
}

/* ── Add Transaction ─────────────────────────────────────── */
function handleAddTransaction(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const tx = {
    id:       Date.now(),
    name:     inputName.value.trim(),
    amount:   parseFloat(parseFloat(inputAmount.value).toFixed(2)),
    category: inputCat.value,
  };

  transactions.unshift(tx);
  saveToStorage(STORAGE_KEY, transactions);
  renderAll();

  form.reset();
  clearErrors();
}

/* ── Delete Transaction ──────────────────────────────────── */
function deleteTransaction(id) {
  transactions = transactions.filter(tx => tx.id !== id);
  saveToStorage(STORAGE_KEY, transactions);
  renderAll();
}

// Expose for inline onclick
window.deleteTransaction = deleteTransaction;

/* ── Render: Balance ─────────────────────────────────────── */
function renderBalance() {
  const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  balanceEl.textContent = formatMoney(total);
  checkSpendingLimit(total);
  return total;
}

/* ── Render: Transaction List ────────────────────────────── */
function renderList() {
  const sorted = getSortedTransactions();

  if (sorted.length === 0) {
    txList.innerHTML = '<div class="empty-state">No transactions yet.</div>';
    return;
  }

  const total      = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const isOverLimit = spendingLimit !== '' && total > spendingLimit;

  txList.innerHTML = sorted.map(tx => {
    const overClass = isOverLimit ? ' over-limit' : '';
    return `
      <div class="tx-item${overClass}" data-id="${tx.id}">
        <div class="tx-info">
          <div class="tx-name">${escapeHtml(tx.name)}</div>
          <div class="tx-amount">${formatMoney(tx.amount)}</div>
          <span class="tx-badge badge-${tx.category}">${tx.category}</span>
        </div>
        <button class="btn-delete" onclick="deleteTransaction(${tx.id})">Delete</button>
      </div>
    `;
  }).join('');
}

/* ── Render: Pie Chart ───────────────────────────────────── */
function renderChart() {
  // Aggregate totals per category
  const totals = { Food: 0, Transport: 0, Fun: 0 };
  transactions.forEach(tx => { totals[tx.category] += tx.amount; });

  const labels = Object.keys(totals).filter(k => totals[k] > 0);
  const data   = labels.map(k => totals[k]);

  if (data.length === 0) {
    chartWrapper.innerHTML = '<span class="no-data-msg">Add transactions to see the chart.</span>';
    if (pieChart) { pieChart.destroy(); pieChart = null; }
    return;
  }

  // Create canvas if not present
  if (!document.getElementById('pieCanvas')) {
    chartWrapper.innerHTML = '<canvas id="pieCanvas"></canvas>';
  }

  const isDark    = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#e8e8e8' : '#555555';
  const ctx       = document.getElementById('pieCanvas').getContext('2d');

  if (pieChart) {
    // Update existing chart
    pieChart.data.labels                     = labels;
    pieChart.data.datasets[0].data           = data;
    pieChart.data.datasets[0].backgroundColor = labels.map(l => CATEGORY_COLORS[l]);
    pieChart.options.plugins.legend.labels.color = textColor;
    pieChart.update();
  } else {
    // Create new chart
    pieChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: labels.map(l => CATEGORY_COLORS[l]),
          borderWidth: 2,
          borderColor: isDark ? '#1e1e1e' : '#ffffff',
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: textColor,
              font: { size: 12 },
              padding: 14,
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${formatMoney(ctx.parsed)}`,
            },
          },
        },
      },
    });
  }
}

/* ── Render All ──────────────────────────────────────────── */
function renderAll() {
  renderBalance();
  renderList();
  renderChart();
}

/* ── Utility: LocalStorage ───────────────────────────────── */
function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage might be full; fail silently
  }
}

/* ── Utility: Format money ───────────────────────────────── */
function formatMoney(n) {
  return '$' + Number(n).toFixed(2);
}

/* ── Utility: Escape HTML (XSS prevention) ──────────────── */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ── Start ───────────────────────────────────────────────── */
init();
