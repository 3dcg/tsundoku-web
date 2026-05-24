// Status enum with display order priority (smaller = higher in list)
export const STATUSES = [
  { key: "reading_second_half", label: "読書後半", priority: 1 },
  { key: "reading_first_half",  label: "読書前半", priority: 2 },
  { key: "unread",              label: "未読",     priority: 3 },
  { key: "finished",            label: "読了",     priority: 4 },
];

export const STATUS_KEYS = STATUSES.map(s => s.key);
export const STATUS_LABEL = Object.fromEntries(STATUSES.map(s => [s.key, s.label]));
export const STATUS_PRIORITY = Object.fromEntries(STATUSES.map(s => [s.key, s.priority]));

export const FORMATS = [
  { key: "paper",  label: "紙" },
  { key: "kindle", label: "Kindle" },
];

export const FORMAT_KEYS = FORMATS.map(f => f.key);
export const FORMAT_LABEL = Object.fromEntries(FORMATS.map(f => [f.key, f.label]));

export const DEFAULT_STATUS = "unread";
