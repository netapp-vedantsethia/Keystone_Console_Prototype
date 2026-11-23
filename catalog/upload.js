(function () {
  'use strict';

  var DEAL_DATA_KEY = 'dealMarginUploadData';

  /** Sample deal data matching the existing margin-analysis defaults */
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

  /**
   * Parse subscription Excel: expect first sheet, rows with numeric data.
   * Look for columns that might be Year 1..5 or a single value column.
   */
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
    var rowMap = {}; // label -> row index
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

  /**
   * Parse hardware Excel: look for BOM, discount rate, discount amount.
   */
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
      var raw = sessionStorage.getItem('dealMarginUploadsByQuote') || localStorage.getItem('dealMarginUploadsByQuote');
      var map = raw ? JSON.parse(raw) : {};
      map[quoteId] = {
        quoteId: quoteId,
        quoteName: 'Quote ' + quoteId,
        opportunityId: oppId || '3876523',
        customerName: 'AUMOVIO Germany GmbH',
        subscriptionUploaded: !!state.subscriptionData,
        hardwareUploaded: !!state.hardwareData,
        subscriptionCodeName: state.subscriptionFile ? state.subscriptionFile.name : (state.usedSample ? 'Sample subscription code' : ''),
        hardwareCodeName: state.hardwareFile ? state.hardwareFile.name : (state.usedSample ? 'Sample hardware code' : ''),
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
          opportunityId: oppId || '3876523',
          customerName: 'AUMOVIO Germany GmbH',
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
          opportunityId: oppId || '3876523',
          customerName: 'AUMOVIO Germany GmbH',
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
      sessionStorage.setItem('dealMarginUploadsByQuote', JSON.stringify(map));
      localStorage.setItem('dealMarginUploadsByQuote', JSON.stringify(map));
      var base = window.location.href.replace(/[^/]*$/, '');
      window.location.href = base + 'index.html?uploaded=1&quote=' + encodeURIComponent(quoteId);
    } catch (e) {
      alert('Could not save data. Try again.');
    }
  }

  var state = {
    subscriptionFile: null,
    hardwareFile: null,
    subscriptionData: null,
    hardwareData: null
  };

  function setHint(id, text, type) {
    var el = document.getElementById(id);
        if (!el) return;
    el.textContent = text || '';
    el.className = 'upload-hint' + (type ? ' ' + type : '');
  }

  function setFileLabel(type, fileName) {
    var id = type === 'subscription' ? 'file-subscription' : 'file-hardware';
    var textId = type === 'subscription' ? 'text-subscription' : 'text-hardware';
    var zoneId = type === 'subscription' ? 'drop-subscription' : 'drop-hardware';
    var el = document.getElementById(id);
    var textEl = document.getElementById(textId);
    var zone = document.getElementById(zoneId);
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
    var btn = document.getElementById('btn-process');
    if (!btn) return;
    btn.disabled = !(state.subscriptionData && state.hardwareData);
  }

  function handleFile(type, file) {
    if (!file) return;
    var isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (!isExcel) {
      setHint('hint-' + type, 'Please upload an Excel file (.xlsx or .xls).', 'error');
      return;
    }
    setHint('hint-' + type, '');
    setFileLabel(type, file.name);
    if (type === 'subscription') state.subscriptionFile = file;
    else state.hardwareFile = file;

    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(e.target.result, { type: 'array' });
        if (type === 'subscription') {
          state.subscriptionData = parseSubscriptionWorkbook(wb);
          setHint('hint-subscription', 'Subscription data parsed.', 'success');
        } else {
          state.hardwareData = parseHardwareWorkbook(wb);
          setHint('hint-hardware', 'Hardware data parsed.', 'success');
        }
        updateProcessButton();
      } catch (err) {
        setHint('hint-' + type, 'Could not read file. Use sample data or try another file.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function setupDropZone(type) {
    var inputId = type === 'subscription' ? 'input-subscription' : 'input-hardware';
    var dropId = type === 'subscription' ? 'drop-subscription' : 'drop-hardware';
    var input = document.getElementById(inputId);
    var drop = document.getElementById(dropId);
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
    state.subscriptionData = sample.subscription;
    state.hardwareData = sample.hardware;
    state.usedSample = true;
    setFileLabel('subscription', 'Sample data');
    setFileLabel('hardware', 'Sample data');
    setHint('hint-subscription', 'Using sample subscription data.', 'success');
    setHint('hint-hardware', 'Using sample hardware data.', 'success');
    document.getElementById('drop-subscription').classList.add('has-file');
    document.getElementById('drop-hardware').classList.add('has-file');
    updateProcessButton();
  }

  function processAndGo() {
    var subscription = state.subscriptionData;
    var hardware = state.hardwareData;
    if (!subscription || !hardware) {
      alert('Please upload both subscription and hardware quotes before continuing.');
      return;
    }
    var dealData = buildDealDataFromParsed(subscription, hardware);
    saveDealDataAndGo(dealData);
  }

  function openModal() {
    document.getElementById('modal-mapping').classList.add('visible');
    document.getElementById('modal-mapping').setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    document.getElementById('modal-mapping').classList.remove('visible');
    document.getElementById('modal-mapping').setAttribute('aria-hidden', 'true');
  }

  function init() {
    setupDropZone('subscription');
    setupDropZone('hardware');

    var btnSample = document.getElementById('btn-sample-data');
    if (btnSample) btnSample.addEventListener('click', useSampleData);

    var btnProcess = document.getElementById('btn-process');
    if (btnProcess) btnProcess.addEventListener('click', function () {
      processAndGo();
    });

    var modalClose = document.getElementById('modal-close');
    var modalCancel = document.getElementById('modal-cancel');
    var modalConfirm = document.getElementById('modal-confirm');
    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modalCancel) modalCancel.addEventListener('click', closeModal);
    if (modalConfirm) modalConfirm.addEventListener('click', function () {
      closeModal();
      processAndGo();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
