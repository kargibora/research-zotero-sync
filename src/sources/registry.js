import { createAlphaxivAdapter } from '../adapters/alphaxiv.js';
import { createScholarInboxAdapter } from '../adapters/scholar-inbox.js';

export const SOURCES = {
  'alphaxiv': {
    key: 'alphaxiv',
    label: 'AlphaXiv',
    parentName: 'AlphaXiv',
    pageCollectionName: 'Papers',
    enableSettingKey: 'enableAlphaxiv',
    cookieHost: 'alphaxiv.org',
    createAdapter: createAlphaxivAdapter
  },
  'scholar-inbox': {
    key: 'scholar-inbox',
    label: 'Scholar-Inbox',
    parentName: 'Scholar-Inbox',
    pageCollectionName: 'Papers',
    enableSettingKey: 'enableScholarInbox',
    cookieHost: 'scholar-inbox.com',
    createAdapter: createScholarInboxAdapter
  }
};

export const SOURCE_KEYS = Object.keys(SOURCES);

export const PAGE_FALLBACK = { pageCollectionName: 'Manual', parentName: 'Manual sync' };
