import { defineConfig } from 'vitest/config';
import base from '../../vitest.config';
export default defineConfig({ ...base, test: { ...base.test,
    include: ['review/web-w1-w5-combined/*.diagnostic.test.tsx'],
} });
