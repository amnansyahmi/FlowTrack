import { useId, useState, type ReactNode } from "react";
import { ImageIcon, type IconName } from "./image-icon";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "./ui/alert-dialog";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { dateKey } from "../lib/finance";
import type { Account } from "../lib/types";

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
  icon,
}: {
  title: string;
  icon?: IconName;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            {icon && <ImageIcon name={icon} className="size-5" />}
            {title}
          </CardTitle>
          {description && (
            <CardDescription className="mt-1.5">{description}</CardDescription>
          )}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
export function Empty({
  children,
  icon = "receipt",
}: {
  children: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <ImageIcon name={icon} />
      </span>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
export function Field({
  label,
  name,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; name: string }) {
  const id = useId();
  return (
    <div className="field">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} {...props} />
    </div>
  );
}
export function SelectField({
  label,
  name,
  options,
  defaultValue,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <Label htmlFor={id}>{label}</Label>
      <Select
        name={name}
        defaultValue={defaultValue ?? options[0]?.value}
        value={value}
        onValueChange={onChange}
      >
        <SelectTrigger id={id} className="w-full h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function AccountField({
  accounts,
  defaultValue,
}: {
  accounts: Account[];
  defaultValue?: string;
}) {
  return (
    <SelectField
      name="accountId"
      label="Account"
      defaultValue={defaultValue ?? "unassigned"}
      options={[
        { value: "unassigned", label: "Unassigned" },
        ...accounts.map((account) => ({
          value: account.id,
          label: account.name,
        })),
      ]}
    />
  );
}
export function DateField({
  label = "Date",
  name = "date",
  defaultValue = dateKey(),
  optional = false,
}: {
  label?: string;
  name?: string;
  defaultValue?: string;
  optional?: boolean;
}) {
  const [selected, setSelected] = useState<Date | undefined>(
    defaultValue
      ? new Date(`${defaultValue.slice(0, 10)}T12:00:00`)
      : undefined,
  );
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="field">
      <Label htmlFor={id}>{label}</Label>
      <input
        name={name}
        type="hidden"
        value={selected ? dateKey(selected) : ""}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className="h-11 w-full justify-between font-normal"
          >
            <span>
              {selected
                ? selected.toLocaleDateString("en-MY", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "Choose date"}
            </span>
            <ImageIcon name="calendar" className="size-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            selected={selected}
            defaultMonth={selected}
            onSelect={(value) => {
              if (value) {
                setSelected(value);
                setOpen(false);
              }
            }}
            startMonth={new Date(2000, 0)}
            endMonth={new Date(new Date().getFullYear() + 15, 11)}
            autoFocus
          />
          <div className="flex justify-between border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelected(new Date());
                setOpen(false);
              }}
            >
              Today
            </Button>
            {optional && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelected(undefined);
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
  busy = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  busy?: boolean;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className={`max-h-[90dvh] overflow-y-auto ${wide ? "sm:max-w-2xl" : ""}`}
      >
        <DialogHeader className="pr-12 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function Confirm({
  children = "Delete",
  title = "Delete this record?",
  description = "This action removes the record from your local data.",
  onConfirm,
  disabled = false,
}: {
  children?: ReactNode;
  title?: string;
  description?: string;
  onConfirm: () => Promise<boolean>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) setOpen(v);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          disabled={disabled}
        >
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                if (await onConfirm()) setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export function FormActions({
  busy,
  onClose,
}: {
  busy: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 border-t pt-4">
      <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
        Cancel
      </Button>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
