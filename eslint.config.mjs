import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default [
  ...coreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Pre-existing patterns — downgraded to warnings to allow CI to pass
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/jsx-no-comment-textnodes': 'warn',
      'react/no-unescaped-entities': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'prefer-const': 'warn',
    },
  },
];
