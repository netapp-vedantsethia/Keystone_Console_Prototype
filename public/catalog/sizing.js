(function () {
  'use strict';

  var MAX_SPECIFIC_WORKLOADS = 5;
  var ENABLE_SIZING_DRAFT_PERSISTENCE = false;
  var quoteItems = [];
  var workloadConfigs = {};
  var previousContractLengthValue = '3';
  var customContractLength = null;
  var currentQuoteId = '42001';
  var currentOpportunityId = '3876523';
  var QUOTE_IDS = [];
  var customContractByQuote = {};

  function getQuoteStorageKey(quoteId) {
    return 'sizingQuoteState_' + (quoteId || currentQuoteId);
  }
  function getOpportunityQuotesKey(oppId) {
    return 'sizingQuotes_' + (oppId || currentOpportunityId);
  }
  function getDraftQuoteKey(oppId) {
    return 'sizingDraftQuote_' + (oppId || currentOpportunityId);
  }
  function getQuoteNamesKey(oppId) {
    return 'sizingQuoteNames_' + (oppId || currentOpportunityId);
  }
  function getOpportunityProfileKey(oppId) {
    return 'opportunityProfile_' + (oppId || currentOpportunityId);
  }
  var DEFAULT_OPPORTUNITY_PROFILE = Object.freeze({
    opportunityId:   '3876523',
    opportunityName: 'Enterprise Multi-Area',
    customerName:    'AUMOVIO Germany GmbH',
    customerPhone:   '+1 (604) 555-0147',
    customerAddress: '1095 West Pender Street, Suite 2100\nVancouver, BC  V6E 2M6\nCanada',
    partnerName:     'Not applicable',
    distributorName: 'Not applicable',
    salesMotion:     'Direct',
    keystoneVersion: '3.0',
    siteName:        'Dallas_FW'
  });

  function getOpportunityProfile(oppId) {
    try {
      var key = getOpportunityProfileKey(oppId);
      var raw = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (!raw) return DEFAULT_OPPORTUNITY_PROFILE;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return DEFAULT_OPPORTUNITY_PROFILE;
      // Merge stored values over defaults so any saved field takes precedence
      return Object.assign({}, DEFAULT_OPPORTUNITY_PROFILE, parsed);
    } catch (e) {
      return DEFAULT_OPPORTUNITY_PROFILE;
    }
  }
  function getQuoteNamesForOpportunity(oppId) {
    try {
      // localStorage fallback: a request raised in the Console lands in another tab's session.
      var raw = sessionStorage.getItem(getQuoteNamesKey(oppId)) || localStorage.getItem(getQuoteNamesKey(oppId));
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }
  function saveQuoteNamesForOpportunity(oppId, names) {
    try {
      sessionStorage.setItem(getQuoteNamesKey(oppId), JSON.stringify(names || {}));
    } catch (e) {}
  }
  function getQuoteDisplayName(quoteId, oppId) {
    var names = getQuoteNamesForOpportunity(oppId);
    var name = names && names[quoteId];
    return name ? String(name) : ('Quote ' + quoteId);
  }
  function setQuoteDisplayName(quoteId, name, oppId) {
    var names = getQuoteNamesForOpportunity(oppId);
    if (!name) delete names[quoteId];
    else names[quoteId] = name;
    saveQuoteNamesForOpportunity(oppId, names);
  }
  function getQuotesForOpportunity(oppId) {
    try {
      var raw = sessionStorage.getItem(getOpportunityQuotesKey(oppId)) || localStorage.getItem(getOpportunityQuotesKey(oppId));
      if (!raw) return [];
      var list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }
  function addQuoteToOpportunity(oppId, quoteId) {
    var list = getQuotesForOpportunity(oppId);
    if (list.indexOf(quoteId) === -1) list.push(quoteId);
    sessionStorage.setItem(getOpportunityQuotesKey(oppId), JSON.stringify(list));
  }
  function removeQuoteFromOpportunity(oppId, quoteId) {
    var list = getQuotesForOpportunity(oppId).filter(function (id) { return id !== quoteId; });
    sessionStorage.setItem(getOpportunityQuotesKey(oppId), JSON.stringify(list));
  }
  function ensureQuoteIdInMaps(quoteId) {
    if (customContractByQuote[quoteId] === undefined) customContractByQuote[quoteId] = null;
    if (customBillingByQuote[quoteId] === undefined) customBillingByQuote[quoteId] = null;
    if (burstByQuote[quoteId] === undefined) burstByQuote[quoteId] = null;
    var exists = QUOTE_IDS.some(function (q) { return q.id === quoteId; });
    if (!exists) QUOTE_IDS.push({ id: quoteId, label: 'Quote ' + quoteId });
  }
  function nextQuoteIdForOpportunity(oppId) {
    var list = getQuotesForOpportunity(oppId);
    var max = 0;
    list.forEach(function (id) {
      var n = parseInt(id, 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return String(max + 1);
  }

  function getActiveQuotesForCurrentOpportunity() {
    var list = getQuotesForOpportunity(currentOpportunityId);
    if (list.indexOf(currentQuoteId) === -1) list = [currentQuoteId].concat(list);
    var uniq = list.filter(function (id, i) { return list.indexOf(id) === i; });
    return uniq.map(function (id) {
      return { id: id, label: getQuoteDisplayName(id, currentOpportunityId) };
    });
  }
  var previousBillingFrequencyValue = 'annually';
  var customBilling = null;
  var customBillingByQuote = {};
  (function () { QUOTE_IDS.forEach(function (q) { customBillingByQuote[q.id] = null; }); })();
  var previousBurstValue = '';
  var burstByQuote = {};
  var customBurstModalForPlanId = null;
  (function () { QUOTE_IDS.forEach(function (q) { burstByQuote[q.id] = null; }); })();
  /* Plan metadata from Keystone STaaS Service Description 3.x and product docs. */
  var PLAN_OPTIONS = [
    { id: 'value', name: 'Value', cost: 28000, family: 'Unified', minCapacityTiB: 100, maxIops: null, latencyTargetMs: null, maxGbps: null, hardwareSeries: ['FAS'], details: 'Unified performance service level for latency-insensitive and secondary workloads.', includes: ['Common fit for backup, archive, and capacity-oriented datasets', 'Unified Keystone subscription model with plan-level add-on compatibility', 'Designed for large scale data where ultra-low latency is not required'], protocols: ['FC', 'iSCSI', 'NFS', 'NFSv4/RDMA', 'NVMe/FC', 'NVMe/TCP', 'SMB', 'S3'], hidden: true },
    { id: 'standard', name: 'Standard', cost: 52000, family: 'Unified', minCapacityTiB: 100, maxIops: 500000, latencyTargetMs: 4, maxGbps: 20, hardwareSeries: ['AFF C-Series'], details: 'Unified balanced performance service level for general enterprise workloads.', includes: ['Balanced profile for file, block, and mixed protocol workloads', 'Suitable for general-purpose databases, application servers, and VM estates', 'Supports standard Keystone operational and add-on capabilities'], protocols: ['FC', 'iSCSI', 'NFS', 'NFSv4/RDMA', 'NVMe/FC', 'NVMe/TCP', 'SMB', 'S3'] },
    { id: 'premium', name: 'Premium', cost: 89000, family: 'Unified', minCapacityTiB: 50, maxIops: 550000, latencyTargetMs: 1, maxGbps: 20, hardwareSeries: ['AFF A-Series'], details: 'Unified high-performance service level for business-critical workloads.', includes: ['Low-latency profile for demanding transactional and analytics workloads', 'Good fit for OLTP, analytics, and high-performance mixed protocol usage', 'Includes full unified protocol support and Keystone add-on compatibility'], protocols: ['FC', 'iSCSI', 'NFS', 'NFSv4/RDMA', 'NVMe/FC', 'NVMe/TCP', 'SMB', 'S3'] },
    { id: 'unified-extreme', name: 'Unified extreme', cost: 164700, family: 'Unified', minCapacityTiB: 50, maxIops: 1000000, latencyTargetMs: 1, maxGbps: 40, hardwareSeries: ['AFF A-Series (high-end)'], details: 'Top-tier unified performance service level for mission-critical workloads.', includes: ['Highest unified performance band for AI/ML, HPC, and ultra-demanding databases', 'Optimized for high throughput and very high IOPS with low latency targets', 'Designed for workloads requiring maximum scalability and performance headroom'], protocols: ['FC', 'iSCSI', 'NFS', 'NFSv4/RDMA', 'NVMe/FC', 'NVMe/TCP', 'SMB', 'S3'] },
    { id: 'block-optimized-premium', name: 'Block optimized premium', cost: 92000, family: 'Block optimized', minCapacityTiB: 50, maxIops: 450000, latencyTargetMs: 1, maxGbps: 25, hardwareSeries: ['ASA A-Series'], details: 'Block-optimized premium level for low latency enterprise block workloads.', includes: ['Focused on block-centric application profiles and database workloads', 'Supports lower latency requirements with strong block throughput', 'Appropriate where block efficiency is prioritized over broad unified protocol scope'], protocols: ['NVMe/TCP', 'NVMe/FC', 'FC', 'iSCSI'], hidden: true },
    { id: 'block-optimized-extreme', name: 'Block optimized extreme', cost: 108000, family: 'Block optimized', minCapacityTiB: 50, maxIops: 850000, latencyTargetMs: 1, maxGbps: 65, hardwareSeries: ['ASA A-Series (high-end)'], details: 'Top block-optimized level for highest IOPS and throughput requirements.', includes: ['Best fit for ultra-demanding block database and transactional tiers', 'Combines high IOPS and throughput with low-latency targets', 'Designed for enterprise block workloads requiring maximum sustained performance'], protocols: ['NVMe/TCP', 'NVMe/FC', 'FC', 'iSCSI'], hidden: true },
    { id: 'object-standard', name: 'Object standard', cost: 26000, family: 'Object', minCapacityTiB: 200, maxIops: null, latencyTargetMs: null, maxGbps: null, hardwareSeries: ['SGF6112'], details: 'Object service level for scalable unstructured data use cases.', includes: ['Capacity-led object profile for data lakes and modern app object stores', 'Useful for active object repositories and large-scale unstructured growth', 'Integrated into Keystone subscription planning for object deployments'], protocols: ['S3'], hidden: true },
    { id: 'object-value', name: 'Object value', cost: 22000, family: 'Object', minCapacityTiB: 500, maxIops: null, latencyTargetMs: null, maxGbps: null, hardwareSeries: ['SG6160'], details: 'Economical object service level for very large capacity footprints.', includes: ['Optimized for very large object datasets and cost-sensitive growth', 'Good fit for long-retention or archive-adjacent object repositories', 'Capacity-oriented recommendation path in this sizing experience'], protocols: ['S3'], hidden: true }
  ].filter(function (p) { return !p.hidden; });

  function getPlanByName(planName) {
    return PLAN_OPTIONS.filter(function (p) { return p.name === planName; })[0] || null;
  }

  /** Example workloads from service table: Extreme (AI/ML, HPC, InMem DB), Premium (Analytics, EDA, OLTP + Block), Standard (OLAP, IoT, Containers), Value (Backup, Archive). */
  var WORKLOAD_TO_PLAN = {
    'ai-ml': 'unified-extreme',
    'hpc': 'unified-extreme',
    'inmem-db': 'unified-extreme',
    'analytics': 'premium',
    'eda': 'premium',
    'oltp': 'premium',
    'olap': 'standard',
    'iot': 'standard',
    'containers': 'standard',
    'backup': 'value',
    'archive': 'value',
    'sap-hana': 'block-optimized-premium',
    'oracle': 'block-optimized-premium',
    'mssql': 'block-optimized-premium',
    'epic': 'block-optimized-premium',
    'standard': 'standard',
    'business': 'premium',
    'mission': 'unified-extreme',
    'mission-critical': 'unified-extreme',
    'general-purpose': 'standard',
    'secondary': 'value'
  };
  var GENERAL_WORKLOAD_IDS = {
    'standard': true,
    'business': true,
    'mission': true,
    'mission-critical': true,
    'general-purpose': true,
    'secondary': true
  };

  function getGeneralLatencyBandMatch(workloadId, plan) {
    if (!workloadId || !GENERAL_WORKLOAD_IDS[workloadId] || !plan) return false;
    if (workloadId === 'mission-critical' || workloadId === 'mission') {
      return plan.latencyTargetMs != null && plan.latencyTargetMs <= 1;
    }
    if (workloadId === 'general-purpose' || workloadId === 'standard' || workloadId === 'business') {
      return plan.latencyTargetMs != null && plan.latencyTargetMs >= 2 && plan.latencyTargetMs <= 4;
    }
    if (workloadId === 'secondary') {
      return plan.id === 'value' || (plan.latencyTargetMs != null && plan.latencyTargetMs >= 5);
    }
    return false;
  }

  function isBusinessCriticalPremiumOverride(workloadId, capacityTiB, iopsRequired, latencyMs) {
    var w = String(workloadId || '').toLowerCase();
    var isBusinessCriticalWorkload = (w === 'mission-critical' || w === 'business' || w === 'business-critical');
    if (!isBusinessCriticalWorkload) return false;
    var validCapacity = (capacityTiB === 50 || capacityTiB === 100 || capacityTiB === 150 || capacityTiB === 200);
    return validCapacity && iopsRequired === 1000000 && latencyMs === 1;
  }

  /** Returns plans filtered by capacity first, then refines by IOPS+latency when both are provided. */
  function getQualifyingPlans(capacityTiB, iops, iopsUnit, latencyMs, workloadId, perfConfig) {
    var cap = parseFloat(capacityTiB);
    var lat = parseFloat(latencyMs);
    var iopsNum = parseFloat(iops);
    if (isNaN(cap) || cap <= 0) return [];
    var mult = (iopsUnit === 'K') ? 1000 : (iopsUnit === 'M') ? 1000000 : (iopsUnit === 'G') ? 1000000000 : 1000;
    var hasIops = !isNaN(iopsNum) && iopsNum > 0;
    var hasLatency = !isNaN(lat) && lat >= 0;
    if (!hasIops || !hasLatency) return [];
    var tuning = perfConfig || {};
    var usableEffectiveMode = tuning.usableEffective || 'effective';
    var snapmirrorMode = tuning.snapmirror || 'no';
    var iopsRequired = iopsNum * mult;
    var requiredCapacity = usableEffectiveMode === 'usable' ? (cap * 1.2) : cap;
    var adjustedIopsRequired = snapmirrorMode === 'yes' ? Math.ceil(iopsRequired * 1.15) : iopsRequired;
    var adjustedLatency = snapmirrorMode === 'yes' ? (lat * 0.9) : lat;
    var contractYears = getCurrentContractYears();
    var isPremiumBenchmark = contractYears === 3 &&
      (cap === 100 || cap === 200 || cap === 300) &&
      hasLatency && lat === 1 &&
      iopsRequired === 1000000;
    var isBusinessCriticalPremiumRule = isBusinessCriticalPremiumOverride(workloadId, cap, iopsRequired, lat);
    var isFixedPremiumScenario = (cap === 50 && iopsRequired === 1000000 && lat === 1);
    var enforcePremiumOnly = isFixedPremiumScenario || isBusinessCriticalPremiumRule;
    var candidates = PLAN_OPTIONS.filter(function (plan) {
      if (requiredCapacity < plan.minCapacityTiB) return false;
      if (enforcePremiumOnly) return plan.id === 'premium';
      // Premium and Unified Extreme always shown when capacity qualifies
      if (plan.id === 'premium' || plan.id === 'unified-extreme') return true;
      if (isPremiumBenchmark && plan.id === 'premium') return true;
      if (plan.id === 'value') return adjustedLatency > 4;
      /* Object/Cloud-style levels are capacity driven (no latency/IOPS gates). */
      if (plan.latencyTargetMs == null || plan.maxIops == null) return true;
      /*
       * Latency input is treated as required performance target.
       * Example: entering 5 ms should not qualify <=1 ms service levels.
       */
      if (plan.maxIops === 0) return adjustedLatency > 4;
      if (adjustedLatency < plan.latencyTargetMs) return false;
      return adjustedIopsRequired <= plan.maxIops;
    });
    var planOrder = { 'premium': 0, 'unified-extreme': 1 };
    candidates.sort(function (a, b) {
      var aOrder = planOrder[a.id] != null ? planOrder[a.id] : 2;
      var bOrder = planOrder[b.id] != null ? planOrder[b.id] : 2;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.cost || 0) - (b.cost || 0);
    });
    return candidates;
  }

  /** Best qualifying plan id (workload-fit then cheapest), or null if none qualify. */
  function getRecommendedPlan(capacityTiB, iops, iopsUnit, latencyMs, workloadId, perfConfig) {
    var qualifying = getQualifyingPlans(capacityTiB, iops, iopsUnit, latencyMs, workloadId, perfConfig);
    return qualifying.length > 0 ? qualifying[0].id : null;
  }

  var appliedDiscountPct = 0;
  var planConfigs = {};
  var burstByPlan = {};
  var requestedDeviations = [];
  var collapsedWorkloadIds = {};
  var sidebarHardwareMode = false;
  var sidebarFlipAnimating = false;
  var quoteReadOnlyMode = false;
  /** True once a saved quote has been loaded, so page defaults stop overwriting its fields. */
  var quoteStateRestored = false;
  var fromCustomerRequest = false;
  var fromNpvReturn = false;
  var hwConfigReviewed = !!(window.CUSTOMER_VIEW);
  var hwConfigApproved = false;

  function storageKeyHwApproved() {
    return 'hwConfigApproved_' + currentQuoteId;
  }
  function loadHwApprovalFromStorage() {
    try {
      hwConfigApproved = sessionStorage.getItem(storageKeyHwApproved()) === '1';
    } catch (e1) {
      hwConfigApproved = false;
    }
    if (window.CUSTOMER_VIEW) {
      hwConfigReviewed = true;
    } else {
      hwConfigReviewed = hwConfigApproved;
    }
  }
  function persistHwApproval() {
    try {
      sessionStorage.setItem(storageKeyHwApproved(), hwConfigApproved ? '1' : '0');
    } catch (e2) {}
  }
  function setHwApproved(v) {
    hwConfigApproved = !!v;
    persistHwApproval();
    if (window.CUSTOMER_VIEW) {
      hwConfigReviewed = true;
    } else {
      hwConfigReviewed = hwConfigApproved;
    }
  }
  function getReviewHardwareButtonLabel() {
    if (hwConfigApproved) return 'Edit Approved HW';
    return sidebarHardwareMode ? 'Approve HW configurations' : 'Review and update HW configuration';
  }
  function buildHwSummaryApprovalBadgeHtml() {
    if (!hwConfigApproved) return '';
    return '<div class="hw-summary-approved-row" role="status">' +
      '<label class="hw-summary-approved-label"><input type="checkbox" checked disabled aria-label="Hardware configuration approved"> ' +
      '<span>Hardware configuration approved</span></label></div>';
  }
  function stripHwSummaryApprovalBadgeFromHtml(html) {
    if (!html) return '';
    return String(html).replace(/^<div class="hw-summary-approved-row"[^>]*>[\s\S]*?<\/div>\s*/i, '');
  }
  function mergeHwSummaryContent(bodyHtml) {
    return buildHwSummaryApprovalBadgeHtml() + stripHwSummaryApprovalBadgeFromHtml(bodyHtml || '');
  }
  function refreshHwSummaryApprovalInDom() {
    var hwInfo = getById('hw-config-summary');
    if (!hwInfo) return;
    var inner = stripHwSummaryApprovalBadgeFromHtml(hwInfo.innerHTML);
    if (!inner.replace(/&nbsp;/g, '').trim()) return;
    hwInfo.innerHTML = mergeHwSummaryContent(inner);
    syncHwConfigSummaryVisibility();
  }

  function getAddonIconSvg(addonId) {
    var map = {
      metro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17.5V6.5h4v11H4zm6 0V10h4v7.5h-4zm6 0V4.5h4v13h-4z"/></svg>',
      'data-protection': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 4.4-3 8.5-7 10-4-1.5-7-5.6-7-10V6l7-3zm-1 11l-2-2-1.4 1.4 3.4 3.4 5.2-5.2L14.8 10 11 13.8z"/></svg>',
      nrd: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v4H5V5zm0 5.5h14V14H5v-3.5zM5 15.5h14V19H5v-3.5z"/></svg>',
      ai: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.2 4.6L19 9l-4.8 2.4L12 16l-2.2-4.6L5 9l4.8-2.4L12 2zm-7 15h5v2H5v-2zm9 0h5v2h-5v-2z"/></svg>',
      'advanced-protection': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.4 9.5-8 11-4.6-1.5-8-6-8-11V5l8-3zm0 4.2L8 7.7V11c0 3.5 2.2 6.8 4 7.8 1.8-1 4-4.3 4-7.8V7.7l-4-1.5z"/></svg>',
      tiering: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4v3l-9 4-9-4v-3z"/></svg>',
      dii: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 17h2v2h-2v-2zm0-12h2v10h-2V5zm-8 6a9 9 0 1118 0 9 9 0 01-18 0z"/></svg>',
      'co-mingling': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h6v6H7V7zm4 4h6v6h-6v-6z"/></svg>'
    };
    return map[addonId] || '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/></svg>';
  }

  function getById(id) {
    return document.getElementById(id);
  }

  function formatCurrency(n) {
    return '$' + (n || 0).toLocaleString();
  }

  function getDisplayYearlyCostForPlan(opt, workloadCfg) {
    if (!opt) return 0;
    var cfg = workloadCfg || {};
    var years = getCurrentContractYears();
    var override = getBenchmarkPricingOverrideForConfig(years, cfg, opt.id);
    return override && override.yearlyNet ? override.yearlyNet : (opt.cost || 0);
  }

  function getNormalizedBurstValue(rawBurst) {
    var b = rawBurst != null ? String(rawBurst).trim() : '';
    var n = parseFloat(b.replace('%', '').trim());
    return isNaN(n) ? '' : String(Math.round(n));
  }

  /*
   * SINGLE SOURCE OF TRUTH: IOT benchmark rate card values.
   * Do not change these unless user explicitly asks to override.
   */
  var IOT_RATE_CARD = Object.freeze({
    usable: Object.freeze({
      50: Object.freeze({
        '20': Object.freeze({ monthly: 20275.00, perTiBPerMonth: 405.50, yearlyNet: 243300.00, averagePerTiBYear: 4866.00 }),
        '40': Object.freeze({ monthly: 21694.50, perTiBPerMonth: 433.89, yearlyNet: 260334.00, averagePerTiBYear: 5206.68 }),
        '60': Object.freeze({ monthly: 23316.50, perTiBPerMonth: 466.33, yearlyNet: 279798.00, averagePerTiBYear: 5595.96 })
      }),
      100: Object.freeze({
        '20': Object.freeze({ monthly: 33941.00, perTiBPerMonth: 339.41, yearlyNet: 407292.00, averagePerTiBYear: 4072.92 }),
        '40': Object.freeze({ monthly: 36316.00, perTiBPerMonth: 363.16, yearlyNet: 435792.00, averagePerTiBYear: 4357.92 }),
        '60': Object.freeze({ monthly: 39032.00, perTiBPerMonth: 390.32, yearlyNet: 468384.00, averagePerTiBYear: 4683.84 })
      })
    }),
    effective: Object.freeze({
      50: Object.freeze({
        '20': Object.freeze({ monthly: 13516.50, perTiBPerMonth: 270.33, yearlyNet: 162198.00, averagePerTiBYear: 3243.96 }),
        '40': Object.freeze({ monthly: 14463.00, perTiBPerMonth: 289.26, yearlyNet: 173556.00, averagePerTiBYear: 3471.12 }),
        '60': Object.freeze({ monthly: 15544.50, perTiBPerMonth: 310.89, yearlyNet: 186534.00, averagePerTiBYear: 3730.68 })
      }),
      100: Object.freeze({
        '20': Object.freeze({ monthly: 22627.00, perTiBPerMonth: 226.27, yearlyNet: 271524.00, averagePerTiBYear: 2715.24 }),
        '40': Object.freeze({ monthly: 24211.00, perTiBPerMonth: 242.11, yearlyNet: 290532.00, averagePerTiBYear: 2905.32 }),
        '60': Object.freeze({ monthly: 26021.00, perTiBPerMonth: 260.21, yearlyNet: 312252.00, averagePerTiBYear: 3122.52 })
      })
    })
  });

  /**
   * Metro Cluster rate card: $/TiB/month by contract term (months).
   * Source: SUB-KEY3-ADP-* price list H2.
   *   1–11 months  : $7.61 / TiB / month
   *   12–35 months : $7.61 / TiB / month
   *   36–59 months : $6.34 / TiB / month
   *   60+ months   : $5.71 / TiB / month
   */
  /**
   * Add-on pricing shown in this prototype is scaled down from the published list rates so demo
   * figures are not mistaken for real quotes. Applies to Metro Cluster, Data Tiering, DII and
   * Cluster Join, covering the cards, the sidebar rows, the totals and the generated quote.
   */
  var ADDON_DEMO_PRICE_FACTOR = 0.5;

  /** Scales a published add-on list rate to the demo rate. */
  function demoAddonRate(rate) {
    return rate * ADDON_DEMO_PRICE_FACTOR;
  }

  var ADP_RATE_CARD = Object.freeze([
    { minMonths: 1,  maxMonths: 11,  perTiBPerMonth: 7.61 },
    { minMonths: 12, maxMonths: 35,  perTiBPerMonth: 7.61 },
    { minMonths: 36, maxMonths: 59,  perTiBPerMonth: 6.34 },
    { minMonths: 60, maxMonths: Infinity, perTiBPerMonth: 5.71 }
  ]);

  function getAdpRatePerTiBMonth(contractMonths) {
    var months = Math.max(1, Math.round(contractMonths || 12));
    for (var i = 0; i < ADP_RATE_CARD.length; i++) {
      if (months >= ADP_RATE_CARD[i].minMonths && months <= ADP_RATE_CARD[i].maxMonths) {
        return demoAddonRate(ADP_RATE_CARD[i].perTiBPerMonth);
      }
    }
    return demoAddonRate(ADP_RATE_CARD[ADP_RATE_CARD.length - 1].perTiBPerMonth);
  }

  /** Returns total committed TiB across all currently selected workloads. */
  function getTotalCommittedTiB() {
    var selected = getSelectedWorkloads();
    var total = 0;
    for (var i = 0; i < selected.length; i++) {
      var cfg = workloadConfigs[selected[i].id];
      if (cfg) {
        var cap = getEffectiveCapacity(cfg);
        if (cap > 0) total += cap;
      }
    }
    return total;
  }

  /** Returns annual ADP cost only when the ADP checkbox is explicitly checked. */
  function getAdpAnnualCost() {
    var cb = document.querySelector('input[name="addon_subscription"][value="advanced-protection"]');
    if (!cb || !cb.checked) return 0;
    var totalTiB = getTotalCommittedTiB();
    if (totalTiB <= 0) return 0;
    var contractMonths = getCurrentContractYears() * 12;
    var rate = getAdpRatePerTiBMonth(contractMonths);
    return Math.round(totalTiB * rate * 12 * 100) / 100;
  }

  /**
   * Data Tiering (DT) rate card: $/TiB/month by capacity tier.
   * Source: SUB-KEY3-DT-36-59M (36–59 month term).
   * Other terms use the same published tiers until updated.
   *   1–99 TiB      : $33.79 / TiB / month
   *   100–249 TiB   : $29.74 / TiB / month
   *   250–499 TiB   : $21.96 / TiB / month
   *   500–999 TiB   : $18.92 / TiB / month
   *   1000+ TiB     : $16.90 / TiB / month
   */
  var DT_RATE_TIERS = Object.freeze([
    { minTiB: 1,    maxTiB: 99,       perTiBPerMonth: 33.79 },
    { minTiB: 100,  maxTiB: 249,      perTiBPerMonth: 29.74 },
    { minTiB: 250,  maxTiB: 499,      perTiBPerMonth: 21.96 },
    { minTiB: 500,  maxTiB: 999,      perTiBPerMonth: 18.92 },
    { minTiB: 1000, maxTiB: Infinity, perTiBPerMonth: 16.90 }
  ]);

  /** Committed TiB the customer wants data tiering on (set via modal). */
  var dataTieringTiB = 0;

  /** Returns $/TiB/month for data tiering given committed TiB. */
  function getDtRatePerTiBMonth(tib) {
    var t = Math.max(1, Math.round(tib || 1));
    for (var i = 0; i < DT_RATE_TIERS.length; i++) {
      if (t >= DT_RATE_TIERS[i].minTiB && t <= DT_RATE_TIERS[i].maxTiB) {
        return demoAddonRate(DT_RATE_TIERS[i].perTiBPerMonth);
      }
    }
    return demoAddonRate(DT_RATE_TIERS[DT_RATE_TIERS.length - 1].perTiBPerMonth);
  }

  /** Returns annual Data Tiering cost only when the tiering checkbox is explicitly checked and capacity is set. */
  function getDtAnnualCost() {
    var cb = document.querySelector('input[name="addon_subscription"][value="tiering"]');
    if (!cb || !cb.checked) return 0;
    if (dataTieringTiB <= 0) return 0;
    var rate = getDtRatePerTiBMonth(dataTieringTiB);
    return Math.round(dataTieringTiB * rate * 12 * 100) / 100;
  }

  /**
   * DII (Data Infrastructure Insights) rate card.
   * Rates are $/TiB/month, keyed by plan family → contract term → capacity tier.
   * Source: SUB-KEY3-DII-* price list.
   *
   * Contract term buckets (months):
   *   12–23M  |  24–35M  |  36–60M
   *
   * Capacity tiers (TiB):
   *   Extreme & Premium: 1–2499  |  2500+
   *   All others:        flat rate
   */
  var DII_RATE_CARD = Object.freeze({
    // plan-family → [ { minM, maxM, tiers:[{maxTiB, rate}] } ]
    'premium': [
      { minM: 12, maxM: 23, tiers: [{ maxTiB: 2499, rate: 4.00 }, { maxTiB: 999999, rate: 3.40 }] },
      { minM: 24, maxM: 35, tiers: [{ maxTiB: 2499, rate: 3.76 }, { maxTiB: 999999, rate: 3.20 }] },
      { minM: 36, maxM: 60, tiers: [{ maxTiB: 2499, rate: 3.56 }, { maxTiB: 999999, rate: 3.03 }] }
    ],
    'block-optimized-premium': [
      { minM: 12, maxM: 23, tiers: [{ maxTiB: 2499, rate: 4.00 }, { maxTiB: 999999, rate: 3.40 }] },
      { minM: 24, maxM: 35, tiers: [{ maxTiB: 2499, rate: 3.76 }, { maxTiB: 999999, rate: 3.20 }] },
      { minM: 36, maxM: 60, tiers: [{ maxTiB: 2499, rate: 3.56 }, { maxTiB: 999999, rate: 3.03 }] }
    ],
    'unified-extreme': [
      { minM: 12, maxM: 23, tiers: [{ maxTiB: 2499, rate: 4.00 }, { maxTiB: 999999, rate: 3.40 }] },
      { minM: 24, maxM: 35, tiers: [{ maxTiB: 2499, rate: 3.76 }, { maxTiB: 999999, rate: 3.20 }] },
      { minM: 36, maxM: 60, tiers: [{ maxTiB: 2499, rate: 3.56 }, { maxTiB: 999999, rate: 3.03 }] }
    ],
    'block-optimized-extreme': [
      { minM: 12, maxM: 23, tiers: [{ maxTiB: 2499, rate: 4.00 }, { maxTiB: 999999, rate: 3.40 }] },
      { minM: 24, maxM: 35, tiers: [{ maxTiB: 2499, rate: 3.76 }, { maxTiB: 999999, rate: 3.20 }] },
      { minM: 36, maxM: 60, tiers: [{ maxTiB: 2499, rate: 3.56 }, { maxTiB: 999999, rate: 3.03 }] }
    ],
    'standard': [
      { minM: 12, maxM: 23, tiers: [{ maxTiB: 999999, rate: 1.60 }] },
      { minM: 24, maxM: 35, tiers: [{ maxTiB: 999999, rate: 1.50 }] },
      { minM: 36, maxM: 60, tiers: [{ maxTiB: 999999, rate: 1.42 }] }
    ],
    'value': [
      { minM: 12, maxM: 23, tiers: [{ maxTiB: 999999, rate: 0.60 }] },
      { minM: 24, maxM: 35, tiers: [{ maxTiB: 999999, rate: 0.56 }] },
      { minM: 36, maxM: 60, tiers: [{ maxTiB: 999999, rate: 0.53 }] }
    ],
    'object-standard': [
      { minM: 12, maxM: 23, tiers: [{ maxTiB: 999999, rate: 0.40 }] },
      { minM: 24, maxM: 35, tiers: [{ maxTiB: 999999, rate: 0.38 }] },
      { minM: 36, maxM: 60, tiers: [{ maxTiB: 999999, rate: 0.36 }] }
    ],
    'object-value': [
      { minM: 12, maxM: 23, tiers: [{ maxTiB: 999999, rate: 0.40 }] },
      { minM: 24, maxM: 35, tiers: [{ maxTiB: 999999, rate: 0.38 }] },
      { minM: 36, maxM: 60, tiers: [{ maxTiB: 999999, rate: 0.36 }] }
    ]
  });

  /** Look up DII $/TiB/month for a given plan ID, contract length (months), and committed TiB. */
  function getDiiRateForPlan(planId, contractMonths, tib) {
    var entries = DII_RATE_CARD[planId];
    if (!entries) return 0;
    var months = Math.max(12, Math.round(contractMonths || 12));
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (months >= e.minM && months <= e.maxM) {
        for (var j = 0; j < e.tiers.length; j++) {
          if (tib <= e.tiers[j].maxTiB) return demoAddonRate(e.tiers[j].rate);
        }
        return demoAddonRate(e.tiers[e.tiers.length - 1].rate);
      }
    }
    // Fallback: use last term bucket
    var last = entries[entries.length - 1];
    for (var k = 0; k < last.tiers.length; k++) {
      if (tib <= last.tiers[k].maxTiB) return demoAddonRate(last.tiers[k].rate);
    }
    return demoAddonRate(last.tiers[last.tiers.length - 1].rate);
  }

  /**
   * Returns annual DII cost summed across all selected workloads.
   * Groups workloads by plan, then prices each plan's total TiB at the correct tier rate.
   */
  function getDiiAnnualCost() {
    var cb = document.querySelector('input[name="addon_subscription"][value="dii"]');
    if (!cb || !cb.checked) return 0;
    var contractMonths = getCurrentContractYears() * 12;
    var selected = getSelectedWorkloads();
    // Group total TiB by plan ID
    var tibByPlan = {};
    for (var i = 0; i < selected.length; i++) {
      var cfg = workloadConfigs[selected[i].id];
      if (!cfg || !cfg.selectedPlan) continue;
      var planMeta = getPlanByName(cfg.selectedPlan);
      var planId = planMeta ? planMeta.id : null;
      if (!planId) continue;
      var tib = getEffectiveCapacity(cfg);
      if (tib <= 0) continue;
      tibByPlan[planId] = (tibByPlan[planId] || 0) + tib;
    }
    var total = 0;
    var planIds = Object.keys(tibByPlan);
    for (var p = 0; p < planIds.length; p++) {
      var pid = planIds[p];
      var planTiB = tibByPlan[pid];
      var rate = getDiiRateForPlan(pid, contractMonths, planTiB);
      total += Math.round(planTiB * rate * 12 * 100) / 100;
    }
    return Math.round(total * 100) / 100;
  }

  /**
   * Extrapolate per-TiB/month rate for burst values beyond the 20/40/60 rate card
   * using quadratic fit on the three known data points.
   * Points: (20, r20), (40, r40), (60, r60) → fit ax² + bx + c, evaluate at burstN.
   */
  function extrapolateBurstRate(r20, r40, r60, burstN) {
    var a = (r60 - 2 * r40 + r20) / 800;
    var b = (r40 - r20) / 20 - 60 * a;
    var c = r20 - a * 400 - b * 20;
    return Math.max(r60, a * burstN * burstN + b * burstN + c);
  }

  function getIotRateCardEntry(capacityTiB, burstPct, usableEffectiveMode) {
    var cap = Number(capacityTiB);
    if (isNaN(cap) || cap <= 0) return null;
    var burst = String(burstPct || '20');
    var burstN = parseFloat(burst);
    if (isNaN(burstN) || burstN < 0) burstN = 20;
    var mode = String(usableEffectiveMode || 'effective').toLowerCase();
    var map = mode === 'usable' ? IOT_RATE_CARD.usable : IOT_RATE_CARD.effective;
    var tierKey = cap < 100 ? 50 : 100;
    var tierMap = map[tierKey];
    if (!tierMap) return null;

    var perTiBPerMonth;
    var standardBurst = tierMap[burst];
    if (standardBurst) {
      perTiBPerMonth = standardBurst.perTiBPerMonth;
    } else {
      var r20 = tierMap['20'].perTiBPerMonth;
      var r40 = tierMap['40'].perTiBPerMonth;
      var r60 = tierMap['60'].perTiBPerMonth;
      if (burstN <= 20) {
        perTiBPerMonth = r20;
      } else if (burstN <= 60) {
        var lower = burstN <= 40 ? r20 : r40;
        var upper = burstN <= 40 ? r40 : r60;
        var frac = burstN <= 40 ? (burstN - 20) / 20 : (burstN - 40) / 20;
        perTiBPerMonth = lower + (upper - lower) * frac;
      } else {
        perTiBPerMonth = extrapolateBurstRate(r20, r40, r60, burstN);
      }
      perTiBPerMonth = Math.round(perTiBPerMonth * 100) / 100;
    }

    var monthly = Math.round(cap * perTiBPerMonth * 100) / 100;
    var yearlyNet = Math.round(monthly * 12 * 100) / 100;
    var averagePerTiBYear = Math.round(perTiBPerMonth * 12 * 100) / 100;
    return {
      monthly: monthly,
      perTiBPerMonth: perTiBPerMonth,
      yearlyNet: yearlyNet,
      averagePerTiBYear: averagePerTiBYear
    };
  }

  function getSubscriptionAddonLabel(addonId) {
    var map = {
      'advanced-protection': 'Metro Cluster',
      tiering: 'Data tiering',
      dii: 'Data infrastructure insights',
      'co-mingling': 'Cluster Join'
    };
    return map[addonId] || addonId;
  }

  function getSelectedWorkloads() {
    var list = [];
    document.querySelectorAll('#workload-specific .quote-workload-tile.selected').forEach(function (t) {
      var id = t.dataset.workload;
      var lbl = t.querySelector('.quote-workload-tile-label');
      if (id && lbl) list.push({ id: id, label: lbl.textContent.trim() });
    });
    document.querySelectorAll('.quote-workload-tiles-general .quote-workload-tile.selected').forEach(function (t) {
      var id = t.dataset.workload;
      var lbl = t.querySelector('.quote-workload-tile-label');
      if (id && lbl) list.push({ id: id, label: lbl.textContent.trim() });
    });
    return list;
  }

  /**
   * A request submitted from the Console arrives as configured workloads with no quote lines yet.
   * Adds one line per configured workload so the seller opens a populated quote, the same result
   * as pressing "Add to quote" on each workload card.
   */
  function addConfiguredWorkloadsToQuote() {
    var years = getCurrentContractYears();
    getSelectedWorkloads().forEach(function (w) {
      var cfg = workloadConfigs[w.id];
      if (!cfg || !cfg.selectedPlan) return;
      var alreadyQuoted = quoteItems.some(function (item) { return item.workloadId === w.id; });
      if (alreadyQuoted) return;
      var planMeta = getPlanByName(cfg.selectedPlan);
      if (!cfg.selectedPlanCost) {
        var benchmark = getBenchmarkPricingOverrideForConfig(years, cfg, planMeta ? planMeta.id : null);
        cfg.selectedPlanCost = benchmark && benchmark.yearlyNet
          ? benchmark.yearlyNet
          : (planMeta ? planMeta.cost : 0);
      }
      var capacity = getEffectiveCapacity(cfg) || cfg.capacity;
      var specParts = [];
      if (capacity) specParts.push(capacity + ' TiB');
      if (cfg.iops) specParts.push(cfg.iops + (cfg.iopsUnit || '') + ' IOPS');
      if (cfg.latency) specParts.push(cfg.latency + ' ms max latency');
      quoteItems.push({
        name: w.label + ' — ' + cfg.selectedPlan,
        cost: cfg.selectedPlanCost || 0,
        workloadId: w.id,
        workloadLabel: w.label,
        planName: cfg.selectedPlan,
        capacityTiB: parseFloat(capacity) || 0,
        spec: specParts.join(' \u00b7 ') || '—',
        hardwareSeries: planMeta && planMeta.hardwareSeries && planMeta.hardwareSeries.length
          ? planMeta.hardwareSeries.join(', ')
          : 'As per selected performance level'
      });
    });
  }

  function collapseAllSelectedWorkloads() {
    collapsedWorkloadIds = {};
    getSelectedWorkloads().forEach(function (w) {
      if (w && w.id) collapsedWorkloadIds[w.id] = true;
    });
  }

  function getPlansInUse() {
    var byPlan = {};
    getSelectedWorkloads().forEach(function (w) {
      var cfg = workloadConfigs[w.id];
      var planName = cfg && cfg.selectedPlan ? cfg.selectedPlan : null;
      if (!planName) return;
      var opt = PLAN_OPTIONS.filter(function (p) { return p.name === planName; })[0];
      var planId = opt ? opt.id : planName.toLowerCase().replace(/\s+/g, '-');
      if (!byPlan[planId]) byPlan[planId] = { planId: planId, planName: planName, workloadLabels: [] };
      byPlan[planId].workloadLabels.push(w.label);
    });
    return Object.keys(byPlan).map(function (id) { return byPlan[id]; });
  }

  var IO_MIX_BLOCK_OPTIONS = ['4K', '8K', '32K', '64K', '128K', '256K'];

  function ensurePlanConfig(planId) {
    if (!planConfigs[planId]) {
      planConfigs[planId] = {
        usableEffective: 'effective',
        ioMix: 'random',
        snapmirror: 'yes',
        burst: '20',
        ioMixReadRandomPct: 70,
        ioMixReadRandomBlock: '8K',
        ioMixReadSeqPct: 0,
        ioMixReadSeqBlock: '32K',
        ioMixWriteRandomPct: 30,
        ioMixWriteRandomBlock: '8K',
        ioMixWriteSeqPct: 0,
        ioMixWriteSeqBlock: '32K'
      };
    }
    return planConfigs[planId];
  }

  function getQuoteState() {
    var contractCard = document.querySelector('.contract-terms-panel .contract-terms-card.selected .contract-terms-input[name="contract-length"]');
    var billingCard = document.querySelector('.contract-terms-panel .contract-terms-card.selected .contract-terms-input[name="billing-frequency"]');
    var contractLength = null;
    var effectiveCustom = customContractLength || (customContractByQuote[currentQuoteId] || null);
    if (contractCard) {
      if (contractCard.value === 'custom' && effectiveCustom) {
        contractLength = effectiveCustom.display || 'Custom';
      } else if (contractCard.value !== 'custom') {
        contractLength = contractCard.closest('.contract-terms-card').querySelector('.contract-terms-card-label').textContent.trim();
      } else {
        contractLength = 'Custom';
      }
    }
    var billingFreq = null;
    if (billingCard) {
      var label = billingCard.closest('.contract-terms-card').querySelector('.contract-terms-card-label');
      billingFreq = label ? label.textContent.trim() : null;
      var effectiveBilling = customBillingByQuote[currentQuoteId] || customBilling;
      if (billingCard.value === 'custom' && effectiveBilling && effectiveBilling.interval) {
        billingFreq = 'Custom (every ' + effectiveBilling.interval + ' ' + effectiveBilling.unit + ')';
      }
    }

    var workloads = [];
    document.querySelectorAll('#workload-specific .quote-workload-tile.selected').forEach(function (t) {
      var lbl = t.querySelector('.quote-workload-tile-label');
      if (lbl) workloads.push(lbl.textContent.trim());
    });
    document.querySelectorAll('.quote-workload-tiles-general .quote-workload-tile.selected').forEach(function (t) {
      var lbl = t.querySelector('.quote-workload-tile-label');
      if (lbl) workloads.push(lbl.textContent.trim());
    });
    var generalWorkload = null;

    var capacity = null;
    var iops = null;
    var iopsUnit = null;
    var latency = null;
    var planName = null;
    var firstWorkloadId = getSelectedWorkloads()[0];
    if (firstWorkloadId && workloadConfigs[firstWorkloadId.id]) {
      var c = workloadConfigs[firstWorkloadId.id];
      capacity = c.capacity;
      iops = c.iops;
      iopsUnit = c.iopsUnit;
      latency = c.latency;
      planName = c.selectedPlan;
    }

    var addons = [];
    document.querySelectorAll('.quote-addon-group input[name="addon_subscription"]:checked').forEach(function (cb) {
      addons.push(cb.value);
    });
    var deploymentSelect = document.querySelector('select[name="deployment_location"]');
    var deployment = deploymentSelect && deploymentSelect.value ? deploymentSelect.options[deploymentSelect.selectedIndex].text : null;
    var billToAddressEl = getById('bill-to-address');
    var shipToAddressEl = getById('ship-to-address');

    var discountRate = (getById('sidebar-discount-rate') && getById('sidebar-discount-rate').value) || '0';
    var currency = (getById('sidebar-currency') && getById('sidebar-currency').value) || 'USD';

    var sidebarDeviationSelect = getById('sidebar-deviations');
    var sidebarDeviation = null;
    if (sidebarDeviationSelect && sidebarDeviationSelect.value) {
      var opt = sidebarDeviationSelect.options[sidebarDeviationSelect.selectedIndex];
      sidebarDeviation = { value: sidebarDeviationSelect.value, label: opt ? opt.text : sidebarDeviationSelect.value };
    }

    var standardBurstValues = ['20', '40', '60'];
    var plansInUse = getPlansInUse();
    var performanceServiceLevelByPlan = {};
    plansInUse.forEach(function (p) {
      var selectedForPlan = getSelectedWorkloads().find(function (w) {
        var wc = workloadConfigs[w.id];
        return wc && wc.selectedPlan === p.planName;
      });
      var workloadCfg = selectedForPlan ? ensureWorkloadConfig(selectedForPlan.id) : null;
      var cfg = workloadCfg || planConfigs[p.planId] || ensurePlanConfig(p.planId);
      var burstRaw = cfg && cfg.burst != null ? String(cfg.burst) : '';
      var burstDisplay = burstRaw ? (burstRaw + '%') : null;
      var burstIsDeviation = !!(burstRaw && standardBurstValues.indexOf(burstRaw) === -1);
      var customBurstKey = selectedForPlan ? ('workload:' + selectedForPlan.id) : p.planId;
      performanceServiceLevelByPlan[p.planName] = {
        planId: p.planId,
        planName: p.planName,
        workloadLabels: p.workloadLabels,
        usableEffective: cfg.usableEffective || null,
        ioMix: (cfg.ioMixReadRandomPct != null || cfg.ioMixWriteRandomPct != null) ? ('Read ' + (cfg.ioMixReadRandomPct || 0) + 'R/' + (cfg.ioMixReadSeqPct || 0) + 'S · Write ' + (cfg.ioMixWriteRandomPct || 0) + 'R/' + (cfg.ioMixWriteSeqPct || 0) + 'S') : (cfg.ioMix || null),
        snapmirror: cfg.snapmirror || null,
        burst: burstDisplay,
        burstIsDeviation: burstIsDeviation,
        customBurstJustification: burstByPlan[customBurstKey] ? burstByPlan[customBurstKey].justification : null
      };
    });
    var firstPlanConfig = plansInUse.length && planConfigs[plansInUse[0].planId] ? planConfigs[plansInUse[0].planId] : null;
    var autoRenewalState = (document.querySelector('input[name="auto-renewal"]:checked') && document.querySelector('input[name="auto-renewal"]:checked').value) || null;
    var autoRenewDurationEl = document.querySelector('select[name="auto-renewal-duration"]');
    var autoRenewDurationValue = (function () {
      if (!autoRenewDurationEl) return '12';
      var v = autoRenewDurationEl.value;
      if (v === '12' || v === 'contract') return v;
      if (v === 'custom') {
        var customVal = document.getElementById('auto-renewal-custom-value');
        var customUnit = document.getElementById('auto-renewal-custom-unit');
        var n = customVal ? parseInt(customVal.value, 10) : 12;
        if (isNaN(n) || n < 1) n = 12;
        var months = customUnit && customUnit.value === 'years' ? n * 12 : n;
        return String(Math.min(120, Math.max(1, months)));
      }
      return '12';
    })();
    var performanceServiceLevel = firstPlanConfig ? {
      usableEffective: firstPlanConfig.usableEffective || null,
      ioMix: (firstPlanConfig.ioMixReadRandomPct != null || firstPlanConfig.ioMixWriteRandomPct != null) ? ('Read ' + (firstPlanConfig.ioMixReadRandomPct || 0) + 'R/' + (firstPlanConfig.ioMixReadSeqPct || 0) + 'S · Write ' + (firstPlanConfig.ioMixWriteRandomPct || 0) + 'R/' + (firstPlanConfig.ioMixWriteSeqPct || 0) + 'S') : (firstPlanConfig.ioMix || null),
      snapmirror: firstPlanConfig.snapmirror || null,
      burst: firstPlanConfig.burst ? firstPlanConfig.burst + '%' : null,
      customBurstJustification: burstByPlan[plansInUse[0].planId] ? burstByPlan[plansInUse[0].planId].justification : null
    } : null;

    var workloadConfigList = getSelectedWorkloads().map(function (w) {
      var c = workloadConfigs[w.id] || {};
      return {
        workloadId: w.id,
        workloadLabel: w.label,
        capacityTiB: c.capacity,
        iops: c.iops,
        iopsUnit: c.iopsUnit,
        maxLatencyMs: c.latency,
        selectedPlan: c.selectedPlan
      };
    });

    var contractLengthIsDeviation = !!(contractCard && contractCard.value === 'custom');
    var billingIsDeviation = !!(billingCard && billingCard.value === 'custom');

    return {
      contractLength: contractLength,
      contractLengthIsDeviation: contractLengthIsDeviation,
      customContractJustification: effectiveCustom ? effectiveCustom.justification : null,
      customBurstJustification: null,
      billingFrequency: billingFreq,
      billingIsDeviation: billingIsDeviation,
      workloads: workloads,
      generalWorkload: generalWorkload,
      autoRenew: autoRenewalState,
      autoRenewDuration: autoRenewDurationValue,
      performanceServiceLevel: performanceServiceLevel,
      performanceServiceLevelByPlan: performanceServiceLevelByPlan,
      workloadConfigs: workloadConfigList,
      workloadConfig: workloadConfigList[0] ? {
        capacityTiB: workloadConfigList[0].capacityTiB,
        iops: workloadConfigList[0].iops,
        iopsUnit: workloadConfigList[0].iopsUnit,
        maxLatencyMs: workloadConfigList[0].maxLatencyMs,
        selectedPlan: workloadConfigList[0].selectedPlan
      } : {},
      addons: addons,
      deploymentLocation: deployment || null,
      billToAddress: billToAddressEl ? billToAddressEl.value : '',
      shipToAddress: shipToAddressEl ? shipToAddressEl.value : '',
      itemization: quoteItems.map(function (i) { return { name: i.name, costPerYear: i.cost }; }),
      quoteItemsDetailed: quoteItems.map(function (i) {
        return {
          name: i.name,
          workloadLabel: i.workloadLabel || null,
          planName: i.planName || null,
          spec: i.spec || null,
          hardwareSeries: i.hardwareSeries || null,
          costPerYear: i.cost
        };
      }),
      discountRatePct: discountRate,
      currency: currency,
      sidebarDeviation: sidebarDeviation
    };
  }

  function buildDealDataForMarginFromQuoteState(state) {
    var src = state || getQuoteStateForStorage();
    var years = parseContractYears(src.contractLengthLabel || '3 Years');
    var tableYears = 5;
    var lineItems = [];
    if (Array.isArray(src.quoteItems) && src.quoteItems.length) {
      lineItems = src.quoteItems.map(function (item) { return { cost: item && item.cost ? item.cost : 0 }; });
    } else if (Array.isArray(src.quoteItemsDetailed) && src.quoteItemsDetailed.length) {
      lineItems = src.quoteItemsDetailed.map(function (item) { return { cost: item && item.costPerYear ? item.costPerYear : 0 }; });
    } else if (Array.isArray(src.itemization) && src.itemization.length) {
      lineItems = src.itemization.map(function (item) { return { cost: item && item.costPerYear ? item.costPerYear : 0 }; });
    }
    var subtotalPerYear = lineItems.reduce(function (sum, item) { return sum + (item && item.cost ? item.cost : 0); }, 0);
    var rawDiscount = src.discountRatePct !== undefined && src.discountRatePct !== null
      ? parseFloat(src.discountRatePct)
      : (src.appliedDiscountPct || 0);
    var discountPct = Math.max(0, Math.min(100, isNaN(rawDiscount) ? 0 : rawDiscount));
    var bookingsUsdYear = Math.round(subtotalPerYear);
    var bookingsLocalYear = bookingsUsdYear;
    var partnerIncentiveYear = Math.round(bookingsUsdYear * 0.10);
    var netBookingsYear = Math.max(0, bookingsUsdYear - partnerIncentiveYear);
    var bomYear = Math.round(netBookingsYear * 0.33);
    var keystoneYear = Math.round(netBookingsYear * 0.11);
    var slaYear = Math.round(netBookingsYear * 0.09);
    var discountDollarYear = Math.round(netBookingsYear * (discountPct / 100));
    var dealValueYear = Math.round(netBookingsYear - (bomYear + keystoneYear + slaYear));
    var gmWithSla = netBookingsYear > 0 ? Math.max(0, Math.min(100, Math.round((dealValueYear / netBookingsYear) * 100))) : 0;
    var gmNoSla = netBookingsYear > 0 ? Math.max(0, Math.min(100, Math.round(((dealValueYear + slaYear) / netBookingsYear) * 100))) : 0;

    function buildArr(val) {
      var arr = [];
      for (var i = 0; i < tableYears; i++) arr.push(i < years ? val : 0);
      return arr;
    }

    return {
      quoteId: src.quoteId || currentQuoteId,
      opportunityId: src.opportunityId || currentOpportunityId,
      customerName: src.customerName || '',
      quoteDiscountPct: discountPct,
      featureRequests: getDeviationsList(src),
      years: tableYears,
      annualData: {
        bookingsLocal: buildArr(bookingsLocalYear),
        bookingsUsd: buildArr(bookingsUsdYear),
        partnerIncentive: buildArr(partnerIncentiveYear),
        netBookings: buildArr(netBookingsYear),
        discountDollar: buildArr(discountDollarYear),
        bom: buildArr(bomYear),
        keystoneServices: buildArr(keystoneYear),
        slaCredits: buildArr(slaYear),
        dealValue: buildArr(dealValueYear),
        grossMarginSlaPct: buildArr(gmWithSla),
        grossMarginNoSlaPct: buildArr(gmNoSla)
      },
      defaults: {
        contractLength: years * 12,
        slaCredits: slaYear,
        discountRate: discountPct,
        discountAmount: discountDollarYear * years,
        grossMarginSla: gmWithSla,
        grossMarginNoSla: gmNoSla,
        breakEven: Math.max(1, Math.min(84, Math.round((years * 12) / 4)))
      }
    };
  }

  function getDeviationsList(state) {
    var list = [];
    if (state.contractLengthIsDeviation && state.contractLength) {
      list.push({ label: 'Contract', value: state.contractLength });
    }
    if (state.billingIsDeviation && state.billingFrequency) {
      list.push({ label: 'Billing', value: state.billingFrequency });
    }
    if (state.performanceServiceLevelByPlan) {
      Object.keys(state.performanceServiceLevelByPlan).forEach(function (planName) {
        var psl = state.performanceServiceLevelByPlan[planName];
        if (psl && psl.burstIsDeviation && psl.burst) {
          list.push({ label: 'Burst (' + planName + ')', value: psl.burst });
        }
      });
    }
    requestedDeviations.forEach(function (d) {
      list.push(d);
    });
    return list;
  }

  /**
   * Sovereign deployments are identified by their site-value prefix rather than a fixed list, so
   * a Console-submitted request naming any EU-Sovereign / Dark-Site location still resolves.
   */
  function isSovereignDeploymentValue(value) {
    return /^(EU-Sovereign|Dark-Site)/i.test(String(value || ''));
  }

  /**
   * A sovereign site can only be sold as a sovereign subscription, so the subscription type
   * follows the chosen site instead of being picked independently. Moving back to a standard
   * site restores the default type.
   */
  function syncSubscriptionTypeToDeployment() {
    var deploymentSelect = document.querySelector('select[name="deployment_location"]');
    var typeSelect = getById('subscription-type');
    if (!deploymentSelect || !typeSelect) return;
    if (isSovereignDeploymentValue(deploymentSelect.value)) {
      typeSelect.value = 'Sovereign';
    } else if (typeSelect.value === 'Sovereign') {
      typeSelect.value = 'USPS';
    }
    updateSovereignTag();
  }

  /**
   * Flags a sovereign quote next to the page title, matching the Console's sovereignty tag, so the
   * constraint is visible without scrolling down to the subscription-type field.
   */
  function updateSovereignTag() {
    var tag = getById('sizing-sovereign-tag');
    if (!tag) return;
    var deploymentSelect = document.querySelector('select[name="deployment_location"]');
    var typeSelect = getById('subscription-type');
    var siteValue = deploymentSelect ? deploymentSelect.value : '';
    var isSovereign = (typeSelect && typeSelect.value === 'Sovereign') || isSovereignDeploymentValue(siteValue);
    tag.hidden = !isSovereign;
    if (!isSovereign) return;
    var siteLabel = '';
    if (deploymentSelect && deploymentSelect.selectedIndex >= 0) {
      siteLabel = deploymentSelect.options[deploymentSelect.selectedIndex].textContent || '';
    }
    tag.textContent = siteLabel ? 'Sovereign \u00b7 ' + siteLabel : 'Sovereign';
  }

  function getQuoteStateForStorage() {
    var contractEl = document.querySelector('input[name="contract-length"]:checked');
    var billingEl = document.querySelector('input[name="billing-frequency"]:checked');
    var effectiveCustom = customContractLength || (customContractByQuote[currentQuoteId] || null);
    var selectedWorkloadIds = [];
    document.querySelectorAll('#workload-specific .quote-workload-tile.selected').forEach(function (t) {
      if (t.dataset.workload) selectedWorkloadIds.push(t.dataset.workload);
    });
    document.querySelectorAll('.quote-workload-tiles-general .quote-workload-tile.selected').forEach(function (t) {
      if (t.dataset.workload) selectedWorkloadIds.push(t.dataset.workload);
    });
    var discountEl = getById('sidebar-discount-rate');
    var currencyEl = getById('sidebar-currency');
    var deviationsEl = getById('sidebar-deviations');
    var autoRenewEl = document.querySelector('input[name="auto-renewal"]:checked');
    var autoRenewDurationEl = document.querySelector('select[name="auto-renewal-duration"]');
    var deploymentEl = document.querySelector('select[name="deployment_location"]');
    var subscriptionTypeEl = getById('subscription-type');
    return {
      contractLengthValue: contractEl ? contractEl.value : '3',
      customContractData: effectiveCustom ? { value: effectiveCustom.value, unit: effectiveCustom.unit, display: effectiveCustom.display, justification: effectiveCustom.justification || '' } : null,
      billingValue: billingEl ? billingEl.value : 'annually',
      customBilling: (function () {
        var b = customBillingByQuote[currentQuoteId] || customBilling;
        return b ? { interval: b.interval, unit: b.unit, justification: b.justification || '' } : null;
      })(),
      sidebarDeviationValue: deviationsEl ? deviationsEl.value : '',
      quoteItems: quoteItems.slice(),
      planConfigs: JSON.parse(JSON.stringify(planConfigs)),
      burstByPlan: JSON.parse(JSON.stringify(burstByPlan)),
      workloadConfigs: JSON.parse(JSON.stringify(workloadConfigs)),
      appliedDiscountPct: appliedDiscountPct,
      discountRateInput: discountEl ? discountEl.value : '0',
      currency: currencyEl ? currencyEl.value : 'USD',
      autoRenew: autoRenewEl ? autoRenewEl.value : 'yes',
      autoRenewDuration: (function () {
        if (!autoRenewDurationEl) return '12';
        var v = autoRenewDurationEl.value;
        if (v === '12' || v === 'contract') return v;
        if (v === 'custom') {
          var customVal = getById('auto-renewal-custom-value');
          var customUnit = getById('auto-renewal-custom-unit');
          var n = customVal ? parseInt(customVal.value, 10) : 12;
          if (isNaN(n) || n < 1) n = 12;
          var months = customUnit && customUnit.value === 'years' ? n * 12 : n;
          return String(Math.min(120, Math.max(1, months)));
        }
        return '12';
      })(),
      deploymentLocation: deploymentEl ? deploymentEl.value : '',
      deploymentLocationLabel: (deploymentEl && deploymentEl.selectedIndex >= 0)
        ? (deploymentEl.options[deploymentEl.selectedIndex].textContent || '')
        : '',
      subscriptionType: subscriptionTypeEl ? subscriptionTypeEl.value : 'USPS',
      billToAddress: (getById('bill-to-address') && getById('bill-to-address').value) || '',
      shipToAddress: (getById('ship-to-address') && getById('ship-to-address').value) || '',
      selectedWorkloadIds: selectedWorkloadIds,
      requestedDeviations: requestedDeviations.slice(),
      selectedAddons: (function () {
        var picked = [];
        document.querySelectorAll('input[name="addon_subscription"]:checked').forEach(function (cb) {
          picked.push(cb.value);
        });
        return picked;
      })(),
      adpAnnualCost: getAdpAnnualCost(),
      dataTieringTiB: dataTieringTiB,
      diiAnnualCost: getDiiAnnualCost(),
      clusterJoinSelected: !!(document.querySelector('input[name="addon_subscription"][value="co-mingling"]') && document.querySelector('input[name="addon_subscription"][value="co-mingling"]').checked)
    };
  }

  function saveQuoteStateToStorage(quoteId, forceSave) {
    if (!ENABLE_SIZING_DRAFT_PERSISTENCE && !forceSave) return;
    try {
      var state = getQuoteStateForStorage();
      var key = getQuoteStorageKey(quoteId || currentQuoteId);
      sessionStorage.setItem(key, JSON.stringify(state));
      localStorage.setItem(key, JSON.stringify(state));
      sessionStorage.setItem('sizingReturnUrl', window.location.href);
    } catch (e) {}
  }

  function resetSizingToDefault() {
    try {
      sessionStorage.removeItem(getQuoteStorageKey(currentQuoteId));
      sessionStorage.removeItem('sizingQuoteState');
      sessionStorage.removeItem('sizingReturnUrl');
    } catch (e) {}
    window.location.replace('sizing.html?quote=' + encodeURIComponent(currentQuoteId) + '&opportunity=' + encodeURIComponent(currentOpportunityId));
  }

  function restoreQuoteStateFromStorage(forceFromKey) {
    if (!ENABLE_SIZING_DRAFT_PERSISTENCE && !quoteReadOnlyMode && !fromCustomerRequest && !fromNpvReturn) return false;
    try {
      var raw = null;
      if (forceFromKey) {
        raw = sessionStorage.getItem(getQuoteStorageKey(currentQuoteId));
      } else if (sessionStorage.getItem('sizingRestoreOnLoad')) {
        sessionStorage.removeItem('sizingRestoreOnLoad');
        raw = sessionStorage.getItem(getQuoteStorageKey(currentQuoteId));
      } else if (sessionStorage.getItem('sizingQuoteState')) {
        raw = sessionStorage.getItem('sizingQuoteState');
        sessionStorage.removeItem('sizingQuoteState');
        if (raw) sessionStorage.setItem(getQuoteStorageKey(currentQuoteId), raw);
      }
      if (!raw) {
        raw = localStorage.getItem(getQuoteStorageKey(currentQuoteId));
      }
      if (!raw) {
        quoteStateRestored = false;
        return false;
      }
      var state = JSON.parse(raw);
      sessionStorage.removeItem('sizingReturnUrl');

      previousContractLengthValue = state.contractLengthValue || '3';
      previousBillingFrequencyValue = state.billingValue || 'annually';
      if (state.customContractData) {
        customContractByQuote[currentQuoteId] = state.customContractData;
        customContractLength = state.customContractData;
      } else {
        customContractByQuote[currentQuoteId] = null;
        customContractLength = null;
      }
      if (state.customBilling) {
        customBillingByQuote[currentQuoteId] = state.customBilling;
        customBilling = state.customBilling;
      } else {
        customBillingByQuote[currentQuoteId] = null;
        customBilling = null;
      }
      quoteItems = state.quoteItems || [];
      planConfigs = state.planConfigs || {};
      burstByPlan = state.burstByPlan || {};
      workloadConfigs = state.workloadConfigs || {};
      appliedDiscountPct = state.appliedDiscountPct || 0;
      requestedDeviations = state.requestedDeviations && state.requestedDeviations.length ? state.requestedDeviations.slice() : [];

      var contractRadio = document.querySelector('.contract-terms-input[name="contract-length"][value="' + (state.contractLengthValue || '3') + '"]');
      if (contractRadio) {
        contractRadio.checked = true;
        document.querySelectorAll('.contract-terms-panel .contract-terms-card').forEach(function (c) {
          var i = c.querySelector('input[name="contract-length"]');
          if (!i) return;
          c.classList.toggle('selected', i.value === state.contractLengthValue);
          c.setAttribute('aria-checked', i.value === state.contractLengthValue ? 'true' : 'false');
        });
      }
      var billingRadio = document.querySelector('.contract-terms-input[name="billing-frequency"][value="' + (state.billingValue || 'annually') + '"]');
      if (billingRadio) {
        billingRadio.checked = true;
        document.querySelectorAll('.contract-terms-panel .contract-terms-card').forEach(function (c) {
          var i = c.querySelector('input[name="billing-frequency"]');
          if (!i) return;
          c.classList.toggle('selected', i.value === state.billingValue);
          c.setAttribute('aria-checked', i.value === state.billingValue ? 'true' : 'false');
        });
      }
      var devSelect = getById('sidebar-deviations');
      if (devSelect && state.sidebarDeviationValue) devSelect.value = state.sidebarDeviationValue;
      var discountInput = getById('sidebar-discount-rate');
      if (discountInput) discountInput.value = state.discountRateInput || '0';
      var currencySelect = getById('sidebar-currency');
      if (currencySelect) currencySelect.value = state.currency || 'USD';
      var autoYes = document.querySelector('input[name="auto-renewal"][value="yes"]');
      var autoNo = document.querySelector('input[name="auto-renewal"][value="no"]');
      if (state.autoRenew === 'no' && autoNo) autoNo.checked = true;
      else if (autoYes) autoYes.checked = true;
      var autoDurationSelect = document.querySelector('select[name="auto-renewal-duration"]');
      if (autoDurationSelect && state.autoRenewDuration) {
        var dur = state.autoRenewDuration;
        if (dur === '12' || dur === 'contract') {
          autoDurationSelect.value = dur;
        } else {
          var months = parseInt(dur, 10);
          if (!isNaN(months) && months >= 1) {
            autoDurationSelect.value = 'custom';
            var customValEl = getById('auto-renewal-custom-value');
            var customUnitEl = getById('auto-renewal-custom-unit');
            if (customValEl) customValEl.value = Math.min(120, months);
            if (customUnitEl) customUnitEl.value = 'months';
          } else {
            autoDurationSelect.value = '12';
          }
        }
      }
      var durationWrap = getById('auto-renewal-duration-wrap');
      if (durationWrap) durationWrap.hidden = (state.autoRenew !== 'yes');
      updateAutoRenewDurationVisibility();
      var deploymentSelect = document.querySelector('select[name="deployment_location"]');
      if (deploymentSelect && state.deploymentLocation) {
        // A Console-submitted request can name a site that isn't in the seller's static list.
        var hasSiteOption = Array.prototype.some.call(deploymentSelect.options, function (o) {
          return o.value === state.deploymentLocation;
        });
        if (!hasSiteOption) {
          var siteOption = document.createElement('option');
          siteOption.value = state.deploymentLocation;
          siteOption.textContent = state.deploymentLocationLabel || state.deploymentLocation;
          deploymentSelect.appendChild(siteOption);
        }
        deploymentSelect.value = state.deploymentLocation;
      }
      var subscriptionTypeSelect = getById('subscription-type');
      if (subscriptionTypeSelect) subscriptionTypeSelect.value = state.subscriptionType || 'USPS';
      syncSubscriptionTypeToDeployment();

      if (Array.isArray(state.selectedAddons)) {
        document.querySelectorAll('input[name="addon_subscription"]').forEach(function (cb) {
          cb.checked = state.selectedAddons.indexOf(cb.value) !== -1;
        });
      }
      if (state.dataTieringTiB) dataTieringTiB = state.dataTieringTiB;
      var billToEl = getById('bill-to-address');
      var shipToEl = getById('ship-to-address');
      if (billToEl) billToEl.value = state.billToAddress || '';
      if (shipToEl) shipToEl.value = state.shipToAddress || '';

      if (state.selectedWorkloadIds && state.selectedWorkloadIds.length) {
        document.querySelectorAll('#workload-specific .quote-workload-tile').forEach(function (t) {
          t.classList.toggle('selected', state.selectedWorkloadIds.indexOf(t.dataset.workload) !== -1);
        });
        document.querySelectorAll('.quote-workload-tiles-general .quote-workload-tile').forEach(function (t) {
          t.classList.toggle('selected', state.selectedWorkloadIds.indexOf(t.dataset.workload) !== -1);
        });
      }

      quoteStateRestored = true;
      return true;
    } catch (e) {
      quoteStateRestored = false;
      return false;
    }
  }

  function updateSidebarDeviationsBox(deviationsList) {
    var box = getById('sidebar-deviations-box');
    if (!box) return;
    if (deviationsList.length === 0) {
      box.innerHTML = '<div class="quote-summary-deviations quote-summary-deviations--empty">' +
        '<h4 class="quote-summary-block-title quote-summary-deviations-title">Feature requests</h4>' +
        '<p class="quote-summary-deviations-desc">No feature requests selected. Add one from the dropdown above.</p>' +
        '</div>';
    } else {
      box.innerHTML = '<div class="quote-summary-deviations">' +
        '<h4 class="quote-summary-block-title quote-summary-deviations-title">Feature requests</h4>' +
        '<p class="quote-summary-deviations-desc">The following items are feature requests and will be visible to the deal desk at approval.</p>' +
        '<ul class="quote-summary-deviations-list">' +
        deviationsList.map(function (d) {
          return '<li class="quote-summary-deviations-item"><span class="quote-summary-deviations-label">' + escapeHtml(d.label) + '</span><span class="quote-summary-deviations-value">' + escapeHtml(d.value) + '</span></li>';
        }).join('') +
        '</ul></div>';
    }
  }

  function renderSidebarSelections(state) {
    var el = getById('sidebar-selections');
    var summarySection = getById('quote-sidebar-summary');
    if (!el) return;

    var deviationsList = getDeviationsList(state);
    updateSidebarDeviationsBox(deviationsList);

    var addedItems = Array.isArray(state.quoteItemsDetailed) ? state.quoteItemsDetailed : [];
    var hasAddedPlans = addedItems.length > 0;
    var hasSummaryContent = !!(state.contractLength || state.billingFrequency || state.autoRenew || state.subscriptionType || state.billToAddress || state.shipToAddress || hasAddedPlans || (state.addons && state.addons.length));

    if (!hasSummaryContent) {
      if (summarySection) summarySection.hidden = true;
      el.innerHTML = '';
      return;
    }
    if (summarySection) summarySection.hidden = false;

    var parts = [];

    function detailLine(label, value, isDeviation) {
      if (!value) return '';
      var rowClass = 'quote-selection-row' + (isDeviation ? ' quote-selection-row--deviation' : '');
      var valueContent = escapeHtml(value);
      if (isDeviation) {
        valueContent = valueContent + ' <span class="quote-summary-deviation-badge" aria-label="Feature request">Feature request</span>';
      }
      return '<div class="' + rowClass + '"><span class="quote-selection-label">' + escapeHtml(label) + '</span><span class="quote-selection-value">' + valueContent + '</span></div>';
    }

    parts.push('<div class="quote-summary-block quote-summary-details">');
    parts.push('<h4 class="quote-summary-block-title">Quote details</h4>');
    if (state.contractLength) parts.push(detailLine('Contract', state.contractLength, state.contractLengthIsDeviation));
    if (state.billingFrequency) parts.push(detailLine('Billing', state.billingFrequency, state.billingIsDeviation));
    if (state.autoRenew) {
      var autoLabel;
      if (state.autoRenew === 'yes' && state.autoRenewDuration) {
        if (state.autoRenewDuration === 'contract') {
          var renewYears = getContractYearsForAutoRenew();
          autoLabel = renewYears === 1 ? 'Yes — Same as term length (1 year)' : 'Yes — Same as term length (' + renewYears + ' years)';
        } else if (state.autoRenewDuration === '12') {
          autoLabel = 'Yes — 12 months';
        } else {
          var m = parseInt(state.autoRenewDuration, 10);
          autoLabel = !isNaN(m) ? 'Yes — ' + m + ' months' : 'Yes — ' + state.autoRenewDuration;
        }
      } else {
        autoLabel = state.autoRenew === 'no' ? 'No' : state.autoRenew;
      }
      parts.push(detailLine('Auto renew', autoLabel, false));
    }
    if (state.subscriptionType) parts.push(detailLine('Subscription type', state.subscriptionType, false));
    if (state.billToAddress) parts.push(detailLine('Bill-to', state.billToAddress, false));
    if (state.shipToAddress) parts.push(detailLine('Ship-to', state.shipToAddress, false));
    if (!window.CUSTOMER_VIEW) {
      parts.push(detailLine('Currency', state.currency || 'USD', false));
      if (state.discountRatePct && parseInt(state.discountRatePct, 10) > 0) parts.push(detailLine('Discount', state.discountRatePct + '%', false));
    }
    parts.push('</div>');

    if (hasAddedPlans) {
      var groupedByPlan = {};
      addedItems.forEach(function (item) {
        if (!item.planName) return;
        if (!groupedByPlan[item.planName]) groupedByPlan[item.planName] = [];
        groupedByPlan[item.planName].push(item);
      });
      Object.keys(groupedByPlan).forEach(function (planName) {
        var p = getPlanByName(planName);
        if (!p) return;
        var psl = state.performanceServiceLevelByPlan[planName];
        var planId = p.id;
        var workloadConfigsForPlan = groupedByPlan[planName];
        parts.push('<div class="quote-summary-plan-container" data-plan-name="' + escapeHtml(planName) + '">');
        parts.push('<div class="quote-summary-plan-title-row"><h4 class="quote-summary-plan-container-title">' + escapeHtml(planName) + '</h4>' +
          '<button type="button" class="quote-summary-plan-delete" data-plan-name="' + escapeHtml(planName) + '" aria-label="Remove ' + escapeHtml(planName) + '" title="Remove from quote">✕</button></div>');
        var planMeta = getPlanByName(planName);
        if (planMeta && planMeta.hardwareSeries && planMeta.hardwareSeries.length) {
          parts.push('<div class="quote-summary-plan-section">');
          parts.push('<span class="quote-summary-plan-section-label">Hardware series</span>');
          parts.push('<p class="quote-summary-addons-inline">' + escapeHtml(planMeta.hardwareSeries.join(', ')) + '</p>');
          parts.push('</div>');
        }

        parts.push('<div class="quote-summary-plan-section">');
        parts.push('<span class="quote-summary-plan-section-label">Workloads</span>');
        workloadConfigsForPlan.forEach(function (w) {
          var spec = w.spec || '—';
          parts.push('<div class="quote-summary-workload-row"><span class="quote-summary-workload-name">' + escapeHtml(w.workloadLabel || w.name || 'Workload') + '</span><span class="quote-summary-workload-spec">' + escapeHtml(spec) + '</span></div>');
        });
        parts.push('</div>');

        if (psl && (psl.usableEffective || psl.ioMix || psl.snapmirror || psl.burst)) {
          parts.push('<div class="quote-summary-plan-section">');
          parts.push('<span class="quote-summary-plan-section-label">Additional configurations</span>');
          var configRows = [];
          if (psl.usableEffective) configRows.push('<div class="quote-selection-row"><span class="quote-selection-label">Usable / Effective</span><span class="quote-selection-value">' + escapeHtml(psl.usableEffective) + '</span></div>');
          if (psl.ioMix) configRows.push('<div class="quote-selection-row"><span class="quote-selection-label">I/O MIX</span><span class="quote-selection-value">' + escapeHtml(psl.ioMix) + '</span></div>');
          if (psl.snapmirror) configRows.push('<div class="quote-selection-row"><span class="quote-selection-label">SnapMirror</span><span class="quote-selection-value">' + escapeHtml(psl.snapmirror) + '</span></div>');
          if (psl.burst) {
            var burstRowClass = 'quote-selection-row' + (psl.burstIsDeviation ? ' quote-selection-row--deviation' : '');
            var burstVal = escapeHtml(psl.burst);
            if (psl.burstIsDeviation) {
              burstVal = burstVal + ' <span class="quote-summary-deviation-badge" aria-label="Feature request">Feature request</span>';
            }
            configRows.push('<div class="' + burstRowClass + '"><span class="quote-selection-label">Burst</span><span class="quote-selection-value">' + burstVal + '</span></div>');
          }
          parts.push(configRows.join(''));
          parts.push('</div>');
        }

        parts.push('</div>');
      });
    }

    if (state.addons && state.addons.length) {
      var addonLabels = state.addons.map(getSubscriptionAddonLabel);
      parts.push('<div class="quote-summary-block quote-summary-subscription">');
      parts.push('<h4 class="quote-summary-block-title">Subscription add-ons</h4>');
      parts.push('<p class="quote-summary-addons-list">' + escapeHtml(addonLabels.join(', ')) + '</p>');
      parts.push('</div>');
    }

    el.innerHTML = parts.join('');
    el.querySelectorAll('.quote-summary-plan-delete').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var pn = btn.dataset.planName;
        if (pn) removeQuoteItemsByPlan(pn);
      });
    });
  }

  function escapeHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  /** Refresh per-TiB price shown on each add-on card based on selected contract length. */
  function updateAddonCardPrices() {
    var contractMonths = getCurrentContractYears() * 12;
    // ADP card
    var adpRate = getAdpRatePerTiBMonth(contractMonths);
    var adpEl = getById('adp-card-rate');
    if (adpEl) adpEl.textContent = '$' + adpRate.toFixed(2) + ' / TiB / month';
    // Data Tiering card — show rate for current capacity tier (or base tier if none set yet)
    var tieringEl = getById('tiering-card-rate');
    if (tieringEl) {
      if (dataTieringTiB > 0) {
        var dtRate = getDtRatePerTiBMonth(dataTieringTiB);
        var dtAnnual = getDtAnnualCost();
        tieringEl.textContent = '$' + dtRate.toFixed(2) + ' / TiB / month  (' + dataTieringTiB + ' TiB — $' + Math.round(dtAnnual).toLocaleString() + '/yr)';
      } else {
        tieringEl.textContent = '$' + getDtRatePerTiBMonth(1).toFixed(2) + ' – $' + getDtRatePerTiBMonth(1000).toFixed(2) + ' / TiB / month';
      }
    }
    // DII card — show calculated total once workloads are configured, else show range
    var diiEl = getById('dii-card-rate');
    if (diiEl) {
      var diiAnnualPreview = getDiiAnnualCost();
      var diiCb = document.querySelector('input[name="addon_subscription"][value="dii"]');
      if (diiCb && diiCb.checked && diiAnnualPreview > 0) {
        diiEl.textContent = formatCurrency(Math.round(diiAnnualPreview)) + ' / year';
      } else {
        diiEl.textContent = '$' + demoAddonRate(0.36).toFixed(2) + ' – $' + demoAddonRate(4.00).toFixed(2) + ' / TiB / month (by plan)';
      }
    }
  }

  function deselectWorkloadTileByLabel(label) {
    if (!label) return;
    document.querySelectorAll('.quote-workload-tile.selected').forEach(function (tile) {
      var lbl = tile.querySelector('.quote-workload-tile-label');
      if (lbl && lbl.textContent.trim() === label) {
        tile.classList.remove('selected');
      }
    });
  }

  function deselectWorkloadTileById(wid) {
    if (!wid) return;
    var tile = document.querySelector('.quote-workload-tile[data-workload="' + wid + '"]');
    if (tile) tile.classList.remove('selected');
  }

  function removeQuoteItemsByPlan(planName) {
    var removedLabels = [];
    for (var i = quoteItems.length - 1; i >= 0; i--) {
      if (quoteItems[i].planName === planName) {
        if (quoteItems[i].workloadLabel) removedLabels.push(quoteItems[i].workloadLabel);
        quoteItems.splice(i, 1);
      }
    }
    var wids = Object.keys(workloadConfigs);
    for (var w = 0; w < wids.length; w++) {
      var wc = workloadConfigs[wids[w]];
      if (wc && wc.selectedPlan === planName) {
        wc.selectedPlan = null;
        wc.selectedPlanCost = null;
        deselectWorkloadTileById(wids[w]);
      }
    }
    for (var r = 0; r < removedLabels.length; r++) {
      deselectWorkloadTileByLabel(removedLabels[r]);
    }
    updateItemization();
    updateSidebarFromSelections();
    updateSidebarTotals();
    renderWorkloadConfigCards();
  }

  function removeQuoteItemByIndex(idx) {
    if (idx < 0 || idx >= quoteItems.length) return;
    var removed = quoteItems[idx];
    if (!removed) return;
    var planName = removed.planName;
    var allSamePlan = quoteItems.filter(function (q) { return q.planName === planName; });
    if (allSamePlan.length <= 1) {
      removeQuoteItemsByPlan(planName);
    } else {
      quoteItems.splice(idx, 1);
      if (removed.workloadLabel) {
        var wids = Object.keys(workloadConfigs);
        for (var wi = 0; wi < wids.length; wi++) {
          var wc = workloadConfigs[wids[wi]];
          var wl = getSelectedWorkloads().filter(function (x) { return x.id === wids[wi]; })[0];
          if (wl && wl.label === removed.workloadLabel && wc.selectedPlan === removed.planName) {
            wc.selectedPlan = null;
            wc.selectedPlanCost = null;
            deselectWorkloadTileById(wids[wi]);
            break;
          }
        }
        deselectWorkloadTileByLabel(removed.workloadLabel);
      }
      updateItemization();
      updateSidebarFromSelections();
      updateSidebarTotals();
      renderWorkloadConfigCards();
    }
  }

  /* ── Inline sizing output panel ── */

  var sizingOutputPendingBilling = null;
  var sizingOutputConfirmed = false;

  function sizingOutputRoundUp25(v) {
    return Math.ceil((v || 0) / 25) * 25;
  }

  function sizingOutputRoundUpToStep(x, step) {
    var s = Math.max(1, Number(step) || 1);
    return Math.ceil((x || 0) / s) * s;
  }

  function sizingOutputGetCapacityAtMonth(inputs, monthIndex) {
    var start = Number(inputs.startingCapacity) || 0;
    if (!isFinite(monthIndex) || monthIndex <= 0) return start;
    var growth = Number(inputs.growthRate) || 0;
    return start * Math.pow(1 + growth, monthIndex / 12);
  }

  function sizingOutputGetFirstCrossMonth(inputs, capacity, demandAtMonth) {
    var totalMonths = Math.max(1, Math.floor(Number(inputs.termYears) || 1)) * 12;
    for (var m = 1; m <= totalMonths; m++) {
      if (demandAtMonth(m) >= capacity) return m;
    }
    return null;
  }

  function sizingOutputGetRecommendedCapacity(inputs, demandAtMonth, step) {
    var totalMonths = Math.max(1, Math.floor(Number(inputs.termYears) || 1)) * 12;
    var windowStart = Math.min(13, totalMonths);
    var windowEnd = Math.min(17, totalMonths);
    var targetMonth = Math.min(15, totalMonths);
    var candidates = [];
    for (var m = windowStart; m <= windowEnd; m++) {
      var cap = sizingOutputRoundUpToStep(demandAtMonth(m), step);
      var crossMonth = sizingOutputGetFirstCrossMonth(inputs, cap, demandAtMonth);
      if (crossMonth !== null) candidates.push({ capacity: cap, crossMonth: crossMonth });
    }
    var inWindow = candidates.filter(function (c) { return c.crossMonth >= windowStart && c.crossMonth <= windowEnd; });
    if (inWindow.length) {
      inWindow.sort(function (a, b) { return Math.abs(a.crossMonth - targetMonth) - Math.abs(b.crossMonth - targetMonth) || a.capacity - b.capacity; });
      return inWindow[0].capacity;
    }
    if (candidates.length) {
      candidates.sort(function (a, b) { return Math.abs(a.crossMonth - targetMonth) - Math.abs(b.crossMonth - targetMonth) || a.capacity - b.capacity; });
      return candidates[0].capacity;
    }
    return sizingOutputRoundUpToStep(demandAtMonth(targetMonth), step);
  }

  function sizingOutputGatherInputs() {
    var selected = getSelectedWorkloads();
    if (!selected.length) return null;
    var firstCfg = null;
    var firstPlan = null;
    for (var i = 0; i < selected.length; i++) {
      var cfg = workloadConfigs[selected[i].id];
      if (cfg && cfg.selectedPlan) {
        firstCfg = cfg;
        firstPlan = getPlanByName(cfg.selectedPlan);
        break;
      }
    }
    if (!firstCfg) return null;

    var usedCap = parseFloat(firstCfg.capacity);
    if (isNaN(usedCap) || usedCap <= 0) return null;

    var iops = parseFloat(firstCfg.iops);
    if (isNaN(iops) || iops <= 0) return null;

    var latency = parseFloat(firstCfg.latency);
    if (isNaN(latency) || latency < 0) return null;

    var growthRate = parseFloat(firstCfg.annualGrowthRate);
    if (isNaN(growthRate)) return null;

    var se = parseFloat(firstCfg.storageEfficiencyRatio);
    if (isNaN(se) || se <= 0) return null;

    var burstPct = parseFloat(getNormalizedBurstValue(firstCfg.burst));
    if (isNaN(burstPct) || burstPct <= 0) return null;

    var termYears = getCurrentContractYears() || 3;

    return {
      usedCapEffective: usedCap,
      usedCapUsable: usedCap / Math.max(1, se),
      se: se,
      burstPct: burstPct,
      growthRate: growthRate / 100,
      termYears: termYears,
      usableEffective: firstCfg.usableEffective || 'effective',
      planName: firstCfg.selectedPlan,
      planFamily: firstPlan ? firstPlan.family : 'Unified'
    };
  }

  function clearSizingOutputPanel() {
    var dash = '—';
    var ids = [
      'sizing-out-usable-min', 'sizing-out-usable-burst', 'sizing-out-usable-full',
      'sizing-out-eff-min', 'sizing-out-eff-burst', 'sizing-out-eff-full',
      'sizing-out-month-min-usable', 'sizing-out-month-min-eff',
      'sizing-out-month-burst-usable', 'sizing-out-month-burst-eff',
      'sizing-out-eg1-min', 'sizing-out-eg1-burst', 'sizing-out-eg1-full',
      'sizing-out-capex-min'
    ];
    for (var i = 0; i < ids.length; i++) {
      var el = getById(ids[i]);
      if (el) el.textContent = dash;
    }
    var forecastBody = getById('sizing-output-forecast-body');
    if (forecastBody) forecastBody.innerHTML = '';
    var cards = document.querySelectorAll('.sizing-output-card');
    for (var j = 0; j < cards.length; j++) {
      cards[j].classList.remove('sizing-output-card--active');
    }
  }

  function renderSizingOutputPanel() {
    if (sizingOutputConfirmed) return;
    var panel = getById('sizing-output-panel');
    if (!panel) return;
    var inputs = sizingOutputGatherInputs();
    if (!inputs) {
      clearSizingOutputPanel();
      return;
    }

    var termYears = inputs.termYears;
    var growthRate = inputs.growthRate;
    var startUsable = inputs.usedCapUsable;
    var startEffective = inputs.usedCapEffective;
    var burstPct = inputs.burstPct;
    var se = inputs.se;

    var usableInputs = { startingCapacity: startUsable, growthRate: growthRate, termYears: termYears };
    var effectiveInputs = { startingCapacity: startEffective, growthRate: growthRate, termYears: termYears };

    // Forecast table
    var forecastBody = getById('sizing-output-forecast-body');
    if (forecastBody) {
      var rows = '';
      for (var y = 0; y <= termYears; y++) {
        var month = y * 12;
        var usable = sizingOutputGetCapacityAtMonth(usableInputs, month);
        var effective = sizingOutputGetCapacityAtMonth(effectiveInputs, month);
        rows += '<tr><td>Year ' + y + '</td><td>' + Math.round(usable) + ' TiB</td><td>' + Math.round(effective) + ' TiB</td></tr>';
      }
      forecastBody.innerHTML = rows;
    }

    // Usable path
    var usableDemand = function (m) { return sizingOutputGetCapacityAtMonth(usableInputs, m); };
    var usableMin = sizingOutputGetRecommendedCapacity(usableInputs, usableDemand, 25);
    var usableBurst = sizingOutputRoundUp25(usableMin * (burstPct / 100));
    var usableFull = usableMin + usableBurst;

    var elUsableMin = getById('sizing-out-usable-min');
    var elUsableBurst = getById('sizing-out-usable-burst');
    var elUsableFull = getById('sizing-out-usable-full');
    if (elUsableMin) elUsableMin.textContent = usableMin + ' TiB';
    if (elUsableBurst) elUsableBurst.textContent = usableBurst + ' TiB (' + burstPct + '%)';
    if (elUsableFull) elUsableFull.textContent = usableFull + ' TiB';

    // Effective path
    var effDemand = function (m) { return sizingOutputGetCapacityAtMonth(effectiveInputs, m); };
    var effMin = sizingOutputGetRecommendedCapacity(effectiveInputs, effDemand, 25);
    var effBurst = sizingOutputRoundUp25(effMin * (burstPct / 100));
    var effFull = effMin + effBurst;

    var elEffMin = getById('sizing-out-eff-min');
    var elEffBurst = getById('sizing-out-eff-burst');
    var elEffFull = getById('sizing-out-eff-full');
    if (elEffMin) elEffMin.textContent = effMin + ' TiB';
    if (elEffBurst) elEffBurst.textContent = effBurst + ' TiB (' + burstPct + '%)';
    if (elEffFull) elEffFull.textContent = effFull + ' TiB';

    // Threshold timing
    var usableMonthMin = sizingOutputGetFirstCrossMonth(usableInputs, usableMin, usableDemand);
    var usableMonthBurst = sizingOutputGetFirstCrossMonth(usableInputs, usableFull, usableDemand);
    var effMonthMin = sizingOutputGetFirstCrossMonth(effectiveInputs, effMin, effDemand);
    var effMonthBurst = sizingOutputGetFirstCrossMonth(effectiveInputs, effFull, effDemand);

    function fmtMonth(m) { return m ? 'Month ' + m : 'Not within term'; }
    var elMonthMinU = getById('sizing-out-month-min-usable');
    var elMonthMinE = getById('sizing-out-month-min-eff');
    var elMonthBurstU = getById('sizing-out-month-burst-usable');
    var elMonthBurstE = getById('sizing-out-month-burst-eff');
    if (elMonthMinU) elMonthMinU.textContent = fmtMonth(usableMonthMin);
    if (elMonthMinE) elMonthMinE.textContent = fmtMonth(effMonthMin);
    if (elMonthBurstU) elMonthBurstU.textContent = fmtMonth(usableMonthBurst);
    if (elMonthBurstE) elMonthBurstE.textContent = fmtMonth(effMonthBurst);

    // Pure EG1 Effective — uses effective capacity path with 25% burst
    var eg1BurstPct = 25;
    var eg1DemandAtMonth = function (m) {
      return inputs.usableEffective === 'effective'
        ? effDemand(m)
        : usableDemand(m) * Math.max(1, se);
    };
    var eg1Min = sizingOutputGetRecommendedCapacity(effectiveInputs, eg1DemandAtMonth, 25);
    var eg1Burst = sizingOutputRoundUp25(eg1Min * (eg1BurstPct / 100));
    var eg1Full = eg1Min + eg1Burst;
    var elEg1Min = getById('sizing-out-eg1-min');
    var elEg1Burst = getById('sizing-out-eg1-burst');
    var elEg1Full = getById('sizing-out-eg1-full');
    if (elEg1Min) elEg1Min.textContent = eg1Min + ' TiB';
    if (elEg1Burst) elEg1Burst.textContent = eg1Burst + ' TiB (25%)';
    if (elEg1Full) elEg1Full.textContent = eg1Full + ' TiB';

    // CAPEX — end-of-term usable demand, rounded up to nearest TiB
    var capexCap = sizingOutputRoundUpToStep(sizingOutputGetCapacityAtMonth(usableInputs, termYears * 12), 1);
    var elCapexMin = getById('sizing-out-capex-min');
    if (elCapexMin) elCapexMin.textContent = capexCap + ' TiB';

    // Update the deep link with current params
    var deeplink = getById('sizing-output-deeplink');
    if (deeplink) {
      var params = new URLSearchParams();
      params.set('view', 'new-workload');
      params.set('capacity', String(Math.round(inputs.usedCapEffective)));
      params.set('se', String(inputs.se));
      params.set('burst', String(Math.round(inputs.burstPct)));
      params.set('term', String(inputs.termYears));
      params.set('growth', String(Math.round(inputs.growthRate * 100)));
      var planName = (inputs.planName || '').toLowerCase();
      if (planName.indexOf('extreme') !== -1 || planName.indexOf('premium') !== -1) params.set('level', 'premium');
      else if (planName.indexOf('standard') !== -1) params.set('level', 'standard');
      else if (planName.indexOf('value') !== -1) params.set('level', 'value');
      if (planName.indexOf('block') !== -1) params.set('stype', 'block');
      else if (planName.indexOf('object') !== -1) params.set('stype', 'object');
      else params.set('stype', 'unified');

      var capexResult = computeCapexHardwareLicense();
      if (capexResult) {
        params.set('capex_hw', String(capexResult.hwLicense));
      }
      var cd = CAPEX_DEFAULTS;
      params.set('capex_tax', String(Math.round(cd.taxRate * 100)));
      params.set('capex_install', String(cd.installation));
      params.set('capex_setup', String(cd.setup));
      params.set('capex_maint', String(cd.maintenance));
      params.set('capex_dc', String(cd.datacenter));
      params.set('capex_sm', String(cd.successManager));

      deeplink.href = 'staas-tco-npv.html?' + params.toString();
    }

    // Show only the card that matches the currently selected billing mode
    var currentMode = 'effective';
    var selected = getSelectedWorkloads();
    for (var si = 0; si < selected.length; si++) {
      var sc = workloadConfigs[selected[si].id];
      if (sc) {
        currentMode = sc.usableEffective || 'effective';
        break;
      }
    }
    var cardUsable = getById('sizing-out-card-usable');
    var cardEffective = getById('sizing-out-card-effective');
    if (cardUsable) {
      cardUsable.style.display = '';
      cardUsable.classList.toggle('sizing-output-card--active', currentMode === 'usable');
    }
    if (cardEffective) {
      cardEffective.style.display = '';
      cardEffective.classList.toggle('sizing-output-card--active', currentMode === 'effective');
    }

    // Redraw chart if visible
    sizingOutputDrawChart();
  }

  /* ── Forecast vs commit capacity chart ── */

  var sizingCapChart = null;

  function sizingOutputGetChartMode() {
    var active = document.querySelector('.sizing-chart-mode-btn.is-active');
    return (active && active.dataset.chartMode) || 'both';
  }

  function sizingOutputBuildChartData(inputs, usableMin, effMin) {
    var termYears = inputs.termYears;
    var growthRate = inputs.growthRate;
    var startUsable = inputs.usedCapUsable;
    var startEffective = inputs.usedCapEffective;
    var labels = [];
    var usableForecast = [];
    var effectiveForecast = [];
    for (var y = 1; y <= termYears; y++) {
      labels.push('Year ' + y);
      var month = y * 12;
      var uInputs = { startingCapacity: startUsable, growthRate: growthRate, termYears: termYears };
      var eInputs = { startingCapacity: startEffective, growthRate: growthRate, termYears: termYears };
      usableForecast.push(sizingOutputGetCapacityAtMonth(uInputs, month));
      effectiveForecast.push(sizingOutputGetCapacityAtMonth(eInputs, month));
    }
    var usableCommit = [];
    var effectiveCommit = [];
    for (var y2 = 0; y2 < termYears; y2++) {
      usableCommit.push(usableMin);
      effectiveCommit.push(effMin);
    }
    return {
      labels: labels,
      usableForecast: usableForecast,
      effectiveForecast: effectiveForecast,
      usableCommit: usableCommit,
      effectiveCommit: effectiveCommit
    };
  }

  function sizingOutputBuildChartSpec(mode, comp) {
    var tibTick = function (v) {
      return typeof v === 'number' && isFinite(v)
        ? (new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v))
        : String(v);
    };
    var gridColor = 'rgba(48, 54, 61, 0.35)';
    var tickColor = '#64748b';
    var ds = [];
    if (mode === 'usable') {
      ds.push({ label: 'Forecast usable (TiB)', data: comp.usableForecast, backgroundColor: 'rgba(46, 125, 50, 0.75)', borderColor: '#2e7d32', borderWidth: 1 });
      ds.push({ type: 'line', label: 'Min billing usable (TiB)', data: comp.usableCommit, borderColor: '#14532d', backgroundColor: '#14532d', borderWidth: 2, tension: 0.12, pointRadius: 3 });
    } else if (mode === 'effective') {
      ds.push({ label: 'Forecast effective (TiB)', data: comp.effectiveForecast, backgroundColor: 'rgba(88, 166, 255, 0.75)', borderColor: '#58a6ff', borderWidth: 1 });
      ds.push({ type: 'line', label: 'Min billing effective (TiB)', data: comp.effectiveCommit, borderColor: '#1e40af', backgroundColor: '#1e40af', borderWidth: 2, tension: 0.12, pointRadius: 3 });
    } else {
      ds.push({ label: 'Forecast usable (TiB)', data: comp.usableForecast, backgroundColor: 'rgba(46, 125, 50, 0.7)', borderColor: '#2e7d32', borderWidth: 1 });
      ds.push({ label: 'Forecast effective (TiB)', data: comp.effectiveForecast, backgroundColor: 'rgba(88, 166, 255, 0.65)', borderColor: '#58a6ff', borderWidth: 1 });
      ds.push({ type: 'line', label: 'Min billing usable (TiB)', data: comp.usableCommit, borderColor: '#14532d', backgroundColor: '#14532d', borderWidth: 2, tension: 0.12, pointRadius: 3 });
      ds.push({ type: 'line', label: 'Min billing effective (TiB)', data: comp.effectiveCommit, borderColor: '#1e3a5f', backgroundColor: '#1e3a5f', borderWidth: 2, borderDash: [5, 4], tension: 0.12, pointRadius: 3 });
    }
    return {
      type: 'bar',
      data: { labels: comp.labels, datasets: ds },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        unifiedY: true,
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: tickColor, maxRotation: 0 } },
          y: { grid: { color: gridColor }, ticks: { color: tickColor, callback: tibTick } }
        }
      }
    };
  }

  function sizingOutputDrawChart() {
    var toggle = getById('sizingOutputChartToggle');
    var body = getById('sizingOutputChartBody');
    var canvas = getById('sizingOutputCapChart');
    if (!toggle || !body || !canvas) return;

    if (!toggle.checked) {
      body.style.display = 'none';
      if (sizingCapChart) { sizingCapChart.destroy(); sizingCapChart = null; }
      return;
    }
    body.style.display = '';

    var inputs = sizingOutputGatherInputs();
    if (!inputs) {
      if (sizingCapChart) { sizingCapChart.destroy(); sizingCapChart = null; }
      return;
    }

    var usableInputs = { startingCapacity: inputs.usedCapUsable, growthRate: inputs.growthRate, termYears: inputs.termYears };
    var effectiveInputs = { startingCapacity: inputs.usedCapEffective, growthRate: inputs.growthRate, termYears: inputs.termYears };
    var usableDemand = function (m) { return sizingOutputGetCapacityAtMonth(usableInputs, m); };
    var effDemand = function (m) { return sizingOutputGetCapacityAtMonth(effectiveInputs, m); };
    var usableMin = sizingOutputGetRecommendedCapacity(usableInputs, usableDemand, 25);
    var effMin = sizingOutputGetRecommendedCapacity(effectiveInputs, effDemand, 25);

    var comp = sizingOutputBuildChartData(inputs, usableMin, effMin);
    var mode = sizingOutputGetChartMode();
    var spec = sizingOutputBuildChartSpec(mode, comp);

    if (sizingCapChart) { sizingCapChart.destroy(); sizingCapChart = null; }
    sizingCapChart = new Chart(canvas, spec);
  }

  // Bind chart toggle and mode buttons
  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'sizingOutputChartToggle') {
      sizingOutputDrawChart();
    }
  });
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.sizing-chart-mode-btn');
    if (!btn) return;
    var btns = document.querySelectorAll('.sizing-chart-mode-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('is-active');
    btn.classList.add('is-active');
    sizingOutputDrawChart();
  });

  function sizingOutputApplyConfirmed(mode, recommendedCap) {
    var selected = getSelectedWorkloads();
    if (!selected.length) return;

    for (var i = 0; i < selected.length; i++) {
      var wid = selected[i].id;
      var cfg = workloadConfigs[wid];
      if (!cfg) continue;

      cfg.usableEffective = mode;

      if (recommendedCap > 0) {
        cfg.suggestedCapacity = String(recommendedCap);
      }

      cfg.manualPlanOverride = false;
    }

    renderWorkloadConfigCards();
    updateSidebarFromSelections();
  }

  /**
   * Runs the forecast math in the background for a single workload and
   * writes the result into cfg.suggestedCapacity.  Returns true if
   * a value was computed, false if inputs are insufficient.
   */
  function autoComputeSuggestedCapacity(wid) {
    var cfg = workloadConfigs[wid];
    if (!cfg) return false;

    function clearField() {
      cfg.suggestedCapacity = '';
      var f = getById('suggested-capacity-field-' + wid);
      if (f) f.style.display = 'none';
      var rf = getById('requested-capacity-field-' + wid);
      if (rf) rf.style.display = 'none';
      return false;
    }

    var usedCap = parseFloat(cfg.capacity);
    if (isNaN(usedCap) || usedCap <= 0) return clearField();

    var growthRate = parseFloat(cfg.annualGrowthRate);
    if (isNaN(growthRate)) return clearField();

    var se = parseFloat(cfg.storageEfficiencyRatio);
    if (isNaN(se) || se <= 0) return clearField();

    var burstPct = parseFloat(getNormalizedBurstValue(cfg.burst));
    if (isNaN(burstPct) || burstPct <= 0) return clearField();

    var termYears = getCurrentContractYears() || 3;
    var mode = cfg.usableEffective || 'effective';

    var startEffective = usedCap;
    var startUsable = usedCap / Math.max(1, se);
    var startCap = mode === 'usable' ? startUsable : startEffective;

    var inputs = { startingCapacity: startCap, growthRate: growthRate / 100, termYears: termYears };
    var demandFn = function (m) { return sizingOutputGetCapacityAtMonth(inputs, m); };
    var minCap = sizingOutputGetRecommendedCapacity(inputs, demandFn, 25);

    cfg.suggestedCapacity = String(minCap);

    var field = getById('suggested-capacity-field-' + wid);
    var input = getById('suggested-capacity-' + wid);
    if (field) field.style.display = '';
    if (input) input.value = minCap;
    var reqField = getById('requested-capacity-field-' + wid);
    if (reqField) reqField.style.display = '';

    return true;
  }

  function sizingOutputUpdateConfirmLabel(billing) {
    var label = getById('sizing-output-confirm-label');
    if (label) {
      var name = billing === 'usable' ? 'Keystone Usable' : 'Keystone Effective';
      label.textContent = name + ' selected — confirm to apply to configuration.';
    }
  }

  var sizingOutputPendingCap = 0;

  function sizingOutputSelectCard(billing) {
    sizingOutputPendingBilling = billing;

    var cardUsable = getById('sizing-out-card-usable');
    var cardEffective = getById('sizing-out-card-effective');
    if (cardUsable) cardUsable.classList.toggle('sizing-output-card--active', billing === 'usable');
    if (cardEffective) cardEffective.classList.toggle('sizing-output-card--active', billing === 'effective');

    // Read the displayed recommended min billing from the selected card
    var valueEl = billing === 'usable' ? getById('sizing-out-usable-min') : getById('sizing-out-eff-min');
    sizingOutputPendingCap = valueEl ? parseInt(valueEl.textContent, 10) || 0 : 0;

    sizingOutputUpdateConfirmLabel(billing);
  }

  // Expose forecasting state for the inline script in sizing.html
  window._sizingForecast = {
    getConfirmed: function () { return sizingOutputConfirmed; },
    setConfirmed: function (v) { sizingOutputConfirmed = v; },
    getPendingBilling: function () { return sizingOutputPendingBilling; },
    setPendingBilling: function (v) { sizingOutputPendingBilling = v; },
    getPendingCap: function () { return sizingOutputPendingCap; },
    apply: sizingOutputApplyConfirmed,
    render: renderSizingOutputPanel
  };

  // Expose state persistence for NPV navigation round-trip
  window._sizingSaveBeforeNpv = function () {
    saveQuoteStateToStorage(currentQuoteId, true);
    try {
      sessionStorage.setItem('sizingRestoreOnLoad', '1');
      sessionStorage.setItem('sizingNpvReturnQuoteId', currentQuoteId);
      sessionStorage.setItem('sizingNpvReturnOppId', currentOpportunityId);
    } catch (e) {}
  };

  // Expose CAPEX financial comparison API for the inline script
  window._capexFinApi = {
    compute: function () {
      var result = computeCapexHardwareLicense();
      if (!result) return null;
      var selected = getSelectedWorkloads();
      var cfg = null;
      for (var i = 0; i < selected.length; i++) {
        var c = workloadConfigs[selected[i].id];
        if (c && c.capacity) { cfg = c; break; }
      }
      result.planName = cfg ? (cfg.selectedPlan || '—') : '—';
      result.defaults = CAPEX_DEFAULTS;
      return result;
    }
  };

  (function () {
    document.addEventListener('click', function (e) {
      var card = e.target.closest('.sizing-output-card--clickable');
      if (!card) return;
      var billing = card.dataset.billing;
      if (billing) sizingOutputSelectCard(billing);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var card = e.target.closest('.sizing-output-card--clickable');
      if (!card) return;
      e.preventDefault();
      var billing = card.dataset.billing;
      if (billing) sizingOutputSelectCard(billing);
    });
  
  })();

  function updateSidebarFromSelections() {
    var state = getQuoteState();
    renderSidebarSelections(state);
    renderSidebarHardwareDetails();
    updateSidebarTotals();
    updateAddonCardPrices();
    renderSizingOutputPanel();
    if (!window.CUSTOMER_VIEW) {
      renderCapexComparison();
      updateCapexVerdictBanners();
    }
  }

  function renderSidebarHardwareDetails() {
    var listEl = getById('sidebar-hardware-list');
    if (!listEl) return;
    if (!quoteItems.length) {
      listEl.innerHTML = '<p class="quote-empty-desc">No hardware details available yet. Add workloads and plans to quote.</p>';
      return;
    }
    var matchedWids = {};
    listEl.innerHTML = quoteItems.map(function (item) {
      var label = item.workloadLabel || item.name || 'Workload';
      var planName = item.planName || '—';
      var planMeta = getPlanByName(planName);
      var hardwareText = item.hardwareSeries || (planMeta && planMeta.hardwareSeries && planMeta.hardwareSeries.length ? planMeta.hardwareSeries.join(', ') : 'As per selected performance level');
      var configSpec = item.spec && item.spec !== '—' ? item.spec : 'Derived from selected workload profile';
      var protocolText = planMeta && planMeta.protocols && planMeta.protocols.length
        ? planMeta.protocols.join(', ')
        : 'Protocol set based on selected plan';

      var wid = item.workloadId || null;
      if (!wid || matchedWids[wid]) {
        wid = null;
        var workloads = getSelectedWorkloads();
        for (var wi = 0; wi < workloads.length; wi++) {
          if (matchedWids[workloads[wi].id]) continue;
          var candCfg = workloadConfigs[workloads[wi].id];
          if (!candCfg || candCfg.selectedPlan !== item.planName) continue;
          if (item.workloadLabel && workloads[wi].label === item.workloadLabel) { wid = workloads[wi].id; break; }
          if (!wid) wid = workloads[wi].id;
        }
      }
      if (wid) matchedWids[wid] = true;
      var cfg = wid ? workloadConfigs[wid] : null;
      var committed = 0;
      if (cfg) {
        committed = getEffectiveCapacity(cfg);
      }
      var burstPct = cfg ? (parseFloat(getNormalizedBurstValue(cfg.burst)) || 0) : 0;
      var totalCap = Math.round(committed * (1 + burstPct / 100) * 100) / 100;
      var capacityLine = '';
      if (committed > 0) {
        capacityLine = '<p class="quote-hardware-item-meta">Capacity (committed + burst): ' +
          escapeHtml(committed + ' TiB') +
          (burstPct > 0 ? ' + ' + escapeHtml(burstPct + '%') + ' burst = ' + escapeHtml(totalCap + ' TiB') : '') +
          '</p>';
      }

      return '<div class="quote-hardware-item">' +
        '<span class="quote-hardware-item-label">' + escapeHtml(label) + '</span>' +
        '<p class="quote-hardware-item-meta">Plan: ' + escapeHtml(planName) + '</p>' +
        capacityLine +
        '<p class="quote-hardware-item-meta">Hardware: ' + escapeHtml(hardwareText) + '</p>' +
        '<p class="quote-hardware-item-meta">Configuration: ' + escapeHtml(configSpec) + '</p>' +
        '<p class="quote-hardware-item-meta">Protocols: ' + escapeHtml(protocolText) + '</p>' +
      '</div>';
    }).join('');
  }

  function syncHwConfigSummaryVisibility() {
    var hwInfo = getById('hw-config-summary');
    if (!hwInfo) return;
    var stripped = stripHwSummaryApprovalBadgeFromHtml(hwInfo.innerHTML || '');
    var hasContent = !!(stripped && String(stripped).replace(/&nbsp;/g, '').trim());
    if (sidebarHardwareMode && hasContent) {
      hwInfo.removeAttribute('hidden');
    } else {
      hwInfo.setAttribute('hidden', '');
    }
  }

  function applySidebarMode() {
    var hardwareSection = getById('sidebar-hardware-view');
    var quoteSections = document.querySelectorAll('.quote-sidebar-card .quote-sidebar-section:not(#sidebar-hardware-view)');
    var actions = document.querySelector('.quote-sidebar-actions');
    var flipBtn = getById('btn-flip-sidebar');
    var reviewHardwareBtn = getById('btn-review-hardware');
    var card = getById('quote-sidebar-flip-card');
    if (!hardwareSection) return;
    if (sidebarHardwareMode) {
      hardwareSection.removeAttribute('hidden');
      quoteSections.forEach(function (sec) { sec.setAttribute('hidden', ''); });
      if (actions) {
        actions.removeAttribute('hidden');
        // Hide absolutely everything first
        actions.querySelectorAll('button, p').forEach(function (el) {
          el.setAttribute('hidden', '');
        });
        // Explicitly hide every subscription-mode button by ID
        ['btn-download', 'btn-send-quote', 'btn-submit', 'btn-copy-quote', 'btn-flip-sidebar'].forEach(function (id) {
          var el = getById(id);
          if (el) { el.setAttribute('hidden', ''); el.style.display = 'none'; }
        });
        // Hide notices
        var notice1 = getById('quote-approval-notice');
        var notice2 = getById('quote-send-notice');
        if (notice1) notice1.setAttribute('hidden', '');
        if (notice2) notice2.setAttribute('hidden', '');
      }
      if (flipBtn) flipBtn.setAttribute('hidden', '');
      // Show ONLY: Approve HW / Edit approved HW
      if (reviewHardwareBtn) {
        reviewHardwareBtn.removeAttribute('hidden');
        reviewHardwareBtn.style.display = '';
        reviewHardwareBtn.disabled = quoteItems.length === 0;
        reviewHardwareBtn.textContent = getReviewHardwareButtonLabel();
        reviewHardwareBtn.setAttribute('aria-label', hwConfigApproved ? 'Edit approved hardware configuration' : 'Approve HW configurations and return to quote');
        reviewHardwareBtn.classList.add('quote-btn-primary');
        reviewHardwareBtn.classList.remove('quote-btn-secondary');
      }
      // Show ONLY: ← Subscription quote
      var existingBack = getById('btn-back-to-subscription');
      if (!existingBack) {
        var backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'quote-btn-secondary';
        backBtn.id = 'btn-back-to-subscription';
        backBtn.setAttribute('aria-label', 'Switch back to subscription quote');
        backBtn.textContent = '\u2190 Subscription quote';
        backBtn.addEventListener('click', function () {
          toggleSidebarModeWithFlip(false);
        });
        actions.appendChild(backBtn);
      } else {
        existingBack.removeAttribute('hidden');
        existingBack.style.display = '';
      }
      syncHwConfigSummaryVisibility();
    } else {
      // Remove the back button entirely when leaving HW mode
      var backBtnEl = getById('btn-back-to-subscription');
      if (backBtnEl) backBtnEl.parentNode.removeChild(backBtnEl);
      hardwareSection.setAttribute('hidden', '');
      quoteSections.forEach(function (sec) { sec.removeAttribute('hidden'); });
      if (actions) {
        // Restore display for all buttons, then let updateApprovalUiState control visibility
        actions.querySelectorAll('button, p').forEach(function (el) {
          el.removeAttribute('hidden');
          el.style.display = '';
        });
        var controlled = ['btn-download', 'btn-send-quote', 'btn-submit'];
        controlled.forEach(function (id) {
          var el = getById(id);
          if (el) { el.setAttribute('hidden', ''); el.style.display = ''; }
        });
      }
      if (flipBtn) {
        flipBtn.removeAttribute('hidden');
        flipBtn.textContent = 'Show hardware details';
        flipBtn.setAttribute('aria-pressed', 'false');
      }
      if (reviewHardwareBtn) {
        reviewHardwareBtn.textContent = getReviewHardwareButtonLabel();
        reviewHardwareBtn.setAttribute('aria-label', hwConfigApproved ? 'Edit approved hardware configuration' : 'Review and update HW configuration');
        reviewHardwareBtn.classList.remove('quote-btn-primary');
        reviewHardwareBtn.classList.add('quote-btn-secondary');
      }
      updateApprovalUiState();
      syncHwConfigSummaryVisibility();
    }
  }

  function bindSidebarFlipToggle() {
    var flipBtn = getById('btn-flip-sidebar');
    if (!flipBtn || flipBtn.dataset.bound) return;
    flipBtn.dataset.bound = '1';
    flipBtn.addEventListener('click', function () {
      toggleSidebarModeWithFlip(!sidebarHardwareMode);
    });
    applySidebarMode();
  }

  function toggleSidebarModeWithFlip(nextMode) {
    if (sidebarFlipAnimating) return;
    var card = getById('quote-sidebar-flip-card');
    if (!card) {
      sidebarHardwareMode = nextMode;
      if (sidebarHardwareMode) renderSidebarHardwareDetails();
      applySidebarMode();
      return;
    }
    sidebarFlipAnimating = true;
    card.classList.remove('is-flipping-in');
    card.classList.add('is-flipping-out');
    window.setTimeout(function () {
      sidebarHardwareMode = nextMode;
      if (sidebarHardwareMode) renderSidebarHardwareDetails();
      applySidebarMode();
      card.classList.remove('is-flipping-out');
      card.classList.add('is-flipping-in');
      window.setTimeout(function () {
        card.classList.remove('is-flipping-in');
        sidebarFlipAnimating = false;
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 180);
    }, 180);
  }

  function ensureWorkloadConfig(wid) {
    if (!workloadConfigs[wid]) {
      workloadConfigs[wid] = {
        capacity: '',
        iops: '',
        iopsUnit: 'M',
        latency: '',
        annualGrowthRate: '20',
        storageEfficiencyRatio: '1.5',
        usableEffective: 'effective',
        snapmirror: 'yes',
        burst: '20',
        ioMixReadRandomPct: 70,
        ioMixReadSeqPct: 0,
        ioMixWriteRandomPct: 30,
        ioMixWriteSeqPct: 0,
        ioMixReadRandomBlock: '8K',
        ioMixReadSeqBlock: '32K',
        ioMixWriteRandomBlock: '8K',
        ioMixWriteSeqBlock: '32K',
        selectedPlan: null,
        selectedPlanCost: null,
        manualPlanOverride: false,
        suggestedCapacity: '',
        requestedCapacity: ''
      };
    }
    if (!workloadConfigs[wid].usableEffective) workloadConfigs[wid].usableEffective = 'effective';
    if (!workloadConfigs[wid].snapmirror) workloadConfigs[wid].snapmirror = 'yes';
    if (!workloadConfigs[wid].burst) workloadConfigs[wid].burst = '20';
    if (workloadConfigs[wid].ioMixReadRandomPct == null) workloadConfigs[wid].ioMixReadRandomPct = 70;
    if (workloadConfigs[wid].ioMixReadSeqPct == null) workloadConfigs[wid].ioMixReadSeqPct = 0;
    if (workloadConfigs[wid].ioMixWriteRandomPct == null) workloadConfigs[wid].ioMixWriteRandomPct = 30;
    if (workloadConfigs[wid].ioMixWriteSeqPct == null) workloadConfigs[wid].ioMixWriteSeqPct = 0;
    if (!workloadConfigs[wid].ioMixReadRandomBlock) workloadConfigs[wid].ioMixReadRandomBlock = '8K';
    if (!workloadConfigs[wid].ioMixReadSeqBlock) workloadConfigs[wid].ioMixReadSeqBlock = '32K';
    if (!workloadConfigs[wid].ioMixWriteRandomBlock) workloadConfigs[wid].ioMixWriteRandomBlock = '8K';
    if (!workloadConfigs[wid].ioMixWriteSeqBlock) workloadConfigs[wid].ioMixWriteSeqBlock = '32K';
    if (workloadConfigs[wid].manualPlanOverride === undefined) workloadConfigs[wid].manualPlanOverride = false;
    return workloadConfigs[wid];
  }

  function getEffectiveCapacity(cfg) {
    if (!cfg) return 0;
    if (!window.CUSTOMER_VIEW && cfg.requestedCapacity && !isNaN(parseFloat(cfg.requestedCapacity)) && parseFloat(cfg.requestedCapacity) > 0) {
      return parseFloat(cfg.requestedCapacity);
    }
    if (!window.CUSTOMER_VIEW && cfg.suggestedCapacity && !isNaN(parseFloat(cfg.suggestedCapacity)) && parseFloat(cfg.suggestedCapacity) > 0) {
      return parseFloat(cfg.suggestedCapacity);
    }
    return parseFloat(cfg.capacity) || 0;
  }

  function updateCapacityFieldGreyout(wid) {
    var cfg = workloadConfigs[wid];
    if (!cfg) return;
    var hasRequested = cfg.requestedCapacity && !isNaN(parseFloat(cfg.requestedCapacity)) && parseFloat(cfg.requestedCapacity) > 0;
    var capField = getById('capacity-' + wid);
    var sugField = getById('suggested-capacity-field-' + wid);
    if (capField) {
      var capWrap = capField.closest('.config-workload-field');
      if (capWrap) capWrap.classList.toggle('config-field-greyed-out', hasRequested);
    }
    if (sugField) sugField.classList.toggle('config-field-greyed-out', hasRequested);
  }

  function renderWorkloadConfigCards() {
    var container = getById('configure-workload-cards');
    var emptyEl = getById('configure-workload-empty');
    if (!container || !emptyEl) return;
    var selected = getSelectedWorkloads();
    if (selected.length === 0) {
      container.innerHTML = '';
      container.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      return;
    }
    emptyEl.classList.add('hidden');
    container.classList.remove('hidden');
    container.innerHTML = '';
    selected.forEach(function (w) {
      ensureWorkloadConfig(w.id);
      var cfg = workloadConfigs[w.id];
      var ioReadRandBlock = cfg.ioMixReadRandomBlock || '8K';
      var ioReadSeqBlock = cfg.ioMixReadSeqBlock || '32K';
      var ioWriteRandBlock = cfg.ioMixWriteRandomBlock || '8K';
      var ioWriteSeqBlock = cfg.ioMixWriteSeqBlock || '32K';
      function blockOpts(selected) {
        return IO_MIX_BLOCK_OPTIONS.map(function (k) {
          return '<option value="' + escapeHtml(k) + '"' + (k === selected ? ' selected' : '') + '>' + escapeHtml(k) + '</option>';
        }).join('');
      }
      var contractYearsNow = getCurrentContractYears() || 3;
      var COMBO_MODES = ['effective', 'usable'];
      var COMBO_BURSTS = ['20', '40', '60'];
      var costPrefix = window.CUSTOMER_VIEW ? 'Est. ' : '';
      var planCardsHtml = '';
      PLAN_OPTIONS.forEach(function (opt) {
        var multiplier = (opt.id === 'unified-extreme') ? 1.15 : (opt.id === 'standard') ? 0.85 : 1;
        var platformLabel = (opt.hardwareSeries && opt.hardwareSeries.length) ? opt.hardwareSeries[0] : 'N/A';

        if (window.CUSTOMER_VIEW) {
          var isSelectedOrig = cfg.selectedPlan === opt.name;
          var selectedOrigClass = isSelectedOrig ? ' selected' : '';
          planCardsHtml += '<div class="config-plan-card' + selectedOrigClass + '"' +
            ' data-plan-id="' + escapeHtml(opt.id) + '"' +
            ' data-plan-name="' + escapeHtml(opt.name) + '"' +
            ' data-plan-cost="' + opt.cost + '"' +
            ' role="button" tabindex="0">' +
            '<span class="config-plan-radio" aria-hidden="true"></span>' +
            '<span class="config-plan-badge" style="display:none"></span>' +
            '<span class="config-plan-name">' + escapeHtml(opt.name) + '</span>' +
            '<span class="config-plan-hardware">' + escapeHtml(platformLabel) + '</span>' +
            '<a href="#" class="config-plan-link" data-plan-id="' + escapeHtml(opt.id) + '">View details</a>' +
            '</div>';
        } else {
          planCardsHtml += '<div class="config-plan-group" data-plan-id="' + escapeHtml(opt.id) + '">';
          planCardsHtml += '<h4 class="config-plan-group-title">' + escapeHtml(opt.name) + ' <span class="config-plan-group-platform">' + escapeHtml(platformLabel) + '</span>' +
            '<span class="config-plan-group-links">' +
            (window.CUSTOMER_VIEW ? '' : '<a href="#" class="config-view-forecasting config-plan-link" data-workload-id="' + escapeHtml(w.id) + '" role="button">View Forecasting</a>') +
            '</span>' +
            '</h4>';
          planCardsHtml += '<div class="config-plan-combo-grid">';
          var capForPricing = getEffectiveCapacity(cfg) || cfg.capacity;
          COMBO_MODES.forEach(function (mode) {
            COMBO_BURSTS.forEach(function (burst) {
              var iot = getIotRateCardEntry(capForPricing, burst, mode);
              var yearlyCost = 0;
              if (iot) {
                yearlyCost = Math.round(iot.yearlyNet * multiplier);
              }
              var costStr = costPrefix + formatCurrency(yearlyCost) + ' / year';
              var npvVal = calculateNPV(yearlyCost, contractYearsNow);
              var npvStr = formatCurrency(Math.round(npvVal));
              var npvLine = '<span class="config-plan-npv">NPV <span class="config-plan-npv-value">' + npvStr + '</span></span>';
              var modeLabel = mode === 'usable' ? 'Usable' : 'Effective';
              var comboKey = opt.name + '|' + mode + '|' + burst;
              var isSelected = cfg.selectedPlan === opt.name && cfg.usableEffective === mode && String(cfg.burst) === burst;
              var selectedClass = isSelected ? ' selected' : '';
              planCardsHtml += '<div class="config-plan-card config-plan-combo-card' + selectedClass + '"' +
                ' data-plan-id="' + escapeHtml(opt.id) + '"' +
                ' data-plan-name="' + escapeHtml(opt.name) + '"' +
                ' data-plan-cost="' + opt.cost + '"' +
                ' data-combo-mode="' + mode + '"' +
                ' data-combo-burst="' + burst + '"' +
                ' data-combo-key="' + escapeHtml(comboKey) + '"' +
                ' role="button" tabindex="0">' +
                '<span class="config-plan-radio" aria-hidden="true"></span>' +
                '<span class="config-plan-badge" style="display:none"></span>' +
                '<span class="config-plan-name">' + escapeHtml(modeLabel) + ' ' + burst + '%</span>' +
                '<span class="config-plan-cost">' + costStr + '</span>' +
                npvLine +
                '</div>';
            });
          });
          planCardsHtml += '</div>';
          planCardsHtml += '</div>';
        }
      });
      var card = document.createElement('div');
      card.className = 'config-workload-card';
      card.dataset.workloadId = w.id;
      card.innerHTML =
        '<div class="config-workload-card-header">' +
          '<span class="config-workload-card-label">' + escapeHtml(w.label) + '</span>' +
          '<span class="config-workload-card-summary" aria-hidden="true"></span>' +
          '<div class="config-workload-card-actions">' +
            '<button type="button" class="config-workload-btn config-workload-dismiss" data-workload-id="' + escapeHtml(w.id) + '" data-workload-label="' + escapeHtml(w.label) + '" aria-label="Remove ' + escapeHtml(w.label) + '" title="Remove workload">✕</button>' +
            '<button type="button" class="config-workload-btn config-workload-collapse" aria-label="Collapse" aria-expanded="true">▲</button>' +
          '</div></div>' +
        '<div class="config-workload-card-body">' +
          '<h3 class="config-workload-section-title config-workload-section-title--primary">Capacity and performance requirements <span class="config-required-hint">' + (window.CUSTOMER_VIEW ? '(capacity required)' : '(all fields required)') + '</span></h3>' +
          '<div class="config-workload-inputs-row">' +
            '<div class="config-workload-field">' +
              '<label class="config-workload-field-label">Current used capacity</label>' +
              '<div class="config-workload-input-wrap config-workload-input-suffix-pill">' +
                '<input type="number" class="config-workload-input" id="capacity-' + escapeHtml(w.id) + '" value="' + escapeHtml(cfg.capacity) + '" min="1" aria-label="Capacity" data-workload-input="capacity">' +
                '<span class="config-workload-suffix-pill">TiB</span></div></div>' +
            '<div class="config-workload-field">' +
              '<label class="config-workload-field-label">IOPS</label>' +
              '<div class="config-workload-input-segmented">' +
                '<input type="number" class="config-workload-input config-workload-input-num" id="iops-' + escapeHtml(w.id) + '" value="' + escapeHtml(cfg.iops) + '" min="1" max="99999" aria-label="IOPS" data-workload-input="iops">' +
                '<select class="config-workload-unit-dropdown" id="iops-unit-' + escapeHtml(w.id) + '" aria-label="IOPS unit" data-workload-input="iopsUnit">' +
                  '<option value="K"' + (cfg.iopsUnit === 'K' ? ' selected' : '') + '>K</option>' +
                  '<option value="M"' + (cfg.iopsUnit === 'M' ? ' selected' : '') + '>M</option>' +
                  '<option value="G"' + (cfg.iopsUnit === 'G' ? ' selected' : '') + '>G</option></select></div></div>' +
            '<div class="config-workload-field">' +
              '<label class="config-workload-field-label">Maximum latency</label>' +
              '<div class="config-workload-input-wrap config-workload-input-suffix-pill">' +
                '<input type="number" class="config-workload-input" id="latency-' + escapeHtml(w.id) + '" value="' + escapeHtml(cfg.latency) + '" min="1" max="999" aria-label="Maximum latency" data-workload-input="latency">' +
                '<span class="config-workload-suffix-pill">ms</span></div></div>' +
            (window.CUSTOMER_VIEW ? '' :
            '<div class="config-workload-field">' +
              '<label class="config-workload-field-label">Growth / Shrink rate</label>' +
              '<div class="config-workload-input-wrap config-workload-input-suffix-pill">' +
                '<input type="number" class="config-workload-input" id="annual-growth-' + escapeHtml(w.id) + '" value="' + escapeHtml(cfg.annualGrowthRate) + '" min="-25" max="100" step="0.1" placeholder="e.g. 10 or -5" aria-label="Growth or Shrink rate" data-workload-input="annualGrowthRate">' +
                '<span class="config-workload-suffix-pill">%</span></div></div>' +
            '<div class="config-workload-field">' +
              '<label class="config-workload-field-label">Storage efficiency ratio</label>' +
              '<div class="config-workload-input-wrap config-workload-input-suffix-pill">' +
                '<input type="number" class="config-workload-input" id="storage-efficiency-' + escapeHtml(w.id) + '" value="' + escapeHtml(cfg.storageEfficiencyRatio) + '" min="0" max="99" step="0.1" placeholder="e.g. 2.5" aria-label="Storage efficiency ratio" data-workload-input="storageEfficiencyRatio">' +
                '<span class="config-workload-suffix-pill">: 1</span></div></div>' +
            '<div class="config-workload-field config-suggested-capacity-field" id="suggested-capacity-field-' + escapeHtml(w.id) + '" style="' + (cfg.suggestedCapacity ? '' : 'display:none') + '">' +
              '<label class="config-workload-field-label">Suggested capacity</label>' +
              '<div class="config-workload-input-wrap config-workload-input-suffix-pill">' +
                '<input type="number" class="config-workload-input config-suggested-capacity-input" id="suggested-capacity-' + escapeHtml(w.id) + '" value="' + escapeHtml(cfg.suggestedCapacity) + '" readonly aria-label="Suggested capacity" data-workload-input="suggestedCapacity">' +
                '<span class="config-workload-suffix-pill">TiB</span></div></div>' +
            '<div class="config-workload-field config-requested-capacity-field" id="requested-capacity-field-' + escapeHtml(w.id) + '" style="' + (cfg.suggestedCapacity ? '' : 'display:none') + '">' +
              '<label class="config-workload-field-label">Customer requested capacity</label>' +
              '<div class="config-workload-input-wrap config-workload-input-suffix-pill">' +
                '<input type="number" class="config-workload-input" id="requested-capacity-' + escapeHtml(w.id) + '" value="' + escapeHtml(cfg.requestedCapacity || '') + '" min="0" step="1" placeholder="" aria-label="Customer requested capacity" data-workload-input="requestedCapacity">' +
                '<span class="config-workload-suffix-pill">TiB</span></div>' +
              '<div class="config-workload-field-hint" style="font-size:0.8rem;color:#6b7280;margin-top:0.25rem;">Overrides suggested capacity for plan recommendations</div></div>') +
          '</div>' +
          '<h3 class="config-workload-section-title">' + (window.CUSTOMER_VIEW ? 'Performance plan configuration' : 'Additional configuration') + ' <span class="config-required-hint">(defaults applied)</span></h3>' +
          '<div class="config-options-row">' +
            '<div class="config-option">' +
              '<span class="config-option-label">Usable / Effective</span>' +
              '<div class="config-toggle-group config-toggle-group--sm" role="radiogroup" aria-label="Usable or Effective">' +
                '<label class="config-toggle-opt"><input type="radio" name="pre_usable_effective_' + escapeHtml(w.id) + '" value="usable" data-workload-input="usableEffective"' + (cfg.usableEffective === 'usable' ? ' checked' : '') + '> Usable</label>' +
                '<label class="config-toggle-opt"><input type="radio" name="pre_usable_effective_' + escapeHtml(w.id) + '" value="effective" data-workload-input="usableEffective"' + (cfg.usableEffective === 'effective' ? ' checked' : '') + '> Effective</label>' +
              '</div></div>' +
            '<div class="config-option">' +
              '<span class="config-option-label">SnapMirror</span>' +
              '<div class="config-toggle-group config-toggle-group--sm" role="radiogroup" aria-label="SnapMirror">' +
                '<label class="config-toggle-opt"><input type="radio" name="pre_snapmirror_' + escapeHtml(w.id) + '" value="yes" data-workload-input="snapmirror"' + (cfg.snapmirror === 'yes' ? ' checked' : '') + '> Yes</label>' +
                '<label class="config-toggle-opt"><input type="radio" name="pre_snapmirror_' + escapeHtml(w.id) + '" value="no" data-workload-input="snapmirror"' + (cfg.snapmirror !== 'yes' ? ' checked' : '') + '> No</label>' +
              '</div></div>' +
            '<div class="config-option">' +
              '<span class="config-option-label">Burst</span>' +
              '<select class="config-option-select" data-workload-input="burst" aria-label="Burst">' +
                '<option value="20"' + (cfg.burst === '20' || !cfg.burst ? ' selected' : '') + '>20%</option>' +
                '<option value="40"' + (cfg.burst === '40' ? ' selected' : '') + '>40%</option>' +
                '<option value="60"' + (cfg.burst === '60' ? ' selected' : '') + '>60%</option>' +
              '</select></div>' +
          '</div>' +
          '<div class="config-io-mix-wrap">' +
            '<div class="config-io-mix-panel">' +
              '<div class="config-io-mix-header">' +
                '<span class="config-io-mix-title">I/O Mix</span>' +
                '<a href="#" class="config-io-mix-link">Need Larger Block Sizes?</a>' +
              '</div>' +
              '<div class="config-io-mix-columns">' +
                '<div class="config-io-mix-col">' +
                  '<div class="config-io-mix-row"><label class="config-io-mix-label">Random Read %</label><input type="number" class="config-io-mix-pct" data-workload-input="ioMixReadRandomPct" min="0" max="100" value="' + escapeHtml(cfg.ioMixReadRandomPct) + '" aria-label="Random Read percent"><select class="config-io-mix-block" data-workload-input="ioMixReadRandomBlock" aria-label="Random Read block size">' + blockOpts(ioReadRandBlock) + '</select></div>' +
                  '<div class="config-io-mix-row"><label class="config-io-mix-label">Sequential Read %</label><input type="number" class="config-io-mix-pct" data-workload-input="ioMixReadSeqPct" min="0" max="100" value="' + escapeHtml(cfg.ioMixReadSeqPct) + '" aria-label="Sequential Read percent"><select class="config-io-mix-block" data-workload-input="ioMixReadSeqBlock" aria-label="Sequential Read block size">' + blockOpts(ioReadSeqBlock) + '</select></div>' +
                '</div>' +
                '<div class="config-io-mix-col">' +
                  '<div class="config-io-mix-row"><label class="config-io-mix-label">Random Write %</label><input type="number" class="config-io-mix-pct" data-workload-input="ioMixWriteRandomPct" min="0" max="100" value="' + escapeHtml(cfg.ioMixWriteRandomPct) + '" aria-label="Random Write percent"><select class="config-io-mix-block" data-workload-input="ioMixWriteRandomBlock" aria-label="Random Write block size">' + blockOpts(ioWriteRandBlock) + '</select></div>' +
                  '<div class="config-io-mix-row"><label class="config-io-mix-label">Sequential Write %</label><input type="number" class="config-io-mix-pct" data-workload-input="ioMixWriteSeqPct" min="0" max="100" value="' + escapeHtml(cfg.ioMixWriteSeqPct) + '" aria-label="Sequential Write percent"><select class="config-io-mix-block" data-workload-input="ioMixWriteSeqBlock" aria-label="Sequential Write block size">' + blockOpts(ioWriteSeqBlock) + '</select></div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="config-plan-recommendations-wrap config-recommendations-hidden" data-workload-id="' + escapeHtml(w.id) + '">' +
          '<div class="config-recommendations-divider"></div>' +
          '<h3 class="config-workload-section-title config-recommendations-title">' + (window.CUSTOMER_VIEW ? 'Performance service plan recommendations' : 'Plan recommendations') + '</h3>' +
          (window.CUSTOMER_VIEW ? '' : '<div class="config-capex-verdict-banner" id="capex-verdict-banner-' + escapeHtml(w.id) + '"></div>') +
          '<div class="config-plan-cards">' + planCardsHtml + '</div>' +
          (window.CUSTOMER_VIEW ? '' :
            '<div class="config-plan-actions-bar">' +
              '<button type="button" class="config-plan-add-btn config-add-to-quote" data-workload-id="' + escapeHtml(w.id) + '">Add to quote</button>' +
            '</div>') +
          (window.CUSTOMER_VIEW ? '<a href="#" class="config-add-to-quote" data-workload-id="' + escapeHtml(w.id) + '" role="button">Add to quote</a>' : '') +
          '</div>' +
        '</div>';
      container.appendChild(card);
      if (!window.CUSTOMER_VIEW) autoComputeSuggestedCapacity(w.id);
      toggleRecommendationsVisibility(card, w.id);
      toggleStorageEfficiencyField(card, w.id);
      updateCapacityFieldGreyout(w.id);
    });
    container.querySelectorAll('.config-workload-card').forEach(function (card) {
      var wid = card.dataset.workloadId;
      if (wid && collapsedWorkloadIds[wid]) {
        var body = card.querySelector('.config-workload-card-body');
        if (body) body.classList.add('collapsed');
        card.classList.add('is-collapsed');
        updateWorkloadCardSummary(card);
        var btn = card.querySelector('.config-workload-collapse');
        if (btn) {
          btn.setAttribute('aria-expanded', 'false');
          btn.textContent = '▼';
        }
      }
    });
    updateSidebarFromSelections();
    renderAdditionalConfigByPlan();
  }

  function updatePlanBlockSummary(planBlock, planId, planCfg) {
    var summaryEl = planBlock && planBlock.querySelector('.additional-config-plan-summary');
    if (!summaryEl || !planCfg) return;
    var c = planCfg;
    var ue = c.usableEffective === 'usable' ? 'Usable' : 'Effective';
    var snap = c.snapmirror === 'yes' ? 'SnapMirror Yes' : 'SnapMirror No';
    var burst = (c.burst || '20') + '% Burst';
    summaryEl.textContent = ue + ' · ' + snap + ' · ' + burst;
  }

  function renderAdditionalConfigByPlan() {
    var container = getById('additional-config-by-plan');
    var emptyEl = getById('additional-config-empty');
    var section = getById('additional-configurations-section');
    /* Performance plan configuration is handled in workload cards before recommendation. */
    if (section) section.setAttribute('hidden', '');
    if (container) container.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
    var plans = getPlansInUse();
    if (plans.length === 0) {
      container.innerHTML = '';
      container.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      return;
    }
    emptyEl.classList.add('hidden');
    container.classList.remove('hidden');
    container.innerHTML = '';
    plans.forEach(function (p) {
      var cfg = ensurePlanConfig(p.planId);
      var appliesText = p.workloadLabels.length === 1
        ? 'Applies to: ' + p.workloadLabels[0]
        : p.workloadLabels.length + ' workloads: ' + p.workloadLabels.join(', ');
      var prefix = p.planId + '_';
      var ueChecked = cfg.usableEffective === 'usable' ? ' checked' : '';
      var effChecked = cfg.usableEffective === 'effective' ? ' checked' : '';
      var snapYes = cfg.snapmirror === 'yes' ? ' checked' : '';
      var ioReadRandPct = cfg.ioMixReadRandomPct != null ? cfg.ioMixReadRandomPct : 70;
      var ioReadSeqPct = cfg.ioMixReadSeqPct != null ? cfg.ioMixReadSeqPct : 0;
      var ioWriteRandPct = cfg.ioMixWriteRandomPct != null ? cfg.ioMixWriteRandomPct : 30;
      var ioWriteSeqPct = cfg.ioMixWriteSeqPct != null ? cfg.ioMixWriteSeqPct : 0;
      var ioReadRandBlock = cfg.ioMixReadRandomBlock || '8K';
      var ioReadSeqBlock = cfg.ioMixReadSeqBlock || '32K';
      var ioWriteRandBlock = cfg.ioMixWriteRandomBlock || '8K';
      var ioWriteSeqBlock = cfg.ioMixWriteSeqBlock || '32K';
      function blockOpts(selected) {
        return IO_MIX_BLOCK_OPTIONS.map(function (k) {
          return '<option value="' + escapeHtml(k) + '"' + (k === selected ? ' selected' : '') + '>' + escapeHtml(k) + '</option>';
        }).join('');
      }
      var snapNo = cfg.snapmirror === 'no' ? ' checked' : '';
      var burstVal = cfg.burst || '20';
      var standardBurst = ['20', '40', '60'];
      var burstOpts = standardBurst.map(function (v) {
        return '<option value="' + v + '"' + (burstVal === v ? ' selected' : '') + '>' + v + '%</option>';
      }).join('');
      if (burstVal && standardBurst.indexOf(burstVal) === -1) {
        burstOpts += '<option value="' + escapeHtml(burstVal) + '" selected>' + escapeHtml(burstVal) + '% (custom)</option>';
      }
      burstOpts += '<option value="custom"' + (burstVal === 'custom' ? ' selected' : '') + '>Custom...</option>';
      var block = document.createElement('div');
      block.className = 'additional-config-plan-block';
      block.dataset.planId = p.planId;
      block.innerHTML =
        '<div class="additional-config-plan-header">' +
          '<div class="additional-config-plan-header-main">' +
            '<span class="additional-config-plan-name">' + escapeHtml(p.planName) + '</span>' +
            '<span class="additional-config-applies-to">' + escapeHtml(appliesText) + '</span>' +
          '</div>' +
          '<span class="additional-config-plan-summary" aria-hidden="true"></span>' +
          '<button type="button" class="config-workload-btn additional-config-plan-collapse" aria-label="Collapse" aria-expanded="true" title="Collapse">▲</button>' +
        '</div>' +
        '<div class="additional-config-plan-body">' +
        '<div class="config-workload-refine config-refine-unified">' +
          '<div class="config-options-row">' +
            '<div class="config-option">' +
              '<span class="config-option-label">Usable / Effective</span>' +
              '<div class="config-toggle-group config-toggle-group--sm" role="radiogroup" aria-label="Usable or Effective">' +
                '<label class="config-toggle-opt"><input type="radio" name="usable_effective_' + escapeHtml(p.planId) + '" value="usable"' + ueChecked + '> Usable</label>' +
                '<label class="config-toggle-opt"><input type="radio" name="usable_effective_' + escapeHtml(p.planId) + '" value="effective"' + effChecked + '> Effective</label>' +
              '</div></div>' +
            '<div class="config-option">' +
              '<span class="config-option-label">SnapMirror</span>' +
              '<div class="config-toggle-group config-toggle-group--sm" role="radiogroup" aria-label="SnapMirror">' +
                '<label class="config-toggle-opt"><input type="radio" name="snapmirror_' + escapeHtml(p.planId) + '" value="yes"' + snapYes + '> Yes</label>' +
                '<label class="config-toggle-opt"><input type="radio" name="snapmirror_' + escapeHtml(p.planId) + '" value="no"' + snapNo + '> No</label>' +
              '</div></div>' +
            '<div class="config-option">' +
              '<span class="config-option-label">Burst</span>' +
              '<select class="config-option-select config-burst-select-plan" data-plan-id="' + escapeHtml(p.planId) + '" aria-label="Burst">' +
                burstOpts +
              '</select></div>' +
          '</div>' +
          '<div class="config-io-mix-wrap">' +
            '<div class="config-io-mix-panel">' +
              '<div class="config-io-mix-header">' +
                '<span class="config-io-mix-title">I/O Mix</span>' +
                '<a href="#" class="config-io-mix-link" data-plan-id="' + escapeHtml(p.planId) + '">Need Larger Block Sizes?</a>' +
              '</div>' +
              '<div class="config-io-mix-columns">' +
                '<div class="config-io-mix-col">' +
                  '<div class="config-io-mix-row"><label class="config-io-mix-label">Random Read %</label><input type="number" class="config-io-mix-pct" data-plan-id="' + escapeHtml(p.planId) + '" data-io="readRandPct" min="0" max="100" value="' + ioReadRandPct + '" aria-label="Random Read percent"><select class="config-io-mix-block" data-plan-id="' + escapeHtml(p.planId) + '" data-io="readRandBlock" aria-label="Random Read block size">' + blockOpts(ioReadRandBlock) + '</select></div>' +
                  '<div class="config-io-mix-row"><label class="config-io-mix-label">Sequential Read %</label><input type="number" class="config-io-mix-pct" data-plan-id="' + escapeHtml(p.planId) + '" data-io="readSeqPct" min="0" max="100" value="' + ioReadSeqPct + '" aria-label="Sequential Read percent"><select class="config-io-mix-block" data-plan-id="' + escapeHtml(p.planId) + '" data-io="readSeqBlock" aria-label="Sequential Read block size">' + blockOpts(ioReadSeqBlock) + '</select></div>' +
                '</div>' +
                '<div class="config-io-mix-col">' +
                  '<div class="config-io-mix-row"><label class="config-io-mix-label">Random Write %</label><input type="number" class="config-io-mix-pct" data-plan-id="' + escapeHtml(p.planId) + '" data-io="writeRandPct" min="0" max="100" value="' + ioWriteRandPct + '" aria-label="Random Write percent"><select class="config-io-mix-block" data-plan-id="' + escapeHtml(p.planId) + '" data-io="writeRandBlock" aria-label="Random Write block size">' + blockOpts(ioWriteRandBlock) + '</select></div>' +
                  '<div class="config-io-mix-row"><label class="config-io-mix-label">Sequential Write %</label><input type="number" class="config-io-mix-pct" data-plan-id="' + escapeHtml(p.planId) + '" data-io="writeSeqPct" min="0" max="100" value="' + ioWriteSeqPct + '" aria-label="Sequential Write percent"><select class="config-io-mix-block" data-plan-id="' + escapeHtml(p.planId) + '" data-io="writeSeqBlock" aria-label="Sequential Write block size">' + blockOpts(ioWriteSeqBlock) + '</select></div>' +
                '</div>' +
              '</div></div>' +
          '</div></div></div>';
      container.appendChild(block);
      (function (planId, planBlock, planCfg) {
        var bodyEl = planBlock.querySelector('.additional-config-plan-body');
        var collapseBtn = planBlock.querySelector('.additional-config-plan-collapse');
        updatePlanBlockSummary(planBlock, planId, planCfg);
        if (collapseBtn && bodyEl) {
          collapseBtn.addEventListener('click', function () {
            var collapsed = bodyEl.classList.toggle('collapsed');
            planBlock.classList.toggle('is-collapsed', collapsed);
            collapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            collapseBtn.setAttribute('aria-label', collapsed ? 'Expand' : 'Collapse');
            collapseBtn.title = collapsed ? 'Expand' : 'Collapse';
            collapseBtn.textContent = collapsed ? '▼' : '▲';
          });
        }
      })(p.planId, block, cfg);
      block.querySelectorAll('input[type="radio"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
          var name = radio.name;
          if (name.indexOf('usable_effective_') === 0) { cfg.usableEffective = radio.value; }
          else if (name.indexOf('snapmirror_') === 0) { cfg.snapmirror = radio.value; }
          updatePlanBlockSummary(block, p.planId, cfg);
          updateSidebarFromSelections();
        });
      });
      block.querySelectorAll('.config-io-mix-pct').forEach(function (input) {
        input.addEventListener('input', function () {
          var key = 'ioMix' + (input.dataset.io === 'readRandPct' ? 'ReadRandomPct' : input.dataset.io === 'readSeqPct' ? 'ReadSeqPct' : input.dataset.io === 'writeRandPct' ? 'WriteRandomPct' : 'WriteSeqPct');
          var val = parseInt(input.value, 10);
          if (!isNaN(val)) cfg[key] = Math.max(0, Math.min(100, val));
          updateSidebarFromSelections();
        });
      });
      block.querySelectorAll('.config-io-mix-block').forEach(function (sel) {
        sel.addEventListener('change', function () {
          var key = 'ioMix' + (sel.dataset.io === 'readRandBlock' ? 'ReadRandomBlock' : sel.dataset.io === 'readSeqBlock' ? 'ReadSeqBlock' : sel.dataset.io === 'writeRandBlock' ? 'WriteRandomBlock' : 'WriteSeqBlock');
          cfg[key] = sel.value;
          updateSidebarFromSelections();
        });
      });
      var ioMixLink = block.querySelector('.config-io-mix-link');
      if (ioMixLink) ioMixLink.addEventListener('click', function (e) { e.preventDefault(); });
      var burstSel = block.querySelector('.config-burst-select-plan');
      if (burstSel) {
        burstSel.addEventListener('change', function () {
          if (burstSel.value === 'custom') {
            openCustomBurstModal(p.planId);
            return;
          }
          cfg.burst = burstSel.value;
          if (burstSel.value && ['20', '40', '60'].indexOf(burstSel.value) === -1) {
            burstByPlan[p.planId] = { value: parseInt(burstSel.value, 10), display: burstSel.value + '%', justification: (burstByPlan[p.planId] && burstByPlan[p.planId].justification) || '' };
          } else {
            burstByPlan[p.planId] = null;
          }
          updatePlanBlockSummary(block, p.planId, cfg);
          updateSidebarFromSelections();
        });
      }
    });
  }

  function toggleStorageEfficiencyField(card, wid) {
    var cfg = workloadConfigs[wid];
    if (!cfg) return;
    var seField = card.querySelector('#storage-efficiency-' + wid);
    if (!seField) return;
    var fieldWrap = seField.closest('.config-workload-field');
    if (cfg.usableEffective === 'usable') {
      seField.disabled = true;
      if (fieldWrap) fieldWrap.classList.add('config-field-disabled');
    } else {
      seField.disabled = false;
      if (fieldWrap) fieldWrap.classList.remove('config-field-disabled');
    }
  }

  function bindWorkloadCards() {
    var container = getById('configure-workload-cards');
    if (!container) return;

    function collapseWorkloadCard(card) {
      if (!card) return;
      var wid = card.dataset.workloadId;
      if (wid) collapsedWorkloadIds[wid] = true;
      var body = card.querySelector('.config-workload-card-body');
      if (body) body.classList.add('collapsed');
      card.classList.add('is-collapsed');
      updateWorkloadCardSummary(card);
      var collapseBtn = card.querySelector('.config-workload-collapse');
      if (collapseBtn) {
        collapseBtn.setAttribute('aria-expanded', 'false');
        collapseBtn.textContent = '▼';
      }
    }

    container.addEventListener('click', function (e) {
      var dismissBtn = e.target.closest('.config-workload-dismiss');
      if (dismissBtn) {
        e.preventDefault();
        e.stopPropagation();
        var wid = dismissBtn.dataset.workloadId;
        var wLabel = dismissBtn.dataset.workloadLabel;
        if (wid && workloadConfigs[wid] && workloadConfigs[wid].selectedPlan) {
          for (var qi = quoteItems.length - 1; qi >= 0; qi--) {
            if (quoteItems[qi].workloadLabel === wLabel) quoteItems.splice(qi, 1);
          }
          workloadConfigs[wid].selectedPlan = null;
          workloadConfigs[wid].selectedPlanCost = null;
        }
        deselectWorkloadTileById(wid);
        if (wLabel) deselectWorkloadTileByLabel(wLabel);
        delete workloadConfigs[wid];
        renderWorkloadConfigCards();
        updateItemization();
        updateSidebarFromSelections();
        updateSidebarTotals();
        return;
      }
      var card = e.target.closest('.config-workload-card');
      var addBtn = e.target.closest('.config-add-to-quote');
      var planCard = e.target.closest('.config-plan-card');
      var detailsLink = e.target.closest('.config-plan-link');
      if (detailsLink) {
        e.preventDefault();
        var detailsPlanId = detailsLink.dataset.planId || (planCard && planCard.dataset.planId);
        if (detailsPlanId) openPlanDetailsModal(detailsPlanId);
        return;
      }
      if (e.target.closest('a') && !addBtn) return;
      if (addBtn) {
        e.preventDefault();
        var wid = addBtn.dataset.workloadId || (card ? card.dataset.workloadId : null);
        var w = getSelectedWorkloads().filter(function (x) { return x.id === wid; })[0];
        var cfg = workloadConfigs[wid];
        if (w && cfg && cfg.selectedPlan) {
          var specParts = [];
          var selectedPlanMeta = getPlanByName(cfg.selectedPlan);
          var hardwareSeriesText = selectedPlanMeta && selectedPlanMeta.hardwareSeries && selectedPlanMeta.hardwareSeries.length
            ? selectedPlanMeta.hardwareSeries.join(', ')
            : 'As per selected performance level';
          var hwCap = getEffectiveCapacity(cfg) || cfg.capacity;
          if (hwCap) specParts.push(hwCap + ' TiB');
          if (cfg.iops) specParts.push(cfg.iops + (cfg.iopsUnit || '') + ' IOPS');
          if (cfg.latency) specParts.push(cfg.latency + ' ms max latency');
          quoteItems.push({
            name: w.label + ' — ' + cfg.selectedPlan,
            cost: cfg.selectedPlanCost || 0,
            workloadId: wid,
            workloadLabel: w.label,
            planName: cfg.selectedPlan,
            capacityTiB: parseFloat(hwCap) || 0,
            spec: specParts.join(' · ') || '—',
            hardwareSeries: hardwareSeriesText
          });
          updateItemization();
          collapseWorkloadCard(addBtn.closest('.config-workload-card'));
        }
        return;
      }
      var groupTitle = e.target.closest('.config-plan-group-title');
      if (groupTitle && groupTitle.querySelector('.config-plan-group-chevron')) {
        var groupEl = groupTitle.closest('.config-plan-group');
        if (groupEl) groupEl.classList.toggle('config-plan-group--collapsed');
        return;
      }
      if (planCard && card) {
        e.preventDefault();
        var wid = card.dataset.workloadId;
        var planName = planCard.dataset.planName;
        var planCost = parseInt(planCard.dataset.planCost, 10) || 0;
        ensureWorkloadConfig(wid);
        var wcfg = workloadConfigs[wid];
        wcfg.selectedPlan = planName;
        if (planCard.dataset.comboMode) wcfg.usableEffective = planCard.dataset.comboMode;
        if (planCard.dataset.comboBurst) wcfg.burst = planCard.dataset.comboBurst;
        var yearsNow = getCurrentContractYears();
        var selectedPlanMeta = PLAN_OPTIONS.filter(function (p) { return p.name === planName; })[0] || null;
        var benchmarkNow = getBenchmarkPricingOverrideForConfig(yearsNow, wcfg, selectedPlanMeta ? selectedPlanMeta.id : null);
        wcfg.selectedPlanCost = benchmarkNow && benchmarkNow.yearlyNet ? benchmarkNow.yearlyNet : planCost;
        wcfg.manualPlanOverride = true;
        var body = card.querySelector('.config-workload-card-body');
        if (body) {
          body.querySelectorAll('.config-plan-card').forEach(function (c) { c.classList.remove('selected'); });
          planCard.classList.add('selected');
        }
        toggleStorageEfficiencyField(card, wid);
        renderAdditionalConfigByPlan();
        updateSidebarFromSelections();
      }
      if (e.target.closest('.config-workload-collapse')) {
        e.preventDefault();
        if (card) {
          var wid = card.dataset.workloadId;
          var body = card.querySelector('.config-workload-card-body');
          if (body) body.classList.toggle('collapsed');
          if (body && body.classList.contains('collapsed')) {
            if (wid) collapsedWorkloadIds[wid] = true;
            card.classList.add('is-collapsed');
            updateWorkloadCardSummary(card);
          } else {
            if (wid) delete collapsedWorkloadIds[wid];
            card.classList.remove('is-collapsed');
          }
          var btn = card.querySelector('.config-workload-collapse');
          if (btn) {
            btn.setAttribute('aria-expanded', body && body.classList.contains('collapsed') ? 'false' : 'true');
            btn.textContent = body && body.classList.contains('collapsed') ? '▼' : '▲';
          }
        }
      }
    });

    var forecastTriggerKeys = { capacity: 1, annualGrowthRate: 1, storageEfficiencyRatio: 1, usableEffective: 1, burst: 1 };

    container.addEventListener('input', function (e) {
      var input = e.target;
      if (!input.dataset || !input.dataset.workloadInput) return;
      if (input.classList && input.classList.contains('config-io-mix-link')) return;
      var card = input.closest('.config-workload-card');
      if (!card) return;
      var wid = card.dataset.workloadId;
      ensureWorkloadConfig(wid);
      var key = input.dataset.workloadInput;
      workloadConfigs[wid][key] = input.value;
      if (key === 'capacity' || key === 'iops' || key === 'iopsUnit' || key === 'latency' || key === 'usableEffective' || key === 'snapmirror' || key === 'burst' || key === 'requestedCapacity' || key === 'ioMixReadRandomPct' || key === 'ioMixReadSeqPct' || key === 'ioMixWriteRandomPct' || key === 'ioMixWriteSeqPct') {
        workloadConfigs[wid].manualPlanOverride = false;
      }
      if (key === 'usableEffective') toggleStorageEfficiencyField(card, wid);
      if (key === 'requestedCapacity') updateCapacityFieldGreyout(wid);
      if (!window.CUSTOMER_VIEW && forecastTriggerKeys[key]) autoComputeSuggestedCapacity(wid);
      toggleRecommendationsVisibility(card, wid);
      updateSidebarFromSelections();
    });
    container.addEventListener('change', function (e) {
      var input = e.target;
      if (!input.dataset || !input.dataset.workloadInput) return;
      var card = input.closest('.config-workload-card');
      if (!card) return;
      var wid = card.dataset.workloadId;
      ensureWorkloadConfig(wid);
      var key = input.dataset.workloadInput;
      if (key === 'burst' && input.value === 'custom') {
        openCustomBurstModal('workload:' + wid);
        return;
      }
      workloadConfigs[wid][key] = input.value;
      if (key === 'capacity' || key === 'iops' || key === 'iopsUnit' || key === 'latency' || key === 'usableEffective' || key === 'snapmirror' || key === 'burst' || key === 'requestedCapacity' || key === 'ioMixReadRandomPct' || key === 'ioMixReadSeqPct' || key === 'ioMixWriteRandomPct' || key === 'ioMixWriteSeqPct' || key === 'ioMixReadRandomBlock' || key === 'ioMixReadSeqBlock' || key === 'ioMixWriteRandomBlock' || key === 'ioMixWriteSeqBlock') {
        workloadConfigs[wid].manualPlanOverride = false;
      }
      if (key === 'usableEffective') toggleStorageEfficiencyField(card, wid);
      if (key === 'requestedCapacity') updateCapacityFieldGreyout(wid);
      if (!window.CUSTOMER_VIEW && forecastTriggerKeys[key]) autoComputeSuggestedCapacity(wid);
      toggleRecommendationsVisibility(card, wid);
      updateSidebarFromSelections();
    });
    container.addEventListener('click', function (e) {
      var link = e.target.closest('.config-io-mix-link');
      if (link) e.preventDefault();
    });
  }

  function updateWorkloadCardSummary(card) {
    if (!card) return;
    var wid = card.dataset.workloadId;
    var summaryEl = card.querySelector('.config-workload-card-summary');
    if (!summaryEl || !wid) return;
    var cfg = workloadConfigs[wid];
    if (!cfg) return;
    var parts = [];
    if (cfg.capacity && !isNaN(parseFloat(cfg.capacity))) parts.push(cfg.capacity + ' TiB');
    if (cfg.iops && !isNaN(parseFloat(cfg.iops))) parts.push(cfg.iops + (cfg.iopsUnit || '') + ' IOPS');
    if (cfg.latency && !isNaN(parseFloat(cfg.latency))) parts.push(cfg.latency + ' ms max latency');
    var reqText = parts.length ? parts.join(' · ') : '—';
    var planText = cfg.selectedPlan || '—';
    var costText = (!window.CUSTOMER_VIEW && cfg.selectedPlanCost != null && !isNaN(cfg.selectedPlanCost)) ? formatCurrency(cfg.selectedPlanCost) + '/yr' : '';
    summaryEl.textContent = costText ? reqText + ' — ' + planText + ' — ' + costText : reqText + ' — ' + planText;
  }

  function toggleRecommendationsVisibility(card, wid) {
    if (!card || !wid) return;
    var wrap = card.querySelector('.config-plan-recommendations-wrap');
    if (!wrap) return;
    var cfg = workloadConfigs[wid];
    var capSource = getEffectiveCapacity(cfg);
    var capacityOk = capSource > 0;
    var iopsOk = cfg.iops !== '' && cfg.iops != null && !isNaN(parseFloat(cfg.iops)) && parseFloat(cfg.iops) > 0;
    var latencyOk = cfg.latency !== '' && cfg.latency != null && !isNaN(parseFloat(cfg.latency)) && parseFloat(cfg.latency) >= 0;
    var allInputsOk = capacityOk && iopsOk && latencyOk;
    if (!window.CUSTOMER_VIEW) {
      var growthOk = cfg.annualGrowthRate !== '' && cfg.annualGrowthRate != null && !isNaN(parseFloat(cfg.annualGrowthRate));
      var seOk = cfg.storageEfficiencyRatio !== '' && cfg.storageEfficiencyRatio != null && !isNaN(parseFloat(cfg.storageEfficiencyRatio)) && parseFloat(cfg.storageEfficiencyRatio) > 0;
      allInputsOk = allInputsOk && growthOk && seOk;
    }
    var workloadSelected = !!wid;
    if (workloadSelected && allInputsOk) {
      wrap.classList.remove('config-recommendations-hidden');
      updateRecommendationBadges(card, wid);
    } else {
      wrap.classList.add('config-recommendations-hidden');
      cfg.selectedPlan = null;
      cfg.selectedPlanCost = null;
      card.querySelectorAll('.config-plan-group').forEach(function (g) { g.style.display = ''; });
      card.querySelectorAll('.config-plan-card').forEach(function (planEl) {
        planEl.classList.remove('selected');
        planEl.style.display = '';
        var b = planEl.querySelector('.config-plan-badge');
        if (b) { b.style.display = 'none'; b.textContent = ''; }
      });
      card.querySelectorAll('.config-plan-group-badge').forEach(function (b) { b.remove(); });
      renderAdditionalConfigByPlan();
      updateSidebarFromSelections();
    }
  }

  function updateRecommendationBadges(card, wid) {
    if (!card || !wid) return;
    var cfg = workloadConfigs[wid];
    var capForPlans = getEffectiveCapacity(cfg);
    if (capForPlans <= 0) return;
    var qualifying = getQualifyingPlans(capForPlans, cfg.iops, cfg.iopsUnit || 'K', cfg.latency, wid, cfg);
    var qualifyingIds = {};
    qualifying.forEach(function (p, i) { qualifyingIds[p.id] = i === 0 ? 'Recommended' : 'Eligible'; });
    var currentSelectionQualifies = qualifying.some(function (p) { return p.name === cfg.selectedPlan; });
    var shouldUseRecommendedByDefault = !cfg.manualPlanOverride;
    var selectionChanged = false;

    if (qualifying.length > 0 && (shouldUseRecommendedByDefault || !currentSelectionQualifies)) {
      cfg.selectedPlan = qualifying[0].name;
      if (!cfg.usableEffective) cfg.usableEffective = 'effective';
      if (!cfg.burst) cfg.burst = '20';
      var yearsNow = getCurrentContractYears();
      var benchmarkNow = getBenchmarkPricingOverrideForConfig(yearsNow, cfg, qualifying[0].id);
      cfg.selectedPlanCost = benchmarkNow && benchmarkNow.yearlyNet ? benchmarkNow.yearlyNet : qualifying[0].cost;
      selectionChanged = true;
    } else if (qualifying.length === 0) {
      cfg.selectedPlan = null;
      cfg.selectedPlanCost = null;
      selectionChanged = true;
    }

    var contractYearsNow = getCurrentContractYears() || 3;
    var costPrefix = window.CUSTOMER_VIEW ? 'Est. ' : '';

    if (window.CUSTOMER_VIEW) {
      card.querySelectorAll('.config-plan-card').forEach(function (planCard) {
        var planId = planCard.dataset.planId;
        var badge = qualifyingIds[planId];
        var show = badge !== undefined;
        planCard.style.display = show ? '' : 'none';
        var existingBadge = planCard.querySelector('.config-plan-badge');
        if (existingBadge) {
          existingBadge.style.display = badge ? '' : 'none';
          existingBadge.className = 'config-plan-badge config-plan-badge--' + (badge === 'Recommended' ? 'recommended' : 'eligible');
          existingBadge.textContent = badge || '';
        }
        var multiplier = (planId === 'unified-extreme') ? 1.15 : (planId === 'standard') ? 0.85 : 1;
        var burstMode = cfg.burst || '20';
        var ueMode = cfg.usableEffective || 'effective';
        var iot = getIotRateCardEntry(getEffectiveCapacity(cfg) || cfg.capacity, burstMode, ueMode);
        var yearlyCost = iot ? Math.round(iot.yearlyNet * multiplier) : 0;
        planCard.dataset.planCost = yearlyCost;
        var costEl = planCard.querySelector('.config-plan-cost');
        if (costEl) costEl.textContent = costPrefix + formatCurrency(yearlyCost) + ' / year';
        planCard.classList.toggle('selected', cfg.selectedPlan === planCard.dataset.planName);
      });
    } else {
      card.querySelectorAll('.config-plan-group').forEach(function (groupEl) {
        var planId = groupEl.dataset.planId;
        var badge = qualifyingIds[planId];
        var show = badge !== undefined;
        groupEl.style.display = show ? '' : 'none';
        groupEl.classList.toggle('config-plan-group--collapsed', badge === 'Eligible');
        groupEl.classList.toggle('config-plan-group--eligible', badge === 'Eligible');
        var titleEl = groupEl.querySelector('.config-plan-group-title');
        if (titleEl) {
          var existingBadgeWrap = titleEl.querySelector('.config-plan-group-badge-wrap');
          if (existingBadgeWrap) existingBadgeWrap.remove();
          if (badge) {
            var wrap = document.createElement('span');
            wrap.className = 'config-plan-group-badge-wrap';
            var span = document.createElement('span');
            span.className = 'config-plan-group-badge config-plan-group-badge--' + (badge === 'Recommended' ? 'recommended' : 'eligible');
            span.textContent = badge;
            wrap.appendChild(span);
            var chevron = document.createElement('span');
            chevron.className = 'config-plan-group-chevron';
            chevron.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M5.5 7L9 10.5L12.5 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            wrap.appendChild(chevron);
            titleEl.appendChild(wrap);
          }
        }
      });
    }

    if (!window.CUSTOMER_VIEW) {
      var activeMode = cfg.usableEffective || 'effective';
      card.querySelectorAll('.config-plan-combo-card').forEach(function (comboEl) {
        var planId = comboEl.dataset.planId;
        var comboMode = comboEl.dataset.comboMode;
        var comboBurst = comboEl.dataset.comboBurst;

        comboEl.style.display = '';

        if (!qualifyingIds[planId]) return;
        var planMeta = PLAN_OPTIONS.filter(function (p) { return p.id === planId; })[0] || null;
        if (!planMeta) return;
        var multiplier = (planId === 'unified-extreme') ? 1.15 : (planId === 'standard') ? 0.85 : 1;
        var iot = getIotRateCardEntry(getEffectiveCapacity(cfg) || cfg.capacity, comboBurst, comboMode);
        var yearlyCost = iot ? Math.round(iot.yearlyNet * multiplier) : 0;
        var costEl = comboEl.querySelector('.config-plan-cost');
        if (costEl) costEl.textContent = costPrefix + formatCurrency(yearlyCost) + ' / year';
        var npvEl = comboEl.querySelector('.config-plan-npv-value');
        if (npvEl) npvEl.textContent = formatCurrency(Math.round(calculateNPV(yearlyCost, contractYearsNow)));

        var isSelected = cfg.selectedPlan === comboEl.dataset.planName &&
          activeMode === comboMode && String(cfg.burst) === comboBurst;
        comboEl.classList.toggle('selected', isSelected);
      });
    }

    if (selectionChanged) {
      renderAdditionalConfigByPlan();
      updateSidebarFromSelections();
    }
  }

  function openPlanDetailsModal(planId) {
    var plan = PLAN_OPTIONS.filter(function (p) { return p.id === planId; })[0];
    var modal = getById('plan-details-modal');
    var titleEl = getById('plan-details-title');
    var bodyEl = getById('plan-details-body');
    if (!plan || !modal || !titleEl || !bodyEl) return;
    var iopsText = plan.maxIops == null ? 'N/A (capacity-based level)' : (plan.maxIops === 0 ? 'N/A' : plan.maxIops.toLocaleString());
    var latencyText = plan.latencyTargetMs == null ? 'N/A (capacity-based level)' : (plan.id === 'value' ? '>4 ms' : '\u2264' + plan.latencyTargetMs + ' ms');
    var gbpsText = plan.maxGbps == null ? 'N/A' : plan.maxGbps + ' GBps';
    titleEl.textContent = plan.name + ' details';
    var includesList = Array.isArray(plan.includes) && plan.includes.length
      ? '<div class="plan-details-section"><h4 class="plan-details-section-title">What this plan includes</h4><ul class="plan-details-list">' + plan.includes.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul></div>'
      : '';
    var hardwareList = Array.isArray(plan.hardwareSeries) && plan.hardwareSeries.length
      ? '<div class="plan-details-section"><h4 class="plan-details-section-title">Hardware series provided</h4><p class="plan-details-inline">' + escapeHtml(plan.hardwareSeries.join(', ')) + '</p></div>'
      : '';
    var protocolList = Array.isArray(plan.protocols) && plan.protocols.length
      ? '<div class="plan-details-section"><h4 class="plan-details-section-title">Supported protocols</h4><p class="plan-details-inline">' + escapeHtml(plan.protocols.join(', ')) + '</p></div>'
      : '';
    bodyEl.innerHTML =
      '<div class="plan-details-grid">' +
      '<div><strong>Family</strong><span>' + escapeHtml(plan.family || 'N/A') + '</span></div>' +
      '<div><strong>Minimum capacity</strong><span>' + escapeHtml(String(plan.minCapacityTiB)) + ' TiB</span></div>' +
      '<div><strong>Maximum IOPS</strong><span>' + escapeHtml(iopsText) + '</span></div>' +
      '<div><strong>Latency target (90th percentile)</strong><span>' + escapeHtml(latencyText) + '</span></div>' +
      '<div><strong>Maximum throughput</strong><span>' + escapeHtml(gbpsText) + '</span></div>' +
      (window.CUSTOMER_VIEW ? '' : '<div><strong>Indicative yearly cost</strong><span>' + escapeHtml(formatCurrency(plan.cost)) + '</span></div>') +
      '</div>' +
      '<p class="plan-details-notes">' + escapeHtml(plan.details || '') + '</p>' +
      includesList +
      hardwareList +
      protocolList;
    modal.removeAttribute('hidden');
  }

  function closePlanDetailsModal() {
    var modal = getById('plan-details-modal');
    if (modal) modal.setAttribute('hidden', '');
  }

  function bindPlanDetailsModal() {
    var modal = getById('plan-details-modal');
    var closeBtn = getById('plan-details-close');
    if (!modal) return;
    if (closeBtn) closeBtn.addEventListener('click', closePlanDetailsModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closePlanDetailsModal();
    });
  }

  function bindRateCardModal() {
    var openLink = getById('rate-card-open-link');
    var modal = getById('rate-card-modal');
    var closeBtn = getById('rate-card-close');
    if (openLink && !openLink.dataset.bound) {
      openLink.dataset.bound = '1';
      openLink.addEventListener('click', function (e) {
        e.preventDefault();
        if (modal) modal.removeAttribute('hidden');
      });
    }
    if (!modal) return;
    if (closeBtn) closeBtn.addEventListener('click', function () { modal.setAttribute('hidden', ''); });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.setAttribute('hidden', '');
    });
  }

  function bindKeystonePerformanceLevelsModal() {
    var openLink = getById('keystone-performance-levels-open-link');
    var modal = getById('keystone-performance-levels-modal');
    var closeBtn = getById('keystone-performance-levels-close');
    if (openLink && !openLink.dataset.bound) {
      openLink.dataset.bound = '1';
      openLink.addEventListener('click', function (e) {
        e.preventDefault();
        if (modal) modal.removeAttribute('hidden');
      });
    }
    if (!modal) return;
    if (closeBtn) closeBtn.addEventListener('click', function () { modal.setAttribute('hidden', ''); });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.setAttribute('hidden', '');
    });
  }

  function saveHwConfigContext() {
    try {
      var items = quoteItems;
      var configs = workloadConfigs;
      var totalCapacity = 0;
      var instances = 0;
      var psl = null;
      var protocol = 'unified';
      var protocols = [];
      items.forEach(function (item) {
        if (item.planName) {
          var plan = getPlanByName(item.planName);
          if (plan) {
            if (!psl) psl = plan.name;
            if (plan.protocols) protocols = protocols.concat(plan.protocols);
          }
          instances++;
        }
      });
      Object.keys(configs).forEach(function (wid) {
        var c = configs[wid];
        if (c && (c.requestedCapacity || c.suggestedCapacity || c.capacity)) {
          var committed = getEffectiveCapacity(c);
          var burstPct = parseFloat(getNormalizedBurstValue(c.burst)) || 0;
          totalCapacity += Math.round(committed * (1 + burstPct / 100) * 100) / 100;
        }
      });
      if (protocols.indexOf('FC') >= 0 || protocols.indexOf('iSCSI') >= 0 || protocols.indexOf('NVMe/FC') >= 0) {
        var hasNfs = protocols.indexOf('NFS') >= 0 || protocols.indexOf('SMB') >= 0;
        if (!hasNfs) protocol = 'san';
      }
      var instanceList = [];
      var matchedWids = {};
      items.forEach(function(item) {
        if (!item.planName) return;
        var plan = getPlanByName(item.planName);
        var wid = item.workloadId || null;
        if (!wid || matchedWids[wid]) {
          wid = null;
          var workloads = getSelectedWorkloads();
          for (var wi = 0; wi < workloads.length; wi++) {
            var candId = workloads[wi].id;
            if (matchedWids[candId]) continue;
            var candCfg = workloadConfigs[candId];
            if (!candCfg || candCfg.selectedPlan !== item.planName) continue;
            if (item.workloadLabel && workloads[wi].label === item.workloadLabel) { wid = candId; break; }
            if (!wid) wid = candId;
          }
        }
        if (wid) matchedWids[wid] = true;
        var cap = item.capacityTiB ? parseFloat(item.capacityTiB) || 0 : 0;
        if (!cap && wid && configs[wid]) {
          cap = getEffectiveCapacity(configs[wid]);
        }
        if (!cap && wid) {
          var capEl = document.getElementById('suggested-capacity-' + wid) || document.getElementById('capacity-' + wid);
          if (capEl) cap = parseFloat(capEl.value) || 0;
        }
        if (!cap && item.spec) {
          var specMatch = item.spec.match(/([\d.]+)\s*TiB/);
          if (specMatch) cap = parseFloat(specMatch[1]) || 0;
        }
        var wBurstPct = 0;
        if (wid && configs[wid]) {
          wBurstPct = parseFloat(getNormalizedBurstValue(configs[wid].burst)) || 0;
        }
        cap = Math.round(cap * (1 + wBurstPct / 100) * 100) / 100;
        var proto = 'unified';
        if (plan && plan.protocols) {
          var pHasFc = plan.protocols.indexOf('FC') >= 0 || plan.protocols.indexOf('iSCSI') >= 0 || plan.protocols.indexOf('NVMe/FC') >= 0;
          var pHasNfs = plan.protocols.indexOf('NFS') >= 0 || plan.protocols.indexOf('SMB') >= 0;
          if (pHasFc && !pHasNfs) proto = 'san';
        }
        instanceList.push({
          psl: plan ? plan.name : (psl || 'Premium'),
          capacityTiB: cap || 100,
          protocol: proto,
          workloadId: wid || '',
          workloadLabel: item.workloadLabel || item.name || '',
          planName: item.planName,
          spec: item.spec || ''
        });
      });
      var ctx = {
        psl: psl || 'Premium',
        capacityTiB: totalCapacity || 100,
        instances: Math.max(1, instances),
        protocol: protocol,
        quoteId: currentQuoteId,
        instanceList: instanceList.length ? instanceList : [{psl: psl||'Premium', capacityTiB: totalCapacity||100, protocol: protocol, workloadLabel:'Default', planName: psl||'Premium', spec:''}]
      };
      console.log('[SUB-SIZER] Saving hwConfigContext:', JSON.stringify(ctx.instanceList.map(function(il){return{cap:il.capacityTiB,label:il.workloadLabel};})));
      sessionStorage.setItem('hwConfigContext', JSON.stringify(ctx));
    } catch (e) { console.error('[SUB-SIZER] Error saving hwConfigContext:', e); }
  }

  window.applyHwConfigUpdate = function(hwData) {
    if (!hwData || !hwData.capacityTiB) return;
    var newCap = parseFloat(hwData.capacityTiB);
    if (isNaN(newCap) || newCap <= 0) return;
    var instIdx = hwData.instanceIndex || 0;
    var instCount = hwData.instanceCount || 1;
    if (instCount > 1 && instIdx < quoteItems.length) {
      var targetItem = quoteItems[instIdx];
      if (targetItem) {
        var spec = targetItem.spec || '';
        targetItem.spec = spec.replace(/[\d.]+\s*TiB/, newCap + ' TiB');
        targetItem.capacityTiB = newCap;
      }
    }
    updateItemization();
    updateSidebarFromSelections();
    saveHwConfigContext();
  };

  function openHwSizerModal() {
    saveHwConfigContext();
    var modal = getById('hw-sizer-modal');
    var iframe = getById('hw-sizer-iframe');
    if (!modal || !iframe) return;
    iframe.src = 'hw-configurator.html';
    modal.style.display = 'flex';
  }

  function closeHwSizerModal() {
    var modal = getById('hw-sizer-modal');
    var iframe = getById('hw-sizer-iframe');
    if (modal) modal.style.display = 'none';
    if (iframe) iframe.src = '';
  }

  function bindReviewHardwareModal() {
    var btn = getById('btn-review-hardware');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        if (quoteItems.length === 0) return;
        if (sidebarHardwareMode) {
          openHwSizerModal();
        } else {
          toggleSidebarModeWithFlip(true);
        }
      });
    }

    function closeHwSizerWithoutApprovalChange() {
      closeHwSizerModal();
      updateApprovalUiState();
      if (sidebarHardwareMode) toggleSidebarModeWithFlip(false);
    }

    function onHwSizerApproveFromIframe() {
      setHwApproved(true);
      closeHwSizerModal();
      updateApprovalUiState();
      if (sidebarHardwareMode) toggleSidebarModeWithFlip(false);
      refreshHwSummaryApprovalInDom();
    }

    function onHwSizerDraftFromIframe() {
      setHwApproved(false);
      closeHwSizerModal();
      updateApprovalUiState();
      if (sidebarHardwareMode) toggleSidebarModeWithFlip(false);
      refreshHwSummaryApprovalInDom();
    }

    var closeBtn = getById('hw-sizer-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        closeHwSizerWithoutApprovalChange();
      });
    }

    var modalBg = getById('hw-sizer-modal');
    if (modalBg) {
      modalBg.addEventListener('click', function (e) {
        if (e.target === modalBg) {
          closeHwSizerWithoutApprovalChange();
        }
      });
    }

    window.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'hwSizerApproveAndClose') {
        onHwSizerApproveFromIframe();
        return;
      }
      if (e.data && e.data.type === 'hwSizerDraftSave') {
        onHwSizerDraftFromIframe();
        return;
      }
      if (e.data && e.data.type === 'hwConfigUpdate') {
        if (typeof window.applyHwConfigUpdate === 'function') {
          window.applyHwConfigUpdate(e.data);
        }
        var hwInfo = getById('hw-config-summary');
        if (hwInfo) {
          var d = e.data;
          var swInfo = d.switchRequired === 'Required' || d.switchRequired === 'Optional'
            ? ' \u00B7 Switch: ' + (d.switchFamily || '\u2014') + ' (' + (d.switchPortsConsumed || 0) + '/' + ((d.switchPortsConsumed||0)+(d.switchPortsFree||0)) + ' ports)'
            : ' \u00B7 Switchless';
          var bodyHtml;
          if (d.instanceSummaries && d.instanceSummaries.length > 1) {
            bodyHtml = d.instanceSummaries.map(function (s, idx) {
              return '<div><span style="color:#0067C5;font-weight:600">Instance ' + (idx + 1) + ':</span> ' +
                '<strong>' + (s.platform || '\u2014') + '</strong> \u00B7 ' +
                (s.haPairs || 1) + ' HA pair(s) \u00B7 ' +
                (s.totalDrives || 0) + ' drives \u00B7 ' +
                (s.shelves || 0) + ' shelf(s)</div>';
            }).join('');
          } else {
            bodyHtml = '<strong>' + (d.platform || '\u2014') + '</strong> \u00B7 ' +
              (d.haPairs || 1) + ' HA pair(s) \u00B7 ' +
              (d.totalDrives || 0) + ' drives \u00B7 ' +
              (d.shelves || 0) + ' shelf(s)' + swInfo;
          }
          hwInfo.innerHTML = mergeHwSummaryContent(bodyHtml);
          syncHwConfigSummaryVisibility();
        }
      }
    });
  }

  function updateWorkloadCount() {
    var el = getById('workload-count');
    if (el) {
      var specificCount = document.querySelectorAll('#workload-specific .quote-workload-tile.selected').length;
      var generalCount = document.querySelectorAll('.quote-workload-tiles-general .quote-workload-tile.selected').length;
      var count = specificCount + generalCount;
      el.textContent = '(' + count + '/' + MAX_SPECIFIC_WORKLOADS + ' selected)';
    }
  }

  function parseContractYears(contractLengthStr) {
    if (!contractLengthStr) return 1;
    var m = String(contractLengthStr).match(/(\d+)\s*(year|month)/i);
    if (!m) return 1;
    var num = parseInt(m[1], 10);
    if (m[2].toLowerCase().indexOf('month') === 0) return Math.max(1, Math.ceil(num / 12));
    return num;
  }

  function isAutoApprovedDiscount() {
    return appliedDiscountPct >= 0 && appliedDiscountPct < 25;
  }

  function canRequestApproval() {
    return appliedDiscountPct > 45 && hwConfigReviewed;
  }

  function getListPerTiBRate() {
    var years = getCurrentContractYears();
    var benchmarkPricing = getBenchmarkPricingOverride(years);
    if (benchmarkPricing && benchmarkPricing.perTiBPerMonth > 0) {
      return benchmarkPricing.perTiBPerMonth;
    }
    var totalTiB = getTotalCommittedTiB();
    var subtotal = quoteItems.reduce(function (sum, item) { return sum + (item.cost || 0); }, 0);
    if (totalTiB > 0 && subtotal > 0) {
      return Math.round((subtotal / 12 / totalTiB) * 100) / 100;
    }
    return 0;
  }

  function setText(id, text) {
    var el = getById(id);
    if (el) el.textContent = text;
  }

  function isQuoteSubmittedForApproval(quoteId) {
    if (!quoteId) return false;
    try {
      var uploadsKey = 'dealMarginUploadsByQuote';
      var raw = sessionStorage.getItem(uploadsKey) || localStorage.getItem(uploadsKey);
      var map = raw ? JSON.parse(raw) : {};
      return !!(map && map[quoteId] && map[quoteId].submittedForApproval);
    } catch (e) {
      return false;
    }
  }

  function setQuoteSubmittedForApproval(quoteId, submitted) {
    if (!quoteId) return;
    try {
      var uploadsKey = 'dealMarginUploadsByQuote';
      var raw = sessionStorage.getItem(uploadsKey) || localStorage.getItem(uploadsKey);
      var map = raw ? JSON.parse(raw) : {};
      if (!map || typeof map !== 'object' || !map[quoteId]) return;
      map[quoteId].submittedForApproval = !!submitted;
      map[quoteId].uploadedAt = new Date().toISOString();
      sessionStorage.setItem(uploadsKey, JSON.stringify(map));
      localStorage.setItem(uploadsKey, JSON.stringify(map));
    } catch (e) {}
  }

  var SELLABILITY_COUNTRY_RULES = [
    { country: 'US', geo: 'AMER', entity: 'NetApp, Inc.', model: 'Buy-Sell', aliases: ['us', 'u.s.', 'usa', 'united states', 'united states of america'] },
    { country: 'Canada', geo: 'AMER', entity: 'NetApp Canada Ltd.', model: 'Buy-Sell', aliases: ['canada'] },
    { country: 'Australia', geo: 'APAC', entity: 'NetApp Australia Pty. Ltd.', model: 'Buy-Sell', aliases: ['australia'] },
    { country: 'India', geo: 'APAC', entity: 'NetApp India Marketing and Services Private Limited', model: 'Buy-Sell', aliases: ['india'] },
    { country: 'Japan', geo: 'APAC', entity: 'NetApp GK', model: 'Buy-Sell', aliases: ['japan'] },
    { country: 'Austria', geo: 'EMEA', entity: 'NetApp Austria GmbH', model: 'Buy-Sell', aliases: ['austria'] },
    { country: 'Belgium', geo: 'EMEA', entity: 'NetApp Belgium BVBA', model: 'Buy-Sell', aliases: ['belgium'] },
    { country: 'France', geo: 'EMEA', entity: 'NetApp France SAS', model: 'Buy-Sell', aliases: ['france'] },
    { country: 'Germany', geo: 'EMEA', entity: 'NetApp Deutschland GmbH', model: 'Buy-Sell', aliases: ['germany'] },
    { country: 'Ireland', geo: 'EMEA', entity: 'NetApp Ireland Ltd.', model: 'Buy-Sell', aliases: ['ireland'] },
    { country: 'Israel', geo: 'EMEA', entity: 'NetApp Israel Sales Limited', model: 'Buy-Sell', aliases: ['israel'] },
    { country: 'Italy', geo: 'EMEA', entity: 'NetApp Italia S.r.l.', model: 'Buy-Sell', aliases: ['italy'] },
    { country: 'Netherlands', geo: 'EMEA', entity: 'NetApp B.V.', model: 'Buy-Sell', aliases: ['netherlands'] },
    { country: 'Spain', geo: 'EMEA', entity: 'NetApp Spain Sales SL', model: 'Buy-Sell', aliases: ['spain'] },
    { country: 'Switzerland', geo: 'EMEA', entity: 'NetApp Switzerland GmbH', model: 'Buy-Sell', aliases: ['switzerland'] },
    { country: 'UK', geo: 'EMEA', entity: 'NetApp UK Ltd.', model: 'Buy-Sell', aliases: ['uk', 'u.k.', 'united kingdom', 'great britain'] },
    { country: 'Mexico', geo: 'AMER', entity: 'NetApp Mexico S. de R.L. de C.V.', model: 'Non-Buy/Sell', aliases: ['mexico'] },
    { country: 'Hong Kong', geo: 'APAC', entity: 'NetApp (Hong Kong) Limited', model: 'Non-Buy/Sell', aliases: ['hong kong'] },
    { country: 'Korea', geo: 'APAC', entity: 'NetApp Korea Limited', model: 'Non-Buy/Sell', aliases: ['korea', 'south korea'] },
    { country: 'New Zealand', geo: 'APAC', entity: 'NetApp New Zealand Limited', model: 'Non-Buy/Sell', aliases: ['new zealand'] },
    { country: 'Singapore', geo: 'APAC', entity: 'NetApp Singapore Pte. Ltd.', model: 'Non-Buy/Sell', aliases: ['singapore'] },
    { country: 'Taiwan', geo: 'APAC', entity: 'NetApp (Hong Kong) Limited - Taiwan Branch', model: 'Non-Buy/Sell', aliases: ['taiwan'] },
    { country: 'Argentina', geo: 'EMEA', entity: 'NetApp Argentina S.R.L.', model: 'Non-Buy/Sell', aliases: ['argentina'] },
    { country: 'Denmark', geo: 'EMEA', entity: 'NetApp Denmark ApS', model: 'Non-Buy/Sell', aliases: ['denmark'] },
    { country: 'Saudi Arabia', geo: 'EMEA', entity: 'Network Appliance Saudi Arabia LLC', model: 'Non-Buy/Sell', aliases: ['saudi arabia'] },
    { country: 'Sweden', geo: 'EMEA', entity: 'NetApp Sweden AB', model: 'Non-Buy/Sell', aliases: ['sweden'] },
    { country: 'Turkey', geo: 'EMEA', entity: 'NetApp Teknoloji Limited Sirketi', model: 'Non-Buy/Sell', aliases: ['turkey'] },
    { country: 'UAE', geo: 'EMEA', entity: 'NetApp BV (Foreign Branch)', model: 'Non-Buy/Sell', aliases: ['uae', 'united arab emirates'] }
  ];

  function normalizeAddressText(s) {
    return String(s || '').toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function findSellabilityCountryRule(addressText) {
    var text = normalizeAddressText(addressText);
    if (!text) return null;
    for (var i = 0; i < SELLABILITY_COUNTRY_RULES.length; i++) {
      var rule = SELLABILITY_COUNTRY_RULES[i];
      for (var j = 0; j < rule.aliases.length; j++) {
        var alias = normalizeAddressText(rule.aliases[j]);
        if (alias && text.indexOf(alias) !== -1) return rule;
      }
    }
    return null;
  }

  function getSellabilityDecision() {
    var shipTo = getById('ship-to-address');
    var shipText = shipTo ? shipTo.value : '';
    if (!String(shipText || '').trim()) {
      return { status: 'pending', message: 'Location check pending. Enter Ship-to address.' };
    }
    var rule = findSellabilityCountryRule(shipText);
    if (!rule) {
      return { status: 'blocked', message: 'Ship-to country is not in the approved country availability list.' };
    }
    return {
      status: 'allowed',
      message: 'Eligible (' + rule.model + ') · ' + rule.country + ' / ' + rule.geo + ' · Entity: ' + rule.entity
    };
  }

  function updateSellabilityUi() {
    // Location check removed
  }

  function formatCurrentStatusTimestamp() {
    var now = new Date();
    return now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    });
  }

  function updateApprovalUiState() {
    if (sidebarHardwareMode) return;

    var autoApproved = isAutoApprovedDiscount(); // true when discount < 25%
    var hasQuoteItems = quoteItems.length > 0;
    var hasDiscountRate = appliedDiscountPct > 0;
    var isEffectivelyApproved = autoApproved && hasQuoteItems;
    var showApprovedStatus = isEffectivelyApproved && hasDiscountRate;
    var statusDot = getById('quote-status-dot');
    var statusText = getById('quote-status-text');
    var statusMeta = getById('quote-status-meta');
    var submitBtn = getById('btn-submit');
    var sendBtn = getById('btn-send-quote');
    var downloadBtn = getById('btn-download');
    var approvalNotice = getById('quote-approval-notice');

    if (statusDot) {
      statusDot.classList.remove('draft', 'approved');
      statusDot.classList.add(showApprovedStatus ? 'approved' : 'draft');
    }
    if (statusText) {
      statusText.textContent = showApprovedStatus ? 'Approved' : 'Draft';
    }
    if (statusMeta) {
      statusMeta.textContent = showApprovedStatus
        ? ('Auto approved: discount below 25% \u00B7 ' + formatCurrentStatusTimestamp())
        : ('Auto saved ' + formatCurrentStatusTimestamp());
    }

    // Download: only shown + enabled after HW config approved and quote has items
    if (downloadBtn) {
      if (hwConfigReviewed && hasQuoteItems) {
        downloadBtn.removeAttribute('hidden');
        downloadBtn.disabled = false;
      } else {
        downloadBtn.setAttribute('hidden', '');
        downloadBtn.disabled = true;
      }
    }

    // Send for approval: shown whenever a discount was applied AND HW config approved
    if (submitBtn) {
      submitBtn.textContent = 'Send for approval';
      if (hwConfigReviewed && hasQuoteItems && hasDiscountRate) {
        submitBtn.removeAttribute('hidden');
        submitBtn.disabled = false;
        submitBtn.title = '';
      } else {
        submitBtn.setAttribute('hidden', '');
        submitBtn.disabled = true;
        submitBtn.title = hwConfigReviewed ? (hasDiscountRate ? '' : 'Apply a discount first') : 'Approve hardware in the HW Configurator first';
      }
    }

    // Send quote to customer: only shown when discount is BELOW the threshold (< 25%)
    if (sendBtn) {
      if (hwConfigReviewed && hasQuoteItems && autoApproved) {
        sendBtn.removeAttribute('hidden');
        sendBtn.disabled = false;
        sendBtn.title = '';
      } else {
        sendBtn.setAttribute('hidden', '');
        sendBtn.disabled = true;
        sendBtn.title = '';
      }
    }

    if (approvalNotice) {
      if (showApprovedStatus) {
        approvalNotice.textContent = 'Deal approved';
        approvalNotice.classList.remove('quote-discount-warning-hidden');
      } else {
        approvalNotice.classList.add('quote-discount-warning-hidden');
      }
    }

    // Customer view: single submit button, enabled once quote has items
    var customerSubmitBtn = getById('btn-customer-submit');
    if (customerSubmitBtn) {
      customerSubmitBtn.disabled = !hasQuoteItems;
      customerSubmitBtn.title = hasQuoteItems ? '' : 'Add at least one workload to submit';
    }
  }

  function getConsoleEntryUrl() {
    try {
      var custom = typeof window !== 'undefined' && window.NETAPP_CONSOLE_URL;
      if (custom != null && String(custom).trim() !== '') {
        var u = String(custom).trim();
        return u.endsWith('/') ? u : u + '/';
      }
      return new URL('console/index.html', window.location.href).href;
    } catch (e) {
      return window.location.origin + '/console/index.html';
    }
  }

  function saveQuoteContextForConsole() {
    try {
      var returnUrl = new URL(
        'sizing.html?quote=' + encodeURIComponent(currentQuoteId || '') +
          '&opportunity=' + encodeURIComponent((currentOpportunityId || '').trim()),
        window.location.href
      ).href;
      var payload = {
        quoteId: currentQuoteId,
        opportunityId: (currentOpportunityId || '').trim(),
        consoleEntryUrl: getConsoleEntryUrl(),
        returnUrl: returnUrl,
        savedAt: new Date().toISOString(),
        quoteItems: quoteItems.map(function (q) {
          return { name: q.name, planName: q.planName, spec: q.spec, workloadLabel: q.workloadLabel, capacityTiB: q.capacityTiB };
        })
      };
      sessionStorage.setItem('subSizerConsoleContext', JSON.stringify(payload));
    } catch (e) {}
  }

  function openConsoleModuleModal() {
    saveQuoteContextForConsole();
    saveHwConfigContext();
    var modal = getById('console-module-modal');
    var iframe = getById('console-module-iframe');
    if (!modal || !iframe) return;
    iframe.src = getConsoleEntryUrl();
    modal.style.display = 'flex';
  }

  function closeConsoleModuleModal() {
    var modal = getById('console-module-modal');
    var iframe = getById('console-module-iframe');
    if (modal) modal.style.display = 'none';
    if (iframe) iframe.src = '';
  }

  function bindConsoleModuleModal() {
    var closeBtn = getById('console-module-close');
    var emailBtn = getById('console-module-email');
    var modalBg = getById('console-module-modal');
    if (closeBtn && !closeBtn.dataset.bound) {
      closeBtn.dataset.bound = '1';
      closeBtn.addEventListener('click', function () {
        closeConsoleModuleModal();
      });
    }
    if (emailBtn && !emailBtn.dataset.bound) {
      emailBtn.dataset.bound = '1';
      emailBtn.addEventListener('click', function () {
        closeConsoleModuleModal();
        openSendQuoteModal();
      });
    }
    if (modalBg && !modalBg.dataset.boundClick) {
      modalBg.dataset.boundClick = '1';
      modalBg.addEventListener('click', function (e) {
        if (e.target === modalBg) closeConsoleModuleModal();
      });
    }
  }

  function openSendQuoteModal() {
    var modal = getById('send-quote-modal');
    var emailInput = getById('send-quote-email');
    if (!modal || !emailInput) return;
    var titleEl = getById('send-quote-modal-title');
    if (titleEl && currentQuoteId) {
      titleEl.textContent = 'Send Quote #' + currentQuoteId + ' to customer';
    }
    emailInput.value = '';
    modal.removeAttribute('hidden');
    emailInput.focus();
  }

  function closeSendQuoteModal() {
    var modal = getById('send-quote-modal');
    if (modal) modal.setAttribute('hidden', '');
  }

  function bindSendQuoteModal() {
    var sendBtn = getById('btn-send-quote');
    var modal = getById('send-quote-modal');
    var cancelBtn = getById('send-quote-cancel');
    var form = getById('send-quote-form');
    var emailInput = getById('send-quote-email');
    var notice = getById('quote-send-notice');
    if (!sendBtn || !modal || !form || !emailInput) return;

    sendBtn.addEventListener('click', function () {
      if (sendBtn.disabled) return;
      if (!isAutoApprovedDiscount()) return;
      openSendQuoteModal();
    });

    if (cancelBtn) cancelBtn.addEventListener('click', function () { closeSendQuoteModal(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (emailInput.value || '').trim();
      var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!ok) {
        emailInput.focus();
        return;
      }
      var consoleUrl = getConsoleEntryUrl();
      try {
        var key = 'sentQuotesLog';
        var raw = localStorage.getItem(key);
        var list = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list)) list = [];
        list.push({
          quoteId: currentQuoteId,
          opportunityId: currentOpportunityId,
          consoleUrl: consoleUrl,
          to: email,
          sentAt: new Date().toISOString()
        });
        localStorage.setItem(key, JSON.stringify(list));
      } catch (err) {}
      if (notice) {
        notice.textContent = 'Quote #' + currentQuoteId + ' sent to ' + email + ' — ' + consoleUrl;
        notice.classList.remove('quote-discount-warning-hidden');
      }
      closeSendQuoteModal();
    });

    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeSendQuoteModal();
    });
  }

  function buildQuoteDownloadHtml() {
    var state = getQuoteState();
    var quoteLabel = getQuoteDisplayName(currentQuoteId, currentOpportunityId) || ('Quote ' + currentQuoteId);
    var today = new Date();
    var validUntil = new Date(today.getTime() + (14 * 24 * 60 * 60 * 1000));
    var quoteDate = today.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    var validDate = validUntil.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    function valOrTodo(v, label) {
      var s = (v == null ? '' : String(v)).trim();
      return s ? escapeHtml(s) : ('<span class="todo">TODO: ' + escapeHtml(label) + '</span>');
    }
    var customer = DEFAULT_OPPORTUNITY_PROFILE.customerName;
    var endUser = DEFAULT_OPPORTUNITY_PROFILE.customerName;
    var customerPhone = DEFAULT_OPPORTUNITY_PROFILE.customerPhone;
    var customerAddress = DEFAULT_OPPORTUNITY_PROFILE.customerAddress;
    var salesMotion = DEFAULT_OPPORTUNITY_PROFILE.salesMotion;
    var termLabel = state.contractLength || ((getCurrentContractYears() || 1) + ' Years');
    var billingLabel = state.billingFrequency || 'Monthly';
    var currency = state.currency || 'USD';
    var quoteStatus = 'Configured';
    var oppId = DEFAULT_OPPORTUNITY_PROFILE.opportunityId;
    var opportunityName = DEFAULT_OPPORTUNITY_PROFILE.opportunityName;
    var partnerName = DEFAULT_OPPORTUNITY_PROFILE.partnerName;
    var distributorName = DEFAULT_OPPORTUNITY_PROFILE.distributorName;
    var keystoneVersion = DEFAULT_OPPORTUNITY_PROFILE.keystoneVersion;
    var siteName = DEFAULT_OPPORTUNITY_PROFILE.siteName;
    var quoteFrom = 'NetApp Inc., 3060 Olsen Drive, San Jose, CA, 95128, US';
    var contactName = 'Derek Keller';
    var contactEmail = 'derek.keller@netapp.com';
    var contactPhone = '+1 (408) 822-6174';
    var fulfilmentMethod = 'Consolidated';
    var serviceCustomer = DEFAULT_OPPORTUNITY_PROFILE.customerName;
    var softwareDeliveryContact = 'Ryan Holloway';
    var softwareDeliveryEmail = 'ryan.holloway@megahostings.com';
    var customerEmail = 'info@megahostings.com';
    var incoterm = 'Not applicable';
    var contingency = '30 days';
    var contractNumber = 'KST-' + DEFAULT_OPPORTUNITY_PROFILE.opportunityId + '-2026-042';
    var orderType = 'Keystone STaaS On Premises';
    var contractName = 'Keystone STaaS On-Premises 3.0';
    var agreement = 'MASTER (U.S. & Canada)';
    var billingToPaymentTerms = {
      'monthly': 'Net 30 – Monthly billing',
      'quarterly': 'Net 30 – Quarterly billing',
      'annually': 'Net 30 – Annual billing',
      'annual': 'Net 30 – Annual billing',
      'bi-annually': 'Net 30 – Semi-annual billing',
      'semi-annual': 'Net 30 – Semi-annual billing',
      'biannual': 'Net 30 – Semi-annual billing'
    };
    var paymentTerms = billingToPaymentTerms[(billingLabel || '').toLowerCase()] || ('Net 30 – ' + billingLabel + ' billing');
    var termsAttachment = 'Keystone STaaS Resale Attachment';
    var serviceDescription = 'Keystone STaaS Service Description v3.2';
    var serviceSupplement = 'Keystone STaaS Service Description v3.2 - Supplement';
    var partnerSupported = 'No';
    var secureSite = 'No';
    var targetReadinessDate = '01 Jun 2026';
    var targetStartDate = '25 Jun 2026';
    var solutionQuoteNumber = currentQuoteId || 'TBD';
    var rows = quoteItems.map(function (item) {
      var cap = '';
      var m = String(item.spec || '').match(/(\d+(\.\d+)?)\s*TiB/i);
      if (m) cap = m[1];
      var planPart = item.planName || 'Premium';
      var partNumber = 'KEY3-UNIFIED-' + (String(planPart).toUpperCase().indexOf('PREMIUM') >= 0 ? 'PREM' : String(planPart).toUpperCase().replace(/\s+/g, '-'));
      var unitNet = item.cost ? (item.cost / 12) : 0;
      return '<tr>' +
        '<td>' + escapeHtml(partNumber) + '</td>' +
        '<td>' + escapeHtml(item.name || '') + '</td>' +
        '<td>' + escapeHtml(cap || '—') + '</td>' +
        '<td>' + escapeHtml(currency) + ' ' + formatCurrency(unitNet).replace('$', '') + '</td>' +
        '<td>' + escapeHtml(currency) + ' ' + formatCurrency(item.cost || 0).replace('$', '') + '</td>' +
      '</tr>';
    }).join('');
    var yearly = getById('sidebar-total-year-final') ? getById('sidebar-total-year-final').textContent : '$0';
    var monthly = getById('sidebar-monthly-cost') ? getById('sidebar-monthly-cost').textContent : '$0';
    var termTotal = getById('sidebar-total') ? getById('sidebar-total').textContent : '$0';
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + escapeHtml(quoteLabel) + '</title>' +
      '<style>' +
      'body{font-family:Arial,Helvetica,sans-serif;padding:18px;color:#111;font-size:11px;line-height:1.35}' +
      '.top-title{font-size:13px;font-weight:700;margin:0 0 6px}' +
      '.meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;margin-bottom:10px}' +
      '.meta p{margin:0}' +
      '.section{margin-top:10px}' +
      '.section-title{font-size:12px;font-weight:700;margin:0 0 6px}' +
      'table{width:100%;border-collapse:collapse}' +
      'th,td{border:1px solid #d8d8d8;padding:6px 7px;text-align:left;vertical-align:top;font-size:10.5px}' +
      'th{background:#efefef;font-weight:700}' +
      '.summary{margin-top:8px;border:1px solid #d8d8d8}' +
      '.summary-row{display:flex;justify-content:space-between;padding:6px 8px;border-top:1px solid #ececec}' +
      '.summary-row:first-child{border-top:none}' +
      '.muted{color:#4b5563}' +
      '.todo{color:#b91c1c;font-weight:700}' +
      '.footer-rule{margin:14px 0 6px;border-top:1px solid #9ca3af}' +
      '.footer-line{display:flex;justify-content:space-between;font-size:10px;color:#333}' +
      '.page-mark{margin-top:6px;font-size:10px;color:#333}' +
      '</style>' +
      '</head><body>' +
      '<p class="top-title">Quote Information</p>' +
      '<p><strong>Quote Name:</strong> ' + escapeHtml(opportunityName) + '</p>' +
      '<div class="meta">' +
      '<p><strong>Quote Number:</strong> ' + escapeHtml(solutionQuoteNumber) + '</p><p><strong>Opportunity ID:</strong> ' + escapeHtml(oppId) + '</p>' +
      '<p><strong>Opportunity Name:</strong> ' + escapeHtml(opportunityName) + '</p><p><strong>Quote Date:</strong> ' + quoteDate + '</p>' +
      '<p><strong>Quote Valid Until:</strong> ' + validDate + '</p><p><strong>Sales Motion:</strong> ' + escapeHtml(salesMotion) + '</p>' +
      '<p><strong>Customer / End User:</strong> ' + escapeHtml(customer) + '</p><p><strong>Service Customer:</strong> ' + escapeHtml(serviceCustomer) + '</p>' +
      '<p><strong>Customer Phone:</strong> ' + escapeHtml(customerPhone) + '</p><p><strong>Customer Email:</strong> ' + escapeHtml(customerEmail) + '</p>' +
      '<p><strong>Partner:</strong> ' + escapeHtml(partnerName) + '</p><p><strong>Distributor:</strong> ' + escapeHtml(distributorName) + '</p>' +
      '<p><strong>Keystone Version:</strong> ' + escapeHtml(keystoneVersion) + '</p><p><strong>Site Location:</strong> ' + escapeHtml(siteName) + '</p>' +
      '<p><strong>NetApp Contact Name:</strong> ' + valOrTodo(contactName, 'NetApp Contact Name') + '</p><p><strong>Email:</strong> ' + valOrTodo(contactEmail, 'Contact Email') + '</p>' +
      '<p><strong>Quote From:</strong> ' + valOrTodo(quoteFrom, 'Quote From') + '</p><p><strong>Software Delivery Contact:</strong> ' + valOrTodo(softwareDeliveryContact, 'Software Delivery Contact') + '</p>' +
      '<p><strong>Software Delivery Email:</strong> ' + valOrTodo(softwareDeliveryEmail, 'Software Delivery Email') + '</p><p><strong>Incoterm:</strong> ' + valOrTodo(incoterm, 'Incoterm') + '</p>' +
      '<p><strong>Quote Status:</strong> ' + escapeHtml(quoteStatus) + '</p><p><strong>Fulfilment Method:</strong> ' + escapeHtml(fulfilmentMethod) + '</p>' +
      '<p><strong>Contingency:</strong> ' + valOrTodo(contingency, 'Contingency') + '</p><p><strong>Contract Number:</strong> ' + valOrTodo(contractNumber, 'Contract Number') + '</p>' +
      '<p><strong>Order Type:</strong> ' + escapeHtml(orderType) + '</p><p><strong>Contract Name:</strong> ' + valOrTodo(contractName, 'Contract Name') + '</p>' +
      '<p><strong>Agreement:</strong> ' + escapeHtml(agreement) + '</p><p><strong>Payment Terms:</strong> ' + valOrTodo(paymentTerms, 'Payment Terms') + '</p>' +
      '<p><strong>Terms:</strong> ' + escapeHtml(termsAttachment) + '</p><p><strong>Service Description:</strong> ' + escapeHtml(serviceDescription) + '</p>' +
      '<p><strong>Service Description Supplement:</strong> ' + escapeHtml(serviceSupplement) + '</p><p><strong>Partner Supported:</strong> ' + escapeHtml(partnerSupported) + '</p>' +
      '<p><strong>Secure Site:</strong> ' + escapeHtml(secureSite) + '</p><p><strong>Target Readiness Date:</strong> ' + valOrTodo(targetReadinessDate, 'Target Readiness Date') + '</p>' +
      '<p><strong>Target Start Date:</strong> ' + valOrTodo(targetStartDate, 'Target Start Date') + '</p><p><strong>Subscription Term:</strong> ' + escapeHtml(termLabel) + '</p>' +
      '<p><strong>Billing Frequency:</strong> ' + escapeHtml(billingLabel) + '</p>' +
      '</div>' +
      '<div class="section"><p class="section-title">Detailed Section</p>' +
      '<p><strong>Keystone STaaS Subscription</strong></p>' +
      '<table><thead><tr><th>Part Number</th><th>Product Description</th><th>Committed Qty (TiB)</th><th>Unit Net Price / Month</th><th>Ext. Net Price / Year</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '</div>' +
      '<div class="section"><p class="section-title">Cost Summary</p>' +
      '<div class="summary">' +
      '<div class="summary-row"><span><strong>Total Monthly Bill</strong></span><span>' + escapeHtml(monthly) + '</span></div>' +
      '<div class="summary-row"><span><strong>Yearly Net Price</strong></span><span>' + escapeHtml(yearly) + '</span></div>' +
      '<div class="summary-row"><span><strong>Term Total Net Price</strong></span><span>' + escapeHtml(termTotal) + '</span></div>' +
      '<div class="summary-row"><span class="muted">All amounts are in</span><span>' + escapeHtml(currency) + '</span></div>' +
      '</div>' +
      '</div>' +
      '<div class="section"><p class="section-title">Terms and Conditions</p>' +
      '<p>This quote is presented for budgetary purposes only. All net prices and discounts are estimated values only and are subject to change. A budgetary quote cannot be used as the basis for valid purchase order.</p>' +
      '</div>' +
      '<div class="footer-rule"></div>' +
      '<div class="footer-line"><span>Price List: NA-USD</span><span>Date Printed: ' + quoteDate + '</span><span>Page: 1 of 1</span></div>' +
      '<div class="page-mark">-- 1 of 1 --</div>' +
      '</body></html>';
  }

  function bindDownloadQuote() {
    var btn = getById('btn-download');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      var didPdf = false;
      if (window.jspdf && window.jspdf.jsPDF) {
        try {
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({ unit: 'pt', format: 'a4' });
        var state = getQuoteState();
        var today = new Date();
        var validUntil = new Date(today.getTime() + (14 * 24 * 60 * 60 * 1000));
        var quoteDate = today.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
        var validDate = validUntil.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
        var pdfProfile = getOpportunityProfile(currentOpportunityId);
        var pdfCustomerName = (pdfProfile && pdfProfile.customerName) ? pdfProfile.customerName : DEFAULT_OPPORTUNITY_PROFILE.customerName;
        // Fixed metadata
        var pdfOpportunityName = DEFAULT_OPPORTUNITY_PROFILE.opportunityName;
        var pdfContactName = 'Derek Keller';
        var pdfContactEmail = 'derek.keller@netapp.com';
        var pdfContactPhone = '+1 (408) 822-6174';
        var pdfQuoteFrom = 'NetApp Inc., 3060 Olsen Drive, San Jose, CA, 95128, US';
        var pdfSoftwareDeliveryContact = 'Ryan Holloway';
        var pdfSoftwareDeliveryEmail = 'ryan.holloway@megahostings.com';
        var pdfCustomerEmail = 'info@megahostings.com';
        var pdfTargetReadinessDate = '01 Jun 2026';
        var pdfTargetStartDate = '25 Jun 2026';
        var pdfBillingLabel = state.billingFrequency || 'Monthly';
        var pdfBillingToPayment = {
          'monthly': 'Net 30 – Monthly billing', 'quarterly': 'Net 30 – Quarterly billing',
          'annually': 'Net 30 – Annual billing', 'annual': 'Net 30 – Annual billing',
          'bi-annually': 'Net 30 – Semi-annual billing', 'semi-annual': 'Net 30 – Semi-annual billing',
          'biannual': 'Net 30 – Semi-annual billing'
        };
        var pdfPaymentTerms = pdfBillingToPayment[(pdfBillingLabel || '').toLowerCase()] || ('Net 30 – ' + pdfBillingLabel + ' billing');
        var pdfContractNumber = 'KST-' + DEFAULT_OPPORTUNITY_PROFILE.opportunityId + '-2026-042';

        // Page constants
        var LM = 40, PW = 515, PH = 800;

        // Draw a key-value table (no autoTable dependency)
        function drawKVTable(ys, kvRows) {
          var col1W = 165, col2W = PW - col1W;
          doc.setFontSize(8.5);
          kvRows.forEach(function (pair) {
            if (ys > PH) { doc.addPage(); ys = 40; }
            var rh = 14;
            doc.setFillColor(248, 248, 248);
            doc.rect(LM, ys - 10, col1W, rh, 'F');
            doc.setDrawColor(215, 215, 215);
            doc.rect(LM, ys - 10, PW, rh, 'S');
            doc.setFont('helvetica', 'bold');
            doc.text(String(pair[0]), LM + 3, ys);
            doc.setFont('helvetica', 'normal');
            var valStr = String(pair[1] == null ? '' : pair[1]);
            var valLines = doc.splitTextToSize(valStr, col2W - 6);
            doc.text(valLines[0] || '', LM + col1W + 3, ys);
            ys += rh;
          });
          return ys;
        }

        // Draw a multi-column table (no autoTable dependency)
        function drawColTable(ys, headers, bodyRows, colWs) {
          var totalW = colWs.reduce(function (a, b) { return a + b; }, 0);
          var colXs = [LM];
          for (var ci = 0; ci < colWs.length - 1; ci++) colXs.push(colXs[ci] + colWs[ci]);
          var lineH = 14, cellPad = 3;
          doc.setFontSize(8.5);
          // Header
          if (ys > PH) { doc.addPage(); ys = 40; }
          doc.setFillColor(239, 239, 239);
          doc.rect(LM, ys - 10, totalW, lineH + 2, 'F');
          doc.setDrawColor(210, 210, 210);
          doc.rect(LM, ys - 10, totalW, lineH + 2, 'S');
          doc.setFont('helvetica', 'bold');
          headers.forEach(function (h, i) { doc.text(String(h), colXs[i] + cellPad, ys); });
          ys += lineH + 2;
          // Body rows
          doc.setFont('helvetica', 'normal');
          bodyRows.forEach(function (row) {
            if (ys > PH) { doc.addPage(); ys = 40; }
            var maxLines = 1;
            row.forEach(function (cell, i) {
              var ln = doc.splitTextToSize(String(cell == null ? '' : cell), colWs[i] - cellPad * 2).length;
              if (ln > maxLines) maxLines = ln;
            });
            var rh = Math.max(lineH, maxLines * 11 + 4);
            doc.setDrawColor(210, 210, 210);
            doc.rect(LM, ys - lineH + 2, totalW, rh, 'S');
            row.forEach(function (cell, i) {
              var txt = doc.splitTextToSize(String(cell == null ? '' : cell), colWs[i] - cellPad * 2);
              doc.text(txt, colXs[i] + cellPad, ys);
            });
            ys += rh;
          });
          return ys;
        }

        var y = 36;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Quote Information', LM, y); y += 18;

        y = drawKVTable(y, [
          ['Quote Name', pdfOpportunityName],
          ['Quote Number', currentQuoteId || 'TBD'],
          ['Quote Date', quoteDate + '   |   Valid Until: ' + validDate],
          ['Opportunity ID', DEFAULT_OPPORTUNITY_PROFILE.opportunityId],
          ['Opportunity Name', DEFAULT_OPPORTUNITY_PROFILE.opportunityName],
          ['Customer / End User', pdfCustomerName],
          ['Customer Phone', DEFAULT_OPPORTUNITY_PROFILE.customerPhone],
          ['Customer Email', pdfCustomerEmail],
          ['Partner', DEFAULT_OPPORTUNITY_PROFILE.partnerName],
          ['Distributor', DEFAULT_OPPORTUNITY_PROFILE.distributorName],
          ['Sales Motion', DEFAULT_OPPORTUNITY_PROFILE.salesMotion],
          ['Keystone Version', DEFAULT_OPPORTUNITY_PROFILE.keystoneVersion],
          ['Site Location', DEFAULT_OPPORTUNITY_PROFILE.siteName],
          ['NetApp Contact Name', pdfContactName],
          ['NetApp Contact Phone', pdfContactPhone],
          ['NetApp Contact Email', pdfContactEmail],
          ['Quote From', pdfQuoteFrom],
          ['Service Customer', pdfCustomerName],
          ['Software Delivery Contact', pdfSoftwareDeliveryContact],
          ['Software Delivery Email', pdfSoftwareDeliveryEmail],
          ['Incoterm', 'Not applicable'],
          ['Quote Status', 'Configured'],
          ['Fulfilment Method', 'Consolidated'],
          ['Contingency', '30 days'],
          ['Contract Number', pdfContractNumber],
          ['Order Type', 'Keystone STaaS On Premises'],
          ['Contract Name', 'Keystone STaaS On-Premises 3.0'],
          ['Agreement', 'MASTER (U.S. & Canada)'],
          ['Payment Terms', pdfPaymentTerms]
        ]);
        y += 10;

        if (y > PH) { doc.addPage(); y = 40; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Detailed Section', LM, y); y += 13;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        var detailLines = [
          'Keystone STaaS Subscription',
          'Terms: Keystone STaaS Resale Attachment',
          'Service Description: Keystone STaaS Service Description v3.2',
          'Service Description Supplement: Keystone STaaS Service Description v3.2 – Supplement',
          'Order Type: Keystone STaaS On Premises',
          'Sales Motion: ' + DEFAULT_OPPORTUNITY_PROFILE.salesMotion,
          'Partner Supported: No    Secure Site: No',
          'Target Readiness Date: ' + pdfTargetReadinessDate + '    Target Start Date: ' + pdfTargetStartDate
        ];
        detailLines.forEach(function (ln) {
          if (y > PH) { doc.addPage(); y = 40; }
          doc.text(ln, LM, y); y += 11;
        });
        y += 8;

        // Line items table
        var tableRows = quoteItems.map(function (item) {
          var cap = '';
          var m = String(item.spec || '').match(/(\d+(\.\d+)?)\s*TiB/i);
          if (m) cap = m[1];
          var part = 'KEY3-UNIFIED-' + (String(item.planName || 'PREM').toUpperCase().indexOf('PREMIUM') >= 0 ? 'PREM' : String(item.planName || 'PLAN').toUpperCase().replace(/\s+/g, '-'));
          var unitMonthly = (item.cost || 0) / 12;
          return [part, item.name || '', cap || '—', 'TODO', unitMonthly.toFixed(2), (item.cost || 0).toFixed(2)];
        });
        var pdfAdpAnnual = getAdpAnnualCost();
        if (pdfAdpAnnual > 0) {
          var pdfAdpTiB = getTotalCommittedTiB();
          var pdfAdpMonths = getCurrentContractYears() * 12;
          var pdfAdpRate = getAdpRatePerTiBMonth(pdfAdpMonths);
          var pdfAdpPartNum = pdfAdpMonths >= 60 ? 'SUB-KEY3-ADP-60M-M' : pdfAdpMonths >= 36 ? 'SUB-KEY3-ADP-36-59M-M' : pdfAdpMonths >= 12 ? 'SUB-KEY3-ADP-12-35M-M' : 'SUB-KEY3-ADP-1-11M-M';
          tableRows.push([pdfAdpPartNum, 'Metro Cluster', pdfAdpTiB.toFixed(0), '—', pdfAdpRate.toFixed(2), pdfAdpAnnual.toFixed(2)]);
        }
        var pdfDtAnnual = getDtAnnualCost();
        if (pdfDtAnnual > 0) {
          var pdfDtMonths = getCurrentContractYears() * 12;
          var pdfDtRate = getDtRatePerTiBMonth(dataTieringTiB);
          var pdfDtPartNum = pdfDtMonths >= 60 ? 'SUB-KEY3-DT-60M-M' : pdfDtMonths >= 36 ? 'SUB-KEY3-DT-36-59M' : pdfDtMonths >= 12 ? 'SUB-KEY3-DT-12-35M' : 'SUB-KEY3-DT-1-11M';
          tableRows.push([pdfDtPartNum, 'Data Tiering', dataTieringTiB.toFixed(0), '—', pdfDtRate.toFixed(2), pdfDtAnnual.toFixed(2)]);
        }
        var pdfDiiCb = document.querySelector('input[name="addon_subscription"][value="dii"]');
        if (pdfDiiCb && pdfDiiCb.checked) {
          var pdfContractMonths = getCurrentContractYears() * 12;
          var pdfDiiSelected = getSelectedWorkloads();
          var pdfTibByPlan = {};
          for (var dii_i = 0; dii_i < pdfDiiSelected.length; dii_i++) {
            var dii_cfg = workloadConfigs[pdfDiiSelected[dii_i].id];
            if (!dii_cfg || !dii_cfg.capacity || !dii_cfg.selectedPlan) continue;
            var dii_pm = getPlanByName(dii_cfg.selectedPlan);
            var dii_pid = dii_pm ? dii_pm.id : null;
            if (!dii_pid) continue;
            var dii_t = parseFloat(dii_cfg.capacity) || 0;
            if (dii_t > 0) pdfTibByPlan[dii_pid] = (pdfTibByPlan[dii_pid] || 0) + dii_t;
          }
          var pdfDiiPlanIds = Object.keys(pdfTibByPlan);
          for (var dii_p = 0; dii_p < pdfDiiPlanIds.length; dii_p++) {
            var dii_planId = pdfDiiPlanIds[dii_p];
            var dii_planTiB = pdfTibByPlan[dii_planId];
            var dii_rate = getDiiRateForPlan(dii_planId, pdfContractMonths, dii_planTiB);
            var dii_annual = Math.round(dii_planTiB * dii_rate * 12 * 100) / 100;
            var dii_termCode = pdfContractMonths >= 36 ? '36-60M' : pdfContractMonths >= 24 ? '24-35M' : '12-23M';
            var dii_partNum = 'SUB-KEY3-DII-' + dii_planId.toUpperCase().replace(/-/g, '').substring(0, 4) + '-' + dii_termCode;
            tableRows.push([dii_partNum, 'Data Infrastructure Insights (' + dii_planId + ')', dii_planTiB.toFixed(0), '—', dii_rate.toFixed(2), dii_annual.toFixed(2)]);
          }
        }
        var pdfCjCb = document.querySelector('input[name="addon_subscription"][value="co-mingling"]');
        if (pdfCjCb && pdfCjCb.checked) {
          var pdfCjFee = demoAddonRate(14400).toFixed(2);
          tableRows.push(['SUB-KEY3-CJ', 'Cluster Join (one-time fee)', '1', '—', pdfCjFee, pdfCjFee]);
        }
        if (!tableRows.length) tableRows.push(['TODO', 'No line items added yet', '—', 'TODO', '0.00', '0.00']);

        if (y > PH) { doc.addPage(); y = 40; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Line Items', LM, y); y += 12;
        y = drawColTable(y,
          ['Part Number', 'Product Description', 'Qty TiB/Mo', 'Disc%', 'Unit Net $/TiB/Mo', 'Ext. Net Price/yr'],
          tableRows, [135, 125, 55, 40, 85, 75]);
        y += 10;

        var monthly = getById('sidebar-monthly-cost') ? getById('sidebar-monthly-cost').textContent : '$0';
        var yearly = getById('sidebar-total-year-final') ? getById('sidebar-total-year-final').textContent : '$0';
        var term = getById('sidebar-total') ? getById('sidebar-total').textContent : '$0';

        if (y > PH) { doc.addPage(); y = 40; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Estimated Subscription Sub Total – Ext. Net Price: ' + yearly, LM, y); y += 12;
        doc.text('Cost Summary', LM, y); y += 12;
        y = drawColTable(y,
          ['Monthly Net Price', 'Billing Frequency', 'Term', 'Total (Term)'],
          [[monthly, (state.billingFrequency || 'Monthly'), (state.contractLength || '—'), term]],
          [130, 130, 130, 125]);
        y += 8;
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.text('Yearly Net Price: ' + yearly, LM, y); y += 12;
        doc.setFont('helvetica', 'normal');
        doc.text('All amounts are in ' + (state.currency || 'USD'), LM, y); y += 16;

        if (y > PH) { doc.addPage(); y = 40; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Terms and Conditions', LM, y); y += 12;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text('This quote is presented for budgetary purposes only. All net prices and discounts are estimated values only and are subject to change.', LM, y, { maxWidth: PW });
        y += 10;
        doc.text('A budgetary quote cannot be used as the basis for valid purchase order.', LM, y);

        // Page footers
        var pageCount = doc.getNumberOfPages();
        for (var p = 1; p <= pageCount; p += 1) {
          doc.setPage(p);
          doc.setFontSize(8);
          doc.text('Solution Quotation ' + (currentQuoteId || 'TBD'), LM, 807);
          doc.text('All amounts are in ' + (state.currency || 'USD'), 200, 807);
          doc.line(LM, 812, 555, 812);
          doc.text('Price List: NA-USD', LM, 820);
          doc.text('Date Printed: ' + quoteDate, 240, 820);
          doc.text('Page: ' + p + ' of ' + pageCount, 500, 820);
        }
        doc.save('Quote_' + (currentQuoteId || 'draft') + '.pdf');
          didPdf = true;
        } catch (pdfErr) {
          /* PDF generation failed — fall through to HTML download */
        }
        if (didPdf) return;
      }
      var html = buildQuoteDownloadHtml();
      var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'Quote_' + (currentQuoteId || 'draft') + '.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  function updateSidebarTotals() {
    var baseSubtotal = quoteItems.reduce(function (sum, item) { return sum + (item.cost || 0); }, 0);
    var adpAnnual = getAdpAnnualCost();
    var dtAnnual = getDtAnnualCost();
    var diiAnnual = getDiiAnnualCost();
    var cjCb = document.querySelector('input[name="addon_subscription"][value="co-mingling"]');
    var cjChecked = !!(cjCb && cjCb.checked);
    var CJ_ONE_TIME_FEE = demoAddonRate(14400);
    var subtotal = baseSubtotal;
    var discountRateEl = getById('sidebar-discount-rate');
    var inputPct = discountRateEl && !isNaN(parseFloat(discountRateEl.value)) ? parseFloat(discountRateEl.value) : 0;
    var discountAmount = appliedDiscountPct > 0 ? subtotal * (appliedDiscountPct / 100) : 0;
    var totalPerYear = subtotal - discountAmount;
    var contractLengthEl = document.querySelector('input[name="contract-length"]:checked');
    var contractLabelEl = contractLengthEl && contractLengthEl.closest('.contract-terms-card') && contractLengthEl.closest('.contract-terms-card').querySelector('.contract-terms-card-label');
    var contractLengthStr = contractLabelEl ? contractLabelEl.textContent : '';
    var years = parseContractYears(contractLengthStr);
    var estimatedTotal = totalPerYear * years;
    var benchmarkPricing = getBenchmarkPricingOverride(years);

    // ADP row in sidebar — only visible when checkbox is checked AND cost > 0
    var adpCheckbox = document.querySelector('input[name="addon_subscription"][value="advanced-protection"]');
    var adpChecked = !!(adpCheckbox && adpCheckbox.checked);
    var adpRow = getById('sidebar-row-adp');
    var adpValueEl = getById('sidebar-adp-value');
    if (adpRow) adpRow.hidden = !adpChecked || adpAnnual <= 0;
    if (adpValueEl) adpValueEl.textContent = formatCurrency(adpAnnual);

    // Data Tiering row in sidebar — only visible when checkbox is checked AND capacity set
    var dtCheckbox = document.querySelector('input[name="addon_subscription"][value="tiering"]');
    var dtChecked = !!(dtCheckbox && dtCheckbox.checked);
    var dtRow = getById('sidebar-row-dt');
    var dtValueEl = getById('sidebar-dt-value');
    if (dtRow) dtRow.hidden = !dtChecked || dtAnnual <= 0;
    if (dtValueEl) dtValueEl.textContent = formatCurrency(dtAnnual);

    // DII row in sidebar — only visible when checkbox is checked AND workloads priced
    var diiCheckbox = document.querySelector('input[name="addon_subscription"][value="dii"]');
    var diiChecked = !!(diiCheckbox && diiCheckbox.checked);
    var diiRow = getById('sidebar-row-dii');
    var diiValueEl = getById('sidebar-dii-value');
    if (diiRow) diiRow.hidden = !diiChecked || diiAnnual <= 0;
    if (diiValueEl) diiValueEl.textContent = formatCurrency(diiAnnual);

    // Cluster Join row — one-time fee, shown only when checked
    var cjRow = getById('sidebar-row-cj');
    if (cjRow) cjRow.hidden = !cjChecked;

    var subEl = getById('sidebar-subtotal');
    var monthlyEl = getById('sidebar-monthly-cost');
    var perTiBEl = getById('sidebar-per-tib-month');
    var yearEl = getById('sidebar-total-year');
    var yearFinalEl = getById('sidebar-total-year-final');
    var totalEl = getById('sidebar-total');
    var totalBeforeDiscountEl = getById('sidebar-total-before-discount');
    var contractDiscountRow = getById('sidebar-row-contract-discount');
    var contractDiscountValueEl = getById('sidebar-contract-discount-value');
    if (benchmarkPricing) {
      var benchYearly = benchmarkPricing.yearlyNet;
      var benchTermBefore = benchYearly * years;
      var benchContractDiscount = appliedDiscountPct > 0 ? benchTermBefore * (appliedDiscountPct / 100) : 0;
      var benchTermAfter = benchTermBefore - benchContractDiscount;
      if (subEl) subEl.textContent = formatCurrency(benchYearly);
      if (monthlyEl) monthlyEl.textContent = formatCurrency(benchYearly / 12);
      if (perTiBEl) perTiBEl.textContent = formatCurrency(benchmarkPricing.perTiBPerMonth);
      if (yearEl) yearEl.textContent = formatCurrency(benchYearly);
      if (yearFinalEl) yearFinalEl.textContent = formatCurrency(benchYearly);
      if (totalBeforeDiscountEl) totalBeforeDiscountEl.textContent = formatCurrency(benchTermBefore);
      if (totalEl) totalEl.textContent = formatCurrency(benchTermAfter);
      if (contractDiscountRow && contractDiscountValueEl) {
        if (benchContractDiscount > 0) {
          contractDiscountRow.hidden = false;
          contractDiscountValueEl.textContent = '−' + formatCurrency(benchContractDiscount);
        } else {
          contractDiscountRow.hidden = true;
        }
      }
    } else {
      var contractBefore = subtotal * years;
      var contractDiscount = appliedDiscountPct > 0 ? contractBefore * (appliedDiscountPct / 100) : 0;
      var contractAfter = contractBefore - contractDiscount;
      if (subEl) subEl.textContent = formatCurrency(subtotal);
      if (monthlyEl) monthlyEl.textContent = formatCurrency(subtotal / 12);
      if (perTiBEl) perTiBEl.textContent = '$0';
      if (yearEl) yearEl.textContent = formatCurrency(subtotal);
      if (yearFinalEl) yearFinalEl.textContent = formatCurrency(subtotal);
      if (totalBeforeDiscountEl) totalBeforeDiscountEl.textContent = formatCurrency(contractBefore);
      if (totalEl) totalEl.textContent = formatCurrency(contractAfter);
      if (contractDiscountRow && contractDiscountValueEl) {
        if (contractDiscount > 0) {
          contractDiscountRow.hidden = false;
          contractDiscountValueEl.textContent = '−' + formatCurrency(contractDiscount);
        } else {
          contractDiscountRow.hidden = true;
        }
      }
    }
    var warningEl = getById('sidebar-discount-warning');
    if (warningEl) {
      if (inputPct > 25) {
        warningEl.classList.remove('quote-discount-warning-hidden');
      } else {
        warningEl.classList.add('quote-discount-warning-hidden');
      }
    }
    updateSellabilityUi();
    updateApprovalUiState();
  }

  function getIopsAbsolute(iopsValue, iopsUnit) {
    var n = parseFloat(iopsValue);
    if (isNaN(n) || n <= 0) return null;
    var u = String(iopsUnit || 'K').toUpperCase();
    if (u === 'M') return n * 1000000;
    if (u === 'K') return n * 1000;
    return n;
  }

  var WACC = 0.12;

  function calculateNPV(yearlyRate, years) {
    if (!yearlyRate || !years || years < 1) return 0;
    var npv = 0;
    for (var t = 1; t <= years; t++) {
      npv += yearlyRate / Math.pow(1 + WACC, t);
    }
    return npv;
  }

  function getCurrentContractYears() {
    var contractLengthEl = document.querySelector('input[name="contract-length"]:checked');
    var contractLabelEl = contractLengthEl && contractLengthEl.closest('.contract-terms-card') && contractLengthEl.closest('.contract-terms-card').querySelector('.contract-terms-card-label');
    var contractLengthStr = contractLabelEl ? contractLabelEl.textContent : '';
    return parseContractYears(contractLengthStr);
  }

  function getBenchmarkPricingOverride(contractYears) {
    if (!contractYears || contractYears < 1) return null;
    var selected = getSelectedWorkloads();
    if (!selected || !selected.length) return null;
    var fallbackCfg = null;
    for (var i = 0; i < selected.length; i += 1) {
      var wid = selected[i].id;
      var c = workloadConfigs[wid];
      if (c) {
        if (!fallbackCfg) fallbackCfg = c;
        var hit = getBenchmarkPricingOverrideForConfig(contractYears, c, 'premium');
        if (hit) return hit;
      }
    }
    if (!fallbackCfg) return null;
    var selectedPlanMeta = fallbackCfg.selectedPlan ? PLAN_OPTIONS.filter(function (p) { return p.name === fallbackCfg.selectedPlan; })[0] : null;
    return getBenchmarkPricingOverrideForConfig(contractYears, fallbackCfg, selectedPlanMeta ? selectedPlanMeta.id : null);
  }

  function getBenchmarkPricingOverrideForConfig(contractYears, cfg, planId) {
    if (!contractYears || contractYears < 1) return null;
    if (!cfg) return null;
    if (planId && planId !== 'premium' && planId !== 'unified-extreme' && planId !== 'standard') return null;
    var cap = parseFloat(cfg.capacity);
    if (isNaN(cap) || cap <= 0) return null;
    var burst = getNormalizedBurstValue(cfg.burst);
    var iot = getIotRateCardEntry(cap, burst || '20', cfg.usableEffective || 'effective');
    if (!iot) return null;
    var multiplier = (planId === 'unified-extreme') ? 1.15 : (planId === 'standard') ? 0.85 : 1;
    var monthly = Math.round(iot.monthly * multiplier * 100) / 100;
    var perTiBPerMonth = Math.round(iot.perTiBPerMonth * multiplier * 100) / 100;
    var yearlyNet = Math.round(iot.yearlyNet * multiplier * 100) / 100;
    var averagePerTiBYear = Math.round(iot.averagePerTiBYear * multiplier * 100) / 100;
    return {
      monthly: monthly,
      perTiBPerMonth: perTiBPerMonth,
      yearlyNet: yearlyNet,
      termTotal: Math.round(yearlyNet * contractYears * 100) / 100,
      averagePerTiBYear: averagePerTiBYear,
      averagePerTiBTerm: Math.round(averagePerTiBYear * contractYears * 100) / 100
    };
  }

  function updateItemization() {
    var empty = getById('quote-itemization');
    var list = getById('quote-items-list');
    if (!empty || !list) return;
    if (quoteItems.length === 0) {
      setHwApproved(false);
      var hwInfoClear = getById('hw-config-summary');
      if (hwInfoClear) {
        hwInfoClear.innerHTML = '';
        syncHwConfigSummaryVisibility();
      }
      try {
        saveHwConfigContext();
      } catch (eHwCtx) {}
      empty.removeAttribute('hidden');
      list.setAttribute('hidden', '');
      list.innerHTML = '';
      var downloadBtn = getById('btn-download');
      var sendBtn = getById('btn-send-quote');
      var reviewHardwareBtn = getById('btn-review-hardware');
      if (downloadBtn) downloadBtn.disabled = true;
      if (sendBtn) sendBtn.disabled = true;
      if (reviewHardwareBtn) {
        reviewHardwareBtn.disabled = true;
        reviewHardwareBtn.textContent = getReviewHardwareButtonLabel();
        reviewHardwareBtn.setAttribute(
          'aria-label',
          sidebarHardwareMode
            ? 'Approve HW configurations and return to quote'
            : 'Review and update HW configuration'
        );
      }
      updateApprovalUiState();
    } else {
      empty.setAttribute('hidden', '');
      list.removeAttribute('hidden');
      list.innerHTML = quoteItems.map(function (item, idx) {
        var label = item.workloadLabel || item.name;
        var planName = item.planName || '';
        var spec = item.spec || '—';
        var itemPlanMeta = getPlanByName(planName);
        var hardwareText = item.hardwareSeries || (itemPlanMeta && itemPlanMeta.hardwareSeries && itemPlanMeta.hardwareSeries.length ? itemPlanMeta.hardwareSeries.join(', ') : 'As per selected performance level');
        var id = 'item-' + idx;
        return '<div class="quote-itemization-item" data-item-index="' + idx + '">' +
          '<button type="button" class="quote-itemization-header" aria-expanded="false" aria-controls="' + id + '-body" id="' + id + '-btn">' +
            '<span class="quote-itemization-header-inner">' +
              '<span class="quote-itemization-name">' + escapeHtml(label) + '</span>' +
              '<span class="quote-itemization-badge">' + escapeHtml(planName) + '</span>' +
            '</span>' +
            (window.CUSTOMER_VIEW ? '' : '<span class="quote-itemization-price">' + formatCurrency(item.cost) + ' <span class="quote-itemization-price-unit">/ year</span></span>') +
            '<button type="button" class="quote-itemization-delete" data-item-index="' + idx + '" aria-label="Remove ' + escapeHtml(label) + '" title="Remove from quote">✕</button>' +
            '<span class="quote-itemization-chevron" aria-hidden="true">▼</span>' +
          '</button>' +
          '<div class="quote-itemization-spec">' + escapeHtml(spec) + '</div>' +
          '<div class="quote-itemization-body" id="' + id + '-body" hidden>' +
            '<p class="quote-itemization-detail-line">Capacity and performance — ' + escapeHtml(spec) + '</p>' +
            '<p class="quote-itemization-detail-label">Hardware series provided:</p>' +
            '<p class="quote-itemization-detail-line">' + escapeHtml(hardwareText) + '</p>' +
            (window.CUSTOMER_VIEW ? '' : '<a href="#" class="quote-itemization-add-discount">+ Add discount</a>') +
          '</div>' +
        '</div>';
      }).join('');
      list.querySelectorAll('.quote-itemization-header').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var item = btn.closest('.quote-itemization-item');
          var body = item && item.querySelector('.quote-itemization-body');
          var expanded = body && !body.hidden;
          if (body) body.hidden = !expanded;
          btn.setAttribute('aria-expanded', !expanded);
          var chevron = btn.querySelector('.quote-itemization-chevron');
          if (chevron) chevron.textContent = expanded ? '▼' : '▲';
        });
      });
      list.querySelectorAll('.quote-itemization-delete').forEach(function (delBtn) {
        delBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var idx = parseInt(delBtn.dataset.itemIndex, 10);
          if (isNaN(idx)) return;
          removeQuoteItemByIndex(idx);
        });
      });
      list.querySelectorAll('.quote-itemization-add-discount').forEach(function (a) {
        a.addEventListener('click', function (e) { e.preventDefault(); });
      });
      var downloadBtn = getById('btn-download');
      var sendBtn = getById('btn-send-quote');
      var reviewHardwareBtn = getById('btn-review-hardware');
      if (reviewHardwareBtn) reviewHardwareBtn.disabled = false;
      updateApprovalUiState();
    }
    updateSidebarTotals();
    updateSidebarFromSelections();
  }

  function getTotalSelectedWorkloadCount() {
    var specificCount = document.querySelectorAll('#workload-specific .quote-workload-tile.selected').length;
    var generalCount = document.querySelectorAll('.quote-workload-tiles-general .quote-workload-tile.selected').length;
    return specificCount + generalCount;
  }

  /* ── Workload mode radio cards (General / Application workloads / TCO) ── */
  var activeAccordionSection = null;

  function initWorkloadAccordion() {
    var card = document.querySelector('.add-workloads-card');
    if (!card) return;
    var tabs = card.querySelectorAll('.wl-type-cards .contract-terms-card');
    if (!tabs.length) return;
    tabs.forEach(function (label) {
      var input = label.querySelector('.contract-terms-input');
      if (input) {
        input.addEventListener('change', function () {
          var mode = label.getAttribute('data-wl-tab');
          if (mode) showWorkloadMode(mode);
        });
      }
    });
    showWorkloadMode('general');
  }

  function showWorkloadMode(mode) {
    var card = document.querySelector('.add-workloads-card');
    if (!card) return;

    card.querySelectorAll('.wl-type-cards .contract-terms-card').forEach(function (label) {
      var isActive = label.getAttribute('data-wl-tab') === mode;
      label.classList.toggle('selected', isActive);
      label.setAttribute('aria-checked', isActive ? 'true' : 'false');
      var inp = label.querySelector('.contract-terms-input');
      if (inp) inp.checked = isActive;
    });

    card.querySelectorAll('.wl-tab-panel').forEach(function (panel) {
      if (panel.getAttribute('data-wl-panel') === mode) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });

    var prev = activeAccordionSection;
    activeAccordionSection = mode;

    if (prev !== mode && (mode === 'general' || mode === 'detailed')) {
      clearOppositeWorkloadGroup(mode);
    }
  }

  function clearOppositeWorkloadGroup(activeGroup) {
    var specific = document.getElementById('workload-specific');
    var generalContainer = document.querySelector('.wl-tab-panel .quote-workload-tiles-general');
    if (activeGroup === 'general' && specific) {
      specific.querySelectorAll('.quote-workload-tile.selected').forEach(function (t) { t.classList.remove('selected'); });
    } else if (activeGroup === 'detailed' && generalContainer) {
      generalContainer.querySelectorAll('.quote-workload-tile.selected').forEach(function (t) { t.classList.remove('selected'); });
    }
    updateWorkloadCount();
    renderWorkloadConfigCards();
    updateSidebarFromSelections();
  }

  function setAccordionSectionBySelection() {
    var specific = document.getElementById('workload-specific');
    var generalContainer = document.querySelector('.wl-tab-panel .quote-workload-tiles-general');
    var hasDetailed = specific && specific.querySelectorAll('.quote-workload-tile.selected').length > 0;
    var hasGeneral = generalContainer && generalContainer.querySelectorAll('.quote-workload-tile.selected').length > 0;
    if (hasDetailed) showWorkloadMode('detailed');
    else if (hasGeneral) showWorkloadMode('general');
  }

  function bindWorkloadTiles() {
    var specific = document.getElementById('workload-specific');
    var generalContainer = document.querySelector('.quote-workload-tiles-general');
    var wrap = document.getElementById('workload-tiles-wrap');
    var expandBtn = document.getElementById('workload-expand-btn');
    var moreCountEl = document.getElementById('workload-more-count');
    if (!specific) return;
    if (moreCountEl && specific) {
      var moreCount = specific.querySelectorAll('.workload-tile-more').length;
      moreCountEl.textContent = moreCount;
    }
    if (expandBtn && wrap) {
      if (!expandBtn.dataset.bound) {
        expandBtn.dataset.bound = '1';
        var moreCountForBtn = specific.querySelectorAll('.workload-tile-more').length;
        expandBtn.addEventListener('click', function () {
          var expanded = wrap.classList.toggle('workload-tiles-expanded');
          expandBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
          if (expanded) {
            expandBtn.textContent = 'Show less';
          } else {
            expandBtn.textContent = 'Show more (' + moreCountForBtn + ')';
          }
          if (moreCountEl) moreCountEl.textContent = moreCountForBtn;
        });
      }
    }
    /** Drops a tile's selection along with its config card and any quote item it produced. */
    function clearWorkloadTile(tile) {
      var wid = tile.dataset.workload;
      var labelEl = tile.querySelector('.quote-workload-tile-label');
      var wLabel = labelEl ? labelEl.textContent.trim() : '';
      if (wLabel) {
        for (var qi = quoteItems.length - 1; qi >= 0; qi--) {
          if (quoteItems[qi].workloadLabel === wLabel) quoteItems.splice(qi, 1);
        }
      }
      tile.classList.remove('selected');
      delete workloadConfigs[wid];
      delete collapsedWorkloadIds[wid];
    }

    function handleWorkloadTileClick(e) {
      var tile = e.target.closest('.quote-workload-tile');
      if (!tile || !tile.dataset.workload) return;
      if (tile.classList.contains('selected')) {
        clearWorkloadTile(tile);
      } else {
        /* Workloads and General are mutually exclusive, and General takes one tier at a time. */
        var isGeneral = !!tile.closest('.quote-workload-tiles-general');
        var clearSelector = isGeneral
          ? '#workload-specific .quote-workload-tile.selected, .quote-workload-tiles-general .quote-workload-tile.selected'
          : '.quote-workload-tiles-general .quote-workload-tile.selected';
        document.querySelectorAll(clearSelector).forEach(clearWorkloadTile);
        if (getTotalSelectedWorkloadCount() < MAX_SPECIFIC_WORKLOADS) tile.classList.add('selected');
      }
      updateWorkloadCount();
      renderWorkloadConfigCards();
      updateItemization();
      updateSidebarFromSelections();
    }
    specific.addEventListener('click', handleWorkloadTileClick);
    if (generalContainer) generalContainer.addEventListener('click', handleWorkloadTileClick);

    var appToggle = document.getElementById('wl-app-toggle');
    if (appToggle && wrap && !window.CUSTOMER_VIEW) {
      appToggle.addEventListener('click', function () {
        var expanded = appToggle.getAttribute('aria-expanded') === 'true';
        appToggle.setAttribute('aria-expanded', String(!expanded));
        wrap.classList.toggle('wl-app-collapsed', expanded);
      });
    }

    updateWorkloadCount();
    renderWorkloadConfigCards();

    initWorkloadAccordion();
    setAccordionSectionBySelection();
  }

  function openCustomBurstModal(planId) {
    var modal = getById('custom-burst-modal');
    var listEl = getById('custom-burst-quote-list');
    var applyToSection = modal && modal.querySelector('.modal-apply-to');
    if (!modal || !listEl) return;
    customBurstModalForPlanId = planId || null;
    if (applyToSection) applyToSection.style.display = '';
    if (planId && String(planId).indexOf('workload:') === 0) {
      var wid = String(planId).replace('workload:', '');
      var wCfg = ensureWorkloadConfig(wid);
      getById('custom-burst-value').value = wCfg.burst && wCfg.burst !== 'custom' ? wCfg.burst : '';
      getById('custom-burst-justification').value = burstByPlan[planId] ? (burstByPlan[planId].justification || '') : '';
    } else if (planId) {
      var planData = burstByPlan[planId];
      if (planData) {
        getById('custom-burst-value').value = planData.value != null ? planData.value : '';
        getById('custom-burst-justification').value = planData.justification || '';
      } else {
        getById('custom-burst-value').value = '';
        getById('custom-burst-justification').value = '';
      }
    } else {
      var effective = burstByQuote[currentQuoteId];
      if (effective) {
        getById('custom-burst-value').value = effective.value != null ? effective.value : '';
        getById('custom-burst-justification').value = effective.justification || '';
      } else {
        getById('custom-burst-value').value = '';
        getById('custom-burst-justification').value = '';
      }
    }
    listEl.innerHTML = '';
    getActiveQuotesForCurrentOpportunity().forEach(function (q) {
      var isCurrent = q.id === currentQuoteId;
      var label = document.createElement('label');
      if (isCurrent) label.className = 'disabled';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.name = 'apply_burst_to_quote';
      cb.value = q.id;
      cb.checked = true;
      if (isCurrent) cb.disabled = true;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(q.label + (isCurrent ? ' (current)' : '')));
      listEl.appendChild(label);
    });
    modal.removeAttribute('hidden');
    getById('custom-burst-value').focus();
  }

  function closeCustomBurstModal() {
    if (customBurstModalForPlanId) {
      renderAdditionalConfigByPlan();
      customBurstModalForPlanId = null;
    }
    var modal = getById('custom-burst-modal');
    var applyToSection = modal && modal.querySelector('.modal-apply-to');
    if (applyToSection) applyToSection.style.display = '';
    if (modal) modal.setAttribute('hidden', '');
  }

  function openCustomBillingModal() {
    var modal = getById('custom-billing-modal');
    var listEl = getById('custom-billing-quote-list');
    if (!modal || !listEl) return;
    var effective = customBillingByQuote[currentQuoteId] || customBilling;
    if (effective) {
      getById('custom-billing-interval').value = effective.interval || '';
      getById('custom-billing-unit').value = effective.unit || 'months';
      getById('custom-billing-justification').value = effective.justification || '';
    } else {
      getById('custom-billing-interval').value = '';
      getById('custom-billing-unit').value = 'months';
      getById('custom-billing-justification').value = '';
    }
    listEl.innerHTML = '';
    getActiveQuotesForCurrentOpportunity().forEach(function (q) {
      var isCurrent = q.id === currentQuoteId;
      var label = document.createElement('label');
      if (isCurrent) label.className = 'disabled';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.name = 'apply_billing_to_quote';
      cb.value = q.id;
      cb.checked = true;
      if (isCurrent) cb.disabled = true;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(q.label + (isCurrent ? ' (current)' : '')));
      listEl.appendChild(label);
    });
    modal.removeAttribute('hidden');
    getById('custom-billing-interval').focus();
  }

  function closeCustomBillingModal() {
    var modal = getById('custom-billing-modal');
    if (modal) modal.setAttribute('hidden', '');
  }

  var LEGAL_DEVIATION_VALUES = ['custom-sla', 'legal-compliance', 'support-level'];
  var pendingLegalDeviation = null;

  function openAddDeviationModal(legalOption) {
    var modal = getById('add-deviation-modal');
    if (!modal) return;
    var titleEl = getById('add-deviation-modal-title');
    var descEl = modal.querySelector('.modal-desc');
    var oppEl = getById('add-deviation-opportunity');
    var quoteEl = getById('add-deviation-quote');
    var selectEl = getById('add-deviation-select');
    var customWrap = getById('add-deviation-custom-wrap');
    var legalWrap = getById('add-deviation-legal-wrap');
    var legalTextEl = getById('add-deviation-legal-text');
    if (quoteEl) quoteEl.value = currentQuoteId || '123';
    if (oppEl) oppEl.value = currentOpportunityId || 'OPP-001';
    getById('add-deviation-comment').value = '';
    if (legalOption) {
      pendingLegalDeviation = { value: legalOption.value, label: legalOption.label };
      if (titleEl) titleEl.textContent = 'Add: ' + legalOption.label;
      if (descEl) descEl.textContent = 'Enter the legal language or text that will appear inside the quote.';
      if (oppEl && oppEl.closest('.modal-field')) oppEl.closest('.modal-field').hidden = true;
      if (quoteEl && quoteEl.closest('.modal-field')) quoteEl.closest('.modal-field').hidden = true;
      if (selectEl && selectEl.closest('.modal-field')) selectEl.closest('.modal-field').hidden = true;
      if (customWrap) customWrap.hidden = true;
      if (legalWrap) { legalWrap.hidden = false; if (legalTextEl) legalTextEl.value = ''; }
      modal.removeAttribute('hidden');
      if (legalTextEl) { legalTextEl.focus(); }
    } else {
      pendingLegalDeviation = null;
      if (titleEl) titleEl.textContent = 'Add feature request';
      if (descEl) descEl.textContent = 'Enter the details for your feature request. It will appear in the feature requests section below.';
      if (oppEl && oppEl.closest('.modal-field')) oppEl.closest('.modal-field').hidden = false;
      if (quoteEl && quoteEl.closest('.modal-field')) quoteEl.closest('.modal-field').hidden = false;
      if (selectEl && selectEl.closest('.modal-field')) selectEl.closest('.modal-field').hidden = false;
      getById('add-deviation-select').value = '';
      getById('add-deviation-description').value = '';
      if (customWrap) customWrap.hidden = true;
      if (legalWrap) legalWrap.hidden = true;
      modal.removeAttribute('hidden');
      if (selectEl) selectEl.focus();
    }
  }

  function closeAddDeviationModal() {
    pendingLegalDeviation = null;
    var modal = getById('add-deviation-modal');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('hidden', '');
    }
  }

  function openTieringCapacityModal() {
    var modal = getById('tiering-capacity-modal');
    var input = getById('tiering-capacity-input');
    var preview = getById('tiering-capacity-rate-preview');
    if (!modal || !input) return;
    // Pre-fill with total committed TiB or last value
    var suggestedTiB = dataTieringTiB > 0 ? dataTieringTiB : getTotalCommittedTiB();
    input.value = suggestedTiB > 0 ? Math.round(suggestedTiB) : '';
    updateTieringRatePreview();
    modal.removeAttribute('hidden');
    input.focus();
  }

  function updateTieringRatePreview() {
    var input = getById('tiering-capacity-input');
    var preview = getById('tiering-capacity-rate-preview');
    if (!input || !preview) return;
    var tib = parseFloat(input.value);
    if (!tib || tib <= 0) { preview.textContent = ''; return; }
    var rate = getDtRatePerTiBMonth(tib);
    var annual = Math.round(tib * rate * 12);
    preview.textContent = '$' + rate.toFixed(2) + ' / TiB / month  →  $' + annual.toLocaleString() + ' / year for ' + Math.round(tib) + ' TiB';
  }

  function bindTieringCapacityModal() {
    var modal = getById('tiering-capacity-modal');
    var form = getById('tiering-capacity-form');
    var input = getById('tiering-capacity-input');
    var cancelBtn = getById('tiering-capacity-cancel');
    if (!modal || !form || !input) return;

    input.addEventListener('input', updateTieringRatePreview);

    cancelBtn && cancelBtn.addEventListener('click', function () {
      modal.setAttribute('hidden', '');
      // Ensure checkbox stays unchecked if user cancels
      var cb = document.querySelector('input[name="addon_subscription"][value="tiering"]');
      if (cb) cb.checked = (dataTieringTiB > 0);
    });

    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        modal.setAttribute('hidden', '');
        var cb = document.querySelector('input[name="addon_subscription"][value="tiering"]');
        if (cb) cb.checked = (dataTieringTiB > 0);
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var tib = parseFloat(input.value);
      if (!tib || tib < 1) {
        input.setCustomValidity('Please enter a valid TiB amount (≥ 1).');
        input.reportValidity();
        return;
      }
      input.setCustomValidity('');
      dataTieringTiB = Math.round(tib);
      // Check the tiering checkbox
      var cb = document.querySelector('input[name="addon_subscription"][value="tiering"]');
      if (cb) cb.checked = true;
      modal.setAttribute('hidden', '');
      updateSidebarFromSelections();
    });
  }

  function bindAddDeviationModal() {
    var modal = getById('add-deviation-modal');
    var form = getById('add-deviation-form');
    var cancelBtn = getById('add-deviation-cancel');
    var selectEl = getById('add-deviation-select');
    var customWrap = getById('add-deviation-custom-wrap');
    var descEl = getById('add-deviation-description');
    if (!modal || !form) return;

    if (selectEl && customWrap) {
      selectEl.addEventListener('change', function () {
        customWrap.hidden = selectEl.value !== 'custom';
      });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (pendingLegalDeviation) {
        var legalTextEl = getById('add-deviation-legal-text');
        var legalText = legalTextEl ? legalTextEl.value.trim() : '';
        if (!legalText) return;
        requestedDeviations.push({ label: pendingLegalDeviation.label, value: legalText });
        pendingLegalDeviation = null;
        closeAddDeviationModal();
        updateSidebarFromSelections();
        return;
      }
      var value = selectEl ? selectEl.value : '';
      var label = selectEl && selectEl.selectedOptions[0] ? selectEl.selectedOptions[0].text : '';
      if (!value) return;
      if (value === 'custom') {
        var desc = (descEl && descEl.value) ? descEl.value.trim() : '';
        if (!desc) return;
        requestedDeviations.push({ label: 'Deal feature request', value: desc });
      } else {
        requestedDeviations.push({ label: label, value: value });
      }
      closeAddDeviationModal();
      updateSidebarFromSelections();
    });
    if (cancelBtn) cancelBtn.addEventListener('click', closeAddDeviationModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeAddDeviationModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && !modal.hasAttribute('hidden')) closeAddDeviationModal();
    });
  }

  function bindCustomBillingModal() {
    var modal = getById('custom-billing-modal');
    var form = getById('custom-billing-form');
    var cancelBtn = getById('custom-billing-cancel');
    if (!modal || !form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var interval = getById('custom-billing-interval').value.trim();
      var unit = getById('custom-billing-unit').value;
      var justification = getById('custom-billing-justification').value.trim();
      if (!interval || isNaN(parseInt(interval, 10))) return;
      var payload = { interval: interval, unit: unit, justification: justification };
      var checked = document.querySelectorAll('#custom-billing-modal .modal-quote-checkboxes input[name="apply_billing_to_quote"]:checked');
      checked.forEach(function (cb) {
        customBillingByQuote[cb.value] = payload;
      });
      customBilling = customBillingByQuote[currentQuoteId] || null;
      if (customBillingByQuote[currentQuoteId]) {
        var customInput = document.querySelector('.contract-terms-input[name="billing-frequency"][value="custom"]');
        if (customInput) {
          customInput.checked = true;
          updateBillingCardStates();
        }
      }
      closeCustomBillingModal();
      updateSidebarFromSelections();
      updateSidebarTotals();
    });
    if (cancelBtn) cancelBtn.addEventListener('click', closeCustomBillingModal);
    var selectAllBtn = getById('custom-billing-select-all');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', function () {
        var checkboxes = modal.querySelectorAll('.modal-quote-checkboxes input[name="apply_billing_to_quote"]:not(:disabled)');
        var allChecked = Array.prototype.every.call(checkboxes, function (c) { return c.checked; });
        checkboxes.forEach(function (c) { c.checked = !allChecked; });
        selectAllBtn.textContent = allChecked ? 'Select all' : 'Clear all';
      });
    }
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeCustomBillingModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && !modal.hasAttribute('hidden')) closeCustomBillingModal();
    });
  }

  function bindBurstCustom() {
    var sel = getById('burst-select');
    var wrap = getById('burst-custom-wrap');
    if (!sel || !wrap) return;
    sel.addEventListener('change', function () {
      if (sel.value === 'custom') {
        sel.value = previousBurstValue || '';
        openCustomBurstModal();
        wrap.classList.add('config-hidden');
      } else {
        previousBurstValue = sel.value;
        wrap.classList.add('config-hidden');
        updateSidebarFromSelections();
      }
    });
  }

  function bindDiscountRate() {
    var input = getById('sidebar-discount-rate');
    if (!input) return;
    function clamp() {
      var v = parseInt(input.value, 10);
      if (isNaN(v)) v = 0;
      input.value = Math.max(0, Math.min(100, v));
    }
    input.addEventListener('input', clamp);
    input.addEventListener('blur', clamp);
  }

  function bindTabs() {
    document.querySelectorAll('.quote-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.quote-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
      });
    });
  }

  function updateContractLengthCardStates() {
    var name = 'contract-length';
    document.querySelectorAll('.contract-terms-panel .contract-terms-card').forEach(function (c) {
      var i = c.querySelector('.contract-terms-input[name="' + name + '"]');
      if (i) {
        c.classList.toggle('selected', i.checked);
        c.setAttribute('aria-checked', i.checked ? 'true' : 'false');
      }
    });
  }

  function updateBillingCardStates() {
    var name = 'billing-frequency';
    document.querySelectorAll('.contract-terms-panel .contract-terms-card').forEach(function (c) {
      var i = c.querySelector('.contract-terms-input[name="' + name + '"]');
      if (i) {
        c.classList.toggle('selected', i.checked);
        c.setAttribute('aria-checked', i.checked ? 'true' : 'false');
      }
    });
  }

  function openCustomContractModal() {
    var modal = getById('custom-contract-length-modal');
    var listEl = getById('custom-contract-quote-list');
    if (!modal || !listEl) return;
    var effective = customContractLength || customContractByQuote[currentQuoteId];
    if (effective) {
      getById('custom-contract-length-value').value = effective.value || '';
      getById('custom-contract-length-unit').value = effective.unit || 'years';
      getById('custom-contract-justification').value = effective.justification || '';
    } else {
      getById('custom-contract-length-value').value = '';
      getById('custom-contract-length-unit').value = 'years';
      getById('custom-contract-justification').value = '';
    }
    listEl.innerHTML = '';
    getActiveQuotesForCurrentOpportunity().forEach(function (q) {
      var isCurrent = q.id === currentQuoteId;
      var label = document.createElement('label');
      if (isCurrent) label.className = 'disabled';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.name = 'apply_to_quote';
      cb.value = q.id;
      cb.checked = true;
      if (isCurrent) cb.disabled = true;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(q.label + (isCurrent ? ' (current)' : '')));
      listEl.appendChild(label);
    });
    modal.removeAttribute('hidden');
    getById('custom-contract-length-value').focus();
  }

  function closeCustomContractModal() {
    var modal = getById('custom-contract-length-modal');
    if (modal) modal.setAttribute('hidden', '');
  }

  function bindContractTermsCards() {
    document.querySelectorAll('.contract-terms-panel .contract-terms-card').forEach(function (card) {
      var input = card.querySelector('.contract-terms-input');
      if (!input) return;
      input.addEventListener('change', function () {
        var name = input.getAttribute('name');
        if (name === 'contract-length') {
          if (input.value === 'custom') {
            input.checked = false;
            var prevInput = document.querySelector('.contract-terms-input[name="contract-length"][value="' + previousContractLengthValue + '"]');
            if (prevInput) prevInput.checked = true;
            updateContractLengthCardStates();
            openCustomContractModal();
            return;
          }
          previousContractLengthValue = input.value;
        }
        if (name === 'billing-frequency') {
          if (input.value === 'custom') {
            input.checked = false;
            var prevBilling = document.querySelector('.contract-terms-input[name="billing-frequency"][value="' + previousBillingFrequencyValue + '"]');
            if (prevBilling) prevBilling.checked = true;
            updateBillingCardStates();
            openCustomBillingModal();
            return;
          }
          previousBillingFrequencyValue = input.value;
        }
        document.querySelectorAll('.contract-terms-panel .contract-terms-card').forEach(function (c) {
          var i = c.querySelector('.contract-terms-input[name="' + name + '"]');
          if (i) {
            c.classList.toggle('selected', i.checked);
            c.setAttribute('aria-checked', i.checked ? 'true' : 'false');
          }
        });
        updateSidebarFromSelections();
        updateSidebarTotals();
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          input.checked = true;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
  }

  function bindCustomContractModal() {
    var modal = getById('custom-contract-length-modal');
    var form = document.getElementById('custom-contract-length-form');
    var cancelBtn = getById('custom-contract-cancel');
    if (!modal || !form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var value = getById('custom-contract-length-value').value.trim();
      var unit = getById('custom-contract-length-unit').value;
      var justification = getById('custom-contract-justification').value.trim();
      if (!value || isNaN(parseInt(value, 10))) return;
      var num = parseInt(value, 10);
      var display = num + ' ' + (unit === 'years' ? (num === 1 ? 'Year' : 'Years') : (num === 1 ? 'Month' : 'Months'));
      var payload = { value: num, unit: unit, display: display, justification: justification };
      var checked = document.querySelectorAll('.modal-quote-checkboxes input[name="apply_to_quote"]:checked');
      var appliedIds = [];
      checked.forEach(function (cb) {
        customContractByQuote[cb.value] = payload;
        appliedIds.push(cb.value);
      });
      if (appliedIds.indexOf(currentQuoteId) !== -1) {
        customContractLength = payload;
        var customInput = document.querySelector('.contract-terms-input[name="contract-length"][value="custom"]');
        if (customInput) {
          customInput.checked = true;
          updateContractLengthCardStates();
        }
        updateAutoRenewTermYearsMessage();
      }
      closeCustomContractModal();
      updateSidebarFromSelections();
    });
    if (cancelBtn) cancelBtn.addEventListener('click', closeCustomContractModal);
    var selectAllBtn = getById('custom-contract-select-all');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', function () {
var checkboxes = modal.querySelectorAll('.modal-quote-checkboxes input[name="apply_to_quote"]:not(:disabled)');
    var allChecked = Array.prototype.every.call(checkboxes, function (c) { return c.checked; });
    checkboxes.forEach(function (c) { c.checked = !allChecked; });
        selectAllBtn.textContent = allChecked ? 'Select all' : 'Clear all';
      });
    }
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeCustomContractModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hasAttribute('hidden')) closeCustomContractModal();
    });
  }

  function bindCustomBurstModal() {
    var modal = getById('custom-burst-modal');
    var form = document.getElementById('custom-burst-form');
    var cancelBtn = getById('custom-burst-cancel');
    if (!modal || !form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var valueStr = getById('custom-burst-value').value.trim();
      var justification = getById('custom-burst-justification').value.trim();
      var num = parseInt(valueStr, 10);
      if (valueStr === '' || isNaN(num) || num < 0 || num > 100) return;
      var display = num + '%';
      var payload = { value: num, display: display, justification: justification };
      if (customBurstModalForPlanId) {
        var planId = customBurstModalForPlanId;
        if (String(planId).indexOf('workload:') === 0) {
          var wid = String(planId).replace('workload:', '');
          ensureWorkloadConfig(wid);
          workloadConfigs[wid].burst = String(num);
          burstByPlan[planId] = payload;
          customBurstModalForPlanId = null;
          closeCustomBurstModal();
          renderWorkloadConfigCards();
          updateSidebarFromSelections();
          return;
        }
        var cfg = ensurePlanConfig(planId);
        cfg.burst = String(num);
        burstByPlan[planId] = payload;
        customBurstModalForPlanId = null;
        var checked = document.querySelectorAll('#custom-burst-modal .modal-quote-checkboxes input[name="apply_burst_to_quote"]:checked');
        checked.forEach(function (cb) {
          burstByQuote[cb.value] = payload;
        });
        renderAdditionalConfigByPlan();
        closeCustomBurstModal();
        updateSidebarFromSelections();
        return;
      }
      var checked = document.querySelectorAll('#custom-burst-modal .modal-quote-checkboxes input[name="apply_burst_to_quote"]:checked');
      checked.forEach(function (cb) {
        burstByQuote[cb.value] = payload;
      });
      if (burstByQuote[currentQuoteId]) {
        var sel = getById('burst-select');
        var wrap = getById('burst-custom-wrap');
        var input = getById('burst-custom-input');
        if (sel) { sel.value = 'custom'; previousBurstValue = 'custom'; }
        if (wrap) wrap.classList.remove('config-hidden');
        if (input) input.value = num;
      }
      closeCustomBurstModal();
      updateSidebarFromSelections();
    });
    if (cancelBtn) cancelBtn.addEventListener('click', closeCustomBurstModal);
    var selectAllBtn = getById('custom-burst-select-all');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', function () {
        var checkboxes = modal.querySelectorAll('.modal-quote-checkboxes input[name="apply_burst_to_quote"]:not(:disabled)');
        var allChecked = Array.prototype.every.call(checkboxes, function (c) { return c.checked; });
        checkboxes.forEach(function (c) { c.checked = !allChecked; });
        selectAllBtn.textContent = allChecked ? 'Select all' : 'Clear all';
      });
    }
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeCustomBurstModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && !modal.hasAttribute('hidden')) closeCustomBurstModal();
    });
  }

  function getContractYearsForAutoRenew() {
    var contractEl = document.querySelector('input[name="contract-length"]:checked');
    if (!contractEl) return 1;
    if (contractEl.value === 'custom') {
      var effective = customContractLength || customContractByQuote[currentQuoteId];
      if (effective && effective.value && effective.unit) {
        var n = parseInt(effective.value, 10);
        if (effective.unit === 'years') return Math.max(1, n);
        return Math.max(1, Math.ceil(n / 12));
      }
      return 1;
    }
    var labelEl = contractEl.closest('.contract-terms-card') && contractEl.closest('.contract-terms-card').querySelector('.contract-terms-card-label');
    var str = labelEl ? labelEl.textContent : '';
    return parseContractYears(str);
  }

  function updateAutoRenewTermYearsMessage() {
    var msgEl = getById('auto-renewal-term-years-msg');
    var durationSelect = document.querySelector('select[name="auto-renewal-duration"]');
    if (!msgEl || !durationSelect) return;
    if (durationSelect.value !== 'contract') {
      msgEl.hidden = true;
      msgEl.textContent = '';
      return;
    }
    var years = getContractYearsForAutoRenew();
    msgEl.textContent = years === 1 ? '— 1 year' : '— ' + years + ' years';
    msgEl.hidden = false;
  }

  function updateAutoRenewDurationVisibility() {
    var wrap = getById('auto-renewal-duration-wrap');
    if (!wrap) return;
    var yesChecked = document.querySelector('input[name="auto-renewal"][value="yes"]:checked');
    wrap.hidden = !yesChecked;
    var durationSelect = document.querySelector('select[name="auto-renewal-duration"]');
    var termYearsMsg = getById('auto-renewal-term-years-msg');
    var customWrap = getById('auto-renewal-custom-wrap');
    if (durationSelect && termYearsMsg && customWrap) {
      var v = durationSelect.value;
      termYearsMsg.hidden = (v !== 'contract');
      customWrap.hidden = (v !== 'custom');
      if (v === 'contract') updateAutoRenewTermYearsMessage();
    }
  }

  var CAPEX_DEFAULTS = {
    taxRate: 0.10,
    installation: 25000,
    setup: 5000,
    maintenance: 75000,
    datacenter: 40000,
    successManager: 15000
  };

  function computeCapexHardwareLicense() {
    var selected = getSelectedWorkloads();
    if (!selected.length) return null;
    var cfg = null;
    for (var i = 0; i < selected.length; i++) {
      var c = workloadConfigs[selected[i].id];
      if (c && c.capacity) { cfg = c; break; }
    }
    if (!cfg) return null;

    var reqCap = cfg.requestedCapacity ? parseFloat(cfg.requestedCapacity) : NaN;
    var hasRequestedCapacity = !isNaN(reqCap) && reqCap > 0;

    var usedCap = parseFloat(cfg.capacity);
    if (isNaN(usedCap) || usedCap <= 0) return null;

    var se = parseFloat(cfg.storageEfficiencyRatio);
    if (isNaN(se) || se <= 0) se = 1;
    var growthRate = parseFloat(cfg.annualGrowthRate);
    if (isNaN(growthRate)) growthRate = 0;

    var termYears = getCurrentContractYears() || 3;
    var capexCapTiB;
    if (hasRequestedCapacity) {
      capexCapTiB = sizingOutputRoundUpToStep(reqCap, 1);
    } else {
      var startUsable = usedCap / Math.max(1, se);
      var usableInputs = { startingCapacity: startUsable, growthRate: growthRate / 100, termYears: termYears };
      capexCapTiB = sizingOutputRoundUpToStep(sizingOutputGetCapacityAtMonth(usableInputs, termYears * 12), 1);
    }

    var burst = getNormalizedBurstValue(cfg.burst) || '20';
    var mode = cfg.usableEffective || 'effective';
    var iot = getIotRateCardEntry(capexCapTiB, burst, mode);
    if (!iot) return null;

    var planMeta = cfg.selectedPlan ? PLAN_OPTIONS.filter(function (p) { return p.name === cfg.selectedPlan; })[0] : null;
    var multiplier = planMeta ? ((planMeta.id === 'unified-extreme') ? 1.15 : (planMeta.id === 'standard') ? 0.85 : 1) : 1;
    var hwLicense = Math.round(iot.yearlyNet * multiplier * termYears);

    return {
      capexCapTiB: capexCapTiB,
      hwLicense: hwLicense,
      termYears: termYears,
      keystoneYearlyCost: cfg.selectedPlanCost || 0
    };
  }

  function renderCapexComparison() {
    var result = computeCapexHardwareLicense();

    var elCap = getById('capex-capacity');
    var elHw = getById('capex-hw-cost');
    var elYear0 = getById('capex-year0');
    var elAnnual = getById('capex-annual-ongoing');
    var elCapexNpv = getById('capex-npv');
    var elKeystoneNpv = getById('capex-keystone-npv');
    var elVerdict = getById('capex-verdict');

    if (!result) {
      if (elCap) elCap.textContent = '—';
      if (elHw) elHw.textContent = '—';
      if (elYear0) elYear0.textContent = '—';
      if (elAnnual) elAnnual.textContent = '—';
      if (elCapexNpv) elCapexNpv.textContent = '—';
      if (elKeystoneNpv) elKeystoneNpv.textContent = '—';
      if (elVerdict) elVerdict.textContent = '';
      return;
    }

    var d = CAPEX_DEFAULTS;
    var termYears = result.termYears;
    var hwLicense = result.hwLicense;

    var acq = hwLicense + d.installation + d.setup + d.successManager;
    var prePaidSupport = d.maintenance * termYears;
    var acqGross = acq + prePaidSupport;
    var acqWithTax = Math.round(acqGross * (1 + d.taxRate));
    var annualOngoing = d.datacenter;

    var capexNpv = acqWithTax;
    for (var y = 1; y <= termYears; y++) {
      capexNpv += annualOngoing / Math.pow(1 + WACC, y);
    }
    capexNpv = Math.round(capexNpv);

    var keystoneYearly = result.keystoneYearlyCost;
    var keystoneNpv = Math.round(calculateNPV(keystoneYearly, termYears));

    if (elCap) elCap.textContent = result.capexCapTiB + ' TiB';
    if (elHw) elHw.textContent = formatCurrency(hwLicense);
    if (elYear0) elYear0.textContent = formatCurrency(acqWithTax);
    if (elAnnual) elAnnual.textContent = formatCurrency(annualOngoing) + '/yr';
    if (elCapexNpv) elCapexNpv.textContent = formatCurrency(capexNpv);
    if (elKeystoneNpv) elKeystoneNpv.textContent = formatCurrency(keystoneNpv);

    if (elVerdict) {
      var diff = capexNpv - keystoneNpv;
      var pctSavings = capexNpv > 0 ? Math.round(Math.abs(diff) / capexNpv * 100) : 0;
      if (keystoneNpv < capexNpv) {
        elVerdict.className = 'capex-verdict capex-verdict--keystone-wins';
        elVerdict.innerHTML = '<strong>Keystone saves ' + formatCurrency(Math.abs(diff)) + '</strong> (' + pctSavings + '% lower NPV over ' + termYears + ' yrs)';
      } else if (capexNpv < keystoneNpv) {
        elVerdict.className = 'capex-verdict capex-verdict--capex-wins';
        elVerdict.innerHTML = '<strong>CAPEX saves ' + formatCurrency(Math.abs(diff)) + '</strong> (' + pctSavings + '% lower NPV over ' + termYears + ' yrs)';
      } else {
        elVerdict.className = 'capex-verdict';
        elVerdict.textContent = 'Both options have equal NPV';
      }
    }
  }

  function computeCapexVsKeystoneVerdict() {
    var result = computeCapexHardwareLicense();
    if (!result) return null;
    var d = CAPEX_DEFAULTS;
    var termYears = result.termYears;
    var hwLicense = result.hwLicense;
    var acq = hwLicense + d.installation + d.setup + d.successManager;
    var prePaidSupport = d.maintenance * termYears;
    var acqGross = acq + prePaidSupport;
    var acqWithTax = Math.round(acqGross * (1 + d.taxRate));
    var annualOngoing = d.datacenter;
    var capexNpv = acqWithTax;
    for (var y = 1; y <= termYears; y++) {
      capexNpv += annualOngoing / Math.pow(1 + WACC, y);
    }
    capexNpv = Math.round(capexNpv);
    var keystoneNpv = Math.round(calculateNPV(result.keystoneYearlyCost, termYears));
    var diff = capexNpv - keystoneNpv;
    var refMax = Math.max(capexNpv, keystoneNpv);
    var pct = refMax > 0 ? Math.round(Math.abs(diff) / refMax * 100) : 0;
    return { capexNpv: capexNpv, keystoneNpv: keystoneNpv, diff: diff, pct: pct, termYears: termYears };
  }

  function updateCapexVerdictBanners() {
    if (window.CUSTOMER_VIEW) return;
    var selected = getSelectedWorkloads();
    for (var i = 0; i < selected.length; i++) {
      var wid = selected[i].id;
      var cfg = workloadConfigs[wid];
      var banner = getById('capex-verdict-banner-' + wid);
      if (!banner) continue;
      if (!cfg || !cfg.selectedPlan) {
        banner.innerHTML = '';
        banner.className = 'config-capex-verdict-banner';
        continue;
      }
      var v = computeCapexVsKeystoneVerdict();
      if (!v) {
        banner.innerHTML = '';
        banner.className = 'config-capex-verdict-banner';
        continue;
      }
      if (v.keystoneNpv < v.capexNpv) {
        banner.className = 'config-capex-verdict-banner config-capex-verdict--keystone';
        banner.innerHTML = '<span class="config-capex-verdict-icon">✓</span>' +
          '<span class="config-capex-verdict-msg"><strong>Keystone saves ' + formatCurrency(Math.abs(v.diff)) + '</strong> — Keystone NPV ' + formatCurrency(v.keystoneNpv) + ' vs CAPEX NPV ' + formatCurrency(v.capexNpv) + ' (' + v.pct + '% lower over ' + v.termYears + ' yrs)</span>' +
          '<span class="config-capex-verdict-cta">See more details →</span>';
      } else if (v.capexNpv < v.keystoneNpv) {
        banner.className = 'config-capex-verdict-banner config-capex-verdict--capex';
        banner.innerHTML = '<span class="config-capex-verdict-icon">⚠</span>' +
          '<span class="config-capex-verdict-msg"><strong>CAPEX saves ' + formatCurrency(Math.abs(v.diff)) + '</strong> — CAPEX NPV ' + formatCurrency(v.capexNpv) + ' vs Keystone NPV ' + formatCurrency(v.keystoneNpv) + ' (' + v.pct + '% lower over ' + v.termYears + ' yrs)</span>' +
          '<span class="config-capex-verdict-cta">See more details →</span>';
      } else {
        banner.className = 'config-capex-verdict-banner config-capex-verdict--neutral';
        banner.innerHTML = '<span class="config-capex-verdict-msg">Both CAPEX and Keystone have equal NPV</span>' +
          '<span class="config-capex-verdict-cta">See more details →</span>';
      }
    }
  }

  function bindCapexCompareToggle() {
    if (window.CUSTOMER_VIEW) return;
    var toggle = getById('capex-compare-toggle');
    if (!toggle) return;
    var sidebarCard = getById('quote-sidebar-flip-card');
    var columns = document.querySelector('.quote-prototype-columns');
    if (!sidebarCard || !columns) return;

    toggle.addEventListener('change', function () {
      if (toggle.checked) {
        sidebarCard.classList.add('capex-compare-active');
        columns.classList.add('capex-columns-wide');
        renderCapexComparison();
      } else {
        sidebarCard.classList.remove('capex-compare-active');
        columns.classList.remove('capex-columns-wide');
      }
    });
  }

  function bindSidebarInputs() {
    document.querySelectorAll('input[name="auto-renewal"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        updateAutoRenewDurationVisibility();
        updateSidebarFromSelections();
      });
    });
    var autoDurationSelect = document.querySelector('select[name="auto-renewal-duration"]');
    if (autoDurationSelect) {
      autoDurationSelect.addEventListener('change', function () {
        updateAutoRenewDurationVisibility();
        updateSidebarFromSelections();
      });
    }
    var autoCustomValue = getById('auto-renewal-custom-value');
    var autoCustomUnit = getById('auto-renewal-custom-unit');
    if (autoCustomValue) autoCustomValue.addEventListener('input', updateSidebarFromSelections);
    if (autoCustomValue) autoCustomValue.addEventListener('change', updateSidebarFromSelections);
    if (autoCustomUnit) autoCustomUnit.addEventListener('change', updateSidebarFromSelections);
    document.querySelectorAll('input[name="contract-length"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        updateAutoRenewTermYearsMessage();
        updateSidebarFromSelections();
      });
    });
    updateAutoRenewDurationVisibility();
    var deploymentSelect = document.querySelector('select[name="deployment_location"]');
    if (deploymentSelect) {
      deploymentSelect.addEventListener('change', function () {
        syncSubscriptionTypeToDeployment();
        updateSidebarFromSelections();
      });
    }
    document.querySelectorAll('.quote-addon-group input[name="addon_subscription"]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        if (cb.value === 'tiering' && cb.checked) {
          // Intercept — open capacity modal instead of direct toggle
          cb.checked = false; // revert until user confirms
          openTieringCapacityModal();
          return;
        }
        if (cb.value === 'tiering' && !cb.checked) {
          dataTieringTiB = 0;
        }
        updateSidebarFromSelections();
      });
    });
    var discountInput = getById('sidebar-discount-rate');
    if (discountInput) {
      discountInput.addEventListener('input', updateSidebarFromSelections);
      discountInput.addEventListener('change', updateSidebarFromSelections);
    }
    var applyBtn = getById('sidebar-discount-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        var rateEl = getById('sidebar-discount-rate');
        var v = rateEl && !isNaN(parseFloat(rateEl.value)) ? parseFloat(rateEl.value) : 0;
        appliedDiscountPct = Math.min(100, Math.max(0, v));
        updateSidebarTotals();
        updateApprovalUiState();
      });
    }

    var deviationsSelect = getById('sidebar-deviations');
    if (deviationsSelect) {
      deviationsSelect.addEventListener('change', function () {
        var val = deviationsSelect.value;
        if (!val) {
          updateSidebarFromSelections();
          return;
        }
        var opt = deviationsSelect.options[deviationsSelect.selectedIndex];
        var label = opt ? opt.text : val;
        deviationsSelect.value = '';
        if (val === 'custom') {
          openAddDeviationModal();
          return;
        }
        if (LEGAL_DEVIATION_VALUES.indexOf(val) !== -1) {
          openAddDeviationModal({ value: val, label: label });
          return;
        }
        requestedDeviations.push({ label: label, value: val });
        updateSidebarFromSelections();
      });
    }
    var currencySelect = getById('sidebar-currency');
    if (currencySelect) currencySelect.addEventListener('change', updateSidebarFromSelections);
    var subscriptionTypeSelect = getById('subscription-type');
    if (subscriptionTypeSelect) {
      subscriptionTypeSelect.addEventListener('change', function () {
        updateSovereignTag();
        updateSidebarFromSelections();
      });
    }
    var billToAddress = getById('bill-to-address');
    var shipToAddress = getById('ship-to-address');
    if (billToAddress) {
      billToAddress.addEventListener('input', function () {
        updateSidebarFromSelections();
      });
    }
    if (shipToAddress) {
      shipToAddress.addEventListener('input', function () {
        updateSidebarFromSelections();
      });
    }
    document.querySelectorAll('input[name="usable_effective"], input[name="io_mix"], input[name="snapmirror"]').forEach(function (el) {
      el.addEventListener('change', updateSidebarFromSelections);
    });
    var burstSelect = document.querySelector('select[name="burst_capacity"]');
    if (burstSelect) burstSelect.addEventListener('change', updateSidebarFromSelections);
    var burstCustomInput = getById('burst-custom-input');
    if (burstCustomInput) {
      burstCustomInput.addEventListener('input', function () {
        if (burstByQuote[currentQuoteId]) {
          var num = parseInt(burstCustomInput.value, 10);
          if (!isNaN(num) && num >= 0 && num <= 100) {
            var cur = burstByQuote[currentQuoteId];
            burstByQuote[currentQuoteId] = { value: num, display: num + '%', justification: (cur && cur.justification) || '' };
          }
        }
        updateSidebarFromSelections();
      });
      burstCustomInput.addEventListener('change', function () {
        if (burstByQuote[currentQuoteId]) {
          var num = parseInt(burstCustomInput.value, 10);
          if (!isNaN(num) && num >= 0 && num <= 100) {
            var cur = burstByQuote[currentQuoteId];
            burstByQuote[currentQuoteId] = { value: num, display: num + '%', justification: (cur && cur.justification) || '' };
          }
        }
        updateSidebarFromSelections();
      });
    }
  }

  function applyUrlQuoteAndOpportunity() {
    var params = new URLSearchParams(window.location.search);
    var q = params.get('quote');
    var opp = params.get('opportunity');
    if (opp) currentOpportunityId = opp;
    if (!opp) {
      try {
        var lastOpp = sessionStorage.getItem('sizingLastOpportunityId');
        if (lastOpp) currentOpportunityId = lastOpp;
      } catch (e) {}
    }
    if (q) {
      currentQuoteId = q;
      if (!opp) {
        try {
          var uploadsKey = 'dealMarginUploadsByQuote';
          var rawUploads = sessionStorage.getItem(uploadsKey) || localStorage.getItem(uploadsKey);
          var uploadsMap = rawUploads ? JSON.parse(rawUploads) : {};
          var upload = uploadsMap && uploadsMap[currentQuoteId];
          if (upload && upload.opportunityId && upload.opportunityId !== '—') {
            currentOpportunityId = upload.opportunityId;
          }
        } catch (e) {}
      }
    } else {
      try {
        var draftQuote = sessionStorage.getItem(getDraftQuoteKey(currentOpportunityId));
        if (draftQuote) currentQuoteId = draftQuote;
      } catch (e) {}
    }
    try {
      sessionStorage.setItem('sizingLastOpportunityId', currentOpportunityId);
    } catch (e) {}

    // On plain fresh navigation (no ?quote= param), reset the quote list so only
    // this single fresh quote appears — prevents accumulation across visits.
    if (!q) {
      try { sessionStorage.removeItem(getOpportunityQuotesKey(currentOpportunityId)); } catch (e) {}
      try { sessionStorage.removeItem(getDraftQuoteKey(currentOpportunityId)); } catch (e) {}
    }

    ensureQuoteIdInMaps(currentQuoteId);
    if (fromCustomerRequest && q) {
      // Customer request: show only this single quote tab — discard any leftover IDs from prior sessions
      try {
        sessionStorage.setItem(getOpportunityQuotesKey(currentOpportunityId), JSON.stringify([q]));
      } catch (e) {}
    } else {
      addQuoteToOpportunity(currentOpportunityId, currentQuoteId);
    }
  }

  function updatePageQuoteAndOpportunityUI() {
    var titleEl = document.querySelector('.page-title');
    if (titleEl) {
      var name = escapeHtml(getQuoteDisplayName(currentQuoteId, currentOpportunityId));
      var renameBtn = ' <button type="button" class="quote-name-edit-icon" aria-label="Edit quote name">✎</button>';
      var actionBtn = '';
      if (!quoteReadOnlyMode) actionBtn = renameBtn;
      titleEl.innerHTML = name + actionBtn;
    }
    var submittedEditBtn = getById('btn-edit-submitted-quote');
    if (submittedEditBtn) {
      var showSubmittedEdit = quoteReadOnlyMode && isQuoteSubmittedForApproval(currentQuoteId);
      submittedEditBtn.hidden = !showSubmittedEdit;
    }
    // Reset button: hidden while viewing a submitted quote in read-only mode.
    // Shown again once the user clicks Edit, or for any brand-new / non-submitted quote.
    var resetBtn = getById('btn-reset-sizing');
    if (resetBtn) {
      resetBtn.hidden = quoteReadOnlyMode;
    }
    var metaOpp = getById('meta-opportunity-id');
    if (metaOpp) metaOpp.textContent = currentOpportunityId;
    var profile = getOpportunityProfile(currentOpportunityId);
    var metaOpportunityName = getById('meta-opportunity-name');
    var metaCustomer = getById('meta-customer-name');
    var metaSalesMotion = getById('meta-sales-motion');
    var metaPartner = getById('meta-partner-name');
    var metaDistributor = getById('meta-distributor-name');
    var metaVersion = getById('meta-keystone-version');
    var profileOppId = profile && profile.opportunityId ? String(profile.opportunityId) : null;
    var partnerText = (profile && profile.partnerName) ? profile.partnerName : '';
    var distributorText = (profile && profile.distributorName) ? profile.distributorName : '';
    if (!partnerText) partnerText = 'Not applicable';
    if (!distributorText) distributorText = 'Not applicable';
    if (metaOpp) metaOpp.textContent = DEFAULT_OPPORTUNITY_PROFILE.opportunityId;
    if (metaOpportunityName) metaOpportunityName.textContent = DEFAULT_OPPORTUNITY_PROFILE.opportunityName;
    if (metaCustomer) metaCustomer.textContent = DEFAULT_OPPORTUNITY_PROFILE.customerName;
    if (metaSalesMotion) metaSalesMotion.textContent = DEFAULT_OPPORTUNITY_PROFILE.salesMotion;
    if (metaPartner) metaPartner.textContent = DEFAULT_OPPORTUNITY_PROFILE.partnerName;
    if (metaDistributor) metaDistributor.textContent = DEFAULT_OPPORTUNITY_PROFILE.distributorName;
    if (metaVersion) metaVersion.textContent = DEFAULT_OPPORTUNITY_PROFILE.keystoneVersion;
    var siteSelect = document.querySelector('select[name="deployment_location"]');
    if (siteSelect && !quoteStateRestored) siteSelect.value = DEFAULT_OPPORTUNITY_PROFILE.siteName;
    syncSubscriptionTypeToDeployment();
    var addDevOpp = getById('add-deviation-opportunity');
    if (addDevOpp) addDevOpp.value = currentOpportunityId;
    var addDevQuote = getById('add-deviation-quote');
    if (addDevQuote) addDevQuote.value = currentQuoteId;
    document.title = getQuoteDisplayName(currentQuoteId, currentOpportunityId) + ' | Sizing';
    var dealMarginLink = document.querySelector('a.nav-link[href="margin-analysis.html"], a.nav-link[href^="margin-analysis.html?"]');
    if (dealMarginLink) {
      dealMarginLink.href = 'margin-analysis.html?quote=' + encodeURIComponent(currentQuoteId) + '&opportunity=' + encodeURIComponent(currentOpportunityId);
    }
  }

  function addNewQuote() {
    /* Add a new quote as a clean draft; stay in same tab and switch to it */
    var state = getQuoteStateForStorage();
    state.quoteItems = [];
    state.appliedDiscountPct = 0;
    state.requestedDeviations = [];
    state.workloadConfigs = {};
    state.planConfigs = {};
    state.burstByPlan = {};
    state.customContractData = null;
    state.customBilling = null;
    state.autoRenew = 'yes';
    state.autoRenewDuration = '12';
    var newId = nextQuoteIdForOpportunity(currentOpportunityId);
    ensureQuoteIdInMaps(newId);
    try {
      sessionStorage.setItem(getQuoteStorageKey(newId), JSON.stringify(state));
      addQuoteToOpportunity(currentOpportunityId, newId);
      sessionStorage.setItem('sizingRestoreOnLoad', '1');
    } catch (e) {}
    var url = 'sizing.html?quote=' + encodeURIComponent(newId) + '&opportunity=' + encodeURIComponent(currentOpportunityId);
    window.location.href = url;
  }

  function copyQuoteToNew() {
    var state = getQuoteStateForStorage();
    var newId = nextQuoteIdForOpportunity(currentOpportunityId);
    ensureQuoteIdInMaps(newId);
    try {
      sessionStorage.setItem(getQuoteStorageKey(newId), JSON.stringify(state));
      addQuoteToOpportunity(currentOpportunityId, newId);
      sessionStorage.setItem('sizingRestoreOnLoad', '1');
    } catch (e) {}
    var url = 'sizing.html?quote=' + encodeURIComponent(newId) + '&opportunity=' + encodeURIComponent(currentOpportunityId);
    window.location.href = url;
  }

  function deleteQuote(quoteId) {
    var list = getQuotesForOpportunity(currentOpportunityId);
    if (list.indexOf(quoteId) === -1) return;
    removeQuoteFromOpportunity(currentOpportunityId, quoteId);
    try {
      sessionStorage.removeItem(getQuoteStorageKey(quoteId));
      var names = getQuoteNamesForOpportunity(currentOpportunityId);
      if (names && names[quoteId]) {
        delete names[quoteId];
        saveQuoteNamesForOpportunity(currentOpportunityId, names);
      }
    } catch (e) {}
    if (currentQuoteId === quoteId) {
      var remaining = getQuotesForOpportunity(currentOpportunityId);
      if (remaining.length > 0) {
        switchToQuote(remaining[0]);
      } else {
        var newId = nextQuoteIdForOpportunity(currentOpportunityId);
        ensureQuoteIdInMaps(newId);
        addQuoteToOpportunity(currentOpportunityId, newId);
        window.location.href = 'sizing.html?quote=' + encodeURIComponent(newId) + '&opportunity=' + encodeURIComponent(currentOpportunityId);
      }
    }
    renderQuoteTabs();
  }

  function switchToQuote(quoteId) {
    if (quoteId === currentQuoteId) return;
    saveQuoteStateToStorage();
    currentQuoteId = quoteId;
    loadHwApprovalFromStorage();
    ensureQuoteIdInMaps(quoteId);
    var didRestore = restoreQuoteStateFromStorage(true);
    updatePageQuoteAndOpportunityUI();
    if (quoteReadOnlyMode) collapseAllSelectedWorkloads();
    renderWorkloadConfigCards();
    if (didRestore && fromCustomerRequest) addConfiguredWorkloadsToQuote();
    renderAdditionalConfigByPlan();
    updateSidebarFromSelections();
    updateSidebarTotals();
    updateItemization();
    if (didRestore) {
      updateContractLengthCardStates();
      updateBillingCardStates();
    }
    renderQuoteTabs();
    var url = 'sizing.html?quote=' + encodeURIComponent(currentQuoteId) + '&opportunity=' + encodeURIComponent(currentOpportunityId);
    if (window.history && window.history.replaceState) window.history.replaceState(null, '', url);
  }

  function renderQuoteTabs() {
    var tablist = getById('sizing-quote-tablist');
    if (!tablist) return;
    var list = getQuotesForOpportunity(currentOpportunityId);
    if (list.indexOf(currentQuoteId) === -1) list = [currentQuoteId].concat(list);
    var uniq = list.filter(function (id, i) { return list.indexOf(id) === i; });
    tablist.innerHTML = uniq.map(function (id) {
      var isCurrent = id === currentQuoteId;
      var displayName = getQuoteDisplayName(id, currentOpportunityId);
      var showDelete = uniq.length > 1;
      return '<span class="sizing-quote-tab-wrap">' +
        '<button type="button" role="tab" class="sizing-quote-tab' + (isCurrent ? ' active' : '') + '" aria-selected="' + isCurrent + '" data-quote-id="' + escapeHtml(id) + '" id="sizing-quote-tab-' + escapeHtml(id) + '">' + escapeHtml(displayName) + '</button>' +
        (showDelete ? '<button type="button" class="sizing-quote-tab-delete" aria-label="Delete quote ' + escapeHtml(id) + '" data-quote-id="' + escapeHtml(id) + '" title="Delete quote">×</button>' : '') +
        '</span>';
    }).join('');
    tablist.querySelectorAll('.sizing-quote-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var qid = btn.getAttribute('data-quote-id');
        if (qid) switchToQuote(qid);
      });
    });
    tablist.querySelectorAll('.sizing-quote-tab-delete').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var qid = btn.getAttribute('data-quote-id');
        if (qid) showDeleteQuoteModal(qid);
      });
    });
  }

  var pendingDeleteQuoteId = null;
  function showDeleteQuoteModal(quoteId) {
    pendingDeleteQuoteId = quoteId;
    var modal = getById('delete-quote-modal');
    if (modal) modal.removeAttribute('hidden');
  }
  function hideDeleteQuoteModal() {
    pendingDeleteQuoteId = null;
    var modal = getById('delete-quote-modal');
    if (modal) modal.setAttribute('hidden', '');
  }
  function bindDeleteQuoteModal() {
    var cancelBtn = getById('delete-quote-cancel');
    var confirmBtn = getById('delete-quote-confirm');
    var modal = getById('delete-quote-modal');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { hideDeleteQuoteModal(); });
    if (confirmBtn) confirmBtn.addEventListener('click', function () {
      if (pendingDeleteQuoteId) {
        deleteQuote(pendingDeleteQuoteId);
        hideDeleteQuoteModal();
      }
    });
    if (modal) modal.addEventListener('click', function (e) {
      if (e.target === modal) hideDeleteQuoteModal();
    });
  }

  function renderOpportunityQuotesSection() {
    renderQuoteTabs();
    var addBtn = getById('btn-add-quote');
    if (addBtn && !addBtn.dataset.bound) {
      addBtn.dataset.bound = '1';
      addBtn.addEventListener('click', addNewQuote);
    }
    var duplicateBtn = getById('btn-copy-quote');
    if (duplicateBtn && !duplicateBtn.dataset.bound) {
      duplicateBtn.dataset.bound = '1';
      duplicateBtn.addEventListener('click', copyQuoteToNew);
    }
  }

  function bindSubmitForApproval() {
    var submitBtn = getById('btn-submit');
    if (!submitBtn || submitBtn.dataset.bound) return;
    submitBtn.dataset.bound = '1';
    submitBtn.addEventListener('click', function () {
      if (submitBtn.disabled) return;
      saveQuoteStateToStorage(currentQuoteId, true); // always save on submit so readonly view can restore
      var submittedQuoteId = currentQuoteId;
      try {
        var state = getQuoteState();
        var submittedDiscountPct = (function () {
          var fromState = parseFloat(state && state.discountRatePct);
          if (!isNaN(fromState)) return Math.max(0, Math.min(100, fromState));
          var rateEl = getById('sidebar-discount-rate');
          var fromInput = rateEl && !isNaN(parseFloat(rateEl.value)) ? parseFloat(rateEl.value) : NaN;
          if (!isNaN(fromInput)) return Math.max(0, Math.min(100, fromInput));
          return Math.max(0, Math.min(100, appliedDiscountPct || 0));
        })();
        state.appliedDiscountPct = submittedDiscountPct;
        state.discountRatePct = submittedDiscountPct;
        var marginData = buildDealDataForMarginFromQuoteState(state);
        marginData.quoteDiscountPct = submittedDiscountPct;
        if (!marginData.defaults) marginData.defaults = {};
        marginData.defaults.discountRate = submittedDiscountPct;
        var featureRequests = marginData.featureRequests || getDeviationsList(state);
        var uploadsKey = 'dealMarginUploadsByQuote';
        var raw = sessionStorage.getItem(uploadsKey) || localStorage.getItem(uploadsKey);
        var map = raw ? JSON.parse(raw) : {};
        var existing = map[submittedQuoteId] || {};
        var submitProfile = getOpportunityProfile(currentOpportunityId);
        var submitCustomerName = (submitProfile && submitProfile.customerName) || DEFAULT_OPPORTUNITY_PROFILE.customerName || 'AUMOVIO Germany GmbH';
        map[submittedQuoteId] = {
          quoteId: submittedQuoteId,
          quoteName: getQuoteDisplayName(submittedQuoteId, currentOpportunityId),
          opportunityId: currentOpportunityId || existing.opportunityId || DEFAULT_OPPORTUNITY_PROFILE.opportunityId,
          customerName: submitCustomerName,
          assignedTo: existing.assignedTo || 'Derek Keller',
          quoteDiscountPct: submittedDiscountPct,
          assignedFor: existing.assignedFor || 'sally',
          uploadedAt: new Date().toISOString(),
          submittedForApproval: true,
          dealDecision: '',
          marginAnalysisCompleted: false,
          subscriptionUploaded: !!existing.subscriptionUploaded,
          hardwareUploaded: !!existing.hardwareUploaded,
          subscriptionCodeName: existing.subscriptionCodeName || '',
          hardwareCodeName: existing.hardwareCodeName || '',
          customerSubmitted: !!existing.customerSubmitted,
          data: marginData
        };
        sessionStorage.setItem(uploadsKey, JSON.stringify(map));
        localStorage.setItem(uploadsKey, JSON.stringify(map));
      } catch (e) {}
      updateApprovalUiState();
      window.alert('The quote has been successfully submitted for approval.');
      window.location.href = 'sales-dashboard.html?tab=in-review';
    });
  }

  function bindQuoteNameEdit() {
    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('.quote-name-edit-icon, #btn-edit-submitted-quote');
      if (!btn) return;
      e.preventDefault();
      if (btn.id === 'btn-edit-submitted-quote' && quoteReadOnlyMode) {
        setQuoteSubmittedForApproval(currentQuoteId, false);
        quoteReadOnlyMode = false;
        applyQuoteReadOnlyMode();
        updatePageQuoteAndOpportunityUI();
        var approvalBanner = document.getElementById('customer-request-banner');
        if (approvalBanner) approvalBanner.remove();
        window.alert('Edit mode enabled for this quote.');
        return;
      }
      if (!btn.classList.contains('quote-name-edit-icon')) return;
      var currentName = getQuoteDisplayName(currentQuoteId, currentOpportunityId);
      var nextName = window.prompt('Rename quote', currentName);
      if (nextName == null) return;
      nextName = String(nextName).trim();
      if (!nextName) nextName = 'Quote ' + currentQuoteId;
      setQuoteDisplayName(currentQuoteId, nextName, currentOpportunityId);
      updatePageQuoteAndOpportunityUI();
      renderOpportunityQuotesSection();
    });
  }

  function applyQuoteReadOnlyMode() {
    updatePageQuoteAndOpportunityUI();
    document.body.classList.toggle('quote-readonly', quoteReadOnlyMode);
    var main = document.querySelector('.quote-prototype-main');
    if (!main) return;
    main.querySelectorAll('input, select, textarea, button').forEach(function (el) {
      if (el.id === 'btn-edit-submitted-quote' || el.classList.contains('quote-name-edit-icon')) {
        el.disabled = false;
        return;
      }
      if (quoteReadOnlyMode) {
        el.setAttribute('disabled', '');
      } else {
        el.removeAttribute('disabled');
      }
    });
  }

  function showSizingEmptyState() {
    var banner = document.getElementById('customer-request-banner');
    if (banner) banner.remove();
    document.body.classList.remove('quote-readonly');
    var main = document.querySelector('.quote-prototype-main');
    if (!main) return;
    main.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;text-align:center;padding:60px 24px;">' +
        '<svg viewBox="0 0 24 24" style="width:48px;height:48px;fill:#9ca3af;margin-bottom:16px" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>' +
        '<h2 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#374151;">No quote selected</h2>' +
        '<p style="margin:0 0 24px;font-size:14px;color:#6b7280;max-width:400px;">To view or edit an existing quote, go to the <a href="sales-dashboard.html" style="color:#2563eb;text-decoration:underline;">Sales dashboard</a> and click on a quote.</p>' +
        '<p style="margin:0;font-size:14px;color:#6b7280;max-width:400px;">To create a new quote, start from <a href="create-opportunity.html" style="color:#2563eb;text-decoration:underline;">Create an opportunity</a>.</p>' +
      '</div>';
    var sidebar = document.querySelector('.quote-sidebar');
    if (sidebar) sidebar.style.display = 'none';
  }

  function generateUniqueId(prefix) {
    var ts = Date.now().toString(36).toUpperCase();
    var rand = Math.floor(Math.random() * 46656).toString(36).toUpperCase();
    while (rand.length < 3) rand = '0' + rand;
    return (prefix || '') + ts + rand;
  }

  function init() {
    var params = new URLSearchParams(window.location.search || '');
    var isCustomerPage = window.location.pathname.indexOf('customer-sizing') !== -1;

    if (isCustomerPage) {
      currentQuoteId = generateUniqueId('QT-');
      currentOpportunityId = generateUniqueId('OPP-');
      ensureQuoteIdInMaps(currentQuoteId);
      var metaQuoteEl = getById('meta-quote-number');
      if (metaQuoteEl) metaQuoteEl.textContent = currentQuoteId;
      var metaOppEl = getById('meta-opportunity-id');
      if (metaOppEl) metaOppEl.textContent = currentOpportunityId;
    }

    if (!isCustomerPage && !params.has('quote') && !params.has('opportunity') && params.get('from') !== 'customer' && params.get('from') !== 'npv') {
      var newId = String(Math.floor(10000 + Math.random() * 90000));
      window.location.replace('sizing.html?quote=' + newId + '&opportunity=' + encodeURIComponent(currentOpportunityId));
      return;
    }

    var shouldRestoreStoredState = false;
    var forceFreshSizing = false;
    try {
      quoteReadOnlyMode = params.get('readonly') === '1';
      fromCustomerRequest = params.get('from') === 'customer';
      fromNpvReturn = params.get('from') === 'npv';
      if (fromNpvReturn) {
        var savedQuoteId = sessionStorage.getItem('sizingNpvReturnQuoteId');
        var savedOppId = sessionStorage.getItem('sizingNpvReturnOppId');
        if (savedQuoteId) currentQuoteId = savedQuoteId;
        if (savedOppId) currentOpportunityId = savedOppId;
        sessionStorage.removeItem('sizingNpvReturnQuoteId');
        sessionStorage.removeItem('sizingNpvReturnOppId');
      }
      forceFreshSizing = sessionStorage.getItem('sizingForceFresh') === '1';
      shouldRestoreStoredState = params.has('quote') || params.has('opportunity') || quoteReadOnlyMode || fromCustomerRequest || fromNpvReturn;
      if (!shouldRestoreStoredState) {
        try {
          shouldRestoreStoredState = !!sessionStorage.getItem('sizingRestoreOnLoad');
        } catch (e2) {}
      }
      if (forceFreshSizing) shouldRestoreStoredState = false;
    } catch (e) {
      quoteReadOnlyMode = false;
      shouldRestoreStoredState = false;
      forceFreshSizing = false;
    }
    applyUrlQuoteAndOpportunity();
    loadHwApprovalFromStorage();
    if (params.has('quote') && !quoteReadOnlyMode && currentQuoteId && isQuoteSubmittedForApproval(currentQuoteId)) {
      quoteReadOnlyMode = true;
    }
    if (!ENABLE_SIZING_DRAFT_PERSISTENCE && !quoteReadOnlyMode && !fromCustomerRequest && !fromNpvReturn) {
      try {
        // Clear current quote state
        sessionStorage.removeItem(getQuoteStorageKey(currentQuoteId));
        localStorage.removeItem(getQuoteStorageKey(currentQuoteId));
        sessionStorage.removeItem('sizingQuoteState');
        sessionStorage.removeItem('sizingRestoreOnLoad');
        // Clean up any ghost quote states from old static IDs
        ['123', '456', '789'].forEach(function (id) {
          sessionStorage.removeItem(getQuoteStorageKey(id));
          localStorage.removeItem(getQuoteStorageKey(id));
        });
        sessionStorage.removeItem('sizingReturnUrl');
      } catch (e4) {}
    }
    updatePageQuoteAndOpportunityUI();
    // Banner: show submitted-for-approval notice or customer-request info
    // Only when navigating to a specific quote (not on fresh/empty sizing)
    (function () {
      var existing = document.getElementById('customer-request-banner');
      if (existing) existing.remove();
      if (!params.has('quote')) return;
      var banner = document.createElement('div');
      banner.id = 'customer-request-banner';
      banner.setAttribute('role', 'status');
      var topSection = document.querySelector('.sizing-top-section');
      if (!topSection) return;
      if (quoteReadOnlyMode && isQuoteSubmittedForApproval(currentQuoteId)) {
        banner.style.cssText = 'background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 18px;margin:0 0 16px;display:flex;align-items:center;gap:12px;font-size:13px;color:#78350f;';
        banner.innerHTML =
          '<svg viewBox="0 0 24 24" style="width:20px;height:20px;flex-shrink:0;fill:#b45309" aria-hidden="true"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>' +
          '<span><strong>Submitted for approval</strong> — This quote has been submitted for deal desk review. Fields are locked. Click <em>Edit</em> above to unlock and make changes.</span>';
        topSection.insertAdjacentElement('afterend', banner);
      } else if (fromCustomerRequest) {
        var pending = null;
        try {
          var pendingRaw = sessionStorage.getItem(getQuoteStorageKey(currentQuoteId)) || localStorage.getItem(getQuoteStorageKey(currentQuoteId));
          pending = pendingRaw ? JSON.parse(pendingRaw) : null;
        } catch (eBanner) {}
        var isSovereignRequest = !!(pending && (pending.subscriptionType === 'Sovereign' || isSovereignDeploymentValue(pending.deploymentLocation)));
        var sovereignNote = isSovereignRequest
          ? ' <strong>Sovereign request</strong> — the customer asked for a sovereign deployment at ' +
            escapeHtml(pending.deploymentLocationLabel || pending.deploymentLocation) +
            '. Keep the site and subscription type as sovereign when you quote.'
          : '';
        banner.style.cssText = 'background:#e0f2fe;border:1px solid #7dd3fc;border-radius:8px;padding:12px 18px;margin:0 0 16px;display:flex;align-items:center;gap:12px;font-size:13px;color:#0c4a6e;';
        banner.innerHTML =
          '<svg viewBox="0 0 24 24" style="width:20px;height:20px;flex-shrink:0;fill:#0369a1" aria-hidden="true"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>' +
          '<span><strong>Customer submitted request</strong> — All fields are pre-filled from the customer\'s submission. Review, add your details (discount, HW review), and use the action buttons to proceed.' + sovereignNote + '</span>';
        topSection.insertAdjacentElement('afterend', banner);
      }
    }());
    var resetBtn = getById('btn-reset-sizing');
    if (resetBtn) resetBtn.addEventListener('click', resetSizingToDefault);
    bindAddDeviationModal();
    bindTieringCapacityModal();
    bindDeleteQuoteModal();
    bindQuoteNameEdit();
    applyQuoteReadOnlyMode();
    var didRestore = shouldRestoreStoredState ? restoreQuoteStateFromStorage() : false;
    if (forceFreshSizing) {
      try { sessionStorage.removeItem('sizingForceFresh'); } catch (e3) {}
    }
    try {
      var deviationLabel = sessionStorage.getItem('deviationRequestAdded');
      var deviationValue = sessionStorage.getItem('deviationRequestValue');
      if (deviationValue) {
        var devSelect = getById('sidebar-deviations');
        if (devSelect) devSelect.value = deviationValue;
        sessionStorage.removeItem('deviationRequestValue');
      }
      if (deviationLabel) {
        sessionStorage.removeItem('deviationRequestAdded');
        if (!deviationValue) {
          requestedDeviations.push({ label: 'Deal feature request', value: deviationLabel });
        }
      }
    } catch (e) {}

    bindContractTermsCards();
    bindCustomContractModal();
    bindCustomBillingModal();
    bindCustomBurstModal();
    bindWorkloadTiles();
    bindBurstCustom();
    bindWorkloadCards();
    bindPlanDetailsModal();
    bindRateCardModal();
    bindKeystonePerformanceLevelsModal();
    bindReviewHardwareModal();
    bindDiscountRate();
    bindTabs();
    bindSidebarInputs();
    bindSidebarFlipToggle();
    bindCapexCompareToggle();
    if (quoteReadOnlyMode) collapseAllSelectedWorkloads();
    renderWorkloadConfigCards();
    if (didRestore && fromCustomerRequest) addConfiguredWorkloadsToQuote();
    renderAdditionalConfigByPlan();
    updateSidebarFromSelections();
    updateSidebarTotals();
    updateItemization();
    if (didRestore) {
      updateContractLengthCardStates();
      updateBillingCardStates();
      updateSidebarFromSelections();
      updateSidebarTotals();
    }
    renderOpportunityQuotesSection();
    if (quoteReadOnlyMode) applyQuoteReadOnlyMode();
    bindSubmitForApproval();
    bindSendQuoteModal();
    bindConsoleModuleModal();
    bindDownloadQuote();
    // Customer view: bind the subscription request submit button
    (function () {
      var btn = getById('btn-customer-submit');
      if (!btn || btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        if (btn.disabled) return;

        var requestId = currentQuoteId;
        var oppId = currentOpportunityId;
        saveQuoteStateToStorage(requestId, true);

        try {
          var quoteListKey = 'sizingQuotes_' + oppId;
          var rawList = localStorage.getItem(quoteListKey);
          var qList = rawList ? JSON.parse(rawList) : [];
          if (qList.indexOf(requestId) === -1) qList.push(requestId);
          localStorage.setItem(quoteListKey, JSON.stringify(qList));
        } catch (e) {}

        var quoteName = 'Customer request ' + requestId + ' \u2013 ' + DEFAULT_OPPORTUNITY_PROFILE.customerName;
        try {
          var namesKey = 'sizingQuoteNames_' + oppId;
          var rawNames = localStorage.getItem(namesKey) || sessionStorage.getItem(namesKey);
          var namesMap = rawNames ? JSON.parse(rawNames) : {};
          namesMap[requestId] = quoteName;
          localStorage.setItem(namesKey, JSON.stringify(namesMap));
          sessionStorage.setItem(namesKey, JSON.stringify(namesMap));
        } catch (e) {}

        var uploadsKey = 'dealMarginUploadsByQuote';
        try {
          var rawUploads = sessionStorage.getItem(uploadsKey) || localStorage.getItem(uploadsKey);
          var uploadsMap = rawUploads ? JSON.parse(rawUploads) : {};
          uploadsMap[requestId] = {
            quoteId: requestId,
            quoteName: quoteName,
            uploadedAt: new Date().toISOString(),
            customerName: DEFAULT_OPPORTUNITY_PROFILE.customerName,
            opportunityId: oppId,
            assignedTo: 'Derek Keller',
            assignedFor: 'sales',
            customerSubmitted: true
          };
          sessionStorage.setItem(uploadsKey, JSON.stringify(uploadsMap));
          localStorage.setItem(uploadsKey, JSON.stringify(uploadsMap));
        } catch (e) {}

        // Update UI
        btn.disabled = true;
        btn.textContent = 'Request submitted!';
        btn.classList.add('quote-btn-submitted');
        var notice = getById('quote-send-notice');
        if (notice) {
          notice.textContent = 'Your subscription request has been submitted. A NetApp representative will be in touch shortly.';
          notice.classList.remove('quote-discount-warning-hidden');
        }

        setTimeout(function () {
          window.location.href = 'sales-email-notification.html';
        }, 1500);
      });
    }());
    updateApprovalUiState();
    window.addEventListener('beforeunload', function () {
      saveQuoteStateToStorage();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
