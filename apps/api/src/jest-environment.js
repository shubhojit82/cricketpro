const NodeEnvModule = require('jest-environment-node');
const NodeEnvironment = NodeEnvModule.TestEnvironment || NodeEnvModule.default || NodeEnvModule;

class CustomEnvironment extends NodeEnvironment {
  async teardown() {
    // Attempt graceful resource cleanup before the worker exits.
    try {
      // Lazy-require the package database helper and call disconnect.
      // Use require at runtime to avoid importing at module load.
      // eslint-disable-next-line global-require
      const db = require('../../../packages/database/src/index');
      if (db && typeof db.disconnectPrisma === 'function') {
        // best-effort disconnect
        // eslint-disable-next-line no-await-in-loop
        await db.disconnectPrisma().catch(() => {});
      }
    } catch (e) {
      // swallow to avoid interfering with Jest teardown
    }

    await super.teardown();
  }
}

module.exports = CustomEnvironment;
