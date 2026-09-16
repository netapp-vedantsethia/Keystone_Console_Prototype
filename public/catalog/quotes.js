(function () {
  'use strict';

  var DEAL_DATA_KEY = 'dealMarginUploadData';
  var DEAL_UPLOADS_KEY = 'dealMarginUploadsByQuote';

  function getById(id) {
    return document.getElementById(id);
  }

  function formatCurrency(n) {
    if (!n && n !== 0) return '—';
    return '$' + Math.round(n).toLocaleString('en-US');
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

  function getUploadForQuote(quoteId) {
    var map = getUploadMap();
    return map && quoteId ? map[quoteId] : null;
  }

  function setActiveDealDataForQuote(quoteId) {
    var upload = getUploadForQuote(quoteId);
    if (!upload || !upload.data) return false;
    try {
      sessionStorage.setItem(DEAL_DATA_KEY, JSON.stringify(upload.data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function canOpenDealMargin(uploaded) {
    if (!uploaded || typeof uploaded !== 'object') return false;
    var hasDealData = !!uploaded.data;
    var hasBothUploads = !!uploaded.subscriptionUploaded && !!uploaded.hardwareUploaded;
    return hasDealData || hasBothUploads || !!uploaded.submittedForApproval;
  }

  // --- Tabs ---
  function bindTabs() {
    var tabs = document.querySelectorAll('.quotes-tab');
    var panel = getById('upload-panel');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var t = tab.getAttribute('data-tab');
        tabs.forEach(function (x) {
          x.classList.remove('active');
          x.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        filterTableByTab(t);
      });
    });
  }

  function filterTableByTab(tabKey) {
    var tbody = getById('quotes-tbody');
    var emptyEl = getById('quotes-empty-uploaded');
    if (!tbody) return;
    var rows = tbody.querySelectorAll('tr');
    var visibleCount = 0;
    var cumulativeValue = 0;
    rows.forEach(function (row) {
      var status = row.getAttribute('data-status') || '';
      var show = true;
      if (tabKey === 'all') show = true;
      else if (tabKey === 'pending-review') show = status === 'pending-review';
      else if (tabKey === 'pending-updates') show = status === 'pending-updates';
      else if (tabKey === 'rejected') show = status === 'rejected';
      else if (tabKey === 'requested-updates') show = status === 'requested-updates';
      else if (tabKey === 'reviewed') show = status === 'reviewed';
      row.style.display = show ? '' : 'none';
      if (show) {
        visibleCount += 1;
        var valCell = row.querySelector('td[data-value]');
        if (valCell) cumulativeValue += parseFloat(valCell.getAttribute('data-value')) || 0;
      }
    });
    if (emptyEl) emptyEl.hidden = visibleCount !== 0;
    var cumEl = getById('quotes-cumulative-value');
    if (cumEl) cumEl.textContent = cumulativeValue > 0 ? formatCurrency(cumulativeValue) : '$0';
    updateQuotesCount();
  }

  function updateQuotesCount() {
    var tbody = getById('quotes-tbody');
    var countEl = getById('quotes-count');
    if (!tbody || !countEl) return;
    var visible = tbody.querySelectorAll('tr:not([style*="display: none"])').length;
    countEl.textContent = '(' + visible + ')';
  }

  function updateStatCards() {
    var tbody = getById('quotes-tbody');
    if (!tbody) return;
    var rows = tbody.querySelectorAll('tr');
    var counts = { all: 0, 'pending-review': 0, 'pending-updates': 0, rejected: 0, 'requested-updates': 0, reviewed: 0 };
    rows.forEach(function (row) {
      var status = row.getAttribute('data-status') || '';
      counts.all += 1;
      if (counts.hasOwnProperty(status)) counts[status] += 1;
    });
    var ids = { all: 'stat-all', 'pending-review': 'stat-pending-review', 'pending-updates': 'stat-pending-updates', rejected: 'stat-rejected', 'requested-updates': 'stat-requested-updates', reviewed: 'stat-reviewed' };
    Object.keys(ids).forEach(function (key) {
      var el = getById(ids[key]);
      if (el) el.textContent = counts[key];
    });
  }

  function renderQuotesHeader() {
    var thead = getById('quotes-thead');
    if (!thead) return;
    thead.innerHTML =
      '<tr>' +
        '<th scope="col">Quote name</th>' +
        '<th scope="col">Quote number</th>' +
        '<th scope="col">Date submitted</th>' +
        '<th scope="col">Status</th>' +
        '<th scope="col">Value</th>' +
        '<th scope="col">Sales rep</th>' +
        '<th scope="col">Customer</th>' +
        '<th scope="col">Opportunity ID</th>' +
      '</tr>';
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatUploadDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getStatusMeta(uploaded) {
    var u = uploaded || {};
    var decision = (u.dealDecision || '').toLowerCase();
    if (decision === 'approved') return { status: 'reviewed', label: 'Approved', cls: 'status-reviewed' };
    if (decision === 'rejected') return { status: 'rejected', label: 'Rejected', cls: 'status-rejected' };
    if (decision === 'request updates' || decision === 'requested updates') return { status: 'requested-updates', label: 'Requested updates', cls: 'status-requested-updates' };
    var submittedForApproval = !!u.submittedForApproval;
    var hasSub = !!u.subscriptionUploaded;
    var hasHw = !!u.hardwareUploaded;
    var completed = !!u.marginAnalysisCompleted;
    var status = completed ? 'reviewed' : (submittedForApproval || (hasSub && hasHw) ? 'pending-review' : 'pending-updates');
    var label = status === 'reviewed' ? 'Reviewed' : status === 'pending-updates' ? 'Pending updates' : 'Pending review';
    var cls = status === 'reviewed' ? 'status-reviewed' : 'status-pending';
    return { status: status, label: label, cls: cls };
  }

  function renderUploadedQuotesRows() {
    var tbody = getById('quotes-tbody');
    if (!tbody) return;
    var map = getUploadMap();
    var ids = Object.keys(map).filter(function (k) {
      var v = map[k];
      // Exclude customer-submitted requests until a salesperson submits them for approval
      if (v && v.customerSubmitted && !v.submittedForApproval) return false;
      return v && typeof v === 'object' && v.quoteId;
    });
    tbody.innerHTML = '';
    if (!ids.length) {
      return;
    }

    ids.sort(function (a, b) {
      var ua = map[a] || {};
      var ub = map[b] || {};
      var ta = ua.uploadedAt ? new Date(ua.uploadedAt).getTime() : 0;
      var tb = ub.uploadedAt ? new Date(ub.uploadedAt).getTime() : 0;
      return tb - ta;
    });

    ids.forEach(function (quoteId) {
      var u = map[quoteId] || {};
      var oppId = u.opportunityId || '3876523';
      var marginHref = 'margin-analysis.html?quote=' + encodeURIComponent(quoteId) + '&opportunity=' + encodeURIComponent(oppId);
      var submitted = formatUploadDate(u.uploadedAt);
      var submittedForApproval = !!u.submittedForApproval;
      var hasSub = !!u.subscriptionUploaded;
      var hasHw = !!u.hardwareUploaded;
      var completed = !!u.marginAnalysisCompleted;
      var ready = canOpenDealMargin(u);
      var statusMeta = getStatusMeta(u);
      var status = statusMeta.status;
      var statusLabel = statusMeta.label;
      var featureRequestCount = Array.isArray(u.data && u.data.featureRequests) ? u.data.featureRequests.length : 0;
      var quoteLabelBase = u.quoteName || ('Quote ' + quoteId);
      var quoteLabel = quoteLabelBase + (featureRequestCount ? (' · FR ' + featureRequestCount) : '');
      var totalBookings = 0;
      var annualData = (u.data && u.data.annualData) || u.annualData || {};
      if (Array.isArray(annualData.bookingsUsd)) {
        annualData.bookingsUsd.forEach(function (b) { totalBookings += (b || 0); });
      }
      var valueDisplay = totalBookings > 0 ? formatCurrency(totalBookings) : '—';
      var row = document.createElement('tr');
      row.setAttribute('data-quote-id', quoteId);
      row.setAttribute('data-status', status);
      row.innerHTML =
        '<td><a class="quotes-link" href="' + marginHref + '" title="' + (featureRequestCount ? ('Feature requests: ' + featureRequestCount) : 'Open deal margin') + '">' + escapeHtml(quoteLabel) + '</a></td>' +
        '<td><a class="quotes-link" href="' + marginHref + '">' + escapeHtml(quoteId) + '</a></td>' +
        '<td>' + escapeHtml(submitted) + '</td>' +
        '<td><span class="quotes-status ' + escapeHtml(statusMeta.cls) + '">' + escapeHtml(statusLabel) + '</span></td>' +
        '<td data-value="' + totalBookings + '">' + valueDisplay + '</td>' +
        '<td>' + escapeHtml(u.assignedTo || 'Derek Keller') + '</td>' +
        '<td>' + escapeHtml(u.customerName || 'AUMOVIO Germany GmbH') + '</td>' +
        '<td>' + escapeHtml(oppId) + '</td>';
      tbody.appendChild(row);
    });
  }

  function updateDealMarginNavLink() {
    // No-op: the Deal margin nav link should stay as plain margin-analysis.html
    // so the page shows an empty state unless the user navigates via a specific quote row.
  }

  function applyUploadStatusToRows() {
    var tbody = getById('quotes-tbody');
    if (!tbody) return;
    if (!tbody.querySelector('[data-upload-type]')) {
      var activeTabSimple = document.querySelector('.quotes-tab.active');
      filterTableByTab(activeTabSimple ? activeTabSimple.getAttribute('data-tab') : 'pending-review');
      return;
    }
    tbody.querySelectorAll('tr[data-quote-id]').forEach(function (row) {
      var quoteId = row.getAttribute('data-quote-id');
      var uploaded = getUploadForQuote(quoteId) || {};
      var submittedForApproval = !!uploaded.submittedForApproval;
      var hasSub = !!uploaded.subscriptionUploaded;
      var hasHw = !!uploaded.hardwareUploaded;
      var ready = canOpenDealMargin(uploaded);
      var completed = !!uploaded.marginAnalysisCompleted;
      var statusMeta = getStatusMeta(uploaded);
      row.setAttribute('data-status', statusMeta.status);

      var subEl = row.querySelector('[data-upload-type="subscription"]');
      var hwEl = row.querySelector('[data-upload-type="hardware"]');
      var readyEl = row.querySelector('[data-upload-type="ready"]');
      var quoteLink = row.querySelector('.quotes-link');
      var statusEl = row.querySelector('.quotes-status');

      if (subEl) {
        var subName = uploaded.subscriptionCodeName || '';
        subEl.textContent = hasSub ? ('Subscription: ' + (subName || 'Uploaded')) : 'Subscription: Not uploaded';
        subEl.title = hasSub ? ('Subscription: ' + (subName || 'Uploaded')) : 'Subscription: Not uploaded';
        subEl.classList.toggle('uploaded', hasSub);
      }
      if (hwEl) {
        var hwName = uploaded.hardwareCodeName || '';
        hwEl.textContent = hasHw ? ('Hardware: ' + (hwName || 'Uploaded')) : 'Hardware: Not uploaded';
        hwEl.title = hasHw ? ('Hardware: ' + (hwName || 'Uploaded')) : 'Hardware: Not uploaded';
        hwEl.classList.toggle('uploaded', hasHw);
      }
      if (readyEl) {
        readyEl.textContent = completed ? 'Margin analysis completed' : ready ? 'Ready for margin analysis' : submittedForApproval ? 'Pending margin analysis' : 'Waiting for both quotes';
        readyEl.classList.toggle('status-reviewed', completed || ready);
        readyEl.classList.toggle('status-pending', !(completed || ready));
      }
      if (statusEl) {
        statusEl.textContent = statusMeta.label;
        statusEl.classList.remove('status-pending', 'status-reviewed');
        statusEl.classList.add(statusMeta.cls);
      }
      if (quoteLink) quoteLink.classList.toggle('disabled-link', !ready);
    });
    var activeTab = document.querySelector('.quotes-tab.active');
    filterTableByTab(activeTab ? activeTab.getAttribute('data-tab') : 'pending-review');
  }

  function bindDealMarginButtons() {
    var tbody = getById('quotes-tbody');
    if (!tbody) return;
    tbody.addEventListener('click', function (e) {
      var quoteLink = e.target.closest('.quotes-link');
      if (quoteLink) {
        var rowForLink = quoteLink.closest('tr[data-quote-id]');
        var quoteIdForLink = rowForLink && rowForLink.getAttribute('data-quote-id');
        if (!quoteIdForLink || !setActiveDealDataForQuote(quoteIdForLink)) {
          e.preventDefault();
          alert('No submitted sizing data found for this quote yet.');
          return;
        }
        return;
      }
    });
  }

  function focusQuoteRow(quoteId) {
    if (!quoteId) return;
    var row = document.querySelector('tr[data-quote-id="' + quoteId + '"]');
    if (!row) return;
    row.classList.add('quotes-row-focus');
    try {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      row.scrollIntoView();
    }
  }

  // --- Upload panel toggle ---
  function bindUploadPanel() {
    var btnOpen = getById('btn-open-upload');
    var panel = getById('upload-panel');
    var btnClose = getById('upload-panel-close');
    var btnCancel = getById('upload-panel-cancel');

    function openPanel() {
      if (panel) {
        panel.removeAttribute('hidden');
        panel.setAttribute('aria-hidden', 'false');
      }
    }

    function closePanel() {
      if (panel) {
        panel.setAttribute('hidden', '');
        panel.setAttribute('aria-hidden', 'true');
      }
    }

    if (btnOpen) btnOpen.addEventListener('click', openPanel);
    if (btnClose) btnClose.addEventListener('click', closePanel);
    if (btnCancel) btnCancel.addEventListener('click', closePanel);
  }

  // --- Row actions menu ---
  function bindRowActions() {
    var menu = getById('quotes-actions-menu');
    var tbody = getById('quotes-tbody');
    if (!tbody || !menu) return;

    function placeMenu(trigger, row) {
      if (!menu || !trigger) return;
      var rect = trigger.getBoundingClientRect();
      menu.style.left = rect.left + 'px';
      menu.style.top = (rect.bottom + 4) + 'px';
      menu.removeAttribute('hidden');
      menu.setAttribute('aria-hidden', 'false');
      menu._currentRow = row;
    }

    function hideMenu() {
      if (menu) {
        menu.setAttribute('hidden', '');
        menu.setAttribute('aria-hidden', 'true');
        menu._currentRow = null;
      }
      document.querySelectorAll('.quotes-actions-trigger').forEach(function (t) {
        t.setAttribute('aria-expanded', 'false');
      });
    }

    tbody.addEventListener('click', function (e) {
      var trigger = e.target.closest('.quotes-actions-trigger');
      if (!trigger) return;
      e.stopPropagation();
      var row = trigger.closest('tr');
      var isOpen = menu && !menu.hasAttribute('hidden');
      if (isOpen && menu._currentRow === row) {
        hideMenu();
        return;
      }
      placeMenu(trigger, row);
      trigger.setAttribute('aria-expanded', 'true');
    });

    if (menu) {
      menu.querySelectorAll('[role="menuitem"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var action = btn.getAttribute('data-action');
          var row = menu._currentRow;
          hideMenu();
          if (action === 'view' && row) {
            var link = row.querySelector('.quotes-link');
            if (link) link.click();
          } else if (action === 'reassign') {
            alert('Reassign: not implemented in demo.');
          } else if (action === 'download') {
            alert('Download: not implemented in demo.');
          } else if (action === 'delete') {
            if (row && confirm('Delete this quote?')) {
              row.remove();
              updateQuotesCount();
            }
          }
        });
      });
    }

    document.addEventListener('click', function () {
      hideMenu();
    });
  }

  // --- Inline upload logic (same as upload.js, for quotes-* IDs) ---
  function getSampleDealData() {
    return {
      subscription: {
        bookingsLocal: [185100, 185100, 185100, 185100, 185100],
        bookingsUsd: [185100, 185100, 185100, 185100, 185100],
        partnerIncentive: [12957, 12957, 12957, 12957, 12957],
        netBookings: [172143, 172143, 172143, 172143, 172143],
        keystoneServices: [38437, 18957, 18957, 18957, 18957],
        slaCredits: [29693, 29693, 29693, 29693, 29693]
      },
      hardware: {
        bomPerYear: 56685,
        discountRate: 26,
        discountAmount: 20000
      },
      contractLengthMonths: 60,
      billingFrequency: 'Annual',
      years: 5
    };
  }

  function parseSubscriptionWorkbook(wb) {
    var sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return null;
    var data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    var years = 5;
    var result = {
      bookingsLocal: [],
      bookingsUsd: [],
      partnerIncentive: [],
      netBookings: [],
      keystoneServices: [],
      slaCredits: []
    };
    var rowMap = {};
    for (var r = 0; r < Math.min(data.length, 20); r++) {
      var row = data[r];
      if (!row || !row.length) continue;
      var label = String(row[0] || '').toLowerCase();
      if (label.indexOf('booking') >= 0 && label.indexOf('local') >= 0) rowMap.bookingsLocal = r;
      else if (label.indexOf('booking') >= 0 && (label.indexOf('usd') >= 0 || label === 'bookings')) rowMap.bookingsUsd = r;
      else if (label.indexOf('partner') >= 0) rowMap.partnerIncentive = r;
      else if (label.indexOf('net booking') >= 0) rowMap.netBookings = r;
      else if (label.indexOf('keystone') >= 0 || label.indexOf('service') >= 0) rowMap.keystoneServices = r;
      else if (label.indexOf('sla') >= 0 || label.indexOf('credit') >= 0) rowMap.slaCredits = r;
    }
    function extractRow(key) {
      var r = rowMap[key];
      var arr = [];
      if (r != null && data[r]) {
        for (var c = 1; c <= years && c < data[r].length; c++) {
          var val = data[r][c];
          if (typeof val === 'number' && !isNaN(val)) arr.push(Math.round(val));
          else if (typeof val === 'string') arr.push(Math.round(parseFloat(val.replace(/[^0-9.-]/g, '')) || 0));
          else arr.push(0);
        }
      }
      while (arr.length < years) arr.push(0);
      return arr.slice(0, years);
    }
    result.bookingsLocal = extractRow('bookingsLocal');
    if (result.bookingsLocal.every(function (n) { return n === 0; })) result.bookingsLocal = [185100, 185100, 185100, 185100, 185100];
    result.bookingsUsd = extractRow('bookingsUsd');
    if (result.bookingsUsd.every(function (n) { return n === 0; })) result.bookingsUsd = result.bookingsLocal.slice();
    result.partnerIncentive = extractRow('partnerIncentive');
    if (result.partnerIncentive.every(function (n) { return n === 0; })) result.partnerIncentive = [12957, 12957, 12957, 12957, 12957];
    result.netBookings = extractRow('netBookings');
    if (result.netBookings.every(function (n) { return n === 0; })) {
      for (var i = 0; i < years; i++) result.netBookings[i] = result.bookingsUsd[i] - result.partnerIncentive[i];
    }
    result.keystoneServices = extractRow('keystoneServices');
    if (result.keystoneServices.every(function (n) { return n === 0; })) result.keystoneServices = [38437, 18957, 18957, 18957, 18957];
    result.slaCredits = extractRow('slaCredits');
    if (result.slaCredits.every(function (n) { return n === 0; })) result.slaCredits = [29693, 29693, 29693, 29693, 29693];
    return result;
  }

  function parseHardwareWorkbook(wb) {
    var sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return null;
    var data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    var result = { bomPerYear: 56685, discountRate: 26, discountAmount: 20000 };
    for (var r = 0; r < Math.min(data.length, 30); r++) {
      var row = data[r];
      if (!row || !row.length) continue;
      var label = String(row[0] || '').toLowerCase();
      var val = row[1];
      var num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
      if (isNaN(num)) continue;
      if (label.indexOf('bom') >= 0 || label.indexOf('bill of material') >= 0) result.bomPerYear = Math.round(num);
      else if (label.indexOf('discount rate') >= 0 || label.indexOf('discount %') >= 0) result.discountRate = Math.round(num);
      else if (label.indexOf('discount amount') >= 0 || label.indexOf('discount amt') >= 0) result.discountAmount = Math.round(num);
    }
    return result;
  }

  function buildDealDataFromParsed(subscription, hardware) {
    var years = subscription.bookingsUsd.length;
    if (years === 0) years = 5;
    var bom = hardware ? hardware.bomPerYear : 56685;
    var bomArr = [];
    for (var i = 0; i < years; i++) bomArr.push(bom);
    var dealValue = [];
    for (var j = 0; j < years; j++) {
      var net = subscription.netBookings[j] || 0;
      var cost = (subscription.partnerIncentive[j] || 0) + bomArr[j] + (subscription.keystoneServices[j] || 0) + (subscription.slaCredits[j] || 0);
      dealValue.push(Math.round(net - cost));
    }
    var grossMarginSlaPct = [];
    var grossMarginNoSlaPct = [];
    for (var k = 0; k < years; k++) {
      var dv = dealValue[k];
      var net = subscription.netBookings[k] || 1;
      var costWithSla = (subscription.partnerIncentive[k] || 0) + bomArr[k] + (subscription.keystoneServices[k] || 0) + (subscription.slaCredits[k] || 0);
      var costNoSla = (subscription.partnerIncentive[k] || 0) + bomArr[k] + (subscription.keystoneServices[k] || 0);
      grossMarginSlaPct.push(net ? Math.round((dv / (net - costWithSla + (subscription.slaCredits[k] || 0) + dv)) * 100) : 0);
      grossMarginNoSlaPct.push(net ? Math.round((dv / (net - costNoSla + dv)) * 100) : 0);
    }
    return {
      subscription: subscription,
      hardware: hardware || { bomPerYear: 56685, discountRate: 26, discountAmount: 20000 },
      contractLengthMonths: 60,
      billingFrequency: 'Annual',
      years: years,
      annualData: {
        bookingsLocal: subscription.bookingsLocal,
        bookingsUsd: subscription.bookingsUsd,
        partnerIncentive: subscription.partnerIncentive,
        netBookings: subscription.netBookings,
        bom: bomArr,
        keystoneServices: subscription.keystoneServices,
        slaCredits: subscription.slaCredits,
        dealValue: dealValue,
        grossMarginSlaPct: grossMarginSlaPct,
        grossMarginNoSlaPct: grossMarginNoSlaPct
      },
      defaults: {
        contractLength: Math.min(60, years * 12),
        slaCredits: subscription.slaCredits[0] || 26000,
        discountRate: hardware ? hardware.discountRate : 26,
        discountAmount: hardware ? hardware.discountAmount : 20000,
        grossMarginSla: grossMarginSlaPct[0] || 20,
        grossMarginNoSla: grossMarginNoSlaPct[0] || 20,
        breakEven: 8
      }
    };
  }

  function saveDealDataAndGo(data) {
    try {
      var params = new URLSearchParams(window.location.search || '');
      var quoteId = params.get('quote') || '123';
      var oppId = params.get('opportunity') || '';
      sessionStorage.setItem(DEAL_DATA_KEY, JSON.stringify(data));
      var map = getUploadMap();
      map[quoteId] = {
        quoteId: quoteId,
        opportunityId: oppId,
        subscriptionUploaded: !!uploadState.subscriptionData,
        hardwareUploaded: !!uploadState.hardwareData,
        subscriptionCodeName: uploadState.subscriptionFile ? uploadState.subscriptionFile.name : (uploadState.usedSample ? 'Sample subscription code' : ''),
        hardwareCodeName: uploadState.hardwareFile ? uploadState.hardwareFile.name : (uploadState.usedSample ? 'Sample hardware code' : ''),
        data: data,
        uploadedAt: new Date().toISOString(),
        assignedFor: 'sally',
        assignedTo: 'Derek Keller',
        status: 'Pending review',
        marginAnalysisCompleted: false
      };
      
      if (!map.__prototypeSeeded) {
        map.__prototypeSeeded = true;
        map['P-2001'] = {
          quoteId: 'P-2001',
          opportunityId: oppId || 'OPP-200',
          quoteName: 'Prototype Quote A',
          subscriptionUploaded: true,
          hardwareUploaded: true,
          subscriptionCodeName: 'subscription_quote_A.xlsx',
          hardwareCodeName: 'hardware_quote_A.xlsx',
          data: data,
          uploadedAt: new Date().toISOString(),
          assignedFor: 'sally',
          assignedTo: 'Derek Keller',
          status: 'Pending review'
        };
        map['P-2002'] = {
          quoteId: 'P-2002',
          opportunityId: oppId || 'OPP-200',
          quoteName: 'Prototype Quote B',
          subscriptionUploaded: true,
          hardwareUploaded: true,
          subscriptionCodeName: 'subscription_quote_B.xlsx',
          hardwareCodeName: 'hardware_quote_B.xlsx',
          data: data,
          uploadedAt: new Date().toISOString(),
          assignedFor: 'sally',
          assignedTo: 'Derek Keller',
          status: 'Pending review'
        };
      }
      sessionStorage.setItem(DEAL_UPLOADS_KEY, JSON.stringify(map));
      localStorage.setItem(DEAL_UPLOADS_KEY, JSON.stringify(map));
      window.location.href = 'index.html?uploaded=1&quote=' + encodeURIComponent(quoteId);
    } catch (e) {
      alert('Could not save data. Try again.');
    }
  }

  var uploadState = {
    subscriptionFile: null,
    hardwareFile: null,
    subscriptionData: null,
    hardwareData: null,
    usedSample: false
  };

  function setHint(id, text, type) {
    var el = getById(id);
    if (!el) return;
    el.textContent = text || '';
    el.className = 'upload-hint' + (type ? ' ' + type : '');
  }

  function setFileLabel(type, fileName) {
    var id = type === 'subscription' ? 'quotes-file-subscription' : 'quotes-file-hardware';
    var textId = type === 'subscription' ? 'quotes-text-subscription' : 'quotes-text-hardware';
    var zoneId = type === 'subscription' ? 'quotes-drop-subscription' : 'quotes-drop-hardware';
    var el = getById(id);
    var textEl = getById(textId);
    var zone = getById(zoneId);
    if (fileName) {
      if (el) el.textContent = fileName;
      if (zone) zone.classList.add('has-file');
      if (textEl) textEl.textContent = 'File selected';
    } else {
      if (el) el.textContent = '';
      if (zone) zone.classList.remove('has-file');
      if (textEl) textEl.textContent = 'Drag and drop or click to browse';
    }
  }

  function updateProcessButton() {
    var btn = getById('quotes-btn-process');
    if (btn) btn.disabled = !(uploadState.subscriptionData && uploadState.hardwareData);
  }

  function handleFile(type, file) {
    if (!file) return;
    var isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (!isExcel) {
      setHint('quotes-hint-' + type, 'Please upload an Excel file (.xlsx or .xls).', 'error');
      return;
    }
    setHint('quotes-hint-' + type, '');
    setFileLabel(type, file.name);
    if (type === 'subscription') uploadState.subscriptionFile = file;
    else uploadState.hardwareFile = file;

    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(e.target.result, { type: 'array' });
        if (type === 'subscription') {
          uploadState.subscriptionData = parseSubscriptionWorkbook(wb);
          setHint('quotes-hint-subscription', 'Subscription data parsed.', 'success');
        } else {
          uploadState.hardwareData = parseHardwareWorkbook(wb);
          setHint('quotes-hint-hardware', 'Hardware data parsed.', 'success');
        }
        updateProcessButton();
      } catch (err) {
        setHint('quotes-hint-' + type, 'Could not read file. Use sample data or try another file.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function setupDropZone(type) {
    var inputId = type === 'subscription' ? 'quotes-input-subscription' : 'quotes-input-hardware';
    var dropId = type === 'subscription' ? 'quotes-drop-subscription' : 'quotes-drop-hardware';
    var input = getById(inputId);
    var drop = getById(dropId);
    if (!input || !drop) return;

    drop.addEventListener('click', function () { input.click(); });
    drop.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.stopPropagation();
      drop.classList.add('drag-over');
    });
    drop.addEventListener('dragleave', function () { drop.classList.remove('drag-over'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault();
      e.stopPropagation();
      drop.classList.remove('drag-over');
      var file = e.dataTransfer && e.dataTransfer.files[0];
      if (file) handleFile(type, file);
    });
    drop.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (file) handleFile(type, file);
      input.value = '';
    });
  }

  function useSampleData() {
    var sample = getSampleDealData();
    uploadState.subscriptionData = sample.subscription;
    uploadState.hardwareData = sample.hardware;
    uploadState.usedSample = true;
    setFileLabel('subscription', 'Sample data');
    setFileLabel('hardware', 'Sample data');
    setHint('quotes-hint-subscription', 'Using sample subscription data.', 'success');
    setHint('quotes-hint-hardware', 'Using sample hardware data.', 'success');
    var d1 = getById('quotes-drop-subscription');
    var d2 = getById('quotes-drop-hardware');
    if (d1) d1.classList.add('has-file');
    if (d2) d2.classList.add('has-file');
    updateProcessButton();
  }

  function processAndGo() {
    var subscription = uploadState.subscriptionData;
    var hardware = uploadState.hardwareData;
    if (!subscription || !hardware) {
      alert('Please upload both subscription and hardware quotes before continuing.');
      return;
    }
    var dealData = buildDealDataFromParsed(subscription, hardware);
    saveDealDataAndGo(dealData);
  }

  function bindUploadLogic() {
    setupDropZone('subscription');
    setupDropZone('hardware');

    var btnSample = getById('quotes-btn-sample');
    if (btnSample) btnSample.addEventListener('click', useSampleData);

    var btnProcess = getById('quotes-btn-process');
    if (btnProcess) btnProcess.addEventListener('click', processAndGo);
  }

  // --- Init ---
  function init() {
    bindTabs();
    renderQuotesHeader();
    renderUploadedQuotesRows();
    updateStatCards();
    updateDealMarginNavLink();
    bindDealMarginButtons();
    applyUploadStatusToRows();
    var params = new URLSearchParams(window.location.search || '');
    var requestedTab = params.get('tab');
    var requestedQuote = params.get('quote');
    var allowed = { all: true, 'pending-review': true, 'pending-updates': true, rejected: true, 'requested-updates': true, reviewed: true };
    var tabKey = allowed[requestedTab] ? requestedTab : 'all';
    var targetTab = document.querySelector('.quotes-tab[data-tab="' + tabKey + '"]');
    if (targetTab) targetTab.click();
    else filterTableByTab(tabKey);
    focusQuoteRow(requestedQuote);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
