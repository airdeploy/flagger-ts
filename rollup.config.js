import replace from '@rollup/plugin-replace'
import pkg from './package.json'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import {terser} from 'rollup-plugin-terser'
import builtins from 'rollup-plugin-node-builtins'
import globals from 'rollup-plugin-node-globals'

// Browser-friendly UMD build target
export default [
  {
    input: 'temp/index.js',
    output: {
      name: 'Flagger',
      file: 'dist/index.umd.js',
      format: 'umd',
      globals: {
        axios: 'axios',
        'axios-retry': 'axiosRetry',
        eventsource: 'EventSource',
        md5: 'md5',
        uuid: 'uuid'
      },
      exports: 'named'
    },
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: true
      }), // so Rollup can find `axios`
      commonjs({
        include: 'node_modules/**'
      }),
      replace({
        __SDK_NAME__: 'js',
        __VERSION__: pkg.version
      }),
      globals(),
      terser({compress: {reduce_funcs: false}}),
      builtins()
    ]
  },
  //CommonJS
  {
    input: 'temp/index.js',
    output: {file: 'dist/index.cjs.js', format: 'cjs', exports: 'named'},
    external: [...Object.keys(pkg.dependencies || {})],
    plugins: [
      commonjs({
        include: 'node_modules/**'
      }),
      replace({
        __SDK_NAME__: 'nodejs',
        __VERSION__: pkg.version
      })
    ]
  },
  // ES
  {
    input: 'temp/index.js',
    external: [...Object.keys(pkg.dependencies || {})],
    plugins: [
      replace({
        __SDK_NAME__: 'nodejs',
        __VERSION__: pkg.version
      })
    ],
    output: {file: pkg.module, format: 'es', exports: 'named'}
  }
]
