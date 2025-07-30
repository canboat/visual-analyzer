const HtmlWebpackPlugin = require('html-webpack-plugin')
const path = require('path')

const { ModuleFederationPlugin } = require('webpack').container
const { WatchIgnorePlugin, ProvidePlugin } = require('webpack')
const webpack = require('webpack')

const packageJson = require('./package')

module.exports = {
  entry: './src/index',
  mode: 'development',
  devtool: 'source-map',
  optimization: {
    minimize: false,
    usedExports: false,
    sideEffects: false
  },
  output: {
    path: path.resolve(__dirname, 'public'),
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      'react': path.resolve(__dirname, 'node_modules/react/cjs/react.development.js'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom/cjs/react-dom.development.js')
    },
    fallback: {
      buffer: require.resolve('buffer/'),
    },
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        options: {
          presets: ['@babel/preset-react'],
        },
      },
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        loader: 'file-loader',
        options: {
          name: '[path][name].[ext]',
        },
      },
    ],
  },
  plugins: [
    // Use Plugin
    new ModuleFederationPlugin({
      name: 'Addon Demo',
      library: { type: 'var', name: packageJson.name.replace(/[-@/]/g, '_') },
      filename: 'remoteEntry.js',
      exposes: {
        './AppPanel': './src/components/AppPanel',
      },
      shared: {
        react: { 
          singleton: true,
          requiredVersion: require('./package.json').devDependencies.react,
          eager: true
        }, 
        'react-dom': {
          singleton: true,
          requiredVersion: require('./package.json').devDependencies['react-dom'],
          eager: true
        }
      },
    }),
    new WatchIgnorePlugin({
      paths: [path.resolve(__dirname, 'public/')],
    }),
    new HtmlWebpackPlugin({
      template: './public_src/index.html',
    }),
    new ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
}
