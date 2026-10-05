import { ImageIcon } from "./image-icon";
import { billIconChoices, billImage, type BillIcon } from "../lib/icons";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useId, useState } from "react";

export function BillIconPicker({
  title,
  value,
  onChange,
}: {
  title: string;
  value: BillIcon | "auto";
  onChange: (value: BillIcon | "auto") => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const selected = billIconChoices.find((choice) => choice.name === value);
  function choose(next: BillIcon | "auto") {
    onChange(next);
    setOpen(false);
  }
  return (
    <div className="field">
      <Label htmlFor={id}>Bill icon</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            id={id}
            variant="outline"
            className="h-11 w-full justify-between font-normal"
          >
            <span className="flex items-center gap-3">
              <img
                src={billImage({
                  title,
                  icon: value === "auto" ? undefined : value,
                })}
                alt=""
                width="24"
                height="24"
              />
              {selected ? selected.label : "Automatic from bill name"}
            </span>
            <ImageIcon name="down" className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-72 max-h-[60dvh] overflow-y-auto"
        >
          <Button
            type="button"
            variant={value === "auto" ? "secondary" : "ghost"}
            className="mb-3 h-11 w-full justify-start"
            aria-pressed={value === "auto"}
            onClick={() => choose("auto")}
          >
            <ImageIcon name="search" />
            Automatic icon
          </Button>
          <div className="grid grid-cols-4 gap-1">
            {billIconChoices.map((choice) => (
              <Button
                type="button"
                key={choice.name}
                aria-label={`Use ${choice.label} icon`}
                aria-pressed={value === choice.name}
                variant={value === choice.name ? "secondary" : "ghost"}
                className="icon-choice"
                onClick={() => choose(choice.name)}
              >
                <ImageIcon name={choice.name} />
                <span>{choice.label}</span>
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
