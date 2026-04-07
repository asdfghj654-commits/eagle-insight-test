import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
        // RTL-aware: use logical properties for translation
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
        "rtl:data-[state=checked]:-translate-x-5 rtl:data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

/**
 * SwitchWithLabel - A properly aligned Switch with Label for RTL support
 * 
 * Usage:
 * <SwitchWithLabel
 *   id="my-switch"
 *   checked={value}
 *   onCheckedChange={setValue}
 *   label="תווית בעברית"
 *   icon={<SomeIcon className="h-4 w-4" />}
 * />
 */
interface SwitchWithLabelProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  label: string;
  icon?: React.ReactNode;
  labelPosition?: 'start' | 'end';
}

const SwitchWithLabel = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchWithLabelProps
>(({ className, label, icon, labelPosition = 'end', id, ...props }, ref) => {
  const switchId = id || `switch-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div className={cn(
      "flex items-center gap-2",
      labelPosition === 'start' ? "flex-row-reverse" : "",
      className
    )}>
      <Switch
        ref={ref}
        id={switchId}
        className="shrink-0"
        {...props}
      />
      <label 
        htmlFor={switchId}
        className="flex items-center gap-1.5 leading-none select-none cursor-pointer text-sm font-medium"
      >
        {icon && <span className="shrink-0">{icon}</span>}
        <span>{label}</span>
      </label>
    </div>
  );
});
SwitchWithLabel.displayName = "SwitchWithLabel";

export { Switch, SwitchWithLabel }
