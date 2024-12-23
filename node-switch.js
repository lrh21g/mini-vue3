const { execSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')

if (fs.existsSync('.nvmrc')) {
  const nvmrcContent = fs.readFileSync('.nvmrc', 'utf8').trim()
  const nvmVersion
    = os.platform() === 'win32'
      ? execSync('type .nvmrc', { encoding: 'utf8' }).trim()
      : nvmrcContent
  try {
    execSync(`nvm use ${nvmVersion}`, { stdio: 'inherit' })
    // eslint-disable-next-line no-console
    console.log('\x1B[32m%s\x1B[0m', 'Node.js 版本切换成功')
  }
  // eslint-disable-next-line unused-imports/no-unused-vars
  catch (error) {
    console.error(
      '\x1B[31m%s\x1B[0m',
      'Node.js 版本切换失败 Check installation nvm',
    )
  }
}
else {
  console.error('\x1B[31m%s\x1B[0m', '.nvmrc 文件不存在')
}
