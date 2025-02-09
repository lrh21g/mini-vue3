// 存储待执行的更新任务
const queue: any[] = []

// 微任务触发器
const p = Promise.resolve()
// 标识是否已调度队列，避免重复调度微任务
let isFlushPending = false

// 将回调函数 fn 推入微任务队列，等待当前同步代码执行完毕后执行
export function nextTick(fn) {
  return fn ? p.then(fn) : p
}

// 任务队列刷新：清空任务队列，依次执行所有任务
function flushJobs() {
  isFlushPending = false
  let job
  // eslint-disable-next-line no-cond-assign
  while ((job = queue.shift())) {
    if (job) {
      job()
    }
  }
}

// 通过 nextTick 将 flushJobs 推入微任务队列，确保在一次事件循环中只调度一次队列刷新。
function queueFlush() {
  if (isFlushPending)
    return
  isFlushPending = true
  nextTick(flushJobs)
}

// 将任务（如组件更新函数）加入队列，若队列中已存在相同任务则跳过（去重）
// 合并同一组件的多次更新为一次，减少不必要的渲染和计算
export function queueJob(job) {
  if (!queue.includes(job)) {
    queue.push(job)
  }
  queueFlush()
}
