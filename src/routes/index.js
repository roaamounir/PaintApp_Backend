/**
 * Central Routes Export
 * Exports all route handlers for easy importing
 */

import { handleAuthRoutes } from "./authRoutes.js";
import { handleProductRoutes } from "./productRoutes.js";
import { handleVendorRoutes } from "./vendorRoutes.js";
import { handlePainterRoutes } from "./painterRoutes.js";
import { handleOrderRoutes } from "./orderRoutes.js";
import { handleCategoryRoutes } from "./categoryRoutes.js";
import { handleColorRoutes } from "./colorRoutes.js";
import { handleCartRoutes } from "./cartRoutes.js";
import { handleOfferRoutes } from "./offerRoutes.js";
import { handleGalleryRoutes } from "./galleryRoutes.js";
import { handleReviewRoutes } from "./reviewRoutes.js";
import { handleWalletRoutes } from "./walletRoutes.js";

export const routes = {
  auth: handleAuthRoutes,
  products: handleProductRoutes,
  vendors: handleVendorRoutes,
  painters: handlePainterRoutes,
  orders: handleOrderRoutes,
  categories: handleCategoryRoutes,
  colors: handleColorRoutes,
  cart: handleCartRoutes,
  offers: handleOfferRoutes,
  gallery: handleGalleryRoutes,
  reviews: handleReviewRoutes,
  wallet: handleWalletRoutes,
};

// Export individual routes for direct usage
export {
  handleAuthRoutes,
  handleProductRoutes,
  handleVendorRoutes,
  handlePainterRoutes,
  handleOrderRoutes,
  handleCategoryRoutes,
  handleColorRoutes,
  handleCartRoutes,
  handleOfferRoutes,
  handleGalleryRoutes,
  handleReviewRoutes,
  handleWalletRoutes,
};

export default routes;
