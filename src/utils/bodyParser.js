/**
 * Utility for parsing request body
 * @param {Object} req - Express-like request object
 * @returns {Promise<Object>} - Parsed body object
 */
export const parseBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        if (!body) {
          resolve({});
          return;
        }
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
};

/**
 * Parse body with timeout to prevent hanging requests
 * @param {Object} req - Request object
 * @param {number} timeout - Timeout in milliseconds (default: 10000)
 * @returns {Promise<Object>}
 */
export const parseBodyWithTimeout = (req, timeout = 10000) => {
  return Promise.race([
    parseBody(req),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeout)
    ),
  ]);
};

export default parseBody;
