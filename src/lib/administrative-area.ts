import { areaList } from "@vant/area-data";
import { inferTierFromPrefectureCityName } from "@/lib/constants";
import type { RegionTier } from "@/lib/types";

export type AreaNode = { text: string; value: string; children: AreaNode[] };

function buildAdministrativeTree(): AreaNode[] {
  const { city_list: cities, county_list: counties, province_list: provinces } =
    areaList;

  const provinceMap = new Map<string, AreaNode>();
  Object.keys(provinces).forEach((code) => {
    provinceMap.set(code.slice(0, 2), {
      text: provinces[code]!,
      value: code,
      children: [],
    });
  });

  const cityMap = new Map<string, AreaNode>();
  Object.keys(cities).forEach((code) => {
    const node: AreaNode = { text: cities[code]!, value: code, children: [] };
    cityMap.set(code.slice(0, 4), node);
    const p = provinceMap.get(code.slice(0, 2));
    if (p) p.children.push(node);
  });

  Object.keys(counties).forEach((code) => {
    const city = cityMap.get(code.slice(0, 4));
    if (city) {
      city.children.push({ text: counties[code]!, value: code, children: [] });
    }
  });

  return Array.from(provinceMap.values());
}

export const AREA_ROOTS = buildAdministrativeTree();

export interface AdministrativeTriple {
  provinceCode: string;
  cityCode: string;
  countyCode: string | null;
}

export interface AdministrativeRegionResolution {
  fullLabel: string;
  prefectureCityName: string;
  tier: RegionTier;
}

export function resolveAdministrativeTriple(
  triple: AdministrativeTriple,
): AdministrativeRegionResolution | null {
  const { provinceCode, cityCode, countyCode } = triple;
  const p = AREA_ROOTS.find((x) => x.value === provinceCode);
  const cy = p?.children.find((x) => x.value === cityCode);
  if (!p || !cy) return null;
  const counties = cy.children ?? [];
  if (counties.length === 0) {
    const fullLabel = `${p.text} · ${cy.text}`;
    return {
      fullLabel,
      prefectureCityName: cy.text,
      tier: inferTierFromPrefectureCityName(cy.text),
    };
  }

  let district = counties.find((x) => x.value === countyCode);
  if (!district || !countyCode) district = counties[0]!;

  return {
    fullLabel: `${p.text} · ${cy.text} · ${district.text}`,
    prefectureCityName: cy.text,
    tier: inferTierFromPrefectureCityName(cy.text),
  };
}

export function getDefaultAdministrativeTriple(): AdministrativeTriple {
  const p = AREA_ROOTS.find((x) => x.text === "浙江省") ?? AREA_ROOTS[0];
  const cy =
    p?.children.find((x) => x.text === "杭州市") ?? p?.children?.[0]!;
  let countyCode: string | null =
    cy.children.find((x) => x.text === "西湖区")?.value ?? null;
  if (!countyCode && cy.children[0]?.value !== undefined)
    countyCode = cy.children[0]!.value;
  else if (!cy.children?.length) countyCode = null;

  return {
    provinceCode: p!.value,
    cityCode: cy!.value,
    countyCode,
  };
}
