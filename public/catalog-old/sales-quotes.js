(function () {
  'use strict';

  var DEAL_UPLOADS_KEY = 'dealMarginUploadsByQuote';
  var SALES_ALIAS = 'sally';
  var emailModalState = {
    quoteId: '',
    quoteName: '',
    opportunityId: '',
    isSending: false
  };

  /**
   * Static: …/console/index.html (Vite build synced via npm run sync-console).
   * Optional: set window.NETAPP_CONSOLE_URL = 'http://127.0.0.1:8080/' while running npm run console:dev (Vite React dev server).
   */
  function getConsoleEntryUrl() {
    try {
      var custom = typeof window !== 'undefined' && window.NETAPP_CONSOLE_URL;
      if (custom != null && String(custom).trim() !== '') {
        var u = String(custom).trim();
        return u.endsWith('/') ? u : u + '/';
      }
      return new URL('console/index.html', window.location.href).href;
    } catch (e1) {
      return window.location.origin + '/console/index.html';
    }
  }

  function getConsoleAfterSendNavigationUrl() {
    try {
      var custom = typeof window !== 'undefined' && window.NETAPP_CONSOLE_URL;
      if (custom != null && String(custom).trim() !== '') {
        var base = String(custom).trim();
        var u = new URL(base.endsWith('/') ? base : base + '/');
        u.searchParams.set('openCart', '1');
        return u.href;
      }
      return new URL('../?openCart=1', window.location.href).href;
    } catch (e1) {
      try {
        return new URL('/?openCart=1', window.location.origin).href;
      } catch (e2) {
        return '/?openCart=1';
      }
    }
  }

  function getSalesDashboardReturnUrl() {
    try {
      return new URL('sales-dashboard.html', window.location.href).href;
    } catch (e2) {
      return window.location.origin + '/sales-dashboard.html';
    }
  }

  function getById(id) { return document.getElementById(id); }

  function formatCurrency(n) {
    return '$' + Math.round(n).toLocaleString();
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getUploadMap() {
    try {
      var raw = sessionStorage.getItem(DEAL_UPLOADS_KEY) || localStorage.getItem(DEAL_UPLOADS_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function formatDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function statusMeta(uploaded) {
    var u = uploaded || {};
    var decision = String(u.dealDecision || '').toLowerCase();
    var explicitStatus = String(u.quoteStatus || u.status || '').toLowerCase();
    if (u.customerSubmitted && !u.submittedForApproval && !u.dealDecision) {
      return { key: 'customer-submitted', label: 'Customer request', cls: 'status-pending' };
    }
    if (explicitStatus === 'closed') return { key: 'closed', label: 'Closed', cls: 'status-reviewed' };
    if (u.subscriptionNumber && (decision === 'approved' || explicitStatus === 'approved')) {
      return { key: 'closed', label: 'Closed', cls: 'status-reviewed' };
    }
    if (decision === 'approved') return { key: 'approved', label: 'Approved', cls: 'status-reviewed' };
    if (decision === 'rejected') return { key: 'rejected', label: 'Rejected', cls: 'status-rejected' };
    if (decision === 'request updates' || decision === 'requested updates') return { key: 'pending-updates', label: 'Pending updates', cls: 'status-pending' };
    if (u.submittedForApproval || u.marginAnalysisCompleted || (u.subscriptionUploaded && u.hardwareUploaded)) {
      return { key: 'in-review', label: 'In review', cls: 'status-pending' };
    }
    return { key: 'draft', label: 'Draft', cls: 'status-pending' };
  }

  function isSalesOwned(uploaded) {
    if (!uploaded || typeof uploaded !== 'object') return false;
    // Customer-submitted requests always belong in the sales dashboard
    if (uploaded.customerSubmitted) return true;
    var assignedFor = String(uploaded.assignedFor || '').toLowerCase();
    var assignedTo = String(uploaded.assignedTo || '').toLowerCase();
    return !assignedFor || assignedFor === SALES_ALIAS || assignedFor === 'sales' ||
      assignedTo.indexOf('sally') !== -1 || assignedTo.indexOf('sales') !== -1;
  }

  function renderHeader() {
    var thead = getById('quotes-thead');
    if (!thead) return;
    thead.innerHTML =
      '<tr>' +
        '<th scope="col">Quote name</th>' +
        '<th scope="col">Quote number</th>' +
        '<th scope="col">Last updated</th>' +
        '<th scope="col">Status</th>' +
        '<th scope="col">Value</th>' +
        '<th scope="col">Source</th>' +
        '<th scope="col">Deal desk comments</th>' +
        '<th scope="col">Sales rep</th>' +
        '<th scope="col">Customer</th>' +
        '<th scope="col">Opportunity ID</th>' +
        '<th scope="col">Action</th>' +
      '</tr>';
  }

  function updateStats(rows) {
    var stats = { draft: 0, 'in-review': 0, 'pending-updates': 0, approved: 0, rejected: 0, 'customer-submitted': 0 };
    rows.forEach(function (r) { stats[r.status.key] = (stats[r.status.key] || 0) + 1; });
    if (getById('stat-draft')) getById('stat-draft').textContent = String(stats.draft || 0);
    if (getById('stat-in-review')) getById('stat-in-review').textContent = String(stats['in-review'] || 0);
    if (getById('stat-pending-updates')) getById('stat-pending-updates').textContent = String(stats['pending-updates'] || 0);
    if (getById('stat-approved')) getById('stat-approved').textContent = String(stats.approved || 0);
    if (getById('stat-rejected')) getById('stat-rejected').textContent = String(stats.rejected || 0);
    if (getById('stat-customer-submitted')) getById('stat-customer-submitted').textContent = String(stats['customer-submitted'] || 0);
  }

  function renderRows() {
    var tbody = getById('quotes-tbody');
    if (!tbody) return [];
    var map = getUploadMap();
    var ids = Object.keys(map).filter(function (k) {
      var v = map[k];
      return v && typeof v === 'object' && v.quoteId && isSalesOwned(v);
    });
    ids.sort(function (a, b) {
      var va = map[a] || {};
      var vb = map[b] || {};
      var ta = va.uploadedAt ? new Date(va.uploadedAt).getTime() : 0;
      var tb = vb.uploadedAt ? new Date(vb.uploadedAt).getTime() : 0;
      return tb - ta;
    });
    tbody.innerHTML = '';

    if (!ids.length) {
      return [];
    }

    var rows = [];
    ids.forEach(function (id) {
      var u = map[id];
      var sm = statusMeta(u);
      var totalBookings = 0;
      var ad = (u.data && u.data.annualData) || u.annualData || {};
      if (Array.isArray(ad.bookingsUsd)) {
        ad.bookingsUsd.forEach(function (b) { totalBookings += (b || 0); });
      }
      var rowData = {
        quoteId: id,
        quoteName: u.quoteName || ('Quote ' + id),
        uploadedAt: u.uploadedAt,
        status: sm,
        value: totalBookings,
        dealDeskComment: u.dealDeskComment || '',
        subscriptionNumber: u.subscriptionNumber || '',
        assignedTo: u.assignedTo || 'Chris Collins',
        customer: u.customerName || 'AUMOVIO Germany GmbH',
        opportunityId: u.opportunityId || '3876523',
        customerSubmitted: !!(u.customerSubmitted)
      };
      rows.push(rowData);
      var row = document.createElement('tr');
      row.setAttribute('data-status', sm.key);
      if (rowData.customerSubmitted) row.classList.add('quote-row-customer');
      var oppParam = (rowData.opportunityId && rowData.opportunityId !== '—')
        ? ('&opportunity=' + encodeURIComponent(rowData.opportunityId))
        : '';
      var quoteHref = rowData.customerSubmitted
        ? ('sizing.html?quote=' + encodeURIComponent(id) + oppParam + '&from=customer')
        : ('sizing.html?quote=' + encodeURIComponent(id) + oppParam + '&readonly=1');
      var sourceLabel = rowData.customerSubmitted ? 'Customer portal' : 'Sales';
      var actionCell = '';
      if (sm.key === 'approved') {
        actionCell = '<button type="button" class="quotes-inline-btn sales-send-btn" data-quote-id="' + escapeHtml(id) + '" data-quote-name="' + escapeHtml(rowData.quoteName) + '" data-opportunity-id="' + escapeHtml(rowData.opportunityId) + '">Send to customer</button>';
      } else if (rowData.customerSubmitted) {
        actionCell = '<button type="button" class="quotes-inline-btn quotes-review-btn" data-quote-id="' + escapeHtml(id) + '" data-quote-href="' + escapeHtml(quoteHref) + '">Review &amp; quote</button>';
      } else {
        actionCell = '<button type="button" class="quotes-inline-btn" disabled title="Available only for approved quotes">Send to customer</button>';
      }
      row.innerHTML =
        '<td><a class="quotes-link" href="' + escapeHtml(quoteHref) + '">' + escapeHtml(rowData.quoteName) + '</a></td>' +
        '<td>' + escapeHtml(id) + '</td>' +
        '<td>' + escapeHtml(formatDate(rowData.uploadedAt)) + '</td>' +
        '<td><span class="quotes-status ' + escapeHtml(sm.cls) + '">' + escapeHtml(sm.label) + '</span></td>' +
        '<td>' + (rowData.value > 0 ? formatCurrency(rowData.value) : '—') + '</td>' +
        '<td>' + sourceLabel + '</td>' +
        '<td title="' + escapeHtml(rowData.dealDeskComment || '') + '">' + escapeHtml(rowData.dealDeskComment || '—') + '</td>' +
        '<td>' + escapeHtml(rowData.assignedTo) + '</td>' +
        '<td>' + escapeHtml(rowData.customer) + '</td>' +
        '<td>' + escapeHtml(rowData.opportunityId) + '</td>' +
        '<td>' + actionCell + '</td>';
      tbody.appendChild(row);
    });
    return rows;
  }

  function bindSendToCustomer() {
    var tbody = getById('quotes-tbody');
    if (!tbody) return;
    tbody.addEventListener('click', function (e) {
      var reviewBtn = e.target.closest('.quotes-review-btn');
      if (reviewBtn) {
        var href = reviewBtn.getAttribute('data-quote-href') || '';
        if (href) window.location.href = href;
        return;
      }
      var btn = e.target.closest('.sales-send-btn');
      if (!btn) return;
      var quoteId = btn.getAttribute('data-quote-id') || '';
      var quoteName = btn.getAttribute('data-quote-name') || ('Quote ' + quoteId);
      var opportunityId = btn.getAttribute('data-opportunity-id') || '';
      openSendEmailModal(quoteId, quoteName, opportunityId);
    });
  }

  function getEmailTemplateBody(opportunityId) {
    var consoleLink = getConsoleEntryUrl();
    var lines = [
      'Hi Steve,',
      '',
      'We\u2019re pleased to inform you that your quote for the Keystone subscription is now ready.',
      'Please log in to the console using the link below to review your quote:',
      consoleLink
    ];
    if (opportunityId) lines.push('Opportunity ID: ' + opportunityId);
    lines.push(
      '',
      'Once you approve the quote, please upload the Purchase Order (PO) in the console so we can proceed with closing the deal.',
      '',
      'If you have any questions or need assistance during the process, feel free to reach out\u2014we\u2019re happy to help.',
      '',
      'Best regards,',
      'Chris Collins',
      'Sales Specialist',
      'NetApp Keystone'
    );
    return lines.join('\n');
  }

  function setEmailModalSending(isSending, statusText, isSent) {
    emailModalState.isSending = !!isSending;
    var to = getById('sales-email-to');
    var subject = getById('sales-email-subject');
    var body = getById('sales-email-body');
    var sendBtn = getById('sales-email-send');
    var cancelBtn = getById('sales-email-cancel');
    var closeBtn = getById('sales-email-close');
    var status = getById('sales-email-status');
    if (to) to.disabled = isSending;
    if (subject) subject.disabled = isSending;
    if (body) body.disabled = isSending;
    if (sendBtn) sendBtn.disabled = isSending;
    if (cancelBtn) cancelBtn.disabled = isSending;
    if (closeBtn) closeBtn.disabled = isSending;
    if (status) {
      if (statusText) {
        status.hidden = false;
        status.textContent = statusText;
      } else {
        status.hidden = true;
        status.textContent = '';
      }
      status.classList.toggle('is-sent', !!isSent);
    }
  }

  function closeSendEmailModal() {
    if (emailModalState.isSending) return;
    var modal = getById('sales-email-modal');
    if (modal) modal.hidden = true;
    setEmailModalSending(false, '', false);
  }

  function openSendEmailModal(quoteId, quoteName, opportunityId) {
    var modal = getById('sales-email-modal');
    var to = getById('sales-email-to');
    var subject = getById('sales-email-subject');
    var body = getById('sales-email-body');
    if (!modal || !to || !subject || !body) return;
    emailModalState.quoteId = quoteId;
    emailModalState.quoteName = quoteName;
    emailModalState.opportunityId = opportunityId || '';
    to.value = 'steve.myers@megaholdings.com';
    subject.value = 'Your Keystone Subscription Quote Is Ready';
    body.value = getEmailTemplateBody(emailModalState.opportunityId);
    setEmailModalSending(false, '', false);
    modal.hidden = false;
    window.setTimeout(function () { to.focus(); }, 0);
  }

  function bindEmailModal() {
    var modal = getById('sales-email-modal');
    var form = getById('sales-email-form');
    var cancelBtn = getById('sales-email-cancel');
    var closeBtn = getById('sales-email-close');
    if (!modal || !form) return;

    if (cancelBtn) cancelBtn.addEventListener('click', closeSendEmailModal);
    if (closeBtn) closeBtn.addEventListener('click', closeSendEmailModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeSendEmailModal();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (emailModalState.isSending) return;
      var to = getById('sales-email-to');
      var subject = getById('sales-email-subject');
      var body = getById('sales-email-body');
      var email = to ? String(to.value || '').trim() : '';
      var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!ok) {
        window.alert('Please enter a valid customer email.');
        return;
      }
      if (!subject || !String(subject.value || '').trim() || !body || !String(body.value || '').trim()) {
        window.alert('Subject and message are required.');
        return;
      }
      var consoleEntryUrl = getConsoleEntryUrl();
      var returnUrl = getSalesDashboardReturnUrl();
      var sentQuoteId = emailModalState.quoteId;
      var sentOppId = emailModalState.opportunityId || '';
      try {
        sessionStorage.setItem('subSizerConsoleContext', JSON.stringify({
          quoteId: sentQuoteId,
          opportunityId: sentOppId,
          consoleEntryUrl: consoleEntryUrl,
          returnUrl: returnUrl,
          customerEmail: email,
          savedAt: new Date().toISOString()
        }));
      } catch (eCtx) {}
      try {
        var key = 'sentQuotesLog';
        var raw = localStorage.getItem(key);
        var list = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list)) list = [];
        list.push({
          quoteId: sentQuoteId,
          opportunityId: sentOppId,
          consoleUrl: consoleEntryUrl,
          to: email,
          sentAt: new Date().toISOString()
        });
        localStorage.setItem(key, JSON.stringify(list));
      } catch (eLog) {}
      setEmailModalSending(true, 'Opening Console\u2026', false);
      var tbodyForSend = getById('quotes-tbody');
      if (tbodyForSend) {
        var rowBtns = tbodyForSend.querySelectorAll('.sales-send-btn');
        for (var bi = 0; bi < rowBtns.length; bi++) {
          if (rowBtns[bi].getAttribute('data-quote-id') === sentQuoteId) {
            rowBtns[bi].disabled = true;
            rowBtns[bi].textContent = 'Sent';
            rowBtns[bi].title = 'Customer notified; you opened Console';
            rowBtns[bi].classList.remove('sales-send-btn');
            break;
          }
        }
      }
      window.location.assign(getConsoleAfterSendNavigationUrl());
    });
  }

  function updateCount() {
    var tbody = getById('quotes-tbody');
    var countEl = getById('quotes-count');
    if (!tbody || !countEl) return;
    var visible = tbody.querySelectorAll('tr:not([style*="display: none"])').length;
    countEl.textContent = '(' + visible + ')';
  }

  function filterRows(tab) {
    var tbody = getById('quotes-tbody');
    var empty = getById('quotes-empty-uploaded');
    if (!tbody) return;
    var visible = 0;
    tbody.querySelectorAll('tr').forEach(function (row) {
      var status = row.getAttribute('data-status') || '';
      var show = tab === 'all' ? true : status === tab;
      row.style.display = show ? '' : 'none';
      if (show) visible += 1;
    });
    if (empty) empty.hidden = visible !== 0;
    updateCount();
  }

  function bindTabs() {
    document.querySelectorAll('.quotes-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var key = tab.getAttribute('data-tab') || 'all';
        document.querySelectorAll('.quotes-tab').forEach(function (t) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        filterRows(key);
      });
    });
  }

  function init() {
    renderHeader();
    var rows = renderRows();
    updateStats(rows);
    bindTabs();
    bindSendToCustomer();
    bindEmailModal();
    filterRows('all');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
