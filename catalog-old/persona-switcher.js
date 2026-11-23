(function () {
  'use strict';

  var STORAGE_KEY = 'appPersona';
  var PERSONAS = {
    sales: {
      label: 'Chris Collins (Sales)',
      allowedPages: ['create-opportunity.html', 'sizing.html', 'sales-dashboard.html'],
      defaultPage: 'sales-dashboard.html',
      allowedNavHrefs: ['create-opportunity.html', 'sizing.html', 'sales-dashboard.html']
    },
    'deal-desk': {
      label: 'Laura Ramirez (Deal Desk)',
      allowedPages: ['index.html', 'margin-analysis.html'],
      defaultPage: 'index.html',
      allowedNavHrefs: ['index.html', 'margin-analysis.html']
    },
    customer: {
      label: 'AUMOVIO Germany GmbH (Customer)',
      allowedPages: ['customer-sizing.html'],
      defaultPage: 'customer-sizing.html',
      allowedNavHrefs: ['customer-sizing.html']
    }
  };
  var FULL_FLOW_STEPS = [
    { href: 'create-opportunity.html', label: 'Create an opportunity' },
    { href: 'sizing.html', label: 'Create a quote' },
    { href: 'deviations.html', label: 'Apply feature request' },
    { href: 'index.html', label: 'Deal approval' },
    { href: '#', label: 'Site readiness' },
    { href: '#', label: 'Activate subscription' }
  ];

  function getCurrentPage() {
    var path = (window.location.pathname || '').split('/');
    return path[path.length - 1] || 'index.html';
  }

  function getPersona() {
    var stored = '';
    try { stored = localStorage.getItem(STORAGE_KEY) || ''; } catch (e) {}
    if (PERSONAS[stored]) return stored;
    var page = getCurrentPage();
    if (PERSONAS['deal-desk'].allowedPages.indexOf(page) !== -1) return 'deal-desk';
    if (PERSONAS['customer'].allowedPages.indexOf(page) !== -1) return 'customer';
    return 'sales';
  }

  function setPersona(persona) {
    if (!PERSONAS[persona]) return;
    try { localStorage.setItem(STORAGE_KEY, persona); } catch (e) {}
  }

  function ensureAllowedPage(persona) {
    var cfg = PERSONAS[persona];
    if (!cfg) return;
    var page = getCurrentPage();
    if (cfg.allowedPages.indexOf(page) !== -1) return;
    window.location.href = cfg.defaultPage;
  }

  function applyNavVisibility(persona) {
    var cfg = PERSONAS[persona];
    if (!cfg) return;
    document.querySelectorAll('.nav-list .nav-link').forEach(function (a) {
      var href = (a.getAttribute('href') || '').trim();
      if (!href || href === '#') {
        a.parentElement.style.display = 'none';
        return;
      }
      var base = href.split('?')[0];
      a.parentElement.style.display = cfg.allowedNavHrefs.indexOf(base) !== -1 ? '' : 'none';
    });
  }

  function applyProgressExperience(persona) {
    var wrap = document.querySelector('.progress-strip .progress-steps');
    if (!wrap) return;
    var page = getCurrentPage();
    var mode = '';
    try { mode = localStorage.getItem('progressExperienceMode') || ''; } catch (e) {}
    var salesSteps = [
      { href: 'create-opportunity.html', label: 'Create an opportunity' },
      { href: 'sizing.html', label: 'Create a quote' },
      { href: 'sales-dashboard.html', label: 'Sales dashboard' }
    ];
    var deskSteps = [
      { href: 'index.html', label: 'Deal dashboard' },
      { href: 'margin-analysis.html', label: 'Deal margin analysis' }
    ];
    var steps = mode === 'full' ? FULL_FLOW_STEPS : (persona === 'deal-desk' ? deskSteps : salesSteps);
    var activeIdx = 0;
    steps.forEach(function (s, i) {
      if (s.href === page) activeIdx = i;
    });
    wrap.innerHTML = steps.map(function (s, i) {
      var cls = i < activeIdx ? 'step completed' : (i === activeIdx ? 'step active' : 'step');
      var icon = i < activeIdx ? '✓' : String(i + 1);
      return '<a href="' + s.href + '" class="' + cls + '">' +
        '<span class="step-icon">' + icon + '</span>' +
        '<span class="step-label">' + s.label + '</span>' +
      '</a>';
    }).join('');
    wrap.style.justifyContent = 'center';
    wrap.querySelectorAll('.step').forEach(function (el) {
      el.style.justifyContent = 'center';
      el.style.textAlign = 'center';
    });
  }

  function mountPersonaSwitcher(persona) {
    var headerPersona = document.querySelector('.header-persona');
    if (!headerPersona) return;
    var cfg = PERSONAS[persona];
    if (!cfg) return;

    headerPersona.innerHTML =
      '<span class="header-persona-label">Logged in as</span>' +
      '<span class="header-persona-value">' + cfg.label + '</span>';

    var select = document.createElement('select');
    select.className = 'header-persona-select';
    select.setAttribute('aria-label', 'Switch persona');
    select.innerHTML =
      '<option value="sales">Chris Collins (Sales)</option>' +
      '<option value="deal-desk">Laura Ramirez (Deal Desk)</option>' +
      '<option value="customer">AUMOVIO Germany GmbH (Customer)</option>';
    select.value = persona;
    select.addEventListener('change', function () {
      var nextPersona = select.value;
      setPersona(nextPersona);
      var nextCfg = PERSONAS[nextPersona];
      var currentPage = getCurrentPage();
      if (!nextCfg || nextCfg.allowedPages.indexOf(currentPage) === -1) {
        window.location.href = nextCfg ? nextCfg.defaultPage : 'index.html';
        return;
      }
      window.location.reload();
    });
    headerPersona.appendChild(select);
  }

  function parseQueryParam(name) {
    try {
      var params = new URLSearchParams(window.location.search || '');
      return params.get(name);
    } catch (e) {
      return null;
    }
  }

  function getUploadMap() {
    try {
      var raw = sessionStorage.getItem('dealMarginUploadsByQuote') || localStorage.getItem('dealMarginUploadsByQuote');
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function getOpportunityProfile(oppId) {
    if (!oppId) return null;
    try {
      var raw = sessionStorage.getItem('opportunityProfile_' + oppId) || localStorage.getItem('opportunityProfile_' + oppId);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function resolveActiveOpportunityId() {
    var oppId = parseQueryParam('opportunity');
    var quoteId = parseQueryParam('quote');
    if (!oppId && quoteId) {
      try {
        var map = getUploadMap();
        var rec = map && map[quoteId];
        if (rec && rec.opportunityId && rec.opportunityId !== '—') oppId = rec.opportunityId;
      } catch (e) {}
    }
    if (!oppId && quoteId) {
      try {
        var sizingRaw = sessionStorage.getItem('sizingQuoteState_' + quoteId) || localStorage.getItem('sizingQuoteState_' + quoteId);
        if (sizingRaw) {
          var sizingState = JSON.parse(sizingRaw);
          if (sizingState && sizingState.opportunityId) oppId = sizingState.opportunityId;
        }
      } catch (e2) {}
    }
    if (!oppId) {
      try { oppId = sessionStorage.getItem('sizingLastOpportunityId') || oppId; } catch (e3) {}
    }
    return oppId || null;
  }

  function applyOpportunityContext() {
    var oppId = resolveActiveOpportunityId();
    if (!oppId) return;
    var profile = getOpportunityProfile(oppId);
    var oppName = profile && profile.opportunityName ? String(profile.opportunityName) : '';

    var metaOppId = document.getElementById('meta-opportunity-id');
    if (metaOppId) metaOppId.textContent = oppId;

    var metaOppName = document.getElementById('meta-opportunity-name');
    if (metaOppName && oppName) metaOppName.textContent = oppName;

    var dealEconomicsOppId = document.getElementById('deal-economics-opportunity-id');
    if (dealEconomicsOppId) dealEconomicsOppId.textContent = oppId;
    var dealEconomicsOppWrap = document.getElementById('deal-economics-opportunity-id-wrap');
    if (dealEconomicsOppWrap && oppName) {
      dealEconomicsOppWrap.setAttribute('title', oppName);
    }

    // Keep opportunity context in navigation links where applicable.
    document.querySelectorAll('a.nav-link[href]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (!href || href === '#' || href.indexOf('http') === 0) return;
      var base = href.split('?')[0];
      if (!/^(create-opportunity|sizing|deviations|sales-dashboard|index|margin-analysis)\.html$/.test(base)) return;
      try {
        var url = new URL(base, window.location.origin);
        url.searchParams.set('opportunity', oppId);
        a.setAttribute('href', url.pathname.split('/').pop() + url.search);
      } catch (e) {}
    });
  }

  function init() {
    var persona = getPersona();
    mountPersonaSwitcher(persona);
    applyNavVisibility(persona);
    applyProgressExperience(persona);
    applyOpportunityContext();
    ensureAllowedPage(persona);
  }

  // Keep a reusable switch so full flow can be restored anywhere later.
  window.setProgressExperienceMode = function (mode) {
    try {
      if (mode === 'full' || mode === 'persona') localStorage.setItem('progressExperienceMode', mode);
    } catch (e) {}
    window.location.reload();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
