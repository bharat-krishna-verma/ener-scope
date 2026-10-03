import { composeDigest, type TenderRow } from "./pipeline";
export function composeForEmail(today: TenderRow[], tag: string) {
  return composeDigest(today, tag);
}
