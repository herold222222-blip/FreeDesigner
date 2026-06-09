export const CUSTOMER_SERVICE_HOTLINE = "4006801231";

export const CUSTOMER_SERVICE_HOTLINE_DISPLAY = "400-680-1231";

export interface CustomerServiceContact {
  id: string;
  businessLabel: string;
  contactName: string;
  extension: string;
}

export const CUSTOMER_SERVICE_CONTACTS: CustomerServiceContact[] = [
  {
    id: "architecture",
    businessLabel: "建筑业务",
    contactName: "朱女士",
    extension: "1",
  },
  {
    id: "landscape",
    businessLabel: "景观业务",
    contactName: "万先生",
    extension: "2",
  },
  {
    id: "interior",
    businessLabel: "室内业务",
    contactName: "彭先生",
    extension: "3",
  },
];

export function formatCustomerServiceLine(contact: CustomerServiceContact) {
  return `${contact.businessLabel} · ${contact.contactName}：${CUSTOMER_SERVICE_HOTLINE_DISPLAY}-${contact.extension}`;
}
