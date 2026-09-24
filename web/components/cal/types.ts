export type Month =
  | "Jan"
  | "Feb"
  | "Mar"
  | "Apr"
  | "May"
  | "June"
  | "July"
  | "Aug"
  | "Sep"
  | "Oct"
  | "Nov"
  | "Dec";

export const MONTHS: Month[] = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const getMonth = (month: Month): number => MONTHS.indexOf(month);
