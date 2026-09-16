import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { BpButton, type BpButtonProps } from '@netapp/blueprint/react';

import { cn } from './utils';

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

type BpAppearance = 'solid' | 'outline' | 'flat' | 'icon';
type BpSize = 'large' | 'medium' | 'small';
type BpIconProp = NonNullable<BpButtonProps['icon']>;

/** Maps the app's shadcn-style variant onto Blueprint's appearance/destructive props. */
function resolveAppearance(variant: ButtonVariant): { appearance: BpAppearance; destructive: boolean } {
  switch (variant) {
    case 'destructive':
      return { appearance: 'solid', destructive: true };
    case 'outline':
    case 'secondary':
      return { appearance: 'outline', destructive: false };
    case 'ghost':
    case 'link':
      return { appearance: 'flat', destructive: false };
    case 'default':
    default:
      return { appearance: 'solid', destructive: false };
  }
}

/** Blueprint's `solid`/`outline` appearances don't support `size="small"` (it throws) — fall back to `medium`. */
function resolveSize(size: ButtonSize, appearance: BpAppearance): BpSize {
  if (size === 'lg') return 'large';
  if (size === 'sm') return appearance === 'flat' || appearance === 'icon' ? 'small' : 'medium';
  return 'medium';
}

/**
 * Blueprint's `resolveIconByName` only treats a plain `typeof value === "function"`
 * as a renderable icon component — `lucide-react` icons are `forwardRef` objects
 * (`typeof === "object"`), so passing one straight through silently resolves to
 * nothing (and triggers the icon-appearance "+" fallback). Wrapping it in a plain
 * function component satisfies that check while still rendering the real icon.
 */
function toBpIcon(IconComponent: React.ComponentType<React.SVGProps<SVGSVGElement>>): BpIconProp {
  const WrappedIcon = (props: React.SVGProps<SVGSVGElement>) => <IconComponent {...props} />;
  return WrappedIcon as unknown as BpIconProp;
}

/**
 * Detects a leading icon-like element (a component with no children of its own —
 * e.g. a `lucide-react` icon) as the first child, so it can be handed to `BpButton`'s
 * dedicated `icon` slot instead of being nested inside its text label.
 */
function isIconLikeElement(node: React.ReactNode): node is React.ReactElement<{ children?: React.ReactNode }> {
  if (!React.isValidElement(node)) return false;
  const type = node.type as unknown;
  const isFunctionComponent = typeof type === 'function';
  const isForwardRefComponent =
    typeof type === 'object' && type !== null && (type as { $$typeof?: symbol }).$$typeof === Symbol.for('react.forward_ref');
  if (!isFunctionComponent && !isForwardRefComponent) return false;
  return node.props.children === undefined;
}

/**
 * `BpButton` renders arbitrary `children` inside a single non-flex
 * `<span class="bp-button__label">`. Tailwind's preflight sets `svg { display: block }`,
 * so an icon nested there forces a line break before the label text below it. Splitting
 * a leading icon out to Blueprint's own `icon` prop (rendered in its dedicated flex slot)
 * keeps icon+label on one line, and fixes icon-only buttons that would otherwise fall
 * back to a literal "+" glyph.
 */
function splitLeadingIcon(children: React.ReactNode): { icon?: BpIconProp; label: React.ReactNode } {
  const kids = React.Children.toArray(children);
  if (kids.length === 0) return { label: children };

  const [first, ...rest] = kids;
  if (!isIconLikeElement(first)) return { label: children };

  const trimmedRest = rest.map((node, index) =>
    index === 0 && typeof node === 'string' ? node.replace(/^\s+/, '') : node,
  );
  const label = trimmedRest.filter((node) => node !== '').length > 0 ? trimmedRest : undefined;

  return { icon: toBpIcon(first.type as React.ComponentType<React.SVGProps<SVGSVGElement>>), label };
}

export interface ButtonProps extends Omit<React.ComponentProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  children?: React.ReactNode;
}

/**
 * Thin adapter over `BpButton` that preserves this app's existing shadcn-style
 * `variant`/`size` API so the ~30 existing call sites don't need to change.
 */
function Button({ className, variant = 'default', size = 'default', asChild = false, children, ...props }: ButtonProps) {
  const { appearance: mapped, destructive } = resolveAppearance(variant);
  const appearance: BpAppearance = size === 'icon' ? 'icon' : mapped;
  const bpSize = resolveSize(size, appearance);

  if (asChild) {
    // BpButton only renders a native <button>. For polymorphic usage (e.g. an <a>)
    // apply its CSS contract (class + data-* attributes) directly to the slotted child.
    // `.bp-button` is itself a flex row, so an icon + text child here already lays out
    // correctly without needing the icon/label split below.
    return (
      <Slot
        data-slot="button"
        data-appearance={appearance}
        data-size={bpSize}
        data-destructive={destructive ? 'true' : 'false'}
        data-loading="false"
        className={cn('bp-button', className)}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  const { icon, label } = splitLeadingIcon(children);

  if (appearance === 'flat' || appearance === 'icon') {
    return (
      <BpButton
        data-slot="button"
        appearance={appearance}
        size={bpSize}
        destructive={destructive}
        icon={icon}
        className={className}
        {...props}
      >
        {label}
      </BpButton>
    );
  }

  return (
    <BpButton
      data-slot="button"
      appearance={appearance}
      size={bpSize === 'small' ? 'medium' : bpSize}
      destructive={destructive}
      icon={icon}
      className={className}
      {...props}
    >
      {label}
    </BpButton>
  );
}

export { Button };
