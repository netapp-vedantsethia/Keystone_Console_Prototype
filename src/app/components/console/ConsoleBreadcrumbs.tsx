import { BpBreadcrumbs } from '@netapp/blueprint/react';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface ConsoleBreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function ConsoleBreadcrumbs({ items }: ConsoleBreadcrumbsProps) {
  return (
    <BpBreadcrumbs
      items={items.map((item, index) => ({
        id: `${index}-${item.label}`,
        label: item.label,
        onSelect: item.onClick,
      }))}
    />
  );
}
