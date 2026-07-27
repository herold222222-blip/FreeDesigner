import type { Designer, Specialty, SubSpecialty } from "@/lib/types";

const LANDSCAPE_SUB_TO_TRACK: Partial<
  Record<SubSpecialty, { l2: string; l3: string }>
> = {
  garden_construction: { l2: "construction_doc", l3: "ls_garden" },
  greening: { l2: "construction_doc", l3: "ls_greening" },
  drainage: { l2: "construction_doc", l3: "ls_drainage" },
  electrical: { l2: "construction_doc", l3: "ls_electrical" },
  construction_doc: { l2: "construction_doc", l3: "ls_garden" },
};

export function tracksFromSubSpecialties(
  specialty: Specialty,
  subs: SubSpecialty[],
): { l2: string; l3: string }[] {
  if (specialty !== "landscape") return [];
  const out: { l2: string; l3: string }[] = [];
  for (const s of subs) {
    const t = LANDSCAPE_SUB_TO_TRACK[s];
    if (t && !out.some((x) => x.l2 === t.l2 && x.l3 === t.l3)) {
      out.push(t);
    }
  }
  return out;
}

/** 默认主航道：用于入驻/改专业后补齐 primaryTrack */
export function defaultPrimaryTrackForSpecialty(
  specialty: Specialty,
  subSpecialties: SubSpecialty[] = [],
): NonNullable<Designer["primaryTrack"]> {
  const fromSubs = tracksFromSubSpecialties(specialty, subSpecialties);
  if (fromSubs[0]) {
    return { l1: specialty, l2: fromSubs[0].l2, l3: fromSubs[0].l3 };
  }
  switch (specialty) {
    case "landscape":
      return { l1: "landscape", l2: "construction_doc", l3: "ls_garden" };
    case "interior":
      return { l1: "interior", l2: "construction_doc", l3: "in_decoration" };
    case "rendering":
      return { l1: "rendering", l2: "render", l3: "render_arch" };
    case "cost_consulting":
      return { l1: "cost_consulting", l2: "arch_cost", l3: "estimate" };
    case "architecture":
    default:
      return { l1: "architecture", l2: "construction_doc", l3: "arch_cd" };
  }
}

/**
 * 取费基数用的二/三级专业列表。
 * 优先 primary/secondary tracks；缺失时从子专业或景观默认档推导。
 */
export function resolveDesignerTrackPairs(
  designer: Designer,
): { l2: string; l3: string }[] {
  const out: { l2: string; l3: string }[] = [];

  if (designer.primaryTrack?.l1 === designer.specialty) {
    out.push({
      l2: designer.primaryTrack.l2,
      l3: designer.primaryTrack.l3,
    });
  }
  for (const t of designer.secondaryTracks ?? []) {
    if (t.l1 !== designer.specialty) continue;
    if (!out.some((x) => x.l2 === t.l2 && x.l3 === t.l3)) {
      out.push({ l2: t.l2, l3: t.l3 });
    }
  }

  if (out.length === 0) {
    out.push(
      ...tracksFromSubSpecialties(
        designer.specialty,
        designer.subSpecialties ?? [],
      ),
    );
  }

  if (out.length === 0 && designer.specialty === "landscape") {
    out.push({ l2: "construction_doc", l3: "ls_garden" });
  }

  return out;
}
