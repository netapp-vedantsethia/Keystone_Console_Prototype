(function () {
  'use strict';

  var SELECTED_TYPE = 'config'; // config | margin | legal
  var returnUrl = null;

  function getById(id) {
    return document.getElementById(id);
  }

  function initReturnUrl() {
    var params = new URLSearchParams(window.location.search);
    var urlFromQuery = params.get('returnUrl');
    if (urlFromQuery) {
      returnUrl = urlFromQuery;
    } else {
      try {
        returnUrl = sessionStorage.getItem('sizingReturnUrl');
      } catch (e) {}
    }
    var wrap = getById('deviations-return-wrap');
    var link = getById('deviations-return-link');
    if (returnUrl && wrap && link) {
      wrap.hidden = false;
      link.href = returnUrl;
      link.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = returnUrl;
      });
    }
  }

  function redirectToQuoteAfterSubmit(deviationLabel, deviationValue) {
    try {
      if (deviationLabel) sessionStorage.setItem('deviationRequestAdded', deviationLabel);
      if (deviationValue) sessionStorage.setItem('deviationRequestValue', deviationValue);
    } catch (e) {}
    if (returnUrl) {
      window.location.replace(returnUrl);
    } else {
      try {
        var fromStorage = sessionStorage.getItem('sizingReturnUrl');
        if (fromStorage) window.location.replace(fromStorage);
      } catch (e2) {}
    }
  }

  function getSelectedDeviationType() {
    var r = document.querySelector('input[name="deviation-type"]:checked');
    return (r && r.value) ? r.value : 'config';
  }

  function applyTypeFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var type = params.get('type');
    if (type === 'config' || type === 'margin' || type === 'legal') {
      var radio = document.querySelector('input[name="deviation-type"][value="' + type + '"]');
      if (radio) {
        radio.checked = true;
        SELECTED_TYPE = type;
      }
    }
    var opp = params.get('opportunity');
    var quote = params.get('quote');
    if (opp && getById('existing-opportunity-id')) getById('existing-opportunity-id').value = opp;
    if (quote && getById('existing-quote-ids-list')) {
      var first = getById('existing-quote-ids-list').querySelector('input[name="quote_id"]');
      if (first) first.value = quote;
    }
  }

  function updateUiForType() {
    SELECTED_TYPE = getSelectedDeviationType();
    var wrapApplyTo = getById('wrap-apply-to');
    var noteMargin = getById('note-margin-impact');
    var hint = getById('deviation-type-hint');
    var select = getById('requested-deviation');

    if (wrapApplyTo) {
      wrapApplyTo.setAttribute('aria-hidden', SELECTED_TYPE === 'config' ? 'false' : 'true');
      wrapApplyTo.style.display = SELECTED_TYPE === 'config' ? '' : 'none';
    }
    if (noteMargin) {
      var showNote = SELECTED_TYPE === 'margin';
      if (select && select.value) {
        var opt = select.selectedOptions[0];
        if (opt && opt.getAttribute('data-type') === 'margin') showNote = true;
      }
      noteMargin.setAttribute('aria-hidden', showNote ? 'false' : 'true');
      noteMargin.style.display = showNote ? '' : 'none';
    }
    if (hint) {
      if (SELECTED_TYPE === 'config') hint.textContent = 'You can apply this to one quote or multiple quotes below.';
      else if (SELECTED_TYPE === 'margin') hint.textContent = 'This type affects how deal margin is calculated.';
      else if (SELECTED_TYPE === 'legal') hint.textContent = 'Legal language only — no configuration or pricing changes.';
      else hint.textContent = '';
    }
    filterDeviationSelect();
  }

  function filterDeviationSelect() {
    var select = getById('requested-deviation');
    var note = getById('note-margin-impact');
    if (!select || !note) return;
    var opt = select.selectedOptions[0];
    var optType = (opt && opt.getAttribute('data-type')) || '';
    var showNote = SELECTED_TYPE === 'margin' || optType === 'margin';
    note.setAttribute('aria-hidden', showNote ? 'false' : 'true');
    note.style.display = showNote ? '' : 'none';
  }

  function generateRequestId() {
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var d = String(now.getDate()).padStart(2, '0');
    var r = Math.floor(Math.random() * 10000);
    return 'REQ-' + y + m + d + '-' + String(r).padStart(4, '0');
  }

  function initDeviationType() {
    var options = document.querySelectorAll('input[name="deviation-type"]');
    options.forEach(function (radio) {
      radio.addEventListener('change', updateUiForType);
    });
    getById('requested-deviation').addEventListener('change', updateUiForType);
    applyTypeFromUrl();
    updateUiForType();
  }

  function initChoice() {
    var existing = document.querySelector('input[name="deviations-type"][value="existing"]');
    var newType = document.querySelector('input[name="deviations-type"][value="new"]');
    var panelExisting = getById('panel-existing');
    var panelNew = getById('panel-new');

    function showPanel(value) {
      if (value === 'existing') {
        if (panelExisting) {
          panelExisting.classList.remove('deviations-panel-hidden');
          panelExisting.setAttribute('aria-hidden', 'false');
        }
        if (panelNew) {
          panelNew.classList.add('deviations-panel-hidden');
          panelNew.setAttribute('aria-hidden', 'true');
        }
      } else {
        if (panelExisting) {
          panelExisting.classList.add('deviations-panel-hidden');
          panelExisting.setAttribute('aria-hidden', 'true');
        }
        if (panelNew) {
          panelNew.classList.remove('deviations-panel-hidden');
          panelNew.setAttribute('aria-hidden', 'false');
        }
      }
    }

    if (existing) existing.addEventListener('change', function () { showPanel('existing'); });
    if (newType) newType.addEventListener('change', function () { showPanel('new'); });
    showPanel('existing');
  }

  function initRequestId() {
    var el = getById('request-id');
    if (el) el.value = generateRequestId();
  }

  function initQuoteIds() {
    var list = getById('existing-quote-ids-list');
    var addBtn = getById('btn-add-quote');
    if (!list || !addBtn) return;

    function createQuoteRow() {
      var row = document.createElement('div');
      row.className = 'deviations-quote-id-row';
      row.innerHTML = '<input type="text" name="quote_id" class="deviation-request-input" placeholder="Quote ID" aria-label="Quote ID">' +
        '<button type="button" class="deviations-quote-remove" aria-label="Remove quote" title="Remove quote">×</button>';
      return row;
    }

    addBtn.addEventListener('click', function () {
      list.appendChild(createQuoteRow());
    });

    list.addEventListener('click', function (e) {
      if (e.target.classList.contains('deviations-quote-remove') && list.querySelectorAll('.deviations-quote-id-row').length > 1) {
        e.target.closest('.deviations-quote-id-row').remove();
      }
    });
  }

  function initFormExisting() {
    var form = getById('form-existing');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var deviationSelect = getById('requested-deviation');
      if (!deviationSelect || !deviationSelect.value) {
        alert('Please select a requested feature request.');
        return;
      }
      var reqId = (getById('request-id') || {}).value || '';
      var oppId = (getById('existing-opportunity-id') || {}).value || '';
      var quoteInputs = form.querySelectorAll('input[name="quote_id"]');
      var quoteIds = [];
      for (var i = 0; i < quoteInputs.length; i++) {
        var v = (quoteInputs[i].value || '').trim();
        if (v) quoteIds.push(v);
      }
      var option = deviationSelect.selectedOptions[0];
      var deviationText = option ? option.text : '';
      var deviationValue = deviationSelect.value || '';
      var msg = 'Request submitted.\nRequest ID: ' + reqId + '\nFeature request: ' + deviationText;
      if (oppId) msg += '\nOpportunity ID: ' + oppId;
      if (quoteIds.length) msg += '\nQuote ID(s): ' + quoteIds.join(', ');
      alert(msg);
      redirectToQuoteAfterSubmit(deviationText, deviationValue);
    });
  }

  function initFormNew() {
    var form = getById('form-new');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      alert('New feature request submitted. In production this would send to your backend or Smartsheet.');
      redirectToQuoteAfterSubmit('New feature request requested', '');
    });
  }

  function initFileDrop() {
    var dropZone = getById('deviation-drop-zone');
    var fileInput = getById('deviation-files');
    var browseBtn = getById('deviation-browse');
    var fileNames = getById('deviation-file-names');

    if (browseBtn && fileInput) {
      browseBtn.addEventListener('click', function () { fileInput.click(); });
    }
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', function (e) {
        if (e.target !== browseBtn) fileInput.click();
      });
      dropZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
      });
      dropZone.addEventListener('dragleave', function () {
        dropZone.classList.remove('drag-over');
      });
      dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          fileInput.files = e.dataTransfer.files;
          updateFileNames();
        }
      });
    }
    if (fileInput) fileInput.addEventListener('change', updateFileNames);

    function updateFileNames() {
      if (!fileNames || !fileInput || !fileInput.files) return;
      var names = [];
      for (var i = 0; i < fileInput.files.length; i++) names.push(fileInput.files[i].name);
      fileNames.textContent = names.length ? names.join(', ') : '';
    }
  }

  function init() {
    initReturnUrl();
    initDeviationType();
    initChoice();
    initRequestId();
    initQuoteIds();
    initFormExisting();
    initFormNew();
    initFileDrop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
