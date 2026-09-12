import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'public/mockServiceWorker.js', 'review']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  { files: ['e2e/**/*fixture.tsx'], rules: { 'react-refresh/only-export-components': 'off' } },
  {
    files: ['src/components/club/ClubMessageModal.tsx', 'src/components/schedule/CalendarTutorial.tsx', 'src/components/workspace/helpers.tsx', 'src/context/AuthContext.tsx'],
    rules: { 'react-refresh/only-export-components': ['error', { allowConstantExport: true, allowExportNames: ['buildClubCommunicationOptions', 'openClubCommunication', 'isTutorialCompleted', 'avatarLetter', 'formatMetaTime', 'useAuth'] }] },
  },
])
