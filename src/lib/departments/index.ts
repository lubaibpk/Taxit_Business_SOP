import type { DepartmentDef } from "./build";
import { cash, finance, procurement, sales, treasury } from "./commercial-finance";
import { compliance, hr, tax } from "./people-compliance";
import { expansion, fleet, governance, purchaseMatching, vanSales } from "./operations-governance";

// Department definitions kept in code (version-controlled). Credit & Collections was seeded by
// migration 0002 and is not redefined here, so syncing never touches it.
export const DEPARTMENT_LIBRARY: DepartmentDef[] = [
  sales,
  cash,
  treasury,
  finance,
  procurement,
  hr,
  compliance,
  tax,
  fleet,
  vanSales,
  expansion,
  governance,
  purchaseMatching,
];
