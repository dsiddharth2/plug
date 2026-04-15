#!/usr/bin/env node
// Register tsx ESM loader so .jsx files can be imported without a build step.
import { register } from 'tsx/esm/api';

register();

await import('../src/index.js');
