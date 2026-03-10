/**
 * Standard API Response Utilities
 * Provides consistent response format across all routes
 */

const DEFAULT_LANGUAGE = "ar";

const getLang = (req) => {
  const langHeader = req.headers["accept-language"];
  if (langHeader && langHeader.includes("en")) return "en";
  return DEFAULT_LANGUAGE;
};

// Response Messages
const messages = {
  success: {
    ar: {
      created: "تم الإنشاء بنجاح",
      updated: "تم التحديث بنجاح",
      deleted: "تم الحذف بنجاح",
      fetched: "تم جلب البيانات بنجاح",
      login: "تم تسجيل الدخول بنجاح",
    },
    en: {
      created: "Created successfully",
      updated: "Updated successfully",
      deleted: "Deleted successfully",
      fetched: "Data fetched successfully",
      login: "Login successful",
    },
  },
  error: {
    ar: {
      notFound: "غير موجود",
      unauthorized: "غير مصرح",
      forbidden: "مسموح فقط للمصرح لهم",
      badRequest: "بيانات غير صالحة",
      serverError: "خطأ في السيرفر",
      validation: "خطأ في التحقق من البيانات",
    },
    en: {
      notFound: "Not found",
      unauthorized: "Unauthorized",
      forbidden: "Forbidden",
      badRequest: "Bad request",
      serverError: "Server error",
      validation: "Validation error",
    },
  },
};

/**
 * Get message in the requested language
 */
const getMessage = (req, category, key) => {
  const lang = getLang(req);
  return messages[category]?.[lang]?.[key] || messages[category]?.en?.[key] || key;
};

/**
 * Send success response
 */
export const success = (req, res, data, statusCode = 200) => {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    })
  );
};

/**
 * Send success response with message
 */
export const successWithMessage = (req, res, messageKey, data = null, statusCode = 200) => {
  const message = getMessage(req, "success", messageKey);
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    })
  );
};

/**
 * Send error response
 */
export const error = (req, res, errorMessage, statusCode = 500) => {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    })
  );
};

/**
 * Send error response with message key
 */
export const errorWithMessage = (req, res, messageKey, statusCode = 500) => {
  const message = getMessage(req, "error", messageKey);
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    })
  );
};

/**
 * Send 404 Not Found response
 */
export const notFound = (req, res, resource = "Resource") => {
  const message = `${resource} ${getMessage(req, "error", "notFound")}`;
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    })
  );
};

/**
 * Send 401 Unauthorized response
 */
export const unauthorized = (req, res, message = null) => {
  const errorMessage = message || getMessage(req, "error", "unauthorized");
  res.writeHead(401, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    })
  );
};

/**
 * Send 403 Forbidden response
 */
export const forbidden = (req, res, message = null) => {
  const errorMessage = message || getMessage(req, "error", "forbidden");
  res.writeHead(403, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    })
  );
};

/**
 * Send 400 Bad Request response
 */
export const badRequest = (req, res, message = null) => {
  const errorMessage = message || getMessage(req, "error", "badRequest");
  res.writeHead(400, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    })
  );
};

/**
 * Wrapper for route handlers with error handling
 */
export const routeHandler = (req, res, handler) => {
  try {
    return handler(req, res);
  } catch (err) {
    console.error("Route Handler Error:", err.message);
    return error(req, res, err.message, 500);
  }
};

export default {
  success,
  successWithMessage,
  error,
  errorWithMessage,
  notFound,
  unauthorized,
  forbidden,
  badRequest,
  routeHandler,
};
