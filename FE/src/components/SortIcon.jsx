import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/solid";

/**
 * Icon chỉ hướng sắp xếp cột bảng.
 * active=true khi cột đang được sắp xếp, dir="asc"|"desc"
 */
export default function SortIcon({ active, dir }) {
  if (!active)
    return (
      <span className="inline-flex flex-col align-middle ml-1 opacity-30 leading-none">
        <ChevronUpIcon className="w-2.5 h-2.5" />
        <ChevronDownIcon className="w-2.5 h-2.5" />
      </span>
    );
  return dir === "asc" ? (
    <ChevronUpIcon className="inline w-3 h-3 ml-1 align-middle" />
  ) : (
    <ChevronDownIcon className="inline w-3 h-3 ml-1 align-middle" />
  );
}
