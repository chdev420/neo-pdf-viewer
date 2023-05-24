const { merge } = require('webpack-merge')
const CopyPlugin = require('copy-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const { VueLoaderPlugin } = require('vue-loader-next')

const commonConfig = {
  resolve: {
    symlinks: false,
    alias: {
      vue: 'vue'
    }
  },
  mode: 'production',
  entry: './src/index.js',
  output: {
    library: {
      name: 'neo-pdf-viewer',
      type: 'umd',
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader-next',
        // options: {
        //   compilerOptions: {
        //     compatConfig: {
        //       MODE: 2
        //     }
        //   }
        // }
      },
      {
        test: /\.s?css$/,
        use: ['vue-style-loader', 'css-loader', 'sass-loader'],
      },
      {
        test: /\.worker\.js$/,
        loader: 'worker-loader',
        options: {
          inline: 'no-fallback',
        },
      },
    ],
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        terserOptions: {
          format: {
            comments: false,
          },
        },
      }),
    ],
  },
  externals: {
    vue: 'vue'
  },
  performance: {
    hints: false,
  },
}

module.exports = [
  merge(commonConfig, {
    output: {
      filename: 'neo-pdf-viewer.js',
    },
    plugins: [
      new VueLoaderPlugin(),
      new CopyPlugin({ patterns: [{ from: 'types' }] }),
    ],
  }),
]
