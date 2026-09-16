import {
  type Subscription,
  type HardwareNode,
  getSubscriptionById,
  formatSubscriptionCompact,
  formatSubscriptionIdentity,
  mockHardwareNodes,
  mockSubscriptions,
  seededFraction,
} from './mockData';
import { shiftDatesDeep } from './dateShift';

export function formatServiceLevels(sub: Subscription): string {
  return sub.serviceLevels.join(', ');
}

/**
 * A single milestone in a request's lifecycle tracker (mirrors the shape used by the
 * "Subscriptions in Activation" tracker so Modify/Renew requests can reuse the same UI).
 */
export interface RequestTrackerStage {
  name: string;
  status: 'completed' | 'in-progress' | 'pending';
  completedDate?: string;
  estimatedDate?: string;
  details?: string;
}

export const MODIFICATION_TRACKER_STAGE_NAMES = [
  'Request Submitted',
  'Technical Review',
  'Approval',
  'Implementation',
  'Completed',
] as const;

export const RENEWAL_TRACKER_STAGE_NAMES = [
  'Request Submitted',
  'Commercial Review',
  'Approval',
  'Contract Execution',
  'Completed',
] as const;

export const CAPACITY_INCREASE_TRACKER_STAGE_NAMES = [
  'Request Submitted',
  'Technical Review',
  'Approval',
  'Provisioning',
  'Completed',
] as const;

export const SERVICE_LEVEL_CHANGE_TRACKER_STAGE_NAMES = [
  'Request Submitted',
  'Technical Review',
  'Approval',
  'Implementation',
  'Completed',
] as const;

export const NEW_SUBSCRIPTION_TRACKER_STAGE_NAMES = [
  'Request Submitted',
  'Sizing & Validation',
  'Quote & Approval',
  'Provisioning',
  'Completed',
] as const;

const MODIFICATION_STAGE_DETAILS: Record<string, string> = {
  'Request Submitted': 'Modification request submitted and queued for review.',
  'Technical Review': 'Operations team reviewing capacity changes and rollback plan.',
  Approval: 'Change approved; scheduling implementation window.',
  Implementation: 'Configuration change being applied to the subscription.',
  Completed: 'Modification completed and subscription updated.',
};

const RENEWAL_STAGE_DETAILS: Record<string, string> = {
  'Request Submitted': 'Renewal request submitted.',
  'Commercial Review': 'Finance team reviewing commercial terms and billing details.',
  Approval: 'Renewal terms approved.',
  'Contract Execution': 'Contract documents being finalized and executed.',
  Completed: 'Subscription renewed successfully.',
};

const CAPACITY_INCREASE_STAGE_DETAILS: Record<string, string> = {
  'Request Submitted': 'Capacity increase request submitted and queued for review.',
  'Technical Review': 'Operations team validating capacity availability and impact.',
  Approval: 'Capacity increase approved; scheduling provisioning.',
  Provisioning: 'Additional committed capacity being provisioned on the subscription.',
  Completed: 'Capacity increase completed and subscription updated.',
};

const NEW_SUBSCRIPTION_STAGE_DETAILS: Record<string, string> = {
  'Request Submitted': 'Subscription request submitted and routed to Derek Keller.',
  'Sizing & Validation': 'Derek Keller validating workload sizing and capacity at the selected site.',
  'Quote & Approval': 'Commercial terms being prepared and approved.',
  Provisioning: 'Hardware allocated and the subscription being provisioned.',
  Completed: 'Subscription activated and available in the console.',
};

const SERVICE_LEVEL_CHANGE_STAGE_DETAILS: Record<string, string> = {
  'Request Submitted': 'Service level change request submitted and queued for review.',
  'Technical Review': 'Technical team reviewing affected volumes and implementation window.',
  Approval: 'Service level change approved; scheduling implementation.',
  Implementation: 'Volumes being migrated to the new service level.',
  Completed: 'Service level change completed and volumes updated.',
};

function parseIsoDateLocal(dateIso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateIso);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(dateIso);
}

function addDaysIso(dateIso: string, days: number): string {
  const d = parseIsoDateLocal(dateIso);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

/**
 * Builds a tracker timeline for a Modify/Renew request. `activeIndex` is the 0-based stage
 * currently in progress; pass `stageNames.length` (or greater) once every stage is done.
 */
export function buildRequestTrackerStages(
  stageNames: readonly string[],
  activeIndex: number,
  requestDateIso: string,
  detailsByName: Record<string, string>,
  daysBetweenStages = 3,
): RequestTrackerStage[] {
  return stageNames.map((name, i) => {
    const details = detailsByName[name];
    const stageDate = addDaysIso(requestDateIso, i * daysBetweenStages);
    if (i < activeIndex) {
      return { name, status: 'completed', completedDate: stageDate, details };
    }
    if (i === activeIndex) {
      return { name, status: 'in-progress', estimatedDate: stageDate, details };
    }
    return { name, status: 'pending', estimatedDate: stageDate, details };
  });
}

export function buildModificationTrackerStages(
  activeIndex: number,
  requestDateIso: string,
): RequestTrackerStage[] {
  return buildRequestTrackerStages(
    MODIFICATION_TRACKER_STAGE_NAMES,
    activeIndex,
    requestDateIso,
    MODIFICATION_STAGE_DETAILS,
  );
}

export function buildRenewalTrackerStages(
  activeIndex: number,
  requestDateIso: string,
): RequestTrackerStage[] {
  return buildRequestTrackerStages(RENEWAL_TRACKER_STAGE_NAMES, activeIndex, requestDateIso, RENEWAL_STAGE_DETAILS);
}

export function buildNewSubscriptionTrackerStages(
  activeIndex: number,
  requestDateIso: string,
): RequestTrackerStage[] {
  return buildRequestTrackerStages(
    NEW_SUBSCRIPTION_TRACKER_STAGE_NAMES,
    activeIndex,
    requestDateIso,
    NEW_SUBSCRIPTION_STAGE_DETAILS,
    14,
  );
}

export function buildCapacityIncreaseTrackerStages(
  activeIndex: number,
  requestDateIso: string,
): RequestTrackerStage[] {
  return buildRequestTrackerStages(
    CAPACITY_INCREASE_TRACKER_STAGE_NAMES,
    activeIndex,
    requestDateIso,
    CAPACITY_INCREASE_STAGE_DETAILS,
  );
}

export function buildServiceLevelChangeTrackerStages(
  activeIndex: number,
  requestDateIso: string,
): RequestTrackerStage[] {
  return buildRequestTrackerStages(
    SERVICE_LEVEL_CHANGE_TRACKER_STAGE_NAMES,
    activeIndex,
    requestDateIso,
    SERVICE_LEVEL_CHANGE_STAGE_DETAILS,
  );
}

export type ConsoleServiceRequest =
  | {
      id: string;
      /** No subscription exists yet, so this carries the pending tracking id instead. */
      subscriptionId: string;
      type: 'New Subscription';
      requestedBy: string;
      requestDate: string;
      status: string;
      priority: string;
      assignedTo: string;
      lastUpdated: string;
      siteLocation: string;
      subscriptionType: string;
      workload: string;
      serviceLevel: string;
      committedCapacity: string;
      /** Requested IOPS and max latency, e.g. "1M IOPS · 1 ms max latency". */
      performanceProfile: string;
      termLength: string;
      billingFrequency: string;
      addOns: string;
      estimatedCost: string;
      businessJustification: string;
      stages?: RequestTrackerStage[];
    }
  | {
      id: string;
      subscriptionId: string;
      type: 'Capacity Increase';
      requestedBy: string;
      requestDate: string;
      status: string;
      priority: string;
      assignedTo: string;
      lastUpdated: string;
      currentCommit: string;
      requestedCommit: string;
      estimatedCost: string;
      justification: string;
      stages?: RequestTrackerStage[];
    }
  | {
      id: string;
      subscriptionId: string;
      type: 'Renewal';
      requestedBy: string;
      requestDate: string;
      status: string;
      priority: string;
      assignedTo: string;
      lastUpdated: string;
      currentTerm: string;
      requestedTerm: string;
      expirationDate: string;
      estimatedCost: string;
      renewalNotes: string;
      billingContact: string;
      stages?: RequestTrackerStage[];
    }
  | {
      id: string;
      subscriptionId: string;
      type: 'Service Level Change';
      requestedBy: string;
      requestDate: string;
      status: string;
      priority: string;
      assignedTo: string;
      lastUpdated: string;
      currentServiceLevel: string;
      requestedServiceLevel: string;
      affectedVolumes: string;
      estimatedCost: string;
      businessJustification: string;
      implementationWindow: string;
      stages?: RequestTrackerStage[];
    }
  | {
      id: string;
      subscriptionId: string;
      type: 'Modification';
      requestedBy: string;
      requestDate: string;
      status: string;
      priority: string;
      assignedTo: string;
      lastUpdated: string;
      modification: string;
      modificationScope: string;
      configurationChangeDetail: string;
      estimatedCost: string;
      implementationDate: string;
      rollbackPlan: string;
      stages?: RequestTrackerStage[];
    };

/** A service request (of any type) that has a populated tracker timeline. */
export type TrackableServiceRequest = ConsoleServiceRequest & {
  stages: RequestTrackerStage[];
};

/** Every service request type is trackable once it has a populated `stages` timeline. */
export function serviceRequestHasTracker(
  request: ConsoleServiceRequest,
): request is TrackableServiceRequest {
  return Boolean(request.stages?.length);
}

/** Generates the next sequential SR id given the current list (prototype-only; not collision-proof across sessions). */
export function nextServiceRequestId(existing: ConsoleServiceRequest[]): string {
  const year = new Date().getFullYear();
  const maxSeq = existing.reduce((max, r) => {
    const m = /^SR-\d{4}-(\d+)$/.exec(r.id);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  return `SR-${year}-${String(maxSeq + 1).padStart(3, '0')}`;
}

const rawMockConsoleServiceRequests: ConsoleServiceRequest[] = [
  {
    id: 'SR-2024-001',
    subscriptionId: '1789858603',
    type: 'Capacity Increase',
    requestedBy: 'John Smith',
    requestDate: '2026-02-01',
    status: 'In Review',
    priority: 'High',
    assignedTo: 'NetApp Account Team',
    lastUpdated: '2 days ago',
    currentCommit: '500 TiB',
    requestedCommit: '700 TiB',
    estimatedCost: '$22,000/month additional',
    justification: 'Unexpected growth in VDI workloads requiring additional capacity',
    stages: buildCapacityIncreaseTrackerStages(1, '2026-02-01'),
  },
  {
    id: 'SR-2024-002',
    subscriptionId: '1789858600',
    type: 'Renewal',
    requestedBy: 'Sarah Johnson',
    requestDate: '2026-01-25',
    status: 'Pending Approval',
    priority: 'Medium',
    assignedTo: 'Finance Team',
    lastUpdated: '5 days ago',
    currentTerm: '3 years',
    requestedTerm: '3 years',
    expirationDate: '2026-05-15',
    estimatedCost: '$1.2M (3-year term)',
    renewalNotes:
      'Customer requests unchanged commercial terms with option to add Premium tier mid-term. Legal review of data residency addendum in progress.',
    billingContact: 'finance@acme.example.com',
    stages: buildRenewalTrackerStages(2, '2026-01-25'),
  },
  {
    id: 'SR-2024-003',
    subscriptionId: '1789858601',
    type: 'Service Level Change',
    requestedBy: 'Mike Chen',
    requestDate: '2026-01-15',
    status: 'In Progress',
    priority: 'Low',
    assignedTo: 'Technical Team',
    lastUpdated: '1 week ago',
    currentServiceLevel: 'Performance',
    requestedServiceLevel: 'Premium',
    affectedVolumes: '12 volumes (450 TiB)',
    estimatedCost: '$8,500/month additional',
    businessJustification:
      'Analytics workloads require higher snapshot efficiency and lower latency SLOs for quarter-end reporting.',
    implementationWindow: '2026-02-22 02:00–06:00 UTC (maintenance window)',
    stages: buildServiceLevelChangeTrackerStages(3, '2026-01-15'),
  },
  {
    id: 'SR-2024-004',
    subscriptionId: '1789858602',
    type: 'Modification',
    requestedBy: 'Emily Davis',
    requestDate: '2026-02-05',
    status: 'Approved',
    priority: 'High',
    assignedTo: 'Implementation Team',
    lastUpdated: '1 day ago',
    modification: 'Add File service tier',
    modificationScope: 'APAC production estate (2 clusters, 8 SVMs)',
    configurationChangeDetail:
      'Enable File tier on Performance pool; align QoS policies with existing Block workloads; peer SVM for DR copy.',
    estimatedCost: '$15,000/month',
    implementationDate: '2026-02-15',
    rollbackPlan: 'Revert SVM parameters from change ticket CK-88421; estimated rollback under 45 minutes.',
    stages: buildModificationTrackerStages(3, '2026-02-05'),
  },
];

/** Timeline-shifted so every request/tracker date stays anchored around "today" — see `dateShift.ts`. */
export const mockConsoleServiceRequests: ConsoleServiceRequest[] = rawMockConsoleServiceRequests.map(shiftDatesDeep);

export interface ConsoleSupportCaseComment {
  author: string;
  time: string;
  text: string;
}

export interface ConsoleSupportCase {
  caseId: string;
  subscriptionId: string;
  title: string;
  priority: string;
  status: string;
  opened: string;
  assignedTo: string;
  slaRemaining: string;
  description: string;
  affectedSystems: string;
  lastUpdate: string;
  comments: ConsoleSupportCaseComment[];
}

const rawMockConsoleSupportCases: ConsoleSupportCase[] = [
  {
    caseId: 'CS-2401',
    subscriptionId: '1789858603',
    title: 'High latency during replication events',
    priority: 'P1',
    status: 'In Progress',
    opened: '2026-02-08 10:30 AM',
    assignedTo: 'NetApp Support Engineer - David Wilson',
    slaRemaining: '2h 15m',
    description:
      'Experiencing high latency (>50ms) during SnapMirror replication windows affecting production workloads.',
    affectedSystems: 'sfo-prod-cluster-01, sfo-prod-cluster-02',
    lastUpdate: '30 minutes ago',
    comments: [
      {
        author: 'John Smith',
        time: '2026-02-08 10:30 AM',
        text: "We're seeing latency spikes up to 80ms during our replication windows. This is affecting our production VMs.",
      },
      {
        author: 'David Wilson (NetApp Support)',
        time: '2026-02-08 11:15 AM',
        text: "I've reviewed the AutoSupport data. The latency spikes correlate with QoS throttling on the source volume. Let me check the QoS policies.",
      },
      {
        author: 'David Wilson (NetApp Support)',
        time: '2026-02-08 12:00 PM',
        text: 'Found the issue - QoS max throughput set too low for the replication window. Proposing to adjust from 100MB/s to 250MB/s. Can you approve?',
      },
    ],
  },
  {
    caseId: 'CS-2398',
    subscriptionId: '1789858600',
    title: 'Snapshot creation failing on volume prod_db_01',
    priority: 'P2',
    status: 'Waiting on Customer',
    opened: '2026-02-07 2:15 PM',
    assignedTo: 'NetApp Support Engineer - Lisa Chen',
    slaRemaining: '18h 45m',
    description: 'Scheduled snapshots are failing with error "insufficient space". Volume shows 75% used.',
    affectedSystems: 'nyc-dr-cluster-01',
    lastUpdate: '4 hours ago',
    comments: [
      {
        author: 'Sarah Johnson',
        time: '2026-02-07 2:15 PM',
        text: 'Our backup snapshots started failing yesterday. Getting error about insufficient space but volume is only 75% full.',
      },
      {
        author: 'Lisa Chen (NetApp Support)',
        time: '2026-02-07 3:00 PM',
        text: 'The issue is snapshot reserve is full. Your volume has 75% data but snapshot reserve (5%) is exhausted. You have 200+ snapshots. Can you review retention policy?',
      },
    ],
  },
  {
    caseId: 'CS-2395',
    subscriptionId: '1789858601',
    title: 'Performance degradation after ONTAP upgrade',
    priority: 'P2',
    status: 'Resolved',
    opened: '2026-02-05 9:00 AM',
    assignedTo: 'NetApp Support Engineer - Robert Taylor',
    slaRemaining: 'SLA Met',
    description: 'After upgrading from ONTAP 9.13.1 to 9.14.1, seeing 20% performance degradation.',
    affectedSystems: 'lon-backup-cluster-01',
    lastUpdate: '2 days ago',
    comments: [
      {
        author: 'Mike Chen',
        time: '2026-02-05 9:00 AM',
        text: 'Performance dropped significantly after the upgrade. IOPS down from 50K to 40K.',
      },
      {
        author: 'Robert Taylor (NetApp Support)',
        time: '2026-02-05 10:30 AM',
        text: "Checking for known issues with 9.14.1... Found it. There's a QoS bug in 9.14.1 that affects certain workload types. Patch available in 9.14.1P1.",
      },
      {
        author: 'Robert Taylor (NetApp Support)',
        time: '2026-02-06 2:00 PM',
        text: 'Upgrade to 9.14.1P1 completed. Performance restored to baseline. Case resolved.',
      },
    ],
  },
];

/** Timeline-shifted so every case/comment timestamp stays anchored around "today" — see `dateShift.ts`. */
export const mockConsoleSupportCases: ConsoleSupportCase[] = rawMockConsoleSupportCases.map(shiftDatesDeep);

export interface ConsoleActiveAlert {
  id: string;
  severity: 'Critical' | 'Warning' | 'Info';
  category: string;
  title: string;
  description: string;
  affectedResource: string;
  /** When null, alert spans multiple subscriptions (see `multiSubscriptionLabel`). */
  subscriptionId: string | null;
  multiSubscriptionLabel?: string;
  firstDetected: string;
  lastOccurrence: string;
  occurrences: number;
  status: string;
  actionTaken?: string;
  recommended?: string;
  slaRemaining?: string;
  currentUsage?: string;
  projectedUsage?: string;
  affectedDrives?: string;
  potentialSavings?: string;
  impact?: string;
  /** When set, a support case already exists — "Create Support Case" should be disabled. */
  linkedSupportCaseId?: string;
  supportCaseStatus?: string;
}

const rawMockConsoleActiveAlerts: ConsoleActiveAlert[] = [
  {
    id: 'alt-001',
    severity: 'Critical',
    category: 'Security',
    title: 'ARP detected abnormal activity',
    description:
      'Anti-Ransomware Protection has detected unusual file extension changes and rapid file modifications on volume sfo_prod_vol_03.',
    affectedResource: 'sfo-prod-cluster-02 / sfo_prod_vol_03',
    subscriptionId: '1789858603',
    firstDetected: '2026-02-08 10:15 AM',
    lastOccurrence: '2026-02-08 10:30 AM',
    occurrences: 3,
    status: 'Active',
    actionTaken: 'Snapshot anti_ransomware_backup_2026-02-08 created automatically',
    recommended: 'Investigate file activity, verify with application owners, and review snapshot for recovery',
  },
  {
    id: 'alt-002',
    severity: 'Critical',
    category: 'Support',
    title: 'P1 case assigned: High latency detected',
    description:
      'Support case CS-2401 has been assigned. Node reporting high latency during replication events.',
    affectedResource: 'sfo-prod-cluster-01 / node-01',
    subscriptionId: '1789858603',
    firstDetected: '2026-02-08 10:30 AM',
    lastOccurrence: '2026-02-08 10:30 AM',
    occurrences: 1,
    status: 'Active',
    slaRemaining: '2h 15m',
    recommended: 'Monitor case progress. NetApp Support Engineer assigned.',
    linkedSupportCaseId: 'CS-2401',
    supportCaseStatus: 'In Progress',
  },
  {
    id: 'alt-003',
    severity: 'Warning',
    category: 'Capacity',
    title: 'Forecast: 30-day commit breach likely',
    description:
      'Based on current growth trajectory, there is a 35% probability of exceeding committed capacity within 30 days.',
    affectedResource: 'Subscription capacity pool',
    subscriptionId: '1789858603',
    firstDetected: '2026-02-08 08:00 AM',
    lastOccurrence: '2026-02-08 08:00 AM',
    occurrences: 1,
    status: 'Active',
    currentUsage: '4,045 TiB (87.9%)',
    projectedUsage: '4,850 TiB (105.4%) in 30 days',
    recommended: 'Consider capacity increase or workload optimization',
  },
  {
    id: 'alt-004',
    severity: 'Warning',
    category: 'Compliance',
    title: 'Disk firmware outdated',
    description: '588 drives require firmware update to address security vulnerability CFDISK-1409.',
    affectedResource: 'Multiple clusters',
    subscriptionId: null,
    multiSubscriptionLabel: 'Multiple subscriptions',
    firstDetected: '2026-02-07 12:00 PM',
    lastOccurrence: '2026-02-07 12:00 PM',
    occurrences: 1,
    status: 'Active',
    affectedDrives: '588 drives across 12 nodes',
    recommended: 'Schedule maintenance window for firmware update',
  },
  {
    id: 'alt-005',
    severity: 'Info',
    category: 'Recommendation',
    title: 'High-impact optimization available',
    description: 'Volume tiering to cloud can reduce costs by $8,500/month for underutilized data.',
    affectedResource: 'nyc-dr-cluster-01 / multiple volumes',
    subscriptionId: '1789858600',
    firstDetected: '2026-02-06 09:00 AM',
    lastOccurrence: '2026-02-06 09:00 AM',
    occurrences: 1,
    status: 'Active',
    potentialSavings: '$8,500/month',
    recommended: 'Review volumes and enable FabricPool tiering',
  },
  {
    id: 'alt-006',
    severity: 'Warning',
    category: 'Infrastructure',
    title: 'Collector agent offline',
    description: 'Collection agent collector-ap-south-01 has not reported heartbeat for 2 hours.',
    affectedResource: 'collector-ap-south-01 (Singapore DC)',
    subscriptionId: '1789858608',
    firstDetected: '2026-02-08 09:00 AM',
    lastOccurrence: '2026-02-08 11:00 AM',
    occurrences: 1,
    status: 'Active',
    impact: 'Monitoring data for 1 cluster (18 volumes) unavailable',
    recommended: 'Check agent connectivity and restart if necessary',
  },
  {
    id: 'alt-007',
    severity: 'Critical',
    category: 'Infrastructure',
    title: 'Missing ASUP data',
    description: 'StorageGRID-Site-A has not reported for over 24 hours.',
    affectedResource: 'StorageGRID-Site-A',
    subscriptionId: '1789858607',
    firstDetected: '2026-02-08 08:00 AM',
    lastOccurrence: '2026-02-08 08:00 AM',
    occurrences: 1,
    status: 'Active',
    recommended: 'Verify delegated collector credentials and site connectivity.',
  },
  {
    id: 'alt-008',
    severity: 'Warning',
    category: 'Infrastructure',
    title: 'Agent in degraded mode',
    description: 'ONTAP-Cluster-01 is collecting only capacity data; run agent connectivity diagnostics.',
    affectedResource: 'ONTAP-Cluster-01',
    subscriptionId: '1789858603',
    firstDetected: '2026-02-08 06:00 AM',
    lastOccurrence: '2026-02-08 06:00 AM',
    occurrences: 1,
    status: 'Active',
    recommended: 'Check agent logs and firewall rules for ASUP endpoints.',
  },
  {
    id: 'alt-009',
    severity: 'Warning',
    category: 'Infrastructure',
    title: 'Partial node coverage',
    description: 'Two nodes not reporting in ONTAP-Cluster-01. Check node health.',
    affectedResource: 'ONTAP-Cluster-01',
    subscriptionId: '1789858603',
    firstDetected: '2026-02-07 10:00 AM',
    lastOccurrence: '2026-02-08 07:00 AM',
    occurrences: 2,
    status: 'Active',
    recommended: 'Validate node management LIFs and SNMP/HTTPS reachability.',
  },
];

/** Timeline-shifted so every alert timestamp stays anchored around "today" — see `dateShift.ts`. */
export const mockConsoleActiveAlerts: ConsoleActiveAlert[] = rawMockConsoleActiveAlerts.map(shiftDatesDeep);

export interface ConsoleAlertMonitor {
  id: number;
  name: string;
  type: string;
  condition: string;
  enabled: boolean;
  subscriptionIds: 'all' | string[];
  severity: string;
  notifications: string;
  lastTriggered: string;
  triggerCount: number;
}

const rawMockConsoleAlertMonitors: ConsoleAlertMonitor[] = [
  {
    id: 1,
    name: 'Capacity Threshold - Critical',
    type: 'Capacity',
    condition: 'Usage > 95% of committed',
    enabled: true,
    subscriptionIds: 'all',
    severity: 'Critical',
    notifications: 'Email, SMS',
    lastTriggered: '2026-02-01 14:30 PM',
    triggerCount: 3,
  },
  {
    id: 2,
    name: 'Capacity Threshold - Warning',
    type: 'Capacity',
    condition: 'Usage > 85% of committed',
    enabled: true,
    subscriptionIds: 'all',
    severity: 'Warning',
    notifications: 'Email',
    lastTriggered: '2026-02-08 08:00 AM',
    triggerCount: 12,
  },
  {
    id: 3,
    name: 'SLA Breach Detection',
    type: 'Performance',
    condition: 'Latency > SLA threshold for 15 minutes',
    enabled: true,
    subscriptionIds: ['1789858603', '1789858600'],
    severity: 'Critical',
    notifications: 'Email, SMS, Webhook',
    lastTriggered: '2026-02-08 10:30 AM',
    triggerCount: 2,
  },
  {
    id: 4,
    name: 'Anti-Ransomware Detection',
    type: 'Security',
    condition: 'ARP detects abnormal activity',
    enabled: true,
    subscriptionIds: 'all',
    severity: 'Critical',
    notifications: 'Email, SMS, Webhook',
    lastTriggered: '2026-02-08 10:15 AM',
    triggerCount: 1,
  },
  {
    id: 5,
    name: 'Collector Health',
    type: 'Infrastructure',
    condition: 'No heartbeat for 30 minutes',
    enabled: true,
    subscriptionIds: 'all',
    severity: 'Warning',
    notifications: 'Email',
    lastTriggered: '2026-02-08 09:00 AM',
    triggerCount: 1,
  },
  {
    id: 6,
    name: 'Firmware Currency',
    type: 'Compliance',
    condition: 'Firmware version outdated',
    enabled: true,
    subscriptionIds: 'all',
    severity: 'Warning',
    notifications: 'Email',
    lastTriggered: '2026-02-07 12:00 PM',
    triggerCount: 1,
  },
  {
    id: 7,
    name: 'Burst Mode Extended',
    type: 'Capacity',
    condition: 'In burst mode for > 7 days',
    enabled: true,
    subscriptionIds: 'all',
    severity: 'Warning',
    notifications: 'Email',
    lastTriggered: '2026-02-05 09:00 AM',
    triggerCount: 2,
  },
  {
    id: 8,
    name: 'Volume Growth Anomaly',
    type: 'Capacity',
    condition: 'Growth rate > 15%/month',
    enabled: false,
    subscriptionIds: 'all',
    severity: 'Info',
    notifications: 'Email',
    lastTriggered: 'Never',
    triggerCount: 0,
  },
];

/** Timeline-shifted so every monitor's last-triggered timestamp stays anchored around "today". */
export const mockConsoleAlertMonitors: ConsoleAlertMonitor[] = rawMockConsoleAlertMonitors.map(shiftDatesDeep);

export function formatMonitorSubscriptionScope(ids: ConsoleAlertMonitor['subscriptionIds']): string {
  if (ids === 'all') return 'All';
  return ids
    .map((id) => {
      const s = getSubscriptionById(id);
      return s ? formatSubscriptionCompact(s) : id;
    })
    .join(', ');
}

/**
 * Keystone collects platform metadata two ways, and the two are structured very differently:
 *
 *  - **Keystone Agent** (collector): many-to-many with subscriptions/nodes. A regional collector
 *    VM streams real-time **usage + performance** telemetry for a pool of nodes; that pool can span
 *    multiple subscriptions, and a subscription's nodes can be split across more than one collector.
 *  - **AutoSupport / ASUP**: one-to-one with a single node. It is a once-daily, point-in-time
 *    capacity snapshot used for billing/capacity verification — no real-time or performance data.
 *
 * Both are generated from `mockHardwareNodes` so Metadata Collection stays consistent with Assets.
 */
export type MetadataCollectionStatus = 'Healthy' | 'Degraded' | 'At risk' | 'Critical';

export interface ConsoleKnowledgeBaseArticle {
  id: string;
  title: string;
}

export interface ConsoleKeystoneAgentCollector {
  id: string;
  name: string;
  region: string;
  status: MetadataCollectionStatus;
  lastTransfer: string;
  /** Node ids this collector instance streams telemetry for — many-to-many across subscriptions. */
  nodeIds: string[];
  summary: string;
  detectedAt?: string;
  whatWentWrong?: string;
  evidence?: string[];
  recommendedSteps?: string[];
  kbArticle?: ConsoleKnowledgeBaseArticle;
}

export interface ConsoleAsupRecord {
  id: string;
  nodeId: string;
  nodeName: string;
  clusterName: string;
  subscriptionId: string;
  status: MetadataCollectionStatus;
  lastTransfer: string;
  summary: string;
  detectedAt?: string;
  whatWentWrong?: string;
  evidence?: string[];
  recommendedSteps?: string[];
  kbArticle?: ConsoleKnowledgeBaseArticle;
}

const REGION_DC_CODE: Record<string, string> = {
  'US-East': 'iad',
  'US-West': 'sjc',
  'US-Central': 'dfw',
  'EU-West': 'lon',
  'EU-Central': 'fra',
  APAC: 'syd',
};

function getHardwareNodeById(nodeId: string): HardwareNode | undefined {
  return mockHardwareNodes.find((n) => n.id === nodeId);
}

function nodeRegion(node: HardwareNode): string {
  return getSubscriptionById(node.subscriptionId)?.region ?? 'Unknown';
}

/** Groups nodes into 1-2 regional collector "hubs" per region (2 when the region has >=2 subscriptions),
 * then round-robins nodes across the hubs — producing genuine node-level many-to-many coverage. */
function buildKeystoneAgentCollectors(): ConsoleKeystoneAgentCollector[] {
  const nodesByRegion = new Map<string, HardwareNode[]>();
  for (const node of mockHardwareNodes) {
    const region = nodeRegion(node);
    const list = nodesByRegion.get(region) ?? [];
    list.push(node);
    nodesByRegion.set(region, list);
  }

  const collectors: ConsoleKeystoneAgentCollector[] = [];

  for (const [region, nodes] of nodesByRegion) {
    const subscriptionCount = new Set(nodes.map((n) => n.subscriptionId)).size;
    const hubCount = subscriptionCount >= 2 ? 2 : 1;
    const dc = REGION_DC_CODE[region] ?? 'reg';

    const byHub: HardwareNode[][] = Array.from({ length: hubCount }, () => []);
    nodes.forEach((node, i) => {
      byHub[i % hubCount].push(node);
    });

    byHub.forEach((hubNodes, hubIdx) => {
      if (hubNodes.length === 0) return;
      const id = `ks-agent-${dc}${String(hubIdx + 1).padStart(2, '0')}`;
      collectors.push({
        id,
        name: id,
        region,
        status: 'Healthy',
        lastTransfer: '2 mins ago',
        nodeIds: hubNodes.map((n) => n.id),
        summary: 'Connected, streaming all nodes.',
      });
    });
  }

  return collectors;
}

function buildAsupRecords(): ConsoleAsupRecord[] {
  return mockHardwareNodes.map((node) => ({
    id: `asup-${node.id}`,
    nodeId: node.id,
    nodeName: node.name,
    clusterName: node.clusterName,
    subscriptionId: node.subscriptionId,
    status: 'Healthy' as MetadataCollectionStatus,
    lastTransfer: `${1 + Math.round(seededFraction(`${node.id}-asup-hrs`) * 5)} hours ago`,
    summary: 'Payload parsed successfully.',
  }));
}

/** Curated issue states — kept on the same subscriptions already flagged in Active Alerts
 * (1789858608: "Collector agent offline", 1789858603: "Agent in degraded mode" / "Partial node
 * coverage", 1789858607: "Missing ASUP data") so the whole console tells one consistent story. */
function applyCollectorIssues(collectors: ConsoleKeystoneAgentCollector[]): ConsoleKeystoneAgentCollector[] {
  const findByCoveredSubscription = (subscriptionId: string) =>
    collectors.find((c) =>
      c.nodeIds.some((nid) => getHardwareNodeById(nid)?.subscriptionId === subscriptionId),
    );

  const atRisk = findByCoveredSubscription('1789858608');
  if (atRisk) {
    atRisk.status = 'At risk';
    atRisk.lastTransfer = '3 hours ago';
    atRisk.summary = 'Collector VM stopped sending data 3 hours ago.';
    atRisk.detectedAt = '2026-04-06 06:18 UTC';
    atRisk.whatWentWrong =
      'The Keystone collector VM stopped sending data 3 hours ago. All nodes assigned to this collector have lost live usage and performance telemetry.';
    atRisk.evidence = [
      `No heartbeat from ${atRisk.name} for 184 minutes (threshold: 5 minutes)`,
      'Last known state: agent service stopped responding after a host reboot',
      'Outbound TCP 443 to keystone-ingest.netapp.com is closed from the collector VM',
    ];
    atRisk.recommendedSteps = [
      'Verify the collector VM is powered on and reachable',
      `Restart the keystone-agent service on ${atRisk.name}`,
      'If restart fails, redeploy the collector using the KB procedure',
    ];
    atRisk.kbArticle = { id: 'KB-2087901', title: 'Keystone collector goes offline after host reboot' };
  }

  const degraded = findByCoveredSubscription('1789858603');
  if (degraded && degraded !== atRisk) {
    degraded.status = 'Degraded';
    degraded.lastTransfer = '38 mins ago';
    degraded.summary = 'Collecting capacity data only — performance telemetry degraded.';
    degraded.detectedAt = '2026-04-06 05:40 UTC';
    degraded.whatWentWrong =
      'Two of the nodes covered by this collector are not reporting performance counters; only capacity/usage is being received.';
    degraded.evidence = [
      '2 covered nodes have not reported a performance sample in over 6 hours',
      'AutoSupport capacity data for the same nodes is current, so billing is not impacted',
      'Collector logs show repeated timeouts polling the ONTAP performance API on the affected nodes',
    ];
    degraded.recommendedSteps = [
      'Validate management LIF reachability for the affected nodes',
      'Confirm the ONTAP performance API is enabled and not rate-limited',
      'Restart telemetry polling for the affected nodes from the collector',
    ];
    degraded.kbArticle = { id: 'KB-2091144', title: 'Collector reports capacity but not performance data' };
  }

  return collectors;
}

function applyAsupIssues(records: ConsoleAsupRecord[]): ConsoleAsupRecord[] {
  const forSubscription = records.filter((r) => r.subscriptionId === '1789858607');
  const [first, second] = forSubscription;

  if (first) {
    first.status = 'Degraded';
    first.lastTransfer = '3 days ago';
    first.summary = 'Missed scheduled daily upload.';
    first.detectedAt = '2026-04-03 02:14 UTC';
    first.whatWentWrong =
      'ASUP HTTPS upload from this node has not reached NetApp for the last 3 scheduled windows.';
    first.evidence = [
      'Last successful ASUP payload: 2026-04-03 02:00 UTC',
      'Cluster log shows repeated TLS handshake timeouts to support.netapp.com',
      'Outbound HTTPS (443) from the node management LIF appears blocked',
    ];
    first.recommendedSteps = [
      'Verify outbound HTTPS connectivity from the node management LIF',
      `Re-run: system node autosupport invoke -node ${first.nodeName} -type test`,
      'If the test fails, follow the KB to update the proxy or firewall allow-list',
    ];
    first.kbArticle = { id: 'KB-1015321', title: 'AutoSupport delivery fails with TLS/HTTPS timeout' };
  }

  if (second) {
    second.status = 'At risk';
    second.lastTransfer = '2 days ago';
    second.summary = 'No ASUP payload received for 2 days.';
    second.detectedAt = '2026-04-04 08:00 UTC';
    second.whatWentWrong = 'This node has not reported an AutoSupport payload for over 24 hours.';
    second.evidence = [
      'Last known payload: 2026-04-04 07:55 UTC (capacity data only, no anomalies)',
      'Two consecutive scheduled uploads were skipped',
    ];
    second.recommendedSteps = [
      'Verify the node is powered on and the ONTAP AutoSupport service is running',
      'Check that the daily schedule has not been disabled by a recent configuration change',
    ];
    second.kbArticle = {
      id: 'KB-1015322',
      title: 'AutoSupport payload missing for consecutive scheduled windows',
    };
  }

  return records;
}

// Built lazily (not as eager module-level consts): consoleOperationsMock.ts <-> mockData.ts is a
// circular import (mockData re-exports this module, this module reads mockHardwareNodes back from
// mockData), so anything that touches mockHardwareNodes at module-evaluation time would race against
// mockData's own initialization. Memoized getters sidestep that — they only run on first real use,
// by which point the whole module graph has finished loading.
let keystoneAgentCollectorsCache: ConsoleKeystoneAgentCollector[] | null = null;
export function getMockConsoleKeystoneAgentCollectors(): ConsoleKeystoneAgentCollector[] {
  if (!keystoneAgentCollectorsCache) {
    // Timeline-shifted (detectedAt + any dates embedded in evidence text) so this stays anchored
    // around "today" — see `dateShift.ts`.
    keystoneAgentCollectorsCache = applyCollectorIssues(buildKeystoneAgentCollectors()).map(shiftDatesDeep);
  }
  return keystoneAgentCollectorsCache;
}

let asupRecordsCache: ConsoleAsupRecord[] | null = null;
export function getMockConsoleAsupRecords(): ConsoleAsupRecord[] {
  if (!asupRecordsCache) {
    asupRecordsCache = applyAsupIssues(buildAsupRecords()).map(shiftDatesDeep);
  }
  return asupRecordsCache;
}

/** Subscriptions (+ node count) covered by a given Keystone Agent collector — many-to-many rollup. */
export function keystoneAgentCollectorSubscriptions(
  collector: ConsoleKeystoneAgentCollector,
): { subscription: Subscription; nodeCount: number }[] {
  const counts = new Map<string, number>();
  collector.nodeIds.forEach((nid) => {
    const node = getHardwareNodeById(nid);
    if (!node) return;
    counts.set(node.subscriptionId, (counts.get(node.subscriptionId) ?? 0) + 1);
  });
  return Array.from(counts.entries()).flatMap(([subscriptionId, nodeCount]) => {
    const subscription = getSubscriptionById(subscriptionId);
    return subscription ? [{ subscription, nodeCount }] : [];
  });
}

export function formatMetadataSubscriptionLine(subscriptionId: string): string {
  const sub = getSubscriptionById(subscriptionId);
  return sub ? formatSubscriptionIdentity(sub) : subscriptionId;
}

/** The single subscription a node (and therefore its one-to-one ASUP record) belongs to. */
export function subscriptionForNode(nodeId: string): Subscription | undefined {
  const node = getHardwareNodeById(nodeId);
  return node ? getSubscriptionById(node.subscriptionId) : undefined;
}

/** The one Keystone Agent collector instance covering a given node (many-to-many at the fleet level,
 * but each node is served by exactly one collector at a time). */
export function collectorForNode(nodeId: string): ConsoleKeystoneAgentCollector | undefined {
  return getMockConsoleKeystoneAgentCollectors().find((c) => c.nodeIds.includes(nodeId));
}

/** The one-to-one AutoSupport record for a node. */
export function asupForNode(nodeId: string): ConsoleAsupRecord | undefined {
  return getMockConsoleAsupRecords().find((a) => a.nodeId === nodeId);
}

const METADATA_STATUS_RANK: Record<MetadataCollectionStatus, number> = {
  Healthy: 0,
  Degraded: 1,
  'At risk': 2,
  Critical: 3,
};

/** Worse (higher-severity) of two collection statuses — used to roll node/source status up to a subscription. */
export function worseMetadataStatus(
  a: MetadataCollectionStatus,
  b: MetadataCollectionStatus,
): MetadataCollectionStatus {
  return METADATA_STATUS_RANK[a] >= METADATA_STATUS_RANK[b] ? a : b;
}

/** A node's overall telemetry health — the worse of its Keystone Agent and AutoSupport status. */
export function nodeTelemetryStatus(nodeId: string): MetadataCollectionStatus {
  const collectorStatus = collectorForNode(nodeId)?.status ?? 'Healthy';
  const asupStatus = asupForNode(nodeId)?.status ?? 'Healthy';
  return worseMetadataStatus(collectorStatus, asupStatus);
}

export function hardwareNodesForSubscription(subscriptionId: string): HardwareNode[] {
  return mockHardwareNodes.filter((n) => n.subscriptionId === subscriptionId);
}

export interface MetadataSubscriptionNodeRow {
  node: HardwareNode;
  telemetryStatus: MetadataCollectionStatus;
  collector?: ConsoleKeystoneAgentCollector;
  asup?: ConsoleAsupRecord;
}

export interface MetadataSubscriptionRollup {
  subscription: Subscription;
  nodes: MetadataSubscriptionNodeRow[];
  status: MetadataCollectionStatus;
  billingImpact: boolean;
  performanceImpact: boolean;
  affectedNodeCount: number;
  failingSourceCount: number;
}

/** By-Subscription view: every subscription with its nodes and each node's Keystone Agent / AutoSupport status. */
export function metadataSubscriptionRollups(subs: Subscription[] = mockSubscriptions): MetadataSubscriptionRollup[] {
  return subs
    .map((subscription) => {
      const nodes: MetadataSubscriptionNodeRow[] = hardwareNodesForSubscription(subscription.id).map((node) => ({
        node,
        telemetryStatus: nodeTelemetryStatus(node.id),
        collector: collectorForNode(node.id),
        asup: asupForNode(node.id),
      }));
      const status = nodes.reduce<MetadataCollectionStatus>(
        (worst, row) => worseMetadataStatus(worst, row.telemetryStatus),
        'Healthy',
      );
      const billingImpact = nodes.some((row) => row.asup && row.asup.status !== 'Healthy');
      const performanceImpact = nodes.some((row) => row.collector && row.collector.status !== 'Healthy');
      const failingSources = new Set<string>();
      nodes.forEach((row) => {
        if (row.collector && row.collector.status !== 'Healthy') failingSources.add(row.collector.id);
        if (row.asup && row.asup.status !== 'Healthy') failingSources.add(row.asup.id);
      });
      return {
        subscription,
        nodes,
        status,
        billingImpact,
        performanceImpact,
        affectedNodeCount: nodes.filter((row) => row.telemetryStatus !== 'Healthy').length,
        failingSourceCount: failingSources.size,
      };
    })
    .filter((rollup) => rollup.nodes.length > 0);
}

/** Fleet-wide health rollup for the Metadata Collection tab's summary cards, ordered to match the
 * natural hierarchy: Subscriptions impact -> Data sources impact -> Node impact. */
export function metadataCollectionHealthSummary(
  subs: Subscription[] = mockSubscriptions,
  nodes: HardwareNode[] = mockHardwareNodes,
) {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const collectors = getMockConsoleKeystoneAgentCollectors().filter((c) => c.nodeIds.some((id) => nodeIds.has(id)));
  const asup = getMockConsoleAsupRecords().filter((a) => nodeIds.has(a.nodeId));
  const rollups = metadataSubscriptionRollups(subs);

  const collectorIssues = collectors.filter((c) => c.status !== 'Healthy');
  const asupIssues = asup.filter((a) => a.status !== 'Healthy');
  const nodesWithCollectorIssue = new Set(collectorIssues.flatMap((c) => c.nodeIds));
  const nodesWithAsupIssue = new Set(asupIssues.map((a) => a.nodeId));

  return {
    // Subscriptions impact
    subscriptionsAtRisk: rollups.filter((r) => r.status !== 'Healthy').length,
    totalSubscriptions: rollups.length,
    billingImpactSubscriptions: rollups.filter((r) => r.billingImpact).length,
    performanceImpactSubscriptions: rollups.filter((r) => r.performanceImpact).length,
    // Data sources impact
    collectorInstances: collectors.length,
    collectorIssueCount: collectorIssues.length,
    asupNodeCount: asup.length,
    asupIssueCount: asupIssues.length,
    failingSourceCount: collectorIssues.length + asupIssues.length,
    // Node impact
    totalNodes: nodes.length,
    affectedNodeCount: new Set([...nodesWithCollectorIssue, ...nodesWithAsupIssue]).size,
  };
}

/** Sum of monitor trigger counts in the last 24h (prototype static). */
export function totalMonitorTriggers24h(monitors: ConsoleAlertMonitor[] = mockConsoleAlertMonitors): number {
  return monitors.reduce((s, m) => s + m.triggerCount, 0);
}

/** Service requests still in workflow (excludes e.g. Approved / closed). */
const OPEN_PIPELINE_STATUSES = new Set(['In Review', 'Pending Approval', 'In Progress']);

export function openPipelineServiceRequests(): ConsoleServiceRequest[] {
  return mockConsoleServiceRequests.filter((r) => OPEN_PIPELINE_STATUSES.has(r.status));
}

const severityRank: Record<ConsoleActiveAlert['severity'], number> = {
  Critical: 0,
  Warning: 1,
  Info: 2,
};

/** Highest-severity alerts first — same source as Monitoring. */
export function overviewRecentAlerts(limit: number): ConsoleActiveAlert[] {
  return [...mockConsoleActiveAlerts]
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    .slice(0, limit);
}

/** Security + compliance alert occurrences — same catalog as Monitoring. */
export function overviewComplianceVulnerabilityTotal(alerts: ConsoleActiveAlert[] = mockConsoleActiveAlerts): number {
  return alerts.reduce((sum, a) => {
    if (a.category === 'Security' || a.category === 'Compliance') {
      return sum + a.occurrences;
    }
    return sum;
  }, 0);
}
