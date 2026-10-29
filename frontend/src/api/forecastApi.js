import client from './client';

/**
 * Fetch multi-day demand forecast and advisory restocking recommendations.
 *
 * @param {Object} params
 * @param {number|string} params.productId - Product database ID
 * @param {number} [params.horizonDays=7] - Forecast horizon (1-90)
 * @param {number} [params.holidayFlag=0] - 0 or 1
 * @param {number} [params.discountPct=0.0] - Discount percentage (0-100)
 * @returns {Promise<Object>} ForecastResponse
 */
export const getProductForecast = async ({
  productId,
  horizonDays = 7,
  holidayFlag = 0,
  discountPct = 0.0,
  modelPreference = 'BASELINE_SMA28',
}) => {
  const response = await client.post('/forecast/demand', {
    product_id: Number(productId),
    horizon_days: Number(horizonDays),
    holiday_flag: Number(holidayFlag),
    discount_pct: Number(discountPct),
    model_preference: modelPreference,
  });
  return response.data;
};

/**
 * Fetch a page of products.
 *
 * @param {Object} [options]
 * @param {number} [options.skip=0]
 * @param {number} [options.limit=100]
 * @returns {Promise<Array>}
 */
export const getProductsList = async ({ skip = 0, limit = 100 } = {}) => {
  const response = await client.get(`/products/?skip=${skip}&limit=${limit}`);
  return response.data;
};

/**
 * Fetch all available products by paginating through /products/
 * to ensure users can select any product regardless of catalog size.
 *
 * @param {number} [pageSize=100]
 * @param {number} [maxItems=1000]
 * @returns {Promise<Array>}
 */
export const getAllProducts = async (pageSize = 100, maxItems = 1000) => {
  let allProducts = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore && allProducts.length < maxItems) {
    const page = await getProductsList({ skip, limit: pageSize });
    if (!Array.isArray(page) || page.length === 0) {
      hasMore = false;
    } else {
      allProducts = allProducts.concat(page);
      if (page.length < pageSize) {
        hasMore = false;
      } else {
        skip += pageSize;
      }
    }
  }

  return allProducts;
};

/**
 * Fetch single product by ID (used for deep-linking fallback).
 *
 * @param {number|string} productId
 * @returns {Promise<Object>}
 */
export const getProductById = async (productId) => {
  const response = await client.get(`/products/${productId}`);
  return response.data;
};
