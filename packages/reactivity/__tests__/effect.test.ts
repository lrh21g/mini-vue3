import { effect, stop } from '../src/effect'
import { reactive } from '../src/reactive'

describe('reactivity/effect', () => {
  it('should observe basic properties', () => {
    let dummy
    const counter = reactive({ num: 0 })

    effect(() => dummy = counter.num)
    expect(dummy).toBe(0)

    counter.num = 7
    expect(dummy).toBe(7)
  })

  it('should return runner when call effect', () => {
    let foo = 0
    const runner: any = effect(() => {
      foo++
      return 'foo'
    })

    expect(foo).toBe(1)
    runner()
    expect(foo).toBe(2)
    expect(runner()).toBe('foo')
  })

  it('scheduler', () => {
    let dummy
    let run: any
    const scheduler = vi.fn(() => {
      // eslint-disable-next-line ts/no-use-before-define
      run = runner
    })
    const obj = reactive({ foo: 1 })
    const runner = effect(
      () => {
        dummy = obj.foo
      },
      { scheduler },
    )
    expect(scheduler).not.toHaveBeenCalled()
    expect(dummy).toBe(1)
    // should be called on first trigger
    obj.foo++
    expect(scheduler).toHaveBeenCalledTimes(1)
    // should not run yet
    expect(dummy).toBe(1)
    // manually run
    run()
    // should have run
    expect(dummy).toBe(2)
  })

  it('stop', () => {
    let dummy
    const obj = reactive({ prop: 1 })
    const runner = effect(() => {
      dummy = obj.prop
    })
    obj.prop = 2
    expect(dummy).toBe(2)
    stop(runner)
    // obj.prop = 3
    obj.prop++
    expect(dummy).toBe(2)

    // stopped effect should still be manually callable
    runner()
    expect(dummy).toBe(3)
  })
})
