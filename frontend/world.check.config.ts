import { mergeConfig } from 'vitest/config';
import config from './vitest.config';
export default mergeConfig(config, { cacheDir: '../../world-vitest-cache', test: { maxWorkers: 2 } });
