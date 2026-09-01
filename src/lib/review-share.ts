export interface OrderReviewShare {
  code: string;
  shareId: string;
  url: string;
}

export interface OrderReviewShareView {
  shareId: string;
  submitted: boolean;
  closed: boolean;
  canSubmit: boolean;
  deadlineHint?: string | null;
  order: {
    id: string;
    code: string;
    title: string;
    projectType: string;
    billingMode: string;
    specialty?: string;
  };
  designer: {
    id: string;
    name: string;
    avatar?: string | null;
  };
}

export function buildOrderReviewShareUrl(shareId: string, origin = "") {
  const base =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/review-order/${shareId}`;
}
