// cz-git docs : https://cz-git.qbb.sh/zh/

const fs = require('node:fs')
const path = require('node:path')

const packages = fs.readdirSync(path.resolve(__dirname, 'packages'))

/** @type { import('cz-git').UserConfig } */
module.exports = {
  ignores: [commit => commit.includes('init')],
  // 继承的规则
  extends: ['@commitlint/config-conventional'],
  // 定义规则类型
  // @see: https://commitlint.js.org/#/reference-rules
  rules: {
    // body 开头空行
    'body-leading-blank': [2, 'always'],
    // footer 开头空行
    'footer-leading-blank': [1, 'always'],
    // header 最大内容长度
    'header-max-length': [2, 'always', 108],
    // subject 是否允许为空
    'subject-empty': [2, 'never'],
    // type 是否允许空
    'type-empty': [2, 'never'],
    // type 类型定义，表示 git 提交的 type 必须在以下类型范围内
    'type-enum': [
      2,
      'always',
      [
        'feat', // 新增功能
        'fix', // 修复 bug
        'docs', // 文档变更
        'style', // 代码格式（不影响功能，例如空格、分号等格式修正）
        'refactor', // 代码重构（不包括 bug 修复、功能新增）
        'perf', // 性能优化
        'test', // 添加、修改测试用例
        'build', // 构建流程、外部依赖变更（如升级 npm 包、修改 webpack 配置等
        'ci', // 修改 CI 配置、脚本
        'chore', // 对构建过程或辅助工具和库的更改（不影响源文件、测试用例
        'revert', // 回滚 commit
      ],
    ],
  },
  prompt: {
    // 自定义命令行提问信息
    messages: {
      type: '选择你要提交的类型 :',
      scope: '选择一个提交范围（可选）:',
      customScope: '请输入自定义的提交范围 :',
      subject: '填写简短精炼的变更描述 :\n',
      body: '填写更加详细的变更描述（可选）。使用 "|" 换行 :\n',
      breaking: '列举非兼容性重大的变更（可选）。使用 "|" 换行 :\n',
      footerPrefixesSelect: '选择关联 issues 前缀（可选）:',
      customFooterPrefix: '输入自定义 issues 前缀 :',
      footer: '列举关联 issues (可选) 例如: #31, #I3244 :\n',
      confirmCommit: '是否提交或修改 commit ?',
    },
    // 自定义选择类型提示
    types: [
      { value: 'feat', name: 'feat:     ✨ 新增功能 | A new feature' },
      { value: 'fix', name: 'fix:      🐛 修复缺陷 | A bug fix' },
      { value: 'docs', name: 'docs:     📝 文档更新 | Documentation only changes' },
      { value: 'style', name: 'style:    💄 代码格式 | Changes that do not affect the meaning of the code' },
      { value: 'refactor', name: 'refactor: 📦 代码重构 | A code change that neither fixes a bug nor adds a feature' },
      { value: 'perf', name: 'perf:     🚀 性能提升 | A code change that improves performance' },
      { value: 'test', name: 'test:     🚨 测试相关 | Adding missing tests or correcting existing tests' },
      { value: 'build', name: 'build:    👷 构建相关 | Changes that affect the build system or external dependencies' },
      { value: 'ci', name: 'ci:       ⚙️  持续集成 | Changes to our CI configuration files and scripts' },
      { value: 'revert', name: 'revert:   ⏪ 回退代码 | Revert to a commit' },
      { value: 'chore', name: 'chore:    ♻️  其他修改 | Other changes that do not modify src or test files' },
    ],
    // 是否开启 commit message 带有 Emoji 字符
    useEmoji: false,
    // 设置 Emoji 字符 的位于头部位置（"left" | "center" （默认） | "right"）
    emojiAlign: 'center',
    // 是否使用 OpenAI API 自动生成提交信息 subject 简短描述
    useAI: false,
    // 如果大于 1 ，则会让 OpenAI 返回指定的多个选项，并开启选择模式
    aiNumber: 1,
    // 设置终端交互部件的主题色（默认为 "" (cyan 青色)）
    themeColorCode: '',
    // 自定义选择模块范围命令行显示信息
    scopes: [...packages],
    // 是否开启在选择模块范围时使用多选模式（默认 : false）
    // enableMultipleScopes: true,
    // 在多选模式下模块范围之间的分隔符（默认 : ","）
    // scopeEnumSeparator: ",",
    // 是否在选择模块范围显示自定义选项(custom)
    allowCustomScopes: true,
    // 是否在选择模块范围显示为空选项(empty)
    allowEmptyScopes: true,
    // 设置选择范围中为 空选项(empty) 和 自定义选项(custom) 的位置
    customScopesAlign: 'bottom',
    // 自定义选择范围中 自定义选项(custom) 在命令行中显示的名称
    customScopesAlias: 'custom',
    // 自定义选择范围中 空选项(empty) 在命令行中显示的名称
    emptyScopesAlias: 'empty',
    // 是否自动将简短描述(subject)第一个字符进行大写处理
    upperCaseSubject: false,
    // 添加额外的问题重大变更(BREAKING CHANGES)提问，询问是否需要添加 "!" 标识于头部
    markBreakingChangeMode: false,
    // 允许出现重大变更(BREAKING CHANGES)的特定 type
    allowBreakingChanges: ['feat', 'fix'],
    // 详细描述(body)和重大变更(BREAKING CHANGES)中根据字符超过该数值自动换行
    breaklineNumber: 100,
    // 详细描述(body)和重大变更(BREAKING CHANGES)中换行字符
    breaklineChar: '|',
    skipQuestions: [],
    // 自定义选择 issue 前缀
    issuePrefixes: [
      // 如果使用 gitee 作为开发管理
      { value: 'link', name: 'link:     链接 ISSUES 进行中' },
      { value: 'closed', name: 'closed:   标记 ISSUES 已完成' },
    ],
    // 设置选择 issue 前缀中 跳过选项(skip) 和 自定义选项(custom) 的位置（"top" （默认） | "bottom" | "top-bottom" | "bottom-top"）
    customIssuePrefixAlign: 'top',
    // 自定义选择 issue 前缀中 跳过选项(skip) 在命令行中显示的名称（默认 : "skip"）
    emptyIssuePrefixAlias: 'skip',
    // 自定义选择 issue 前缀中 自定义选项(custom) 在命令行中显示的名称（默认 : "custom"）
    customIssuePrefixAlias: 'custom',
    // 是否在选择 issue 前缀 显示自定义选项(custom)
    allowCustomIssuePrefix: true,
    // 是否在选择 issue 前缀 显示为跳过选项(skip)
    allowEmptyIssuePrefix: true,
    // 确定提交中模板 commit message 是否着色
    confirmColorize: true,
    // 自定义选择了特定类型后覆盖模块范围命令行显示信息
    scopeOverrides: undefined,
    // 在 详细描述 中是否使用显示默认值
    defaultBody: '',
    // 在 输入ISSUE 中是否使用显示默认值
    defaultIssues: '',
    // 如果 defaultScope 与 scopes 选择范围列表项中的 value 相匹配就会进行星标置顶操作
    defaultScope: '',
    // 在 简短描述 中是否使用显示默认值
    defaultSubject: '',
  },
}
