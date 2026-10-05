import { cn } from "../lib/utils";

import { type IconName } from "../lib/icons";
export { categoryIcon, navigationIcons, type IconName } from "../lib/icons";

/** Local SVG images: labels belong to the surrounding control, not the asset. */
export function ImageIcon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <img
      src={`/icons/${name}.svg`}
      alt=""
      aria-hidden="true"
      width="24"
      height="24"
      draggable={false}
      className={cn("image-icon", className)}
    />
  );
}
