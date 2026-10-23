import path from 'node:path';
import {tmpdir} from 'node:os';

export const testPath = (...parts) => path.join(
  process.env.BOTSTATS_TEST_DIR || path.join(tmpdir(), 'q2pro-botstats-tests'),
  ...parts
);
