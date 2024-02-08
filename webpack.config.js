const {resolve} = require('path');
const webpack = require('webpack');
const ESLintPlugin = require('eslint-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const devKeys = require('../credentials/keys-dev.json');
const prodKeys = require('../credentials/keys-prod.json');
const electronKeys = require('../credentials/keys-electron.json');
const packageJson = require('./package.json');

module.exports = (env) => {
    const {mode = 'production', target = 'web'} = env;
    const __dev__ = mode === 'development';
    const __electron__ = target === 'electron';
    const wwwDir = resolve(__dirname, __dev__ ? 'www-dev' : __electron__ ? 'www-electron' : 'www');
    const keys = __dev__ ? devKeys : __electron__ ? electronKeys : prodKeys;

    return {
        entry: {
            'lib/butterchurn': 'butterchurn',
            'lib/unidecode': 'unidecode',
            'lib/vendors': [
                '@ctrl/tinycolor',
                'audiomotion-analyzer',
                'colorjs.io',
                'colorthief',
                'd3-array',
                'd3-interpolate',
                'd3-scale',
                'detect-browser',
                'dexie',
                'libs/dialog-polyfill',
                'fullscreen-api-polyfill',
                'jsfft',
                'md5',
                'react',
                'react-dom',
                'react-error-boundary',
                'spotify-web-api-js',
                'string-score',
                'youtube-player',
            ],
            bundle: {
                import: './src/index.tsx',
                dependOn: ['lib/butterchurn', 'lib/unidecode', 'lib/vendors'],
            },
        },
        output: {
            chunkFilename: 'lib/[name].js',
            path: __electron__ ? wwwDir : `${wwwDir}/v${packageJson.version}`,
        },
        optimization: {
            runtimeChunk: 'single',
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
                {
                    test: /\.s?css$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        {
                            loader: 'css-loader',
                        },
                        {
                            loader: 'sass-loader',
                        },
                        {
                            loader: 'postcss-loader',
                        },
                    ],
                },
                {
                    test: /\.frag$/,
                    type: 'asset/source',
                },
            ],
        },
        plugins: [
            new ESLintPlugin({
                extensions: ['.tsx', '.ts'],
            }),
            new MiniCssExtractPlugin({
                filename: 'bundle.css',
            }),
            new webpack.ProvidePlugin({
                Buffer: ['buffer', 'Buffer'],
            }),
            new webpack.ProvidePlugin({
                process: 'process/browser',
            }),
            new webpack.DefinePlugin({
                __dev__,
                __app_name__: JSON.stringify(packageJson.name),
                __app_version__: JSON.stringify(packageJson.version),
                __app_contact__: JSON.stringify(packageJson.author.email),
                __am_dev_token__: JSON.stringify(keys.am_dev_token),
                __lf_api_key__: JSON.stringify(keys.lf_api_key),
                __lf_api_secret__: JSON.stringify(keys.lf_api_secret),
                __sp_client_id__: JSON.stringify(keys.sp_client_id),
                __yt_api_key__: JSON.stringify(keys.yt_api_key),
                __yt_client_id__: JSON.stringify(keys.yt_client_id),
            }),
            new CopyPlugin({
                patterns: [
                    {
                        from: './src/html/index.html',
                        to: wwwDir,
                        transform(content) {
                            return String(content).replace(
                                /%version%/g,
                                __electron__ ? '' : `/v${packageJson.version}`
                            );
                        },
                    },
                ],
            }),
            __dev__ || __electron__
                ? undefined
                : new CopyPlugin({
                      patterns: [
                          {
                              from: './src/html/privacy-policy.html',
                              to: wwwDir,
                          },
                      ],
                  }),
            __dev__ || __electron__
                ? undefined
                : new CopyPlugin({
                      patterns: [
                          {
                              from: './src/service-worker.js',
                              to: wwwDir,
                              transform(content) {
                                  return String(content)
                                      .replace('%appName%', packageJson.name)
                                      .replace('%appVersion%', packageJson.version);
                              },
                          },
                      ],
                  }),
            ,
        ],
        resolve: {
            alias: {
                assets: resolve(__dirname, 'src/assets/'),
                components: resolve(__dirname, 'src/components/'),
                hooks: resolve(__dirname, 'src/hooks/'),
                services: resolve(__dirname, 'src/services/'),
                styles: resolve(__dirname, 'src/styles/'),
                types: resolve(__dirname, 'src/types/'),
                utils: resolve(__dirname, 'src/utils/'),
                libs: resolve(__dirname, 'libs/'),
            },
            extensions: ['.tsx', '.ts', '.js'],
        },
        stats: {
            builtAt: true,
        },
        mode,
    };
};
