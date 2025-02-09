import { createVNode } from './vnode'

export function createAppAPI(render, hydrate?) {
  return (rootComponent, rootProps) => {
    let isMounted = false

    const app = {
      _component: rootComponent,
      _props: rootProps,
      _context: null,
      _container: null,
      mount(container, isHydrate?: boolean) {
        if (!isMounted) {
          const vnode = createVNode(rootComponent, rootProps)

          if (isHydrate) {
            hydrate(vnode, container)
          }
          else {
            render(vnode, container)
          }

          isMounted = true
          app._container = container
        }
      },
      use() { },
      directive() { },
      unmount() { },
      component() { },
      mixin() { },
      install() { },
    }
    return app
  }
}
