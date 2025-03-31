import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  pluginJs.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
);
