/**
 * Publishes a Console self-service subscription request into the catalog prototype so it shows up
 * as a customer request on the seller's dashboard and opens pre-filled in the sizing screen.
 *
 * The catalog is a separate vanilla-JS app under `public/catalog/` that keeps everything in
 * browser storage. The key names and value shapes below mirror exactly what `sizing.js` writes
 * when a request is submitted from `customer-sizing.html`; see `getQuoteStateForStorage` and
 * `renderRows` in `sales-quotes.js`. Change them together.
 */

/** The single opportunity every catalog quote hangs off in this prototype. */
const OPPORTUNITY_ID = '3876523';
const DEAL_UPLOADS_KEY = 'dealMarginUploadsByQuote';
const SELLER_NAME = 'Derek Keller';
/** Quote numbers in the catalog start here so they read like real Keystone quote IDs. */
const FIRST_QUOTE_ID = 42001;

export interface CatalogSellerHandoffInput {
  customerName: string;
  /** Site value matching a `deployment_location` option in the sizing page, e.g. `EU-Sovereign-Berlin`. */
  siteValue: string;
  /** Human-readable site name, used when the sizing page has no option for `siteValue` yet. */
  siteLabel: string;
  /** Subscription type value for the sizing page's dropdown, e.g. `Sovereign`. */
  subscriptionType: string;
  /** Workload tile id on the sizing page: `mission-critical`, `general-purpose` or `secondary`. */
  workloadId: string;
  capacityTib: number;
  iops: string;
  iopsUnit: string;
  latencyMs: string;
  /** Service level named the way the sizing page names it, e.g. `Unified extreme`. */
  catalogPlanName: string;
  /** Contract length in years, matching a `contract-length` radio value. */
  termYears: string;
  /** Billing cadence matching a `billing-frequency` radio value, e.g. `annually`. */
  billingValue: string;
  /** Add-on checkbox values on the sizing page, e.g. `dii`, `tiering`, `advanced-protection`. */
  addonValues: string[];
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

/** The catalog reads session storage first and local storage second, so write both. */
function writeJson(key: string, value: unknown) {
  const serialized = JSON.stringify(value);
  try {
    window.localStorage.setItem(key, serialized);
  } catch {
    /* storage unavailable — the handoff is best-effort */
  }
  try {
    window.sessionStorage.setItem(key, serialized);
  } catch {
    /* ignore */
  }
}

function nextQuoteId(): string {
  const known = [
    ...readJson<string[]>(`sizingQuotes_${OPPORTUNITY_ID}`, []),
    ...Object.keys(readJson<Record<string, unknown>>(DEAL_UPLOADS_KEY, {})),
  ];
  const highest = known.reduce((max, id) => {
    const n = parseInt(id, 10);
    return Number.isNaN(n) ? max : Math.max(max, n);
  }, FIRST_QUOTE_ID - 1);
  return String(highest + 1);
}

/**
 * Builds the sizing page's saved-quote shape. Everything the seller can still change is left at
 * the sizing page's own defaults so only the customer's choices come through pre-filled.
 */
function buildQuoteState(input: CatalogSellerHandoffInput) {
  return {
    contractLengthValue: input.termYears,
    customContractData: null,
    billingValue: input.billingValue,
    customBilling: null,
    sidebarDeviationValue: '',
    quoteItems: [],
    planConfigs: {},
    burstByPlan: {},
    workloadConfigs: {
      [input.workloadId]: {
        capacity: String(input.capacityTib),
        iops: input.iops,
        iopsUnit: input.iopsUnit,
        latency: input.latencyMs,
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
        selectedPlan: input.catalogPlanName,
        selectedPlanCost: null,
        manualPlanOverride: true,
        suggestedCapacity: '',
        requestedCapacity: '',
      },
    },
    appliedDiscountPct: 0,
    discountRateInput: '0',
    currency: 'USD',
    autoRenew: 'yes',
    autoRenewDuration: '12',
    deploymentLocation: input.siteValue,
    deploymentLocationLabel: input.siteLabel,
    subscriptionType: input.subscriptionType,
    billToAddress: '',
    shipToAddress: '',
    selectedWorkloadIds: [input.workloadId],
    requestedDeviations: [],
    selectedAddons: input.addonValues,
    adpAnnualCost: 0,
    dataTieringTiB: input.addonValues.includes('tiering') ? input.capacityTib : 0,
    diiAnnualCost: 0,
    clusterJoinSelected: false,
  };
}

/**
 * Writes the request into catalog storage and returns the generated quote number, or `null` if
 * browser storage is unavailable.
 */
export function publishRequestToSellerDashboard(
  input: CatalogSellerHandoffInput,
): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const quoteId = nextQuoteId();
    const quoteName = `Customer request ${quoteId} \u2013 ${input.customerName}`;

    writeJson(`sizingQuoteState_${quoteId}`, buildQuoteState(input));

    const quoteIds = readJson<string[]>(`sizingQuotes_${OPPORTUNITY_ID}`, []);
    if (!quoteIds.includes(quoteId)) quoteIds.push(quoteId);
    writeJson(`sizingQuotes_${OPPORTUNITY_ID}`, quoteIds);

    const quoteNames = readJson<Record<string, string>>(`sizingQuoteNames_${OPPORTUNITY_ID}`, {});
    quoteNames[quoteId] = quoteName;
    writeJson(`sizingQuoteNames_${OPPORTUNITY_ID}`, quoteNames);

    const uploads = readJson<Record<string, unknown>>(DEAL_UPLOADS_KEY, {});
    uploads[quoteId] = {
      quoteId,
      quoteName,
      uploadedAt: new Date().toISOString(),
      customerName: input.customerName,
      opportunityId: OPPORTUNITY_ID,
      assignedTo: SELLER_NAME,
      assignedFor: 'sales',
      customerSubmitted: true,
      subscriptionType: input.subscriptionType,
      siteLocation: input.siteLabel,
    };
    writeJson(DEAL_UPLOADS_KEY, uploads);

    return quoteId;
  } catch {
    return null;
  }
}
