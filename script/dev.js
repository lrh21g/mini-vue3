/* eslint-disable no-console */

import { resolve } from 'node:path'
import process from 'node:process'
import { build } from 'esbuild'
import minimist from 'minimist'

// 获取执行命令的参数
const args = minimist(process.argv.slice(2)) // 前两个参数是执行的命令： node script/dev.js
const target = args._[0] || 'reactivity' // 默认打包 reactivity
const format = args.f || 'global' // 默认打包 reactivity

const pkg = require(resolve(__dirname, `../packages/${target}/package.json`))
const options = pkg.buildOptions // package.json 中的自定义的配置

const outputConfig = {
  esm: {
    file: resolve(__dirname, `../packages/${target}/dist/${target}.esm-bundler.js`),
    format: 'es',
  },
  cjs: {
    file: resolve(__dirname, `../packages/${target}/dist/${target}.cjs.js`),
    format: 'cjs',
  },
  global: {
    file: resolve(__dirname, `../packages/${target}/dist/${target}.global.js`),
    format: 'iife', // 立即执行函数
  },
}

const outputFormat = outputConfig[format].format
const outfile = outputConfig[format].file

console.log('当前打包模块:', target)

build({
  entryPoints: [resolve(__dirname, `../packages/${target}/src/index.ts`)], // 打包入口
  outfile,
  bundle: true, // 是否全部打包到一起
  sourcemap: true,
  format: outputFormat,
  globalName: options.name,
  platform: outputFormat === 'cjs' ? 'node' : 'browser',
  watch: {
    onRebuild(error) {
      if (!error)
        console.log('rebuild....', target)
    },
  },
}).then((_res) => {
  console.log('watching....', target)
})
