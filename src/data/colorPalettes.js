/**
 * أنظمة الألوان وألوان كل نظام — مصدر ديناميكي من الكود (بدون الداتابيز).
 * أي تعديل على الأنظمة أو الألوان يتم هنا.
 */

export const colorSystems = [
  { id: 1, name: "RAL Classic", slug: "ral-classic" },
  { id: 2, name: "Pantone", slug: "pantone" },
  { id: 3, name: "NCS", slug: "ncs" },
  { id: 4, name: "HKS", slug: "hks" },
  { id: 5, name: "Sherwin Williams", slug: "sherwin-williams" },
  { id: 6, name: "عينة المحول", slug: "sample" },
];

const ralColors = [
  { code: "RAL 9010", hex: "#F7F9EF" },
  { code: "RAL 7035", hex: "#8B8B8B" },
  { code: "RAL 9005", hex: "#0A0A0D" },
  { code: "RAL 1021", hex: "#E8B447" },
  { code: "RAL 5010", hex: "#1E213D" },
  { code: "RAL 3020", hex: "#A72920" },
  { code: "RAL 6021", hex: "#2F5233" },
  { code: "RAL 4003", hex: "#6B3B63" },
  { code: "RAL 5012", hex: "#1F3438" },
  { code: "RAL 9016", hex: "#F7FBF5" },
  { code: "RAL 1015", hex: "#E6D2B5" },
  { code: "RAL 6018", hex: "#2D5016" },
  { code: "RAL 9001", hex: "#FDF4E3" },
  { code: "RAL 7024", hex: "#474A50" },
  { code: "RAL 1026", hex: "#F7BA0B" },
  { code: "RAL 1018", hex: "#FAD201" },
  { code: "RAL 5017", hex: "#0E4C92" },
  { code: "RAL 9006", hex: "#A1A1A1" },
  { code: "RAL 6017", hex: "#2D5540" },
  { code: "RAL 3000", hex: "#A7292B" },
  { code: "RAL 7039", hex: "#6B695F" },
];

const pantoneColors = [
  { code: "Pantone 11-0601 TCX", hex: "#F5F0E6" },
  { code: "Pantone 19-4028 TPX", hex: "#1E3A5F" },
  { code: "Pantone 17-1462 TCX", hex: "#C24A4A" },
  { code: "Pantone 18-1664 TCX", hex: "#9E2B2E" },
  { code: "Pantone 15-0950 TCX", hex: "#E8B013" },
  { code: "Pantone 19-4052 TCX", hex: "#1B365D" },
  { code: "Pantone 14-4318 TCX", hex: "#7BA3BC" },
  { code: "Pantone 16-0229 TCX", hex: "#2D5C3F" },
  { code: "Pantone 12-0609 TCX", hex: "#E8E3D5" },
  { code: "Pantone 19-3921 TCX", hex: "#2C2C2E" },
  { code: "Pantone 17-6153 TCX", hex: "#4A7C59" },
  { code: "Pantone 14-1112 TCX", hex: "#D4C4A5" },
  { code: "Pantone 18-5338 TCX", hex: "#2C5234" },
  { code: "Pantone 16-1544 TCX", hex: "#B84A4F" },
  { code: "Pantone 13-0645 TCX", hex: "#E8D48B" },
];

const ncsColors = [
  { code: "NCS S 0500-N", hex: "#E8E8E6" },
  { code: "NCS S 0502-Y", hex: "#E8E6DC" },
  { code: "NCS S 0505-R", hex: "#E8E0DF" },
  { code: "NCS S 0505-Y", hex: "#E8E4D4" },
  { code: "NCS S 1005-R", hex: "#D4CFCE" },
  { code: "NCS S 1505-R", hex: "#C4BFBE" },
  { code: "NCS S 2005-R", hex: "#B3AEAD" },
  { code: "NCS S 3020-R", hex: "#9E7A78" },
  { code: "NCS S 3030-R", hex: "#8B5A58" },
  { code: "NCS S 4040-R", hex: "#6B3535" },
  { code: "NCS S 5040-R", hex: "#4A2222" },
  { code: "NCS S 6020-B", hex: "#3A4A5A" },
  { code: "NCS S 7020-G", hex: "#1E3328" },
  { code: "NCS S 8010-G10Y", hex: "#1A241E" },
  { code: "NCS S 9000-N", hex: "#0F0F0F" },
];

const hksColors = [
  { code: "HKS 1", hex: "#E8D4B8" },
  { code: "HKS 3", hex: "#E8B84A" },
  { code: "HKS 4", hex: "#E88C3A" },
  { code: "HKS 5", hex: "#E85A3A" },
  { code: "HKS 6", hex: "#C43A3A" },
  { code: "HKS 7", hex: "#8B2E3A" },
  { code: "HKS 8", hex: "#5A2E3A" },
  { code: "HKS 10", hex: "#3A3A5A" },
  { code: "HKS 11", hex: "#2E4A8B" },
  { code: "HKS 12", hex: "#3A6AB8" },
  { code: "HKS 14", hex: "#2E6A5A" },
  { code: "HKS 15", hex: "#2E8B5A" },
  { code: "HKS 16", hex: "#5AB84A" },
  { code: "HKS 17", hex: "#8BB83A" },
  { code: "HKS 18", hex: "#B8A83A" },
];

const swColors = [
  { code: "SW 7004", hex: "#B8B8B0" },
  { code: "SW 7015", hex: "#8B8B82" },
  { code: "SW 7021", hex: "#5A5A52" },
  { code: "SW 7076", hex: "#3A3A35" },
  { code: "SW 7008", hex: "#E8E4D8" },
  { code: "SW 7010", hex: "#D4CEBE" },
  { code: "SW 7011", hex: "#B8A88E" },
  { code: "SW 7029", hex: "#5A4A3A" },
  { code: "SW 7581", hex: "#C45A4A" },
  { code: "SW 7582", hex: "#8B3A32" },
  { code: "SW 7583", hex: "#5A2822" },
  { code: "SW 6778", hex: "#3A5A8B" },
  { code: "SW 6779", hex: "#2E4A72" },
  { code: "SW 6462", hex: "#2E5A4A" },
  { code: "SW 6463", hex: "#3A7262" },
];

const sampleColors = [
  { code: "عينة 1", hex: "#667788" },
  { code: "عينة 2", hex: "#FF5500" },
  { code: "عينة 3", hex: "#00AA66" },
  { code: "عينة 4", hex: "#EEEEEE" },
  { code: "عينة 5", hex: "#333333" },
  { code: "عينة 6", hex: "#C41E3A" },
  { code: "عينة 7", hex: "#FFD700" },
  { code: "عينة 8", hex: "#2E8B57" },
  { code: "عينة 9", hex: "#4B0082" },
  { code: "عينة 10", hex: "#FF69B4" },
];

/** ألوان كل نظام: [systemId] => [{ code, hex }, ...] */
export const systemPalettes = {
  1: ralColors,
  2: pantoneColors,
  3: ncsColors,
  4: hksColors,
  5: swColors,
  6: sampleColors,
};
