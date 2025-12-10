/* eslint import/prefer-default-export: off */
import { URL } from 'url';
import path from 'path';

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
}

export function jsonReplacer(key: any, value: any) {
  if (typeof value === 'bigint') return value.toString();
  if (value && value.type === 'Buffer')
    return Buffer.from(value.data).toString('hex');
  return value;
}
