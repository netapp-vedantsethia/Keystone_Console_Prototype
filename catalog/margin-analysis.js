(function () {
  'use strict';

  function formatCurrency(n) {
    return '$' + Math.round(n).toLocaleString();
  }

  /** Summary card currency: no commas, match screenshot ($925498) */
  function formatSummaryCurrency(n) {
    return '$' + Math.round(Number(n));
  }

  /** Summary card contract length: match screenshot (5Years, no space) */
  function formatSummaryContract(contractMonths) {
    var m = parseInt(contractMonths, 10) || 0;
    if (m >= 12) {
      var y = Math.floor(m / 12);
      return y + 'Years';
    }
    return m + ' Months';
  }

  function formatPercent(n) {
    return Math.round(n) + '%';
  }

  /** Clamp percentage to 0–100 for deal simulator */
  function clampPct(n) {
    return Math.max(0, Math.min(100, Math.round(Number(n))));
  }

  function monthsToYearsMonths(months) {
    const y = Math.floor(months / 12);
    const m = months % 12;
    return y + ' Years ' + m + ' Month' + (m !== 1 ? 's' : '');
  }

  /** Contract length in Deal Simulator: years only (e.g. "5 Years", "1 Year") */
  function monthsToYearsOnly(months) {
    var y = Math.floor(parseInt(months, 10) / 12) || 0;
    if (y === 0) y = 1;
    return y + (y === 1 ? ' Year' : ' Years');
  }

  var DEAL_DATA_KEY = 'dealMarginUploadData';
  var partnerIncentiveEligible = true;

  // Default slider values for reset
  var defaults = {
    contractLength: 60,
    slaCredits: 26000,
    discountRate: 26,
    discountAmount: 20000,
    grossMarginSla: 25,
    grossMarginNoSla: 30,
    breakEven: 8
  };

  var PARTNER_INCENTIVE_RATE = 0.10; // 10% of total bookings
  var BOM_RATE_OF_BOOKINGS = 0.10; // 10% of overall bookings
  var BOM_APPLICABLE_YEARS = 3; // apply BOM only for first 3 years
  var PERFORMANCE_SLA_RATE = 0.03;
  var AVAILABILITY_SLA_RATE = 0.04;
  var PERFORMANCE_AFFECTED_CAPACITY_FACTOR = 0.05;
  var AVAILABILITY_AFFECTED_CAPACITY_FACTOR = 1.00;
  var SLA_DAYS_IN_MONTH = 30;
  var SLA_MONTHS_OF_IMPACT = 5;
  var RRG_RATE = 0.10;

  /** Partner incentive = 10% of bookings (USD) per year */
  function partnerIncentiveFromBookings(bookingsUsdArr) {
    return (bookingsUsdArr || []).map(function (b) { return Math.round((b || 0) * PARTNER_INCENTIVE_RATE); });
  }

  function bomCostForYear(bookingUsd, yearIndex) {
    if (yearIndex >= BOM_APPLICABLE_YEARS) return 0;
    return Math.round((bookingUsd || 0) * BOM_RATE_OF_BOOKINGS);
  }

  function bomCostFromBookings(bookingsUsdArr) {
    return (bookingsUsdArr || []).map(function (b, i) { return bomCostForYear(b, i); });
  }

  // Deal economics data (annual per year)
  // Discount is included as a cost: higher discount = lower deal value = lower margin
  var annualData = {
    bookingsLocal: [185100, 185100, 185100, 185100, 185100],
    bookingsUsd: [185100, 185100, 185100, 185100, 185100],
    partnerIncentive: [18510, 18510, 18510, 18510, 18510],
    netBookings: [166590, 166590, 166590, 166590, 166590],
    discountDollar: [43313, 43313, 43313, 43313, 43313],
    bom: [18510, 18510, 18510, 0, 0],
    keystoneServices: [15000, 15000, 15000, 15000, 15000],
    slaCredits: [29693, 29693, 29693, 29693, 29693],
    dealValue: [41564, 41564, 41564, 60374, 60374],
    grossMarginSlaPct: [25, 25, 25, 36, 36],
    grossMarginNoSlaPct: [30, 30, 30, 43, 43]
  };

  var KSM_COST_FIXED = 6000;
  var INSTALLATION_COST_YEAR1 = 13000;
  var SUPPORT_COST_PCT = 0.055; // 5.5% of Net bookings

  /** Keystone breakdown: KSM and Installation fixed; Support = 5.5% of Net bookings */
  function getKeystoneBreakdown(netBookings) {
    var n = (netBookings || []).length;
    var ksmCost = [];
    var installationCost = [];
    var supportCost = [];
    for (var i = 0; i < n; i++) {
      ksmCost.push(KSM_COST_FIXED);
      installationCost.push(i === 0 ? INSTALLATION_COST_YEAR1 : 0);
      supportCost.push(Math.round((netBookings[i] || 0) * SUPPORT_COST_PCT));
    }
    return { ksmCost: ksmCost, supportCost: supportCost, installationCost: installationCost };
  }

  /** Keystone total = KSM + Support(5.5% net) + Installation + Supplemental */
  function getComputedKeystoneServices(netBookings, yearsLen) {
    var n = yearsLen || (netBookings || []).length || 5;
    var breakdown = getKeystoneBreakdown(netBookings);
    var supplemental = getSupplementalServices(n);
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push((breakdown.ksmCost[i] || 0) + (breakdown.supportCost[i] || 0) + (breakdown.installationCost[i] || 0) + (supplemental[i] || 0));
    }
    return out;
  }
  /** SLA credits from formulas. Monthly invoice uses Net Bookings / Term / 12 equivalent. */
  function getSlaCreditsFromFormulas(netBookings, termMonths, bookingsForRrg) {
    var arr = netBookings || [];
    var n = arr.length;
    var term = Math.max(1, parseInt(termMonths, 10) || 60);
    var totalNetBookings = 0;
    for (var i = 0; i < n; i++) totalNetBookings += arr[i] || 0;
    var totalBookingsForRrg = 0;
    var bookingsArr = bookingsForRrg || arr;
    for (var j = 0; j < bookingsArr.length; j++) totalBookingsForRrg += bookingsArr[j] || 0;
    var monthlyInvoice = totalNetBookings / term;

    // Performance SLA: Monthly invoice * 3% * 30(days) * 5(months) * 5%(affected capacity)
    var totalPerformance = monthlyInvoice * PERFORMANCE_SLA_RATE * SLA_DAYS_IN_MONTH * SLA_MONTHS_OF_IMPACT * PERFORMANCE_AFFECTED_CAPACITY_FACTOR;
    // Availability SLA: 4% of total bookings (simple model)
    var totalAvailability = AVAILABILITY_SLA_RATE * totalBookingsForRrg;
    // RRG: 10% of Bookings
    var totalRRG = RRG_RATE * totalBookingsForRrg;

    var ransomwareRecovery = [];
    var performanceSla = [];
    var availabilitySla = [];
    for (var i = 0; i < n; i++) {
      ransomwareRecovery.push(Math.round(totalRRG / n));
      performanceSla.push(Math.round(totalPerformance / n));
      availabilitySla.push(Math.round(totalAvailability / n));
    }
    var total = [];
    for (var i = 0; i < n; i++) {
      total.push(Math.round((ransomwareRecovery[i] || 0) + (performanceSla[i] || 0) + (availabilitySla[i] || 0)));
    }
    return {
      ransomwareRecovery: ransomwareRecovery,
      performanceSla: performanceSla,
      availabilitySla: availabilitySla,
      total: total
    };
  }

  function getSlaBreakdown(netBookings, termMonths, bookingsForRrg) {
    var fromFormulas = getSlaCreditsFromFormulas(netBookings, termMonths, bookingsForRrg);
    return {
      ransomwareRecovery: fromFormulas.ransomwareRecovery,
      performanceSla: fromFormulas.performanceSla,
      availabilitySla: fromFormulas.availabilitySla
    };
  }

  // Base data for simulator (copied once; sliders scale from this)
  var baseAnnualData = null;
  var originalGrossMarginSlaBaseline = null;
  var originalGrossMarginNoSlaBaseline = null;

  function copyAnnualData(src) {
    return {
      bookingsLocal: (src.bookingsLocal || []).slice(),
      bookingsUsd: (src.bookingsUsd || []).slice(),
      partnerIncentive: (src.partnerIncentive || []).slice(),
      netBookings: (src.netBookings || []).slice(),
      discountDollar: (src.discountDollar || []).slice(),
      bom: (src.bom || []).slice(),
      keystoneServices: (src.keystoneServices || []).slice(),
      slaCredits: (src.slaCredits || []).slice(),
      dealValue: (src.dealValue || []).slice(),
      grossMarginSlaPct: (src.grossMarginSlaPct || []).slice(),
      grossMarginNoSlaPct: (src.grossMarginNoSlaPct || []).slice()
    };
  }

  function includePartnerIncentive() {
    var el = document.getElementById('include-partner-incentive');
    if (!partnerIncentiveEligible) return false;
    return el ? el.checked : true;
  }

  function getEffectivePartnerIncentive(data, yearIndex) {
    if (includePartnerIncentive()) return (data.partnerIncentive && data.partnerIncentive[yearIndex]) || 0;
    return 0;
  }

  var SUPPLEMENTAL_SERVICES_YEAR1 = 2160; // one-time, year 1 only

  function getSupplementalServices(yearsLen) {
    var n = yearsLen || 5;
    var arr = [];
    for (var i = 0; i < n; i++) arr.push(i === 0 ? SUPPLEMENTAL_SERVICES_YEAR1 : 0);
    return arr;
  }

  function recomputeFromSliders() {
    if (!baseAnnualData) return;
    var termMonths = parseInt(document.getElementById('slider-contract-length') && document.getElementById('slider-contract-length').value, 10) || 60;
    var discountRate = (parseInt(document.getElementById('slider-discount-rate') && document.getElementById('slider-discount-rate').value, 10) || 0) / 100;
    var slaSliderEl = document.getElementById('slider-sla-credits');
    var targetSlaYear1 = parseInt(slaSliderEl && slaSliderEl.value, 10);
    var n = baseAnnualData.bookingsUsd.length;
    var piIncluded = includePartnerIncentive();
    for (var i = 0; i < n; i++) {
      // Bookings must remain gross (pre-discount) baseline from sizing/upload.
      annualData.bookingsLocal[i] = Math.round(baseAnnualData.bookingsLocal[i] || 0);
      annualData.bookingsUsd[i] = Math.round(baseAnnualData.bookingsUsd[i] || 0);
      annualData.partnerIncentive[i] = Math.round((annualData.bookingsUsd[i] || 0) * PARTNER_INCENTIVE_RATE);
      var piEff = piIncluded ? (annualData.partnerIncentive[i] || 0) : 0;
      annualData.netBookings[i] = Math.max(0, (annualData.bookingsUsd[i] || 0) - piEff);
      annualData.discountDollar[i] = Math.round((annualData.netBookings[i] || 0) * discountRate);
      annualData.bom[i] = bomCostForYear(annualData.bookingsUsd[i] || 0, i);
      annualData.keystoneServices[i] = getComputedKeystoneServices(annualData.netBookings, n)[i];
    }
    var totalDiscountAmount = 0;
    for (var d = 0; d < n; d++) totalDiscountAmount += (annualData.discountDollar[d] || 0);
    var discountAmtSlider = document.getElementById('slider-discount-amount');
    var discountAmtDisplay = document.getElementById('display-discount-amount');
    if (discountAmtSlider) discountAmtSlider.value = Math.max(0, Math.round(totalDiscountAmount));
    if (discountAmtDisplay) discountAmtDisplay.textContent = formatCurrency(Math.max(0, Math.round(totalDiscountAmount)));
    var slaFromFormulas = getSlaCreditsFromFormulas(annualData.netBookings, termMonths, annualData.bookingsUsd);
    var baseSlaYear1 = (slaFromFormulas.total && slaFromFormulas.total[0]) || 0;
    var slaScale = 1;
    if (!isNaN(targetSlaYear1) && targetSlaYear1 >= 0 && baseSlaYear1 > 0) {
      slaScale = targetSlaYear1 / baseSlaYear1;
    }
    for (var i = 0; i < n; i++) {
      annualData.slaCredits[i] = Math.round((slaFromFormulas.total[i] || 0) * slaScale);
    }
    var displaySla = document.getElementById('display-sla-credits');
    if (displaySla) displaySla.textContent = formatCurrency(annualData.slaCredits[0] || 0);
    for (var i = 0; i < n; i++) {
      var piEff = getEffectivePartnerIncentive(annualData, i);
      var disc = annualData.discountDollar[i] || 0;
      var totalCost = piEff + annualData.bom[i] + annualData.keystoneServices[i] + annualData.slaCredits[i] + disc;
      annualData.dealValue[i] = Math.round((annualData.netBookings[i] || 0) - totalCost);
      var revSla = (annualData.netBookings[i] || 0) - totalCost + annualData.slaCredits[i];
      var revNoSla = (annualData.netBookings[i] || 0) - (piEff + annualData.bom[i] + annualData.keystoneServices[i] + disc);
      var pctSla = revSla ? Math.round(100 * annualData.dealValue[i] / revSla) : 0;
      var pctNoSla = revNoSla ? Math.round(100 * annualData.dealValue[i] / revNoSla) : 0;
      annualData.grossMarginSlaPct[i] = clampPct(pctSla);
      annualData.grossMarginNoSlaPct[i] = clampPct(pctNoSla);
    }
    var gmSla = clampPct(annualData.grossMarginSlaPct[0]);
    var gmNoSla = clampPct(annualData.grossMarginNoSlaPct[0]);
    var isCumulative = document.querySelector('.toggle-pill[data-view="cumulative"].active');
    if (isCumulative) {
      renderTableCumulative();
      renderOriginalTableCumulative();
    } else {
      renderTableAnnual();
      renderOriginalTableAnnual();
    }
    var table = document.getElementById('economics-table');
    if (table) {
      // Status colors follow discount thresholds:
      // <25% green, 25%-50% orange, >50% red.
      var discountPctForColor = clampPct(document.getElementById('slider-discount-rate') && document.getElementById('slider-discount-rate').value);
      table.classList.remove('discount-under-20', 'discount-20-to-45', 'discount-over-45');
      if (discountPctForColor > 50) table.classList.add('discount-over-45');
      else if (discountPctForColor >= 25) table.classList.add('discount-20-to-45');
      else table.classList.add('discount-under-20');
    }
    updateSummaryFromSliders();
    updateBreakEvenFromFormula();
  }

  /** Break-even (months) = Contract length (months) / (Total Booking / Total Cost) */
  function computeBreakEvenMonths(bookingsUsd, costsPerYear, contractMonths) {
    var totalBooking = 0;
    var totalCost = 0;
    for (var i = 0; i < (bookingsUsd || []).length; i++) {
      totalBooking += bookingsUsd[i] || 0;
      totalCost += (costsPerYear && costsPerYear[i]) || 0;
    }
    if (totalBooking <= 0) return null;
    var term = Math.max(1, parseInt(contractMonths, 10) || 60);
    return term * totalCost / totalBooking;
  }

  /** For a given discount rate (0–100), compute break-even months without mutating annualData */
  function getBreakEvenForDiscountRate(discountRatePct, termMonths, discountAmt) {
    if (!baseAnnualData) return null;
    var scale = 1 - (clampPct(discountRatePct) / 100);
    var n = baseAnnualData.bookingsUsd.length;
    var amtPerYear = n ? Math.round((discountAmt || 0) / n) : 0;
    var piIncluded = includePartnerIncentive();
    var bookingsUsd = [];
    var partnerIncentive = [];
    var netBookings = [];
    for (var i = 0; i < n; i++) {
      var bu = Math.round((baseAnnualData.bookingsUsd[i] || 0) * scale);
      bookingsUsd.push(bu);
      partnerIncentive.push(Math.round(bu * PARTNER_INCENTIVE_RATE));
      var pi = piIncluded ? partnerIncentive[i] : 0;
      netBookings.push(Math.max(0, bu - pi));
    }
    var keystone = getComputedKeystoneServices(netBookings, n);
    var sla = getSlaCreditsFromFormulas(netBookings, termMonths, bookingsUsd).total;
    var costs = [];
    for (var i = 0; i < n; i++) {
      costs.push((partnerIncentive[i] || 0) + bomCostForYear(bookingsUsd[i] || 0, i) + (keystone[i] || 0) + (sla[i] || 0));
    }
    return computeBreakEvenMonths(bookingsUsd, costs, termMonths);
  }

  /** For a given discount rate (0-100), estimate gross margin % (year 1). */
  function getGrossMarginForDiscountRate(discountRatePct, termMonths, discountAmt, withSla) {
    if (!baseAnnualData) return null;
    var scale = 1 - (clampPct(discountRatePct) / 100);
    var n = baseAnnualData.bookingsUsd.length;
    if (!n) return 0;
    var piIncluded = includePartnerIncentive();
    var bookingsUsd = [];
    var partnerIncentive = [];
    var netBookings = [];
    for (var i = 0; i < n; i++) {
      var bu = Math.round((baseAnnualData.bookingsUsd[i] || 0) * scale);
      bookingsUsd.push(bu);
      partnerIncentive.push(Math.round(bu * PARTNER_INCENTIVE_RATE));
      var pi = piIncluded ? partnerIncentive[i] : 0;
      netBookings.push(Math.max(0, bu - pi));
    }
    var keystone = getComputedKeystoneServices(netBookings, n);
    var sla = getSlaCreditsFromFormulas(netBookings, termMonths, bookingsUsd).total;
    var y = 0;
    var piEff = piIncluded ? (partnerIncentive[y] || 0) : 0;
    var bom = bomCostForYear(bookingsUsd[y] || 0, y);
    var ks = keystone[y] || 0;
    var slaY = sla[y] || 0;
    var net = netBookings[y] || 0;
    var totalCost = piEff + bom + ks + slaY;
    var dealValue = net - totalCost;
    var denom = withSla ? (net - totalCost + slaY) : (net - (piEff + bom + ks));
    if (!denom) return 0;
    return clampPct(Math.round((100 * dealValue) / denom));
  }

  /** Find discount rate that gets closest to target gross margin %. */
  function discountRateForGrossMargin(targetGrossMarginPct, withSla, termMonths, discountAmt) {
    if (!baseAnnualData) return null;
    var target = clampPct(targetGrossMarginPct);
    var bestRate = 0;
    var bestDiff = Infinity;
    for (var dr = 0; dr <= 100; dr++) {
      var gm = getGrossMarginForDiscountRate(dr, termMonths, discountAmt, withSla);
      if (gm == null) continue;
      var diff = Math.abs(gm - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestRate = dr;
        if (diff === 0) break;
      }
    }
    return bestRate;
  }

  /** Set break-even slider and display from formula (after recompute). */
  function updateBreakEvenFromFormula() {
    var termMonths = parseInt(document.getElementById('slider-contract-length') && document.getElementById('slider-contract-length').value, 10) || 60;
    var costs = getTotalCostsPerYear();
    var be = computeBreakEvenMonths(annualData.bookingsUsd, costs, termMonths);
    var sliderBreakEven = document.getElementById('slider-break-even');
    var displayBreakEven = document.getElementById('display-break-even');
    var months = be != null ? Math.round(Math.max(0, Math.min(84, be))) : 0;
    if (sliderBreakEven) sliderBreakEven.value = months;
    if (displayBreakEven) displayBreakEven.textContent = monthsToYearsMonths(months);
  }

  /** Find discount rate (0–100) that achieves target break-even months. Shorter break-even ⇒ lower discount rate (higher d ⇒ longer be). */
  function discountRateForBreakEven(targetBreakEvenMonths, termMonths, discountAmt) {
    if (!baseAnnualData || targetBreakEvenMonths <= 0) return null;
    var lo = 0;
    var hi = 100;
    for (var iter = 0; iter < 25; iter++) {
      var mid = (lo + hi) / 2;
      var be = getBreakEvenForDiscountRate(mid, termMonths, discountAmt);
      if (be == null) return clampPct(lo);
      if (be <= targetBreakEvenMonths) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return clampPct(Math.round((lo + hi) / 2));
  }

  function parseYearsFromSizingState(state) {
    if (!state) return 3;
    var candidates = [state.contractLengthLabel, state.contractLength, state.contractLengthValue];
    for (var i = 0; i < candidates.length; i++) {
      var v = candidates[i];
      if (!v) continue;
      var m = String(v).match(/(\d+)\s*(year|month)?/i);
      if (!m) continue;
      var num = parseInt(m[1], 10) || 0;
      if (num <= 0) continue;
      if ((m[2] || '').toLowerCase().indexOf('month') === 0) return Math.max(1, Math.ceil(num / 12));
      return num;
    }
    return 3;
  }

  function buildFallbackDealDataFromSizingState(quoteId, sizingState) {
    if (!sizingState || typeof sizingState !== 'object') return null;
    var contractYears = Math.max(1, Math.min(5, parseYearsFromSizingState(sizingState)));
    var tableYears = 5;
    var items = Array.isArray(sizingState.quoteItems) ? sizingState.quoteItems : [];
    var subtotalPerYear = items.reduce(function (sum, item) { return sum + ((item && item.cost) || 0); }, 0);
    if (!(subtotalPerYear > 0)) return null;
    var rawDiscount = sizingState.discountRatePct !== undefined && sizingState.discountRatePct !== null
      ? parseFloat(sizingState.discountRatePct)
      : parseFloat(sizingState.appliedDiscountPct || 0);
    var discountPct = Math.max(0, Math.min(100, isNaN(rawDiscount) ? 0 : rawDiscount));

    function projectedYearsArray(getVal) {
      var arr = [];
      for (var i = 0; i < tableYears; i++) arr.push(getVal(i));
      return arr;
    }

    var bookingsUsd = projectedYearsArray(function () { return Math.round(subtotalPerYear); });
    var bookingsLocal = bookingsUsd.slice();
    var partnerIncentive = projectedYearsArray(function () { return Math.round(subtotalPerYear * PARTNER_INCENTIVE_RATE); });
    var netBookings = projectedYearsArray(function () { return Math.max(0, Math.round(subtotalPerYear) - Math.round(subtotalPerYear * PARTNER_INCENTIVE_RATE)); });
    var discountDollar = projectedYearsArray(function (_, i) { return Math.round((netBookings[i] || 0) * (discountPct / 100)); });
    var bom = bookingsUsd.map(function (b, i) { return bomCostForYear(b, i); });
    var keystoneServices = getComputedKeystoneServices(netBookings, tableYears);
    var slaCredits = getSlaCreditsFromFormulas(netBookings, contractYears * 12, bookingsUsd).total;
    var dealValue = [];
    var gmSla = [];
    var gmNoSla = [];
    for (var y = 0; y < tableYears; y++) {
      var pi = partnerIncentive[y] || 0;
      var totalCost = pi + (bom[y] || 0) + (keystoneServices[y] || 0) + (slaCredits[y] || 0);
      var dv = (netBookings[y] || 0) - totalCost;
      var revSla = (netBookings[y] || 0) - totalCost + (slaCredits[y] || 0);
      var revNoSla = (netBookings[y] || 0) - (pi + (bom[y] || 0) + (keystoneServices[y] || 0));
      dealValue.push(Math.round(dv));
      gmSla.push(clampPct(revSla ? Math.round((100 * dv) / revSla) : 0));
      gmNoSla.push(clampPct(revNoSla ? Math.round((100 * dv) / revNoSla) : 0));
    }

    var featureRequests = [];
    if (sizingState.contractLengthValue === 'custom' && sizingState.customContractData) {
      featureRequests.push({ label: 'Contract', value: sizingState.customContractData.display || 'Custom' });
    }
    if (sizingState.billingValue === 'custom' && sizingState.customBilling) {
      var cb = sizingState.customBilling;
      featureRequests.push({ label: 'Billing', value: 'Custom (every ' + (cb.interval || '') + ' ' + (cb.unit || '') + ')' });
    }
    var standardBurst = ['20', '40', '60'];
    if (sizingState.workloadConfigs && typeof sizingState.workloadConfigs === 'object') {
      Object.keys(sizingState.workloadConfigs).forEach(function (wid) {
        var wc = sizingState.workloadConfigs[wid];
        if (wc && wc.burst && standardBurst.indexOf(String(wc.burst)) === -1) {
          featureRequests.push({ label: 'Burst (' + (wc.selectedPlan || wid) + ')', value: wc.burst + '%' });
        }
      });
    }
    if (sizingState.burstByPlan && typeof sizingState.burstByPlan === 'object') {
      Object.keys(sizingState.burstByPlan).forEach(function (planId) {
        var bp = sizingState.burstByPlan[planId];
        if (bp && bp.value != null && standardBurst.indexOf(String(bp.value)) === -1) {
          var duplicate = featureRequests.some(function (fr) {
            return fr.label.indexOf('Burst') === 0 && fr.value === bp.value + '%';
          });
          if (!duplicate) featureRequests.push({ label: 'Burst', value: bp.display || (bp.value + '%') });
        }
      });
    }
    if (Array.isArray(sizingState.requestedDeviations)) {
      sizingState.requestedDeviations.forEach(function (d) {
        if (d && d.label) featureRequests.push(d);
      });
    }

    return {
      quoteId: quoteId || sizingState.quoteId || '123',
      opportunityId: sizingState.opportunityId || 'OPP-001',
      quoteDiscountPct: discountPct,
      featureRequests: featureRequests,
      annualData: {
        bookingsLocal: bookingsLocal,
        bookingsUsd: bookingsUsd,
        partnerIncentive: partnerIncentive,
        netBookings: netBookings,
        discountDollar: discountDollar,
        bom: bom,
        keystoneServices: keystoneServices,
        slaCredits: slaCredits,
        dealValue: dealValue,
        grossMarginSlaPct: gmSla,
        grossMarginNoSlaPct: gmNoSla
      },
      defaults: {
        contractLength: contractYears * 12,
        slaCredits: slaCredits[0] || 0,
        discountRate: discountPct,
        discountAmount: Math.round((discountDollar[0] || 0) * tableYears),
        grossMarginSla: gmSla[0] || 0,
        grossMarginNoSla: gmNoSla[0] || 0,
        breakEven: Math.max(1, Math.min(84, Math.round((tableYears * 12) / 4)))
      }
    };
  }

  function applyGrossBookingsFromSizingState(stored, sizingState) {
    if (!stored || !stored.annualData || !sizingState) return stored;
    var items = Array.isArray(sizingState.quoteItems) ? sizingState.quoteItems : [];
    var subtotalPerYear = items.reduce(function (sum, item) { return sum + ((item && item.cost) || 0); }, 0);
    if (!(subtotalPerYear > 0)) return stored;
    var tableYears = 5;
    var bookings = [];
    for (var i = 0; i < tableYears; i++) bookings.push(Math.round(subtotalPerYear));
    stored.annualData.bookingsLocal = bookings.slice();
    stored.annualData.bookingsUsd = bookings.slice();
    return stored;
  }

  function hasNonZeroAnnualData(stored) {
    if (!stored || !stored.annualData) return false;
    var ad = stored.annualData;
    var candidates = ['bookingsUsd', 'netBookings', 'dealValue'];
    for (var i = 0; i < candidates.length; i++) {
      var arr = ad[candidates[i]];
      if (Array.isArray(arr) && arr.some(function (v) { return (Number(v) || 0) > 0; })) return true;
    }
    return false;
  }

  function extractQuoteIdFromSizingStateKey(key) {
    if (!key) return null;
    var m = String(key).match(/^sizingQuoteState_(.+)$/);
    return m ? m[1] : null;
  }

  function getSizingStateByQuoteId(quoteId) {
    if (!quoteId) return null;
    try {
      var raw = sessionStorage.getItem('sizingQuoteState_' + quoteId) || localStorage.getItem('sizingQuoteState_' + quoteId);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Flags a sovereign quote next to the page title so deal desk sees the deployment constraint
   * before approving. Matches the tag the Console and the sizing page use.
   */
  function updateSovereignTag(quoteId) {
    var tag = document.getElementById('margin-sovereign-tag');
    if (!tag) return;
    var state = getSizingStateByQuoteId(quoteId);
    var siteValue = state ? String(state.deploymentLocation || '') : '';
    var isSovereign = !!state &&
      (state.subscriptionType === 'Sovereign' || /^(EU-Sovereign|Dark-Site)/i.test(siteValue));
    tag.hidden = !isSovereign;
    if (!isSovereign) return;
    var siteLabel = state.deploymentLocationLabel || siteValue;
    tag.textContent = siteLabel ? 'Sovereign \u00b7 ' + siteLabel : 'Sovereign';
  }

  function findBestSizingStateCandidate() {
    var candidates = [];
    function collectFrom(storageObj) {
      if (!storageObj || typeof storageObj.length !== 'number') return;
      for (var i = 0; i < storageObj.length; i++) {
        var key = storageObj.key(i);
        var quoteId = extractQuoteIdFromSizingStateKey(key);
        if (!quoteId) continue;
        var state = getSizingStateByQuoteId(quoteId);
        if (!state) continue;
        var items = Array.isArray(state.quoteItems) ? state.quoteItems : [];
        var hasItems = items.some(function (it) { return ((it && it.cost) || 0) > 0; });
        if (!hasItems) continue;
        var ts = 0;
        try {
          var fromUploadsRaw = sessionStorage.getItem('dealMarginUploadsByQuote') || localStorage.getItem('dealMarginUploadsByQuote');
          var fromUploads = fromUploadsRaw ? JSON.parse(fromUploadsRaw) : {};
          var up = fromUploads && fromUploads[quoteId];
          ts = up && up.uploadedAt ? new Date(up.uploadedAt).getTime() : 0;
        } catch (e) {}
        candidates.push({ quoteId: quoteId, state: state, ts: ts });
      }
    }
    try { collectFrom(sessionStorage); } catch (e1) {}
    try { collectFrom(localStorage); } catch (e2) {}
    if (!candidates.length) return null;
    candidates.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    return candidates[0];
  }

  function loadUploadedDealData() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      var quoteId = params.get('quote');
      var opportunityId = params.get('opportunity');
      var upload = null;
      var uploadsRaw = sessionStorage.getItem('dealMarginUploadsByQuote') || localStorage.getItem('dealMarginUploadsByQuote');
      var uploads = uploadsRaw ? JSON.parse(uploadsRaw) : {};
      if (!quoteId) {
        try {
          var lastOpp = sessionStorage.getItem('sizingLastOpportunityId');
          if (lastOpp) {
            var draftQuote = sessionStorage.getItem('sizingDraftQuote_' + lastOpp);
            if (draftQuote) quoteId = draftQuote;
          }
        } catch (e0) {}
        if (!quoteId && uploads && typeof uploads === 'object') {
          var keys = Object.keys(uploads);
          if (keys.length) {
            keys.sort(function (a, b) {
              var ta = uploads[a] && uploads[a].uploadedAt ? new Date(uploads[a].uploadedAt).getTime() : 0;
              var tb = uploads[b] && uploads[b].uploadedAt ? new Date(uploads[b].uploadedAt).getTime() : 0;
              return tb - ta;
            });
            quoteId = keys[0];
          }
        }
      }
      if (quoteId) {
        try { sessionStorage.setItem('activeQuoteId', quoteId); } catch (e01) {}
        upload = uploads && uploads[quoteId] ? uploads[quoteId] : null;
      }

      var stored = upload && upload.data ? upload.data : null;
      var forcedFromSizing = false;
      if (quoteId) {
        try {
          var sizingRawAuthoritative = sessionStorage.getItem('sizingQuoteState_' + quoteId) || localStorage.getItem('sizingQuoteState_' + quoteId);
          if (sizingRawAuthoritative) {
            var sizingStateAuthoritative = JSON.parse(sizingRawAuthoritative);
            var authoritativeData = buildFallbackDealDataFromSizingState(quoteId, sizingStateAuthoritative);
            if (authoritativeData && authoritativeData.annualData) {
              stored = authoritativeData;
              forcedFromSizing = true;
            }
          }
        } catch (eAuth) {}
      }
      if (!stored || typeof stored !== 'object' || !hasNonZeroAnnualData(stored)) {
        if (!quoteId) {
          try { quoteId = sessionStorage.getItem('activeQuoteId') || quoteId; } catch (e02) {}
        }
        if (quoteId) {
          var sizingRawFallback = sessionStorage.getItem('sizingQuoteState_' + quoteId) || localStorage.getItem('sizingQuoteState_' + quoteId);
          if (sizingRawFallback) {
            var sizingStateFallback = JSON.parse(sizingRawFallback);
            var fallbackData = buildFallbackDealDataFromSizingState(quoteId, sizingStateFallback);
            if (fallbackData) {
              stored = fallbackData;
              try {
                var existing = uploads && typeof uploads === 'object' ? uploads : {};
                existing[quoteId] = existing[quoteId] || { quoteId: quoteId };
                existing[quoteId].data = fallbackData;
                if (!existing[quoteId].uploadedAt) existing[quoteId].uploadedAt = new Date().toISOString();
                sessionStorage.setItem('dealMarginUploadsByQuote', JSON.stringify(existing));
                localStorage.setItem('dealMarginUploadsByQuote', JSON.stringify(existing));
              } catch (e02b) {}
            }
          }
        }
      }
      if (!stored || typeof stored !== 'object' || !hasNonZeroAnnualData(stored)) {
        var best = findBestSizingStateCandidate();
        if (best && best.quoteId && best.state) {
          quoteId = best.quoteId;
          try { sessionStorage.setItem('activeQuoteId', quoteId); } catch (e03) {}
          stored = buildFallbackDealDataFromSizingState(quoteId, best.state);
        }
      }
      if (!stored || typeof stored !== 'object') {
        var raw = sessionStorage.getItem(DEAL_DATA_KEY);
        stored = raw ? JSON.parse(raw) : null;
      }
      if (!forcedFromSizing && stored && quoteId) {
        try {
          var sizingRawCurrent = sessionStorage.getItem('sizingQuoteState_' + quoteId) || localStorage.getItem('sizingQuoteState_' + quoteId);
          if (sizingRawCurrent) {
            var sizingStateCurrent = JSON.parse(sizingRawCurrent);
            stored = applyGrossBookingsFromSizingState(stored, sizingStateCurrent);
          }
        } catch (e4) {}
      }
      if (!stored || typeof stored !== 'object') return false;
      try { sessionStorage.setItem(DEAL_DATA_KEY, JSON.stringify(stored)); } catch (e2) {}
      renderFeatureRequestsFromStored(stored);
      if (stored.annualData) {
        annualData.bookingsLocal = stored.annualData.bookingsLocal || annualData.bookingsLocal;
        annualData.bookingsUsd = stored.annualData.bookingsUsd || annualData.bookingsUsd;
        annualData.partnerIncentive = partnerIncentiveFromBookings(annualData.bookingsUsd);
        annualData.netBookings = stored.annualData.netBookings || annualData.netBookings;
        annualData.discountDollar = stored.annualData.discountDollar || annualData.discountDollar || [4000, 4000, 4000, 4000, 4000];
        annualData.bom = stored.annualData.bom || annualData.bom;
        annualData.keystoneServices = stored.annualData.keystoneServices || annualData.keystoneServices;
        annualData.slaCredits = stored.annualData.slaCredits || annualData.slaCredits;
        annualData.dealValue = stored.annualData.dealValue || annualData.dealValue;
        var gs = stored.annualData.grossMarginSlaPct || annualData.grossMarginSlaPct;
        var gn = stored.annualData.grossMarginNoSlaPct || annualData.grossMarginNoSlaPct;
        annualData.grossMarginSlaPct = (gs || []).map(function (v) { return clampPct(v); });
        annualData.grossMarginNoSlaPct = (gn || []).map(function (v) { return clampPct(v); });
      }
      try {
        if (!opportunityId && quoteId) {
          var sizingRaw = sessionStorage.getItem('sizingQuoteState_' + quoteId) || localStorage.getItem('sizingQuoteState_' + quoteId);
          if (sizingRaw) {
            var sizingStateForOpp = JSON.parse(sizingRaw);
            opportunityId = sizingStateForOpp && sizingStateForOpp.opportunityId ? sizingStateForOpp.opportunityId : opportunityId;
          }
        }
        if (opportunityId) {
          partnerIncentiveEligible = false;
          // Always use canonical hardcoded values — do not let stale storage override display fields
          var elPartner = document.getElementById('meta-partner-name');
          var elDistributor = document.getElementById('meta-distributor-name');
          var elCustomer = document.getElementById('meta-customer-name');
          var elOppName = document.getElementById('meta-opportunity-name');
          var elSalesMotion = document.getElementById('meta-sales-motion');
          var elQuoteNum = document.getElementById('meta-quote-number');
          var elOppId = document.getElementById('meta-opportunity-id');
          var elPageTitle = document.querySelector('.page-title');
          if (elPartner) elPartner.textContent = 'Not applicable';
          if (elDistributor) elDistributor.textContent = 'Not applicable';
          if (elCustomer) elCustomer.textContent = 'AUMOVIO Germany GmbH';
          if (elOppName) elOppName.textContent = 'Enterprise Multi-Area';
          if (elSalesMotion) elSalesMotion.textContent = 'Direct';
          if (elOppId) elOppId.textContent = '3876523';
          var displayQuoteNum = quoteId || '42001';
          if (elQuoteNum) elQuoteNum.textContent = displayQuoteNum;
          if (elPageTitle) elPageTitle.textContent = 'Quote ' + displayQuoteNum;
          updateSovereignTag(displayQuoteNum);
        }
      } catch (e3) {}
      if (stored.defaults) {
        defaults.contractLength = stored.defaults.contractLength !== undefined ? stored.defaults.contractLength : defaults.contractLength;
        defaults.slaCredits = stored.defaults.slaCredits !== undefined ? stored.defaults.slaCredits : defaults.slaCredits;
        defaults.discountRate = clampPct(stored.defaults.discountRate !== undefined ? stored.defaults.discountRate : defaults.discountRate);
        defaults.discountAmount = stored.defaults.discountAmount !== undefined ? stored.defaults.discountAmount : defaults.discountAmount;
        defaults.grossMarginSla = clampPct(stored.defaults.grossMarginSla !== undefined ? stored.defaults.grossMarginSla : defaults.grossMarginSla);
        defaults.grossMarginNoSla = clampPct(stored.defaults.grossMarginNoSla !== undefined ? stored.defaults.grossMarginNoSla : defaults.grossMarginNoSla);
        defaults.breakEven = stored.defaults.breakEven !== undefined ? stored.defaults.breakEven : defaults.breakEven;
      }
      if (upload && upload.quoteDiscountPct !== undefined && upload.quoteDiscountPct !== null) {
        defaults.discountRate = clampPct(upload.quoteDiscountPct);
      } else if (stored.quoteDiscountPct !== undefined && stored.quoteDiscountPct !== null) {
        defaults.discountRate = clampPct(stored.quoteDiscountPct);
      } else if (quoteId) {
        var sizingRaw = sessionStorage.getItem('sizingQuoteState_' + quoteId) || localStorage.getItem('sizingQuoteState_' + quoteId);
        if (sizingRaw) {
          var sizingState = JSON.parse(sizingRaw);
          if (sizingState && sizingState.appliedDiscountPct !== undefined && sizingState.appliedDiscountPct !== null) {
            defaults.discountRate = clampPct(sizingState.appliedDiscountPct);
          }
        }
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function renderFeatureRequestsFromStored(stored) {
    var listEl = document.getElementById('deviations-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    var requests = stored && Array.isArray(stored.featureRequests) ? stored.featureRequests : [];
    if (!requests.length) {
      listEl.innerHTML = '<p class="tab-content-note" style="color:#6b7280;font-style:italic;">No feature requests were specified in the Sizing tab for this deal.</p>';
      return;
    }
    requests.forEach(function (req) {
      var label = req && req.label ? String(req.label) : 'Feature request';
      var value = req && req.value ? String(req.value) : '';
      var type = /discount|sla|margin|burst|contract|billing/i.test(label + ' ' + value) ? 'margin' : 'config';
      var item = document.createElement('div');
      item.className = 'deviation-item';
      item.setAttribute('data-type', type);

      var badge = document.createElement('span');
      badge.className = 'deviation-badge ' + (type === 'margin' ? 'deviation-badge--margin' : 'deviation-badge--config');
      badge.textContent = type === 'margin' ? 'Margin impact' : 'Configuration';

      var labelEl = document.createElement('span');
      labelEl.className = 'deviation-label';
      labelEl.textContent = label;

      var detailEl = document.createElement('span');
      detailEl.className = 'deviation-detail';
      detailEl.textContent = value;

      item.appendChild(badge);
      item.appendChild(labelEl);
      item.appendChild(detailEl);
      listEl.appendChild(item);
    });
  }

  function getTotalCostsPerYear() {
    var years = annualData.bookingsUsd ? annualData.bookingsUsd.length : 5;
    var arr = [];
    for (var y = 0; y < years; y++) {
      var pi = getEffectivePartnerIncentive(annualData, y);
      var disc = annualData.discountDollar[y] || 0;
      var cost = pi + annualData.bom[y] + annualData.keystoneServices[y] + annualData.slaCredits[y] + disc;
      arr.push(cost);
    }
    return arr;
  }

  function getTotalCostsPerYearFor(data) {
    var years = data.bookingsUsd ? data.bookingsUsd.length : 5;
    var keystone = data === annualData ? data.keystoneServices : getComputedKeystoneServices(data.netBookings, years);
    var arr = [];
    for (var y = 0; y < years; y++) {
      var pi = (data === annualData && !includePartnerIncentive()) ? 0 : (data.partnerIncentive[y] || 0);
      var disc = (data.discountDollar && data.discountDollar[y]) || 0;
      var cost = pi + (data.bom[y] || 0) + (keystone[y] || 0) + (data.slaCredits[y] || 0) + disc;
      arr.push(cost);
    }
    return arr;
  }

  function ensureAnnualTableStructure() {
    var table = document.getElementById('economics-table');
    if (!table) return;
    var thead = table.querySelector('thead tr');
    if (thead && thead.cells.length !== 6) {
      thead.innerHTML = '<th class="col-charges">Charges</th><th>Year 1</th><th>Year 2</th><th>Year 3</th><th>Year 4</th><th>Year 5</th>';
    }
    var tbody = table.querySelector('tbody');
    var rows = tbody.querySelectorAll('tr');
    for (var r = 0; r < rows.length; r++) {
      var cells = rows[r].querySelectorAll('td');
      while (cells.length < 6) {
        var td = document.createElement('td');
        td.className = 'num';
        rows[r].appendChild(td);
        cells = rows[r].querySelectorAll('td');
      }
    }
  }

  function ensureOriginalTableStructure() {
    var table = document.getElementById('economics-table-original');
    if (!table) return;
    var thead = table.querySelector('thead tr');
    if (thead && thead.cells.length !== 6) {
      thead.innerHTML = '<th class="col-charges">Charges</th><th>Year 1</th><th>Year 2</th><th>Year 3</th><th>Year 4</th><th>Year 5</th>';
    }
    var tbody = table.querySelector('tbody');
    if (!tbody) return;
    var rows = tbody.querySelectorAll('tr');
    for (var r = 0; r < rows.length; r++) {
      var cells = rows[r].querySelectorAll('td');
      while (cells.length < 6) {
        var td = document.createElement('td');
        td.className = 'num';
        rows[r].appendChild(td);
        cells = rows[r].querySelectorAll('td');
      }
    }
  }

  function renderOriginalTableAnnual() {
    if (!baseAnnualData) return;
    ensureOriginalTableStructure();
    var tbody = document.querySelector('#economics-table-original tbody');
    if (!tbody) return;
    var rows = tbody.querySelectorAll('tr');
    var costs = getTotalCostsPerYearFor(baseAnnualData);
    var discountDollar = baseAnnualData.discountDollar || [4000, 4000, 4000, 4000, 4000];
    var keystoneBreakdown = getKeystoneBreakdown(baseAnnualData.netBookings);
    var slaBreakdown = getSlaBreakdown(baseAnnualData.netBookings, defaults.contractLength || 60, baseAnnualData.bookingsUsd);
    setRowNums(rows[0], baseAnnualData.bookingsLocal, false);
    setRowNums(rows[1], baseAnnualData.bookingsUsd, false);
    setRowNums(rows[2], baseAnnualData.partnerIncentive, true);
    setRowNums(rows[3], baseAnnualData.netBookings, false);
    setRowNums(rows[4], discountDollar, true);
    setRowNums(rows[5], baseAnnualData.bom, true);
    var supplemental = getSupplementalServices(baseAnnualData.bookingsUsd.length);
    setRowNums(rows[6], baseAnnualData.keystoneServices, true);
    setRowNums(rows[7], keystoneBreakdown.ksmCost, true);
    setRowNums(rows[8], keystoneBreakdown.supportCost, true);
    setRowNums(rows[9], keystoneBreakdown.installationCost, true);
    setRowNums(rows[10], supplemental, true);
    setRowNums(rows[11], baseAnnualData.slaCredits, true);
    setRowNums(rows[12], slaBreakdown.ransomwareRecovery, true);
    setRowNums(rows[13], slaBreakdown.performanceSla, true);
    setRowNums(rows[14], slaBreakdown.availabilitySla, true);
    setRowNums(rows[15], costs, true);
    setRowNums(rows[16], baseAnnualData.dealValue, false);
    setRowNums(rows[17], baseAnnualData.grossMarginSlaPct, false, true);
    setRowNums(rows[18], baseAnnualData.grossMarginNoSlaPct, false, true);
  }

  function renderOriginalTableCumulative() {
    if (!baseAnnualData) return;
    var table = document.getElementById('economics-table-original');
    if (!table) return;
    var thead = table.querySelector('thead tr');
    var tbody = table.querySelector('tbody');
    var rows = tbody.querySelectorAll('tr');
    var costs = getTotalCostsPerYearFor(baseAnnualData);
    var discountDollar = baseAnnualData.discountDollar || [4000, 4000, 4000, 4000, 4000];
    var keystoneBreakdown = getKeystoneBreakdown(baseAnnualData.netBookings);
    var slaBreakdown = getSlaBreakdown(baseAnnualData.netBookings, defaults.contractLength || 60, baseAnnualData.bookingsUsd);
    if (thead && thead.cells.length !== 2) {
      thead.innerHTML = '<th class="col-charges">Charges</th><th>Total (5 years)</th>';
    }
    var supplemental = getSupplementalServices(baseAnnualData.bookingsUsd.length);
    var rowData = [
      baseAnnualData.bookingsLocal, baseAnnualData.bookingsUsd, baseAnnualData.partnerIncentive, baseAnnualData.netBookings,
      discountDollar, baseAnnualData.bom, baseAnnualData.keystoneServices,
      keystoneBreakdown.ksmCost, keystoneBreakdown.supportCost, keystoneBreakdown.installationCost,
      supplemental,
      baseAnnualData.slaCredits, slaBreakdown.ransomwareRecovery, slaBreakdown.performanceSla, slaBreakdown.availabilitySla,
      costs, baseAnnualData.dealValue, baseAnnualData.grossMarginSlaPct, baseAnnualData.grossMarginNoSlaPct
    ];
    var rowNeg = [false, false, true, false, true, true, true, true, true, true, true, true, true, true, true, true, false, false, false];
    var rowPct = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, true, true];
    for (var r = 0; r < rows.length && r < rowData.length; r++) {
      var cells = rows[r].querySelectorAll('td');
      if (cells.length < 2) continue;
      var val = rowPct[r] ? (rowData[r].length ? clampPct(rowData[r][rowData[r].length - 1]) : 0) : sumArr(rowData[r]);
      for (var i = cells.length - 1; i >= 2; i--) rows[r].removeChild(cells[i]);
      cells = rows[r].querySelectorAll('td');
      var valueCell = cells[1];
      if (!valueCell) continue;
      if (rowPct[r]) {
        valueCell.textContent = val + '%';
      } else {
        valueCell.textContent = rowNeg[r] ? '(' + formatCurrency(val) + ')' : formatCurrency(val);
        valueCell.className = 'num' + (rowNeg[r] ? ' neg' : '');
      }
    }
  }

  function renderTableAnnual() {
    ensureAnnualTableStructure();
    var tbody = document.querySelector('#economics-table tbody');
    if (!tbody) return;
    var rows = tbody.querySelectorAll('tr');
    var costs = getTotalCostsPerYear();
    var partnerDisplay = includePartnerIncentive() ? annualData.partnerIncentive : [0, 0, 0, 0, 0];
    var keystoneBreakdown = getKeystoneBreakdown(annualData.netBookings);
    var termMonths = parseInt(document.getElementById('slider-contract-length') && document.getElementById('slider-contract-length').value, 10) || 60;
    var slaBreakdown = getSlaBreakdown(annualData.netBookings, termMonths, annualData.bookingsUsd);
    setRowNums(rows[0], annualData.bookingsLocal, false);
    setRowNums(rows[1], annualData.bookingsUsd, false);
    setRowNums(rows[2], partnerDisplay, true);
    setRowNums(rows[3], annualData.netBookings, false);
    setRowNums(rows[4], annualData.discountDollar || [0, 0, 0, 0, 0], true);
    setRowNums(rows[5], annualData.bom, true);
    var supplemental = getSupplementalServices(annualData.bookingsUsd.length);
    setRowNums(rows[6], annualData.keystoneServices, true);
    setRowNums(rows[7], keystoneBreakdown.ksmCost, true);
    setRowNums(rows[8], keystoneBreakdown.supportCost, true);
    setRowNums(rows[9], keystoneBreakdown.installationCost, true);
    setRowNums(rows[10], supplemental, true);
    setRowNums(rows[11], annualData.slaCredits, true);
    setRowNums(rows[12], slaBreakdown.ransomwareRecovery, true);
    setRowNums(rows[13], slaBreakdown.performanceSla, true);
    setRowNums(rows[14], slaBreakdown.availabilitySla, true);
    setRowNums(rows[15], costs, true);
    setRowNums(rows[16], annualData.dealValue, false);
    setRowNums(rows[17], annualData.grossMarginSlaPct, false, true);
    setRowNums(rows[18], annualData.grossMarginNoSlaPct, false, true);
  }

  function setRowNums(row, values, neg, pct) {
    if (!row) return;
    var cells = row.querySelectorAll('td');
    for (var i = 0; i < values.length && i + 1 < cells.length; i++) {
      if (pct) {
        var pctVal = clampPct(values[i]);
        cells[i + 1].textContent = pctVal + '%';
      } else {
        var v = values[i];
        cells[i + 1].textContent = neg ? '(' + formatCurrency(v) + ')' : formatCurrency(v);
      }
      cells[i + 1].className = 'num' + (neg ? ' neg' : '');
    }
  }

  function sumArr(arr) {
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += arr[i];
    return s;
  }

  function renderTableCumulative() {
    var table = document.getElementById('economics-table');
    if (!table) return;
    var thead = table.querySelector('thead tr');
    var tbody = table.querySelector('tbody');
    var rows = tbody.querySelectorAll('tr');
    var costs = getTotalCostsPerYear();
    var partnerDisplay = includePartnerIncentive() ? annualData.partnerIncentive : [0, 0, 0, 0, 0];
    var keystoneBreakdown = getKeystoneBreakdown(annualData.netBookings);
    var termMonths = parseInt(document.getElementById('slider-contract-length') && document.getElementById('slider-contract-length').value, 10) || 60;
    var slaBreakdown = getSlaBreakdown(annualData.netBookings, termMonths, annualData.bookingsUsd);
    if (thead && thead.cells.length !== 2) {
      thead.innerHTML = '<th class="col-charges">Charges</th><th>Total (5 years)</th>';
    }
    var supplemental = getSupplementalServices(annualData.bookingsUsd.length);
    var rowData = [
      annualData.bookingsLocal, annualData.bookingsUsd, partnerDisplay, annualData.netBookings,
      annualData.discountDollar || [0, 0, 0, 0, 0], annualData.bom, annualData.keystoneServices,
      keystoneBreakdown.ksmCost, keystoneBreakdown.supportCost, keystoneBreakdown.installationCost,
      supplemental,
      annualData.slaCredits, slaBreakdown.ransomwareRecovery, slaBreakdown.performanceSla, slaBreakdown.availabilitySla,
      costs, annualData.dealValue, annualData.grossMarginSlaPct, annualData.grossMarginNoSlaPct
    ];
    var rowNeg = [false, false, true, false, true, true, true, true, true, true, true, true, true, true, true, true, false, false, false];
    var rowPct = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, true, true];
    for (var r = 0; r < rows.length && r < rowData.length; r++) {
      var cells = rows[r].querySelectorAll('td');
      if (cells.length < 2) continue;
      var val = rowPct[r] ? (rowData[r].length ? clampPct(rowData[r][rowData[r].length - 1]) : 0) : sumArr(rowData[r]);
      for (var i = cells.length - 1; i >= 2; i--) rows[r].removeChild(cells[i]);
      cells = rows[r].querySelectorAll('td');
      var valueCell = cells[1];
      if (!valueCell) continue;
      if (rowPct[r]) {
        valueCell.textContent = val + '%';
      } else {
        valueCell.textContent = rowNeg[r] ? '(' + formatCurrency(val) + ')' : formatCurrency(val);
        valueCell.className = 'num' + (rowNeg[r] ? ' neg' : '');
      }
    }
  }

  function getTotalBookingsFromData() {
    var sum = 0;
    for (var i = 0; i < annualData.bookingsUsd.length; i++) sum += annualData.bookingsUsd[i];
    return sum;
  }
  function getTotalNetBookingsFromData() {
    var sum = 0;
    for (var i = 0; i < annualData.netBookings.length; i++) sum += annualData.netBookings[i];
    return sum;
  }
  function getTotalCostsFromData() {
    var costs = getTotalCostsPerYear();
    var sum = 0;
    for (var i = 0; i < costs.length; i++) sum += costs[i];
    return sum;
  }

  var DISCOUNT_HEALTHY_THRESHOLD = 27;

  function updateSummaryFromSliders() {
    var contractMonths = parseInt(document.getElementById('slider-contract-length').value, 10);
    var discountRate = parseInt(document.getElementById('slider-discount-rate').value, 10);
    var totalBookings = getTotalBookingsFromData();
    var totalNetBookings = getTotalNetBookingsFromData();
    var costs = getTotalCostsFromData();
    var dealValue = totalNetBookings - costs;
    var years = Math.floor(contractMonths / 12) + (contractMonths % 12 ? 0.5 : 0) || 1;
    var elMargin = document.getElementById('summary-deal-margin');
    var elContract = document.getElementById('summary-contract-length');
    var elDiscount = document.getElementById('summary-discount');
    var elBookings = document.getElementById('summary-total-bookings');
    var elCosts = document.getElementById('summary-costs');
    var elDv = document.getElementById('summary-deal-value');
    var marginPct = totalNetBookings > 0 ? clampPct(Math.round((dealValue / totalNetBookings) * 100)) : 0;
    var dealHealthy = clampPct(discountRate) < DISCOUNT_HEALTHY_THRESHOLD;
    var neutralEls = [elContract, elDiscount, elBookings, elCosts];
    for (var s = 0; s < neutralEls.length; s++) {
      if (!neutralEls[s]) continue;
      neutralEls[s].classList.remove('margin-healthy', 'margin-unhealthy');
    }
    var healthEls = [elMargin, elDv];
    for (var h = 0; h < healthEls.length; h++) {
      if (!healthEls[h]) continue;
      if (dealHealthy) {
        healthEls[h].classList.add('margin-healthy');
        healthEls[h].classList.remove('margin-unhealthy');
      } else {
        healthEls[h].classList.add('margin-unhealthy');
        healthEls[h].classList.remove('margin-healthy');
      }
    }
    if (elMargin) elMargin.textContent = marginPct + '%';
    if (elContract) elContract.textContent = formatSummaryContract(contractMonths);
    if (elDiscount) elDiscount.textContent = clampPct(discountRate) + '%';
    updateApprovalAuthority();
    updateRecommendedSteps();
    if (elBookings) elBookings.textContent = formatSummaryCurrency(totalBookings);
    if (elCosts) elCosts.textContent = formatSummaryCurrency(costs);
    if (elDv) elDv.textContent = formatSummaryCurrency(dealValue);
  }

  function bindPartnerIncentiveCheckbox() {
    var el = document.getElementById('include-partner-incentive');
    if (el) el.addEventListener('change', function () { recomputeFromSliders(); });
  }

  function bindFormulaTooltips() {
    var tooltip = document.getElementById('charge-formula-tooltip');
    if (!tooltip) return;
    function showTooltip(el) {
      var text = el.getAttribute('data-tooltip') || el.getAttribute('title');
      if (!text) return;
      tooltip.textContent = text;
      tooltip.setAttribute('aria-hidden', 'false');
      var rect = el.getBoundingClientRect();
      var pad = 8;
      tooltip.style.left = rect.left + 'px';
      tooltip.style.top = (rect.bottom + 6) + 'px';
      tooltip.classList.add('visible');
      requestAnimationFrame(function () {
        var w = tooltip.offsetWidth;
        var h = tooltip.offsetHeight;
        var maxLeft = document.documentElement.clientWidth - w - pad;
        var viewH = document.documentElement.clientHeight - pad;
        var left = Math.max(pad, Math.min(rect.left, maxLeft));
        var top = rect.bottom + 6;
        if (top + h > viewH) top = rect.top - h - 6;
        top = Math.max(pad, top);
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
      });
    }
    function hideTooltip() {
      tooltip.classList.remove('visible');
      tooltip.setAttribute('aria-hidden', 'true');
    }
    document.body.addEventListener('mouseover', function (e) {
      var icon = e.target && e.target.closest && e.target.closest('.row-info-icon');
      if (icon) showTooltip(icon);
      else hideTooltip();
    });
    document.body.addEventListener('mouseout', function (e) {
      var fromIcon = e.target && e.target.closest && e.target.closest('.row-info-icon');
      var toIcon = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.row-info-icon');
      if (fromIcon && !toIcon) hideTooltip();
    });
  }

  function bindExpandCollapse() {
    function toggleSection(expandRow) {
      var forKey = expandRow.getAttribute('data-expandable');
      var collapsed = expandRow.getAttribute('data-collapsed') === 'true';
      expandRow.setAttribute('data-collapsed', collapsed ? 'false' : 'true');
      var btn = expandRow.querySelector('.row-expand-btn');
      if (btn) {
        btn.textContent = collapsed ? '▼' : '▲';
        btn.setAttribute('aria-expanded', collapsed ? 'true' : 'false');
      }
      var next = expandRow.nextElementSibling;
      var count = 0;
      while (next && next.classList.contains('row-expand-detail') && next.getAttribute('data-detail-for') === forKey && count < 10) {
        next.classList.toggle('hidden-detail', !collapsed);
        next = next.nextElementSibling;
        count++;
      }
    }
    document.querySelectorAll('.economics-table .row-expandable .row-expand-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('tr.row-expandable');
        if (row) toggleSection(row);
      });
    });
    document.querySelectorAll('#economics-table-original .row-expandable .row-expand-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('tr.row-expandable');
        if (row) toggleSection(row);
      });
    });
  }

  function bindSliders() {
    function getNetBookingsTotalForDiscountSync() {
      var source = (baseAnnualData && Array.isArray(baseAnnualData.netBookings) && baseAnnualData.netBookings.length)
        ? baseAnnualData.netBookings
        : annualData.netBookings;
      var total = 0;
      for (var i = 0; i < (source || []).length; i++) total += (source[i] || 0);
      return Math.max(0, Math.round(total));
    }

    function syncDiscountAmountFromRate() {
      var sliderDiscountRate = document.getElementById('slider-discount-rate');
      var sliderDiscountAmt = document.getElementById('slider-discount-amount');
      var displayDiscountRate = document.getElementById('display-discount-rate');
      var displayDiscountAmt = document.getElementById('display-discount-amount');
      if (!sliderDiscountRate || !sliderDiscountAmt) return;
      var ratePct = clampPct(sliderDiscountRate.value);
      sliderDiscountRate.value = ratePct;
      var totalNet = getNetBookingsTotalForDiscountSync();
      var amount = Math.round(totalNet * (ratePct / 100));
      sliderDiscountAmt.value = amount;
      if (displayDiscountRate) displayDiscountRate.textContent = ratePct + '%';
      if (displayDiscountAmt) displayDiscountAmt.textContent = formatCurrency(amount);
    }

    function syncDiscountRateFromAmount() {
      var sliderDiscountRate = document.getElementById('slider-discount-rate');
      var sliderDiscountAmt = document.getElementById('slider-discount-amount');
      var displayDiscountRate = document.getElementById('display-discount-rate');
      var displayDiscountAmt = document.getElementById('display-discount-amount');
      if (!sliderDiscountRate || !sliderDiscountAmt) return;
      var amount = Math.max(0, parseInt(sliderDiscountAmt.value, 10) || 0);
      var totalNet = getNetBookingsTotalForDiscountSync();
      var ratePct = totalNet > 0 ? clampPct(Math.round((amount / totalNet) * 100)) : 0;
      sliderDiscountRate.value = ratePct;
      if (displayDiscountRate) displayDiscountRate.textContent = ratePct + '%';
      if (displayDiscountAmt) displayDiscountAmt.textContent = formatCurrency(amount);
    }

    var sliderContract = document.getElementById('slider-contract-length');
    var displayContract = document.getElementById('display-contract-length');
    if (sliderContract && displayContract) {
      function updateContract() {
        var m = parseInt(sliderContract.value, 10);
        displayContract.textContent = monthsToYearsOnly(m);
        recomputeFromSliders();
      }
      sliderContract.addEventListener('input', updateContract);
      updateContract();
    }

    var sliderSla = document.getElementById('slider-sla-credits');
    var displaySla = document.getElementById('display-sla-credits');
    if (sliderSla && displaySla) {
      sliderSla.addEventListener('input', function () {
        displaySla.textContent = formatCurrency(parseInt(sliderSla.value, 10));
        recomputeFromSliders();
      });
      displaySla.textContent = formatCurrency(parseInt(sliderSla.value, 10));
    }

    var sliderDiscountRate = document.getElementById('slider-discount-rate');
    var displayDiscountRate = document.getElementById('display-discount-rate');
    if (sliderDiscountRate && displayDiscountRate) {
      sliderDiscountRate.addEventListener('input', function () {
        syncDiscountAmountFromRate();
        recomputeFromSliders();
      });
      syncDiscountAmountFromRate();
    }

    var sliderDiscountAmt = document.getElementById('slider-discount-amount');
    var displayDiscountAmt = document.getElementById('display-discount-amount');
    if (sliderDiscountAmt && displayDiscountAmt) {
      sliderDiscountAmt.addEventListener('input', function () {
        syncDiscountRateFromAmount();
        recomputeFromSliders();
      });
      if (displayDiscountAmt) displayDiscountAmt.textContent = formatCurrency(parseInt(sliderDiscountAmt.value, 10) || 0);
    }

    var sliderGmSla = document.getElementById('slider-gross-margin-sla');
    var displayGmSla = document.getElementById('display-gross-margin-sla');
    if (sliderGmSla && displayGmSla) {
      sliderGmSla.addEventListener('input', function () {
        var v = clampPct(sliderGmSla.value);
        sliderGmSla.value = v;
        displayGmSla.textContent = v + '%';
        var termMonths = parseInt(document.getElementById('slider-contract-length') && document.getElementById('slider-contract-length').value, 10) || 60;
        var discountAmt = parseInt(document.getElementById('slider-discount-amount') && document.getElementById('slider-discount-amount').value, 10) || 0;
        var dr = discountRateForGrossMargin(v, true, termMonths, discountAmt);
        if (dr != null) {
          var sliderDr = document.getElementById('slider-discount-rate');
          if (sliderDr) sliderDr.value = dr;
          syncDiscountAmountFromRate();
        }
        recomputeFromSliders();
      });
      displayGmSla.textContent = clampPct(sliderGmSla.value) + '%';
    }

    var sliderGmNoSla = document.getElementById('slider-gross-margin-no-sla');
    var displayGmNoSla = document.getElementById('display-gross-margin-no-sla');
    if (sliderGmNoSla && displayGmNoSla) {
      sliderGmNoSla.addEventListener('input', function () {
        var v = clampPct(sliderGmNoSla.value);
        sliderGmNoSla.value = v;
        displayGmNoSla.textContent = v + '%';
        var termMonths = parseInt(document.getElementById('slider-contract-length') && document.getElementById('slider-contract-length').value, 10) || 60;
        var discountAmt = parseInt(document.getElementById('slider-discount-amount') && document.getElementById('slider-discount-amount').value, 10) || 0;
        var dr = discountRateForGrossMargin(v, false, termMonths, discountAmt);
        if (dr != null) {
          var sliderDr = document.getElementById('slider-discount-rate');
          if (sliderDr) sliderDr.value = dr;
          syncDiscountAmountFromRate();
        }
        recomputeFromSliders();
      });
      displayGmNoSla.textContent = clampPct(sliderGmNoSla.value) + '%';
    }

    var sliderBreakEven = document.getElementById('slider-break-even');
    var displayBreakEven = document.getElementById('display-break-even');
    if (sliderBreakEven && displayBreakEven) {
      sliderBreakEven.addEventListener('input', function () {
        var targetMonths = parseInt(sliderBreakEven.value, 10) || 0;
        displayBreakEven.textContent = monthsToYearsMonths(targetMonths);
        var termMonths = parseInt(document.getElementById('slider-contract-length') && document.getElementById('slider-contract-length').value, 10) || 60;
        var discountAmt = parseInt(document.getElementById('slider-discount-amount') && document.getElementById('slider-discount-amount').value, 10) || 0;
        var dr = discountRateForBreakEven(targetMonths, termMonths, discountAmt);
        if (dr != null) {
          var sliderDr = document.getElementById('slider-discount-rate');
          if (sliderDr) sliderDr.value = dr;
          syncDiscountAmountFromRate();
        }
        recomputeFromSliders();
      });
      displayBreakEven.textContent = monthsToYearsMonths(parseInt(sliderBreakEven.value, 10));
    }
  }

  function bindViewToggle() {
    var pills = document.querySelectorAll('.toggle-pill[data-view]');
    pills.forEach(function (btn) {
      btn.addEventListener('click', function () {
        pills.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var view = btn.getAttribute('data-view');
        if (view === 'cumulative') {
          renderTableCumulative();
          renderOriginalTableCumulative();
        } else {
          renderTableAnnual();
          renderOriginalTableAnnual();
        }
      });
    });
  }

  function bindDealViewToggle() {
    var originalView = document.getElementById('deal-view-original');
    var simulatedView = document.getElementById('deal-view-simulated');
    var pills = document.querySelectorAll('.toggle-pill[data-deal-view]');
    if (!pills.length || !originalView || !simulatedView) return;
    pills.forEach(function (btn) {
      btn.addEventListener('click', function () {
        pills.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var view = btn.getAttribute('data-deal-view');
        if (view === 'original') {
          originalView.hidden = false;
          simulatedView.hidden = true;
        } else {
          originalView.hidden = true;
          simulatedView.hidden = false;
        }
      });
    });
  }

  function bindReset() {
    var btn = document.getElementById('reset-values');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var el;
      if ((el = document.getElementById('slider-contract-length'))) el.value = defaults.contractLength;
      if ((el = document.getElementById('slider-sla-credits'))) el.value = defaults.slaCredits;
      if ((el = document.getElementById('slider-discount-rate'))) el.value = clampPct(defaults.discountRate);
      if ((el = document.getElementById('slider-discount-amount'))) el.value = defaults.discountAmount;
      if ((el = document.getElementById('slider-gross-margin-sla'))) el.value = clampPct(defaults.grossMarginSla);
      if ((el = document.getElementById('slider-gross-margin-no-sla'))) el.value = clampPct(defaults.grossMarginNoSla);
      if ((el = document.getElementById('slider-break-even'))) el.value = defaults.breakEven;
      if ((el = document.getElementById('display-contract-length'))) el.textContent = monthsToYearsOnly(defaults.contractLength);
      if ((el = document.getElementById('display-sla-credits'))) el.textContent = formatCurrency(defaults.slaCredits);
      if ((el = document.getElementById('display-discount-rate'))) el.textContent = clampPct(defaults.discountRate) + '%';
      if ((el = document.getElementById('display-discount-amount'))) el.textContent = formatCurrency(defaults.discountAmount);
      if ((el = document.getElementById('display-gross-margin-sla'))) el.textContent = clampPct(defaults.grossMarginSla) + '%';
      if ((el = document.getElementById('display-gross-margin-no-sla'))) el.textContent = clampPct(defaults.grossMarginNoSla) + '%';
      if ((el = document.getElementById('display-break-even'))) el.textContent = monthsToYearsMonths(defaults.breakEven);
      recomputeFromSliders();
      updateApprovalAuthority();
      updateRecommendedSteps();
    });
  }

  function bindTabs() {
    var tabs = document.querySelectorAll('.tab[data-tab]');
    var actionsFooter = document.getElementById('actions-footer-main');
    var panelIds = {
      quote: 'panel-quote',
      overview: 'panel-quote',
      justification: 'panel-justification',
      details: 'panel-details',
      'deal-score': 'panel-deal-score',
      deviations: 'panel-deviations',
      comments: 'panel-comments',
      concise: 'panel-concise'
    };
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var tabName = tab.getAttribute('data-tab');
        tabs.forEach(function (t) { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        document.querySelectorAll('.tab-panel').forEach(function (p) {
          p.classList.remove('active');
          p.hidden = true;
        });
        var panelId = panelIds[tabName];
        var panel = document.getElementById(panelId);
        if (panel) {
          panel.classList.add('active');
          panel.hidden = false;
        }
        if (actionsFooter) {
          actionsFooter.hidden = panelId !== 'panel-quote';
        }
      });
    });
  }

  function bindMetaMore() {
    var btn = document.getElementById('meta-more-btn');
    var details = document.getElementById('meta-more-details');
    if (!btn || !details) return;
    btn.addEventListener('click', function () {
      var open = details.hidden;
      details.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? 'Less' : 'More';
    });
  }

  function bindCollapsibleSimulator() {
    var toggle = document.getElementById('controls-panel-toggle');
    var body = document.getElementById('controls-panel-body');
    var panel = document.getElementById('controls-panel');
    if (!toggle || !body || !panel) return;
    toggle.addEventListener('click', function () {
      var expand = body.hidden;
      body.hidden = !expand;
      toggle.setAttribute('aria-expanded', expand ? 'true' : 'false');
      panel.setAttribute('data-expanded', expand ? 'true' : 'false');
    });
  }

  function getCurrentMarginPct() {
    var el = document.getElementById('summary-deal-margin');
    if (!el) return 20;
    var text = el.textContent || '';
    return parseInt(text.replace(/\D/g, ''), 10) || 20;
  }

  function getApprovalAuthority(marginPct) {
    if (marginPct >= 35) return 'Deal Desk';
    if (marginPct >= 25) return 'Geo';
    return 'Worldwide';
  }

  function updateApprovalAuthority() {
    var margin = getCurrentMarginPct();
    var who = getApprovalAuthority(margin);
    var elWho = document.getElementById('approval-current-who');
    if (elWho) elWho.textContent = who;
    document.querySelectorAll('.approval-tier').forEach(function (t) { t.classList.remove('active'); });
    var tierId = who === 'Worldwide' ? 'tier-ww' : who === 'Geo' ? 'tier-geo' : 'tier-dm';
    var tier = document.getElementById(tierId);
    if (tier) tier.classList.add('active');
  }

  function updateRecommendedSteps() {
    var margin = getCurrentMarginPct();
    var who = getApprovalAuthority(margin);
    var elDesc = document.getElementById('rec-status-desc');
    var elOverview = document.getElementById('overview-recommended');
    if (margin < 50) {
      if (elDesc) elDesc.textContent = 'Deal margin is below 50% — unhealthy. Reduce discount or SLA credits to improve margin.';
      if (elOverview) elOverview.textContent = '\u00B7 Margin unhealthy (<50%) — simulate to improve';
    } else {
      if (elDesc) elDesc.textContent = 'Current deal can be approved by ' + who + '.';
      if (elOverview) elOverview.textContent = '\u00B7 Can be approved by ' + who;
    }
  }

  function buildDealDataForCopy() {
    var totalBookings = document.getElementById('summary-total-bookings');
    var costs = document.getElementById('summary-costs');
    var dealValue = document.getElementById('summary-deal-value');
    var margin = document.getElementById('summary-deal-margin');
    var contract = document.getElementById('summary-contract-length');
    var discount = document.getElementById('summary-discount');
    var parts = [
      'Deal economics (from Service Catalog)',
      'Total bookings: ' + (totalBookings ? totalBookings.textContent : '—'),
      'Costs: ' + (costs ? costs.textContent : '—'),
      'Margin dollars: ' + (dealValue ? dealValue.textContent : '—'),
      'Deal margin: ' + (margin ? margin.textContent : '—'),
      'Contract length: ' + (contract ? contract.textContent : '—'),
      'Discount: ' + (discount ? discount.textContent : '—')
    ];
    return parts.join('\n');
  }

  function bindCopyAndActions() {
    var btnCopy = document.getElementById('btn-copy-deal-data');
    if (btnCopy) {
      btnCopy.addEventListener('click', function () {
        var text = buildDealDataForCopy();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            btnCopy.textContent = 'Copied!';
            setTimeout(function () { btnCopy.textContent = 'Copy deal information'; }, 2000);
          }).catch(function () { fallbackCopy(text, btnCopy); });
        } else {
          fallbackCopy(text, btnCopy);
        }
      });
    }
    function fallbackCopy(text, btn) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        btn.textContent = 'Copied!';
        setTimeout(function () { btn.textContent = 'Copy deal information'; }, 2000);
      } catch (e) {}
      document.body.removeChild(ta);
    }
    var btnApprove = document.getElementById('btn-approve-quote');
    if (btnApprove) {
      btnApprove.addEventListener('click', function () {
        var submitterName = getPvrSubmitterForAction();
        var msg = 'Approve quote? In SC we will store: Approval status, Discount/Margin value, and deal context. Deal context + deviation + discount will be sent to recipients via Email.';
        if (submitterName) msg += '\n\nCopy/send to: ' + submitterName;
        if (confirm(msg)) {
          var doneMsg = 'Decision stored in Service Catalog (SC). Send deal context + deviation + discount to recipients via Email. For UCPQ: open the approval email and use the link/token to update status in UCPQ.';
          if (submitterName) doneMsg = 'Recipient: ' + submitterName + '. ' + doneMsg;
          alert(doneMsg);
        }
      });
    }
  }

  function bindDecisionActions() {
    var btnApprove = document.getElementById('btn-deal-approve');
    var btnReject = document.getElementById('btn-deal-reject');
    var btnRequestUpdate = document.getElementById('btn-deal-request-update');
    var DEAL_UPLOADS_KEY = 'dealMarginUploadsByQuote';
    var commentModal = document.getElementById('decision-comment-modal');
    var commentForm = document.getElementById('decision-comment-form');
    var commentInput = document.getElementById('decision-comment-input');
    var commentCancel = document.getElementById('decision-comment-cancel');
    var commentError = document.getElementById('decision-comment-error');

    function requestDecisionComment(onSubmit) {
      if (!commentModal || !commentForm || !commentInput) {
        var fallback = window.prompt('Add comment for Sales (required):', '') || '';
        fallback = String(fallback).trim();
        if (!fallback) {
          alert('Comment is required to proceed.');
          return;
        }
        onSubmit(fallback);
        return;
      }
      commentModal.hidden = false;
      commentInput.value = '';
      if (commentError) commentError.hidden = true;
      commentInput.focus();

      function cleanup() {
        commentModal.hidden = true;
        commentForm.removeEventListener('submit', onFormSubmit);
        if (commentCancel) commentCancel.removeEventListener('click', onCancel);
        commentModal.removeEventListener('click', onOverlayClick);
      }
      function onCancel() {
        cleanup();
      }
      function onOverlayClick(e) {
        if (e.target === commentModal) cleanup();
      }
      function onFormSubmit(e) {
        e.preventDefault();
        var val = String(commentInput.value || '').trim();
        if (!val) {
          if (commentError) commentError.hidden = false;
          commentInput.focus();
          return;
        }
        cleanup();
        onSubmit(val);
      }

      if (commentCancel) commentCancel.addEventListener('click', onCancel);
      commentModal.addEventListener('click', onOverlayClick);
      commentForm.addEventListener('submit', onFormSubmit);
    }

    function persistDecisionAndReturn(decision, alertMessage, requiredComment, decisionComment) {
      var quoteId = '123';
      try {
        var params = new URLSearchParams(window.location.search || '');
        quoteId = params.get('quote') || '123';
        var raw = sessionStorage.getItem(DEAL_UPLOADS_KEY) || localStorage.getItem(DEAL_UPLOADS_KEY);
        var map = raw ? JSON.parse(raw) : {};
        var existing = map[quoteId] || { quoteId: quoteId };
        existing.dealDecision = decision;
        existing.status = decision;
        existing.marginAnalysisCompleted = true;
        existing.decisionAt = new Date().toISOString();
        if (requiredComment) {
          existing.dealDeskComment = decisionComment || '';
          existing.dealDeskCommentAt = new Date().toISOString();
        }
        map[quoteId] = existing;
        sessionStorage.setItem(DEAL_UPLOADS_KEY, JSON.stringify(map));
        localStorage.setItem(DEAL_UPLOADS_KEY, JSON.stringify(map));
      } catch (e) {}
      alert(alertMessage);
      window.location.href = 'index.html?tab=all&quote=' + encodeURIComponent(quoteId);
    }

    if (btnApprove) {
      btnApprove.addEventListener('click', function () {
        persistDecisionAndReturn('Approved', 'Your deal has been successfully approved.', false, '');
      });
    }

    if (btnRequestUpdate) {
      btnRequestUpdate.addEventListener('click', function () {
        requestDecisionComment(function (comment) {
          persistDecisionAndReturn('Request updates', 'Update request has been sent to the seller. Please provide more updates.', true, comment);
        });
      });
    }

    if (btnReject) {
      btnReject.addEventListener('click', function () {
        requestDecisionComment(function (comment) {
          persistDecisionAndReturn('Rejected', 'The deal has been rejected and the seller has been informed.', true, comment);
        });
      });
    }
  }

  function getPvrSubmitterForAction() {
    var el = document.getElementById('justification-pvr-submitter-name');
    if (!el) return null;
    var name = (el.textContent || '').trim();
    if (!name || name === '—') return null;
    return name;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function applyStoredDefaultsToSliders() {
    var sliderContract = document.getElementById('slider-contract-length');
    var sliderSla = document.getElementById('slider-sla-credits');
    var sliderDiscountRate = document.getElementById('slider-discount-rate');
    var sliderDiscountAmt = document.getElementById('slider-discount-amount');
    var sliderGmSla = document.getElementById('slider-gross-margin-sla');
    var sliderGmNoSla = document.getElementById('slider-gross-margin-no-sla');
    var sliderBreakEven = document.getElementById('slider-break-even');
    if (sliderContract) sliderContract.value = defaults.contractLength;
    if (sliderSla) sliderSla.value = defaults.slaCredits;
    if (sliderDiscountRate) sliderDiscountRate.value = clampPct(defaults.discountRate);
    if (sliderDiscountAmt) sliderDiscountAmt.value = defaults.discountAmount;
    if (sliderGmSla) sliderGmSla.value = clampPct(defaults.grossMarginSla);
    if (sliderGmNoSla) sliderGmNoSla.value = clampPct(defaults.grossMarginNoSla);
    if (sliderBreakEven) sliderBreakEven.value = defaults.breakEven;
  }

  function showEmptyState() {
    var container = document.querySelector('.page-container');
    if (!container) return;
    container.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:340px;text-align:center;padding:60px 24px;">' +
        '<svg viewBox="0 0 24 24" style="width:48px;height:48px;fill:#9ca3af;margin-bottom:16px" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>' +
        '<h2 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#374151;">No quote selected</h2>' +
        '<p style="margin:0;font-size:14px;color:#6b7280;max-width:380px;">Go to the <a href="index.html" style="color:#2563eb;text-decoration:underline;">Deal approval dashboard</a> and click on a quote to view its deal margin analysis.</p>' +
      '</div>';
  }

  function init() {
    var params = new URLSearchParams(window.location.search || '');
    if (!params.get('quote')) {
      showEmptyState();
      return;
    }

    // Always stamp hardcoded opportunity details immediately — no conditions
    (function applyHardcodedMeta() {
      var urlQuote = params.get('quote') || '42001';
      var urlOpp   = params.get('opportunity') || '3876523';
      var fields = {
        '.page-title':              'Quote ' + urlQuote,
        '#meta-quote-number':       urlQuote,
        '#meta-opportunity-id':     urlOpp,
        '#meta-opportunity-name':   'Enterprise Multi-Area',
        '#meta-sales-motion':       'Direct',
        '#meta-customer-name':      'AUMOVIO Germany GmbH',
        '#meta-partner-name':       'Not applicable',
        '#meta-distributor-name':   'Not applicable',
        '#deal-economics-opportunity-id': urlOpp
      };
      Object.keys(fields).forEach(function (sel) {
        var el = document.querySelector(sel);
        if (el) el.textContent = fields[sel];
      });
      updateSovereignTag(urlQuote);
    }());
    var hadStored = loadUploadedDealData();
    if (!hadStored) renderFeatureRequestsFromStored(null);
    if (hadStored) applyStoredDefaultsToSliders();
    (function updateJustificationBookings() {
      var el = document.getElementById('justification-proposed-bookings');
      if (!el) return;
      var totalBookings = 0;
      if (Array.isArray(annualData.bookingsUsd)) {
        annualData.bookingsUsd.forEach(function (b) { totalBookings += (b || 0); });
      }
      if (totalBookings <= 0) return; // keep hardcoded fallback when no real data
      var discountPct = clampPct(defaults.discountRate || 0);
      var proposed = totalBookings * (1 - discountPct / 100);
      el.textContent = proposed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD';
    }());
    baseAnnualData = copyAnnualData(annualData);
    originalGrossMarginSlaBaseline = clampPct((baseAnnualData.grossMarginSlaPct && baseAnnualData.grossMarginSlaPct[0]) || 0);
    originalGrossMarginNoSlaBaseline = clampPct((baseAnnualData.grossMarginNoSlaPct && baseAnnualData.grossMarginNoSlaPct[0]) || 0);
    var nBase = baseAnnualData.bookingsUsd ? baseAnnualData.bookingsUsd.length : 5;
    baseAnnualData.bom = bomCostFromBookings(baseAnnualData.bookingsUsd);
    baseAnnualData.keystoneServices = getComputedKeystoneServices(baseAnnualData.netBookings, nBase);
    var baseSla = getSlaCreditsFromFormulas(baseAnnualData.netBookings, defaults.contractLength || 60, baseAnnualData.bookingsUsd);
    baseAnnualData.slaCredits = baseSla.total;
    for (var i = 0; i < nBase; i++) baseAnnualData.discountDollar[i] = baseAnnualData.netBookings[i];
    bindPartnerIncentiveCheckbox();
    bindFormulaTooltips();
    bindExpandCollapse();
    bindSliders();
    bindViewToggle();
    bindDealViewToggle();
    bindReset();
    bindTabs();
    bindMetaMore();
    bindCollapsibleSimulator();
    renderOriginalTableAnnual();
    recomputeFromSliders();
    updateApprovalAuthority();
    updateRecommendedSteps();
    bindCopyAndActions();
    bindDecisionActions();
    if (hadStored) {
      var displayContract = document.getElementById('display-contract-length');
      var displaySla = document.getElementById('display-sla-credits');
      var displayDiscountRate = document.getElementById('display-discount-rate');
      var displayDiscountAmt = document.getElementById('display-discount-amount');
      var displayGmSla = document.getElementById('display-gross-margin-sla');
      var displayGmNoSla = document.getElementById('display-gross-margin-no-sla');
      var displayBreakEven = document.getElementById('display-break-even');
      if (displayContract) displayContract.textContent = monthsToYearsOnly(defaults.contractLength);
      if (displaySla) displaySla.textContent = formatCurrency(defaults.slaCredits);
      if (displayDiscountRate) displayDiscountRate.textContent = clampPct(defaults.discountRate) + '%';
      if (displayDiscountAmt) displayDiscountAmt.textContent = formatCurrency(defaults.discountAmount);
      if (displayGmSla) displayGmSla.textContent = clampPct(defaults.grossMarginSla) + '%';
      if (displayGmNoSla) displayGmNoSla.textContent = clampPct(defaults.grossMarginNoSla) + '%';
      if (displayBreakEven) displayBreakEven.textContent = monthsToYearsMonths(defaults.breakEven);
    }
  }
})();
