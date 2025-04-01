import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  pluginJs.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  {
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    },
  },
  eslintConfigPrettier,
);
