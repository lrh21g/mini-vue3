import path from 'node:path'
import process from 'node:process'
import json from '@rollup/plugin-json'
import resolvePlugin from '@rollup/plugin-node-resolve'
import ts from 'rollup-plugin-typescript2'

// 根据环境变量中的 target 属性，获取对应模块中的 package.json
const packagesDir = path.resolve(__dirname, 'packages')
const packageDir = path.resolve(packagesDir, process.env.TARGET)

const resolve = p => path.resolve(packageDir, p)

// 找到 package.json 文件
const pkg = require(resolve('package.json'))

const name = path.basename(packageDir)

// 打包类型映射表：根据每个包提供给的 formats 进行格式化需要打包的内容
const outputConfig = {
  'esm-bundler': {
    file: resolve(`dist/${name}.esm-bundler.js`),
    format: 'es',
  },
  'cjs': {
    file: resolve(`dist/${name}.cjs.js`),
    format: 'cjs',
  },
  'global': {
    file: resolve(`dist/${name}.global.js`),
    format: 'iife', // 立即执行函数
  },
}

const options = pkg.buildOptions // package.json中的自定义的配置

function createConfig(format, output) {
  output.name = options.name
  output.sourcemap = true // 生成 sourcemap

  // 生成 rollup 配置
  return {
    input: resolve(`src/index.ts`),
    output,
    plugins: [
      json(),
      ts(
        {
          tsconfig: path.resolve(__dirname, 'tsconfig.json'),
        },
      ),
      resolvePlugin(), // 解析第三方插件模块
    ],
  }
}

export default options.formats.map(format => createConfig(format, outputConfig[format]))
