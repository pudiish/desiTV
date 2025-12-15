export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    // CSS optimization plugins (install: npm install -D cssnano postcss-combine-duplicated-selectors postcss-combine-media-query)
    // Uncomment after installing:
    // 'postcss-combine-duplicated-selectors': {},
    // 'postcss-combine-media-query': {},
    // cssnano: {
    //   preset: ['default', {
    //     discardComments: { removeAll: true },
    //     normalizeWhitespace: true,
    //     minifyFontValues: true,
    //     minifySelectors: true,
    //   }]
    // },
  },
}

