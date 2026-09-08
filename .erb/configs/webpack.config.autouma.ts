import path from 'path';
import webpack from 'webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import webpackPaths from './webpack.paths';

const root = webpackPaths.rootPath;
const autoUmaPath = path.join(webpackPaths.distPath, 'autouma');
const mobilePath = path.join(root, 'src', 'autouma', 'mobile');

const configuration: webpack.Configuration = {
  mode: 'production',
  target: 'web',
  stats: 'errors-warnings',
  entry: path.join(root, 'src', 'autouma', 'index.tsx'),
  output: {
    path: autoUmaPath,
    publicPath: './',
    filename: 'autouma.js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            compilerOptions: {
              module: 'nodenext',
              moduleResolution: 'nodenext',
            },
          },
        },
      },
      {
        test: /\.s?(a|c)ss$/,
        include: /\.module\.s?(c|a)ss$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: { modules: true, importLoaders: 1 },
          },
          'sass-loader',
        ],
      },
      {
        test: /\.s?(a|c)ss$/,
        exclude: /\.module\.s?(c|a)ss$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'sass-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [require('tailwindcss'), require('autoprefixer')],
              },
            },
          },
        ],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf|png|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.svg$/,
        use: [
          {
            loader: '@svgr/webpack',
            options: { prettier: false, svgo: false, titleProp: true, ref: true },
          },
          'file-loader',
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    modules: [webpackPaths.srcPath, 'node_modules'],
    plugins: [new TsconfigPathsPlugin()],
    alias: {
      'better-sqlite3$': path.join(mobilePath, 'database.ts'),
      'electron$': path.join(mobilePath, 'electronShim.ts'),
      'electron-log$': path.join(mobilePath, 'logShim.ts'),
      'fs$': path.join(mobilePath, 'fsShim.ts'),
      'main/handle/AutoResearchLocalGameClient$': path.join(
        mobilePath,
        'localGame.ts',
      ),
    },
    fallback: {
      buffer: require.resolve('buffer/'),
      crypto: require.resolve('crypto-browserify'),
      path: require.resolve('path-browserify'),
      process: require.resolve('process/browser'),
      stream: require.resolve('stream-browserify'),
      url: false,
      vm: false,
    },
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin(), new CssMinimizerPlugin()],
  },
  plugins: [
    new webpack.EnvironmentPlugin({ NODE_ENV: 'production' }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
    new MiniCssExtractPlugin({ filename: 'style.css' }),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.join(root, 'src', 'autouma', 'index.ejs'),
      minify: {
        collapseWhitespace: true,
        removeComments: true,
      },
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: path.join(root, 'master.mdb'), to: 'master.mdb' },
        {
          from: path.join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
          to: 'sql-wasm.wasm',
        },
        { from: path.join(root, 'assets', 'data'), to: 'data' },
        { from: path.join(root, 'assets', 'chr_icon'), to: 'chr_icon' },
        { from: path.join(root, 'assets', 'skill_icons'), to: 'skill_icons' },
        {
          from: path.join(root, 'assets', 'support_card_s'),
          to: 'support_card_s',
        },
        {
          from: path.join(root, 'assets', 'trained_chr_icon'),
          to: 'trained_chr_icon',
        },
        { from: path.join(root, 'web-assets'), to: '.' },
      ],
    }),
  ],
};

export default configuration;
