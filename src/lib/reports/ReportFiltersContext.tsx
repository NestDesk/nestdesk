"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Filters {
  startDate?: string;
  endDate?: string;
  hostelIds?: string[];
}

const ReportFiltersContext = createContext<{
  filters: Filters;
  setFilters: (f: Filters) => void;
}>({ filters: {}, setFilters: () => {} });

export function ReportFiltersProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [filters, setFiltersState] = useState<Filters>(() => {
    return {
      startDate: searchParams?.get("startDate") ?? undefined,
      endDate: searchParams?.get("endDate") ?? undefined,
      hostelIds: searchParams?.get("hostelIds")
        ? searchParams.get("hostelIds")!.split(",")
        : undefined,
    };
  });

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    if (filters.hostelIds && filters.hostelIds.length)
      params.set("hostelIds", filters.hostelIds.join(","));

    const url = `/reports?${params.toString()}`;
    router.replace(url);
  }, [filters, router]);

  function setFilters(f: Filters) {
    setFiltersState((prev) => ({ ...prev, ...f }));
  }

  return (
    <ReportFiltersContext.Provider value={{ filters, setFilters }}>
      {children}
    </ReportFiltersContext.Provider>
  );
}

export function useReportFilters() {
  return useContext(ReportFiltersContext);
}
