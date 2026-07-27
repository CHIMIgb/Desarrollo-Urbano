import purgecss from '@fullhuman/postcss-purgecss';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  plugins: [
    purgecss({
      content: [
        resolve(__dirname, 'index.html'),
        resolve(__dirname, 'src/**/*.js'),
      ],
      safelist: {
        standard: [
          'active', 'hidden', 'collapsed', 'open', 'dismissing',
          'loading', 'dirty', 'disabled', 'pulse', 'violation',
          'no-terrain', 'panel-toggle-btn',
        ],
        deep: [
          /^toast/, /^modal/, /^search/, /^tool-/,
          /^layer/, /^stat/, /^draw/, /^maplibre/,
          /^ls-/, /^lot-/, /^project/, /^prec/,
        ],
      },
      defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || [],
    }),
  ],
};
