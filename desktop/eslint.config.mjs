import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules,
      'react-refresh/only-export-components': [
        'error',
        {
          allowConstantExport: true,
          allowExportNames: [
            'useDiagnostics',
            'useSidebar',
            'badgeVariants',
            'buttonVariants',
            'tabsListVariants',
            'toggleVariants'
          ]
        }
      ]
    }
  },
  {
    // JavaScript modules cannot express TypeScript return annotations; keep
    // explicit return-type enforcement focused on typed source files.
    files: ['**/*.mjs'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },
  eslintConfigPrettier,
  {
    // Guard: pane engines are accessed only through the EngineView interface.
    // Direct .webContents property access on engine objects is prohibited here
    // because getEngine() returns EngineView (which does not expose webContents).
    // This rule catches any future attempt to re-introduce a raw reach-around.
    files: ['src/main/pane-manager.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='webContents'][object.name!='mainWindow']",
          message:
            'Reach-around forbidden: access engine capabilities through the EngineView interface, not raw webContents.'
        }
      ]
    }
  }
)
