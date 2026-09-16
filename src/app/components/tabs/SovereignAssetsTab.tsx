import { EyeOff, HardDrive } from 'lucide-react';
import { Subscription, hardwareNodesForSubscription } from '../../data/mockData';
import {
  DataTable,
  DataTableHeader,
  DataTableHeaderCell,
  DataTableBody,
  DataTableRow,
  DataTableCell,
} from '../ui/DataTable';

interface SovereignAssetsTabProps {
  subscription: Subscription;
}

/**
 * Dark Site assets view: shows only the hardware NetApp shipped (model, serial,
 * disks, location) — the one thing that's contractually known regardless of connectivity.
 * Deliberately omits live telemetry columns (status, CPU, memory, uptime, ONTAP version) since
 * NetApp has no connection into the environment to measure them.
 */
export function SovereignAssetsTab({ subscription }: SovereignAssetsTabProps) {
  const nodes = hardwareNodesForSubscription(subscription.id);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 p-4">
        <HardDrive className="mt-0.5 h-5 w-5 shrink-0 text-purple-600" />
        <div className="text-sm text-purple-900">
          <span className="font-semibold">Hardware as shipped.</span> This reflects the
          configuration NetApp shipped to your site. NetApp has no connectivity into your
          environment, so live status, utilization, and software version aren't available here.
        </div>
      </div>

      <DataTable title="Hardware Nodes" count={nodes.length} showSearch={false} showDownload={false}>
        <table className="w-full">
          <DataTableHeader>
            <tr>
              <DataTableHeaderCell>Node Name</DataTableHeaderCell>
              <DataTableHeaderCell>Model</DataTableHeaderCell>
              <DataTableHeaderCell>Serial Number</DataTableHeaderCell>
              <DataTableHeaderCell>Disks</DataTableHeaderCell>
              <DataTableHeaderCell>Cluster</DataTableHeaderCell>
              <DataTableHeaderCell>Site Location</DataTableHeaderCell>
            </tr>
          </DataTableHeader>
          <DataTableBody>
            {nodes.map((node) => (
              <DataTableRow key={node.id}>
                <DataTableCell>{node.name}</DataTableCell>
                <DataTableCell>{node.model}</DataTableCell>
                <DataTableCell>{node.serialNumber}</DataTableCell>
                <DataTableCell>{node.disks}</DataTableCell>
                <DataTableCell>{node.clusterName}</DataTableCell>
                <DataTableCell>{node.location}</DataTableCell>
              </DataTableRow>
            ))}
            {nodes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                  No shipped hardware on file for this subscription.
                </td>
              </tr>
            )}
          </DataTableBody>
        </table>
      </DataTable>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <EyeOff className="h-3.5 w-3.5 shrink-0" />
        Volumes, capacity used, CPU/memory, and uptime aren't shown — NetApp has no visibility
        into deployed configuration or usage for Dark Site subscriptions.
      </div>
    </div>
  );
}
