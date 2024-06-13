import handler from '../lib/handler'

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handler(request)
  },
}
