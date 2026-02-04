export function calculateRecommendedQuantity(selection, paint) {
  let area = selection.area;

  if (!area && selection.length && selection.width) {
    area = selection.length * selection.width;
    if (selection.height) {
      area *= selection.height; // optional height
    }
  }

  const recommendedQuantity = Math.ceil(area / paint.coverage);

  return recommendedQuantity;
}
