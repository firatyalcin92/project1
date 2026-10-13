import { createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import { DefaultCatchBoundary, NotFound } from './components/boundaries'

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5_000,
        retry: (failureCount, error) => {
          // Yetki hatalarında tekrar denemenin anlamı yok.
          if (error instanceof Error && /UNAUTHORIZED|NOT_FOUND/.test(error.message)) return false
          return failureCount < 2
        },
        refetchOnWindowFocus: true,
      },
    },
  })

  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: NotFound,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
