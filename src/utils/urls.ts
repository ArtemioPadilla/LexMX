/**
 * URL utility functions for handling base path in different environments
 */

// Get the base URL from environment or default to '/'
const BASE_URL = import.meta.env.BASE_URL || '/';

/**
 * Constructs a URL with the proper base path
 * @param path - The path without leading slash (e.g., 'chat', 'legal/document')
 * @returns The full path with base URL
 */
export function getUrl(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Handle empty path (home page)
  if (!cleanPath) {
    return BASE_URL;
  }
  
  // Ensure BASE_URL ends with slash
  const base = BASE_URL.endsWith('/') ? BASE_URL : BASE_URL + '/';
  
  return base + cleanPath;
}

/**
 * Check if we're in production (GitHub Pages)
 */
export function isProduction(): boolean {
  return import.meta.env.PROD === true;
}

/**
 * Get the full site URL including domain
 */
export function getFullUrl(path: string): string {
  const siteUrl = import.meta.env.SITE || 'https://artemiopadilla.github.io';
  const url = getUrl(path);
  
  // If url starts with /, remove it to avoid double slashes
  const cleanUrl = url.startsWith('/') ? url.slice(1) : url;
  
  return siteUrl.endsWith('/') ? siteUrl + cleanUrl : siteUrl + '/' + cleanUrl;
}

/**
 * Helper for asset URLs (images, etc.)
 */
export function getAssetUrl(asset: string): string {
  // For assets, we also need to consider the base path
  return getUrl(asset);
}